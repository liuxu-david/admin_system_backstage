import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile


def configuration(component):
    if component not in {"backend", "frontend"}:
        raise ValueError("Invalid deployment component")
    values = {}
    for key in ("DEPLOY_HOST", "DEPLOY_USER", "DEPLOY_SSH_KEY", "DEPLOY_KNOWN_HOSTS", "IMAGE_REF", "GITHUB_REPOSITORY"):
        value = os.environ.get(key, "")
        if not value.strip():
            raise ValueError(f"Missing {key}")
        values[key] = value
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{0,252}", values["DEPLOY_HOST"]):
        raise ValueError("DEPLOY_HOST must be an IPv4 address or DNS hostname")
    if not re.fullmatch(r"[a-z_][a-z0-9_-]{0,31}", values["DEPLOY_USER"]):
        raise ValueError("Invalid DEPLOY_USER")
    port = os.environ.get("DEPLOY_PORT", "22") or "22"
    if not port.isdigit() or not 1 <= int(port) <= 65535:
        raise ValueError("Invalid DEPLOY_PORT")
    repository = values["GITHUB_REPOSITORY"].lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]*/[a-z0-9][a-z0-9_.-]*", repository):
        raise ValueError("Invalid GITHUB_REPOSITORY")
    if not re.fullmatch(re.escape(f"ghcr.io/{repository}@sha256:") + r"[0-9a-f]{64}", values["IMAGE_REF"]):
        raise ValueError("IMAGE_REF must be this repository's immutable GHCR digest")
    values["DEPLOY_PORT"] = port
    values["component"] = component
    return values


def write_private(path, value):
    path.write_text(value.replace("\r", "").rstrip("\n") + "\n", encoding="utf-8", newline="\n")
    path.chmod(0o600)


def ssh_command(config, key_path, hosts_path):
    remote = shlex.join([
        "python3", "/opt/admin-system-test/manage.py", "deploy",
        config["component"], config["IMAGE_REF"],
    ])
    return [
        "ssh", "-F", "/dev/null", "-T", "-i", str(key_path),
        "-p", config["DEPLOY_PORT"],
        "-o", "BatchMode=yes", "-o", "IdentitiesOnly=yes",
        "-o", "StrictHostKeyChecking=yes",
        "-o", f"UserKnownHostsFile={hosts_path}",
        "-o", "GlobalKnownHostsFile=/dev/null",
        "-o", "ConnectTimeout=20", "-o", "ServerAliveInterval=15",
        "-o", "ServerAliveCountMax=4",
        f"{config['DEPLOY_USER']}@{config['DEPLOY_HOST']}", remote,
    ]


def main():
    try:
        if len(sys.argv) != 2:
            raise ValueError("Usage: deploy.py backend|frontend")
        config = configuration(sys.argv[1])
        with tempfile.TemporaryDirectory(prefix="admin-deploy-") as directory:
            folder = Path(directory)
            folder.chmod(0o700)
            key, hosts = folder / "key", folder / "known_hosts"
            write_private(key, config["DEPLOY_SSH_KEY"])
            write_private(hosts, config["DEPLOY_KNOWN_HOSTS"])
            subprocess.run(ssh_command(config, key, hosts), check=True, timeout=1800)
    except ValueError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (OSError, subprocess.SubprocessError):
        print("SSH deployment failed; inspect the test environment status before retrying.", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
