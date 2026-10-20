#!/usr/bin/env python3
"""Small, fail-closed deployment CLI for the admin-system-test Compose project."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request


PROJECT = "admin-system-test"
IMAGE_KEYS = {"backend": "BACKEND_IMAGE", "frontend": "FRONTEND_IMAGE"}
CONFIG_KEYS = {"BACKEND_REPOSITORY", "FRONTEND_REPOSITORY", "DB_USERNAME", "DB_NAME", "DB_PASSWORD", "REDIS_PASSWORD", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "CORS_ORIGINS"}
# GHCR owner is a GitHub login; path segments follow a conservative OCI subset.
REPOSITORY = re.compile(r"ghcr\.io/[a-z0-9]+(?:-[a-z0-9]+)*/[a-z0-9]+(?:[._-][a-z0-9]+)*(?:/[a-z0-9]+(?:[._-][a-z0-9]+)*)*")
DIGEST = re.compile(r"[0-9a-f]{64}")


class DeployError(Exception):
    """An operational failure whose message is safe for CI logs."""


def validate_image(image, repository):
    if not REPOSITORY.fullmatch(repository):
        raise DeployError("Invalid repository allowlist; use a lowercase ghcr.io/owner/path.")
    name, separator, digest = image.partition("@sha256:")
    if not separator or name != repository or not DIGEST.fullmatch(digest):
        raise DeployError("Image must be the allowlisted repository followed by @sha256:<64 lowercase hex>.")
    return image


def read_env(path):
    """Read literal KEY=value (optionally quoted); never source or expand values."""
    values = {}
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError):
        raise DeployError("Cannot read required environment file.") from None
    for number, line in enumerate(lines, 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key) or key in values or "\x00" in value:
            raise DeployError(f"Invalid environment syntax at line {number}.")
        if value.startswith(("'", '"')):
            if len(value) < 2 or value[-1] != value[0] or value[0] in value[1:-1]:
                raise DeployError(f"Invalid quoted environment value at line {number}.")
            value = value[1:-1]
        values[key] = value
    return values


def atomic_write(path, text):
    """Replace one state file, with private permissions and no partial contents."""
    descriptor, temporary = tempfile.mkstemp(prefix="." + path.name + ".", dir=path.parent)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            os.chmod(temporary, 0o600)
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


@contextmanager
def deployment_lock(root):
    """One non-blocking Linux lock for both repositories; never unlink its inode."""
    try:
        import fcntl
    except ImportError:
        raise DeployError("Deployment requires Linux flock; tests can mock this boundary.") from None
    with open(root / ".deploy.lock", "a+b") as stream:
        os.chmod(root / ".deploy.lock", 0o600)
        try:
            fcntl.flock(stream.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise DeployError("Another deployment or maintenance command holds the deployment lock.") from None
        try:
            yield
        finally:
            fcntl.flock(stream.fileno(), fcntl.LOCK_UN)


def fetch_local(path):
    # Do not send local checks through an inherited HTTP proxy or follow redirects.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    try:
        with opener.open("http://127.0.0.1:8080" + path, timeout=10) as response:
            if response.status != 200:
                raise DeployError("Local HTTP check did not return 200.")
            return response.read(1024 * 1024)
    except (OSError, urllib.error.URLError):
        raise DeployError("Local HTTP request failed; inspect services in a controlled terminal.") from None


class Manager:
    def __init__(self, root, run=None, fetch=None):
        self.root = Path(root).resolve()
        self.run = run or subprocess.run
        self.fetch = fetch or fetch_local
        self.config = {}
        self.wait_timeout = 180

    def load_config(self):
        self.config = read_env(self.root / ".env")
        for component in IMAGE_KEYS:
            repository = self.config.get(component.upper() + "_REPOSITORY", "")
            if not REPOSITORY.fullmatch(repository):
                raise DeployError("Both repository allowlists must be valid lowercase GHCR paths.")
        if set(self.config) != CONFIG_KEYS:
            raise DeployError("Use exactly the settings in .env.example; versions belong in images.env and process overrides are forbidden.")
        if not self.config["CORS_ORIGINS"].strip():
            raise DeployError("Set CORS_ORIGINS explicitly for this test environment.")
        for key in ("DB_USERNAME", "DB_NAME"):
            if not re.fullmatch(r"[a-z][a-z0-9_]{0,62}", self.config.get(key, "")):
                raise DeployError(f"{key} must be a simple lowercase PostgreSQL identifier.")
        for key in ("DB_PASSWORD", "REDIS_PASSWORD", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"):
            value = self.config.get(key, "")
            if len(value) < 32 or value.lower().startswith(("change", "replace")):
                raise DeployError(f"Set a unique random {key} of at least 32 characters in .env.")
        if self.config["JWT_ACCESS_SECRET"] == self.config["JWT_REFRESH_SECRET"]:
            raise DeployError("JWT access and refresh secrets must differ.")
        if not (self.root / "compose.yml").is_file():
            raise DeployError("compose.yml is missing from the deployment directory.")
        os.chmod(self.root / ".env", 0o600)

    def images(self, optional=False):
        if not self.config:
            self.load_config()
        path = self.root / "images.env"
        if optional and not path.exists():
            return {}
        values = read_env(path)
        if set(values) != set(IMAGE_KEYS.values()):
            raise DeployError("images.env must contain exactly BACKEND_IMAGE and FRONTEND_IMAGE; bootstrap first.")
        for component, key in IMAGE_KEYS.items():
            validate_image(values[key], self.config[component.upper() + "_REPOSITORY"])
        return values

    def history(self):
        path = self.root / "release-history.json"
        if not path.exists():
            return []
        try:
            history = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(history, list):
                raise ValueError
            for entry in history:
                if entry["status"] not in ("success", "failed", "in_progress") or entry["component"] not in (*IMAGE_KEYS, "both") or entry["command"] not in ("bootstrap", "deploy", "rollback"):
                    raise ValueError
                for field in ("old", "new", "desired", "last_good"):
                    versions = entry[field]
                    if not isinstance(versions, dict) or set(versions) - set(IMAGE_KEYS.values()):
                        raise ValueError
                    if field == "new" and set(versions) != set(IMAGE_KEYS.values()):
                        raise ValueError
                    for component, key in IMAGE_KEYS.items():
                        if key in versions:
                            validate_image(versions[key], self.config[component.upper() + "_REPOSITORY"])
            return history
        except (OSError, ValueError, TypeError, KeyError, AttributeError, DeployError):
            raise DeployError("Release history is unreadable; inspect it before publishing.") from None

    def save_history(self, history):
        atomic_write(self.root / "release-history.json", json.dumps(history, indent=2) + "\n")

    def last_good(self, history):
        good = {}
        for entry in history:
            if entry.get("status") == "success":
                keys = IMAGE_KEYS.values() if entry["component"] == "both" else [IMAGE_KEYS[entry["component"]]]
                for key in keys:
                    good[key] = entry["new"][key]
        return good

    def docker(self, arguments, *, compose=False, stdout=subprocess.PIPE, timeout=600):
        # Explicit variables beat shell overrides, and --env-file disables implicit
        # Compose dotenv expansion. Values from .env remain literal, including '$'.
        env = {key: os.environ[key] for key in ("PATH", "HOME", "USERPROFILE", "SYSTEMROOT", "WINDIR", "TMP", "TEMP", "TMPDIR", "DOCKER_CONFIG") if key in os.environ}
        command = ["docker"]
        if compose:
            env.update(self.config)
            env.update(self.images())
            command += ["compose", "--project-name", PROJECT, "--project-directory", str(self.root), "--env-file", os.devnull, "-f", str(self.root / "compose.yml")]
        try:
            result = self.run(command + arguments, cwd=self.root, env=env, stdin=subprocess.DEVNULL, stdout=stdout, stderr=subprocess.PIPE, timeout=timeout, check=False)
        except subprocess.TimeoutExpired:
            raise DeployError("Docker command timed out; inspect actual service state before retrying.") from None
        except OSError:
            raise DeployError("Cannot run Docker; verify installation and daemon permissions.") from None
        if result.returncode:
            # Docker can include secrets in diagnostics; never relay stdout/stderr.
            raise DeployError(f"Docker command failed (exit {result.returncode}); inspect logs in a controlled terminal.")
        return result.stdout

    def up(self, *services, recreate=False):
        arguments = ["up", "-d", "--wait", "--wait-timeout", str(self.wait_timeout)]
        if recreate:
            arguments += ["--no-deps", "--force-recreate", "--pull", "never"]
        self.docker(arguments + list(services), compose=True, timeout=self.wait_timeout + 60)

    def check(self):
        try:
            payload = json.loads(self.fetch("/health"))
            health = payload.get("data", payload)
            valid = isinstance(health, dict) and health.get("status") == "ok" and payload.get("code", 0) == 0
            page = self.fetch("/").decode("utf-8").lower()
            if not valid or "<html" not in page or not re.search(r'id=[\"\']app[\"\']', page):
                raise ValueError
        except (ValueError, AttributeError, UnicodeError):
            raise DeployError("HTTP verification failed: expected healthy JSON and the frontend HTML app shell.") from None
        return {"status": "ok", "checks": ["frontend HTML", "proxied /health"]}

    def backup(self):
        self.images()
        folder = self.root / "backups"
        folder.mkdir(mode=0o700, exist_ok=True)
        os.chmod(folder, 0o700)
        descriptor, temporary = tempfile.mkstemp(prefix="postgres-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S-"), suffix=".partial", dir=folder)
        path = Path(temporary)
        try:
            with os.fdopen(descriptor, "wb") as output:
                os.chmod(path, 0o600)
                self.docker(["exec", "-T", "postgres", "pg_dump", "--format=custom", "--no-password", "--username", self.config["DB_USERNAME"], "--dbname", self.config["DB_NAME"]], compose=True, stdout=output)
                output.flush()
                os.fsync(output.fileno())
            if path.stat().st_size == 0:
                raise DeployError("pg_dump produced an empty backup; no services were rebuilt.")
            final = path.with_suffix(".dump")
            os.replace(path, final)
            return {"backup": str(final)}
        finally:
            if path.exists():
                path.unlink()  # Only this attempt's incomplete file; retain every backup.

    def release(self, action, component, new, old):
        history = self.history()
        record = {
            "started_at": datetime.now(timezone.utc).isoformat(),
            "command": action, "component": component,
            "status": "in_progress", "stage": "pull",
            "old": old, "new": new, "desired": old,
            "last_good": self.last_good(history),
        }
        history.append(record)
        self.save_history(history)

        def stage(name):
            record["stage"] = name
            self.save_history(history)

        try:
            components = IMAGE_KEYS if component == "both" else [component]
            for item in components:
                self.docker(["pull", new[IMAGE_KEYS[item]]])
            if component == "backend":
                stage("backup")
                self.backup()
            stage("write_versions")
            atomic_write(self.root / "images.env", "".join(f"{key}={new[key]}\n" for key in IMAGE_KEYS.values()))
            record["desired"] = new
            stage("compose_config")
            self.docker(["config", "--quiet"], compose=True, timeout=30)
            if component == "both":
                stage("base_health")
                self.up("postgres", "redis")
            if component in ("both", "backend"):
                stage("app_health")
                self.up("app", recreate=True)
            stage("web_health")
            self.up("web", recreate=True)
            stage("http_check")
            self.check()
        except (Exception, KeyboardInterrupt):
            record["status"] = "failed"
            record["finished_at"] = datetime.now(timezone.utc).isoformat()
            self.save_history(history)
            raise DeployError(f"Release failed at {record['stage']}; images.env is desired state, NOT proof of running versions. No database rollback was performed; inspect status and controlled logs.") from None
        record["status"] = "success"
        record["stage"] = "complete"
        record["last_good"] = self.last_good(history)
        record["finished_at"] = datetime.now(timezone.utc).isoformat()
        self.save_history(history)
        return record

    def status(self):
        desired = self.images(optional=True)
        history = self.history()
        containers = []
        if desired:
            output = self.docker(["ps", "--all", "--format", "json"], compose=True, timeout=30)
            try:
                text = output.decode("utf-8").strip()
                rows = json.loads(text) if text.startswith("[") else [json.loads(line) for line in text.splitlines()]
                containers = [{key: row.get(key, "") for key in ("Service", "State", "Health", "Image")} for row in rows]
            except (ValueError, AttributeError):
                raise DeployError("Cannot parse Docker Compose service status.") from None
        return {"desired": desired, "last_good": self.last_good(history), "last_release_status": history[-1]["status"] if history else None, "containers": containers, "note": "Desired versions are not a claim about running containers; last_good is per component."}

    def rollback_image(self, component, current):
        for entry in reversed(self.history()):
            if entry.get("status") == "success" and entry.get("component") in (component, "both"):
                candidate = entry["new"][IMAGE_KEYS[component]]
                if candidate != current:
                    return validate_image(candidate, self.config[component.upper() + "_REPOSITORY"])
        raise DeployError("No different previous successful version exists for this component.")

    def seed(self):
        if not sys.stdin.isatty() or not sys.stdout.isatty() or os.environ.get("CI") or os.environ.get("GITHUB_ACTIONS"):
            raise DeployError("Seed is manual-only: use an interactive, controlled terminal, never CI.")
        print("WARNING: seed can print initial credentials and reset role/menu relationships. Use only a controlled terminal; change the initial password before exposure. No schema synchronization will run.", file=sys.stderr, flush=True)
        self.docker(["exec", "-T", "-e", "SEED_SYNCHRONIZE=false", "app", "node", "dist/database/seeds/rbac.seed.js"], compose=True, stdout=None)
        return {"status": "success", "note": "Manual seed finished; protect credentials and change the initial password."}

    def execute(self, action, *, backend=None, frontend=None, component=None, image=None, confirm_schema_compatible=False):
        with deployment_lock(self.root):
            self.load_config()
            if action == "bootstrap":
                if any(entry.get("status") == "success" for entry in self.history()):
                    raise DeployError("Bootstrap is only for first installation; use deploy after a successful release.")
                new = {"BACKEND_IMAGE": validate_image(backend or "", self.config["BACKEND_REPOSITORY"]), "FRONTEND_IMAGE": validate_image(frontend or "", self.config["FRONTEND_REPOSITORY"])}
                return self.release(action, "both", new, self.images(optional=True))
            if action in ("deploy", "rollback"):
                if component not in IMAGE_KEYS:
                    raise DeployError("Choose backend or frontend.")
                if action == "rollback" and component == "backend" and not confirm_schema_compatible:
                    raise DeployError("Backend rollback requires --confirm-schema-compatible; only the application is rolled back, never the database.")
                if not any(entry.get("command") == "bootstrap" and entry.get("status") == "success" for entry in self.history()):
                    raise DeployError("A successful bootstrap is required before component deploy or rollback; retry bootstrap first.")
                old = self.images()
                new = dict(old)
                if action == "rollback":
                    image = self.rollback_image(component, old[IMAGE_KEYS[component]])
                new[IMAGE_KEYS[component]] = validate_image(image or "", self.config[component.upper() + "_REPOSITORY"])
                result = self.release(action, component, new, old)
                if action == "rollback":
                    result["note"] = "Application-only rollback; the database was NOT rolled back."
                return result
            if action == "seed":
                return self.seed()
            if action == "backup":
                return self.backup()
            if action == "check":
                return self.check()
            if action == "status":
                return self.status()
            raise DeployError("Unknown command.")


def main(argv=None):
    parser = argparse.ArgumentParser(description="Manage admin-system-test from this script's directory (install in /opt/admin-system-test). No build, automatic seed, database rollback or volume deletion.")
    commands = parser.add_subparsers(dest="command", required=True)
    bootstrap = commands.add_parser("bootstrap", help="First installation; requires both digest-pinned images")
    bootstrap.add_argument("backend", metavar="BACKEND_IMAGE")
    bootstrap.add_argument("frontend", metavar="FRONTEND_IMAGE")
    deploy = commands.add_parser("deploy", help="Pull, safely update one image, and verify the frontend/proxy")
    deploy.add_argument("component", choices=list(IMAGE_KEYS))
    deploy.add_argument("image", metavar="IMAGE")
    rollback = commands.add_parser("rollback", help="Previous successful component image; NEVER rolls back the database")
    rollback.add_argument("component", choices=list(IMAGE_KEYS))
    rollback.add_argument("--confirm-schema-compatible", action="store_true")
    for name, description in (("status", "Desired, last-good and observed service state"), ("check", "Verify local frontend HTML and proxied health"), ("backup", "Private pg_dump custom-format backup"), ("seed", "Manual terminal only; may print initial credentials")):
        commands.add_parser(name, help=description)
    arguments = vars(parser.parse_args(argv))
    command = arguments.pop("command")
    try:
        result = Manager(Path(__file__).resolve().parent).execute(command, **arguments)
        print(json.dumps(result, indent=2))
        return 0
    except DeployError as error:
        print(f"ERROR: {error}", file=sys.stderr)
    except OSError:
        print("ERROR: Local filesystem operation failed; inspect permissions and free space. Running services may differ from desired state.", file=sys.stderr)
    except KeyboardInterrupt:
        print("ERROR: Interrupted; inspect service status before retrying.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
