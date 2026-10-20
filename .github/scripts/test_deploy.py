import importlib.util
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


spec = importlib.util.spec_from_file_location("deploy_client", Path(__file__).with_name("deploy.py"))
client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(client)


class DeployClientTests(unittest.TestCase):
    def setUp(self):
        self.env = {
            "DEPLOY_HOST": "server.example.test",
            "DEPLOY_USER": "deploy",
            "DEPLOY_PORT": "22",
            "DEPLOY_SSH_KEY": "test-key-not-a-real-secret",
            "DEPLOY_KNOWN_HOSTS": "server.example.test ssh-ed25519 TEST",
            "IMAGE_REF": "ghcr.io/example/backend@sha256:" + "a" * 64,
            "GITHUB_REPOSITORY": "Example/Backend",
        }

    def test_valid_image_creates_strict_ssh_command(self):
        with patch.dict(os.environ, self.env, clear=True):
            config = client.configuration("backend")
        command = client.ssh_command(config, Path("key"), Path("hosts"))
        self.assertIn("StrictHostKeyChecking=yes", command)
        self.assertIn("BatchMode=yes", command)
        self.assertIn("IdentitiesOnly=yes", command)
        self.assertIn("GlobalKnownHostsFile=/dev/null", command)
        self.assertIn("deploy@server.example.test", command)
        self.assertEqual(command[-1], "python3 /opt/admin-system-test/manage.py deploy backend " + self.env["IMAGE_REF"])
        self.assertNotIn(self.env["DEPLOY_SSH_KEY"], " ".join(command))

    def test_rejects_remote_shell_injection(self):
        for key, value in [("DEPLOY_HOST", "host; id"), ("DEPLOY_USER", "-oProxyCommand=id"), ("DEPLOY_PORT", "22;id"), ("IMAGE_REF", self.env["IMAGE_REF"] + ";id")]:
            with self.subTest(key=key), patch.dict(os.environ, {**self.env, key: value}, clear=True):
                with self.assertRaises(ValueError):
                    client.configuration("backend")

    def test_rejects_different_repository_and_mutable_tag(self):
        for value in ["ghcr.io/attacker/backend@sha256:" + "a" * 64, "ghcr.io/example/backend:latest"]:
            with self.subTest(value=value), patch.dict(os.environ, {**self.env, "IMAGE_REF": value}, clear=True):
                with self.assertRaises(ValueError):
                    client.configuration("backend")

    def test_requires_trusted_known_hosts_and_private_key(self):
        for key in ["DEPLOY_KNOWN_HOSTS", "DEPLOY_SSH_KEY"]:
            with self.subTest(key=key), patch.dict(os.environ, {**self.env, key: ""}, clear=True):
                with self.assertRaises(ValueError):
                    client.configuration("backend")

    def test_rejects_invalid_port_and_component(self):
        with patch.dict(os.environ, {**self.env, "DEPLOY_PORT": "65536"}, clear=True):
            with self.assertRaises(ValueError):
                client.configuration("backend")
        with patch.dict(os.environ, self.env, clear=True):
            with self.assertRaises(ValueError):
                client.configuration("database")

    def test_key_written_without_carriage_returns_and_restricted(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "key"
            client.write_private(target, "one\r\ntwo\r\n")
            self.assertEqual(target.read_bytes(), b"one\ntwo\n")
            if os.name != "nt":
                self.assertEqual(target.stat().st_mode & 0o777, 0o600)


if __name__ == "__main__":
    unittest.main()
