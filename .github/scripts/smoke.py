"""Exercise a built image with isolated, disposable CI databases."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request


def docker(*args, **kwargs):
    return subprocess.run(["docker", *args], check=True, **kwargs)


def request(base, path, payload=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(base + path, data=data, headers=headers)
    with urllib.request.urlopen(req, timeout=10) as response:
        body = json.load(response)
    if body.get("code") != 0:
        raise RuntimeError("Unexpected API response: " + path)
    return body["data"]


def wait_database(name, command):
    for _ in range(60):
        result = subprocess.run(["docker", "exec", name, *command], capture_output=True)
        if result.returncode == 0:
            return
        time.sleep(1)
    raise RuntimeError("Disposable test database did not become ready")


def main(image):
    prefix = "admin-ci-" + secrets.token_hex(5)
    pg, redis, app = (prefix + suffix for suffix in ("-pg", "-redis", "-app"))
    containers = []
    created_network = False
    try:
        docker("network", "create", prefix, stdout=subprocess.DEVNULL)
        created_network = True
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            password = secrets.token_hex(24)
            env = folder / "postgres.env"
            env.write_text(f"POSTGRES_USER=ci_user\nPOSTGRES_DB=ci_test\nPOSTGRES_PASSWORD={password}\n", encoding="utf-8")
            env.chmod(0o600)
            docker("run", "-d", "--name", pg, "--network", prefix, "--env-file", str(env), "postgres:16-alpine", stdout=subprocess.DEVNULL)
            containers.append(pg)
            docker("run", "-d", "--name", redis, "--network", prefix, "redis:7-alpine", stdout=subprocess.DEVNULL)
            containers.append(redis)
            wait_database(pg, ["pg_isready", "-U", "ci_user", "-d", "ci_test"])
            wait_database(redis, ["redis-cli", "ping"])
            values = {
                "APP_ENV": "test", "APP_PORT": "3000", "APP_PREFIX": "api", "RUN_MIGRATIONS": "true",
                "DB_HOST": pg, "DB_PORT": "5432", "DB_USERNAME": "ci_user", "DB_NAME": "ci_test", "DB_PASSWORD": password,
                "REDIS_HOST": redis, "REDIS_PORT": "6379", "JWT_ACCESS_SECRET": secrets.token_hex(32),
                "JWT_REFRESH_SECRET": secrets.token_hex(32), "CORS_ORIGINS": "http://127.0.0.1",
            }
            env = folder / "app.env"
            env.write_text("".join(f"{key}={value}\n" for key, value in values.items()), encoding="utf-8")
            env.chmod(0o600)
            docker("run", "-d", "--name", app, "--network", prefix, "--env-file", str(env), "-p", "127.0.0.1::3000", image, stdout=subprocess.DEVNULL)
            containers.append(app)
            binding = docker("port", app, "3000/tcp", capture_output=True, text=True).stdout.strip().splitlines()[0]
            base = "http://" + binding
            for _ in range(90):
                try:
                    if request(base, "/health")["status"] == "ok":
                        break
                except (OSError, ValueError, RuntimeError, KeyError):
                    time.sleep(1)
            else:
                raise RuntimeError("Backend image did not become healthy; check migration/startup")
            credentials = {"email": prefix + "@example.test", "password": "Ci1!" + secrets.token_hex(16)}
            request(base, "/api/auth/register", credentials)
            tokens = request(base, "/api/auth/login", credentials)
            info = request(base, "/api/users/info", token=tokens["accessToken"])
            if not isinstance(info, dict):
                raise RuntimeError("User information endpoint returned an invalid result")
            print("Image smoke test passed: migrations, health, registration, login, PostgreSQL and Redis-backed user info.")
    finally:
        for name in reversed(containers):
            subprocess.run(["docker", "rm", "-f", "-v", name], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if created_network:
            subprocess.run(["docker", "network", "rm", prefix], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


if __name__ == "__main__":
    if len(sys.argv) != 2 or not sys.argv[1] or sys.argv[1].startswith("-"):
        raise SystemExit("Usage: smoke.py LOCAL_IMAGE")
    try:
        main(sys.argv[1])
    except Exception:
        print("Isolated image smoke test failed; no production resources were used.", file=sys.stderr)
        raise SystemExit(1)
