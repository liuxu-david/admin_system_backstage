"""Deployment tests use temporary files and mocked Docker/HTTP, never a daemon."""
import contextlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest import mock

import manage


BACKEND_REPOSITORY = "ghcr.io/example-owner/admin_system_backstage"
FRONTEND_REPOSITORY = "ghcr.io/example-owner/admin_system_front"
BACKEND_1 = BACKEND_REPOSITORY + "@sha256:" + "a" * 64
BACKEND_2 = BACKEND_REPOSITORY + "@sha256:" + "b" * 64
FRONTEND_1 = FRONTEND_REPOSITORY + "@sha256:" + "c" * 64
FRONTEND_2 = FRONTEND_REPOSITORY + "@sha256:" + "d" * 64
SECRETS = {
    "DB_PASSWORD": "database-secret-not-for-history-123456",
    "REDIS_PASSWORD": "redis-secret-not-for-history-123456789",
    "JWT_ACCESS_SECRET": "access-secret-not-for-history-12345678",
    "JWT_REFRESH_SECRET": "refresh-secret-not-for-history-1234567",
}


class ValidationTests(unittest.TestCase):
    def test_exact_allowlisted_digest_is_accepted(self):
        self.assertEqual(manage.validate_image(BACKEND_1, BACKEND_REPOSITORY), BACKEND_1)

    def test_tags_injection_and_other_repositories_are_rejected(self):
        invalid = [
            BACKEND_REPOSITORY + ":latest",
            BACKEND_REPOSITORY + ":main@sha256:" + "a" * 64,
            BACKEND_1 + "; touch /tmp/owned",
            BACKEND_1 + "\nOTHER=bad",
            "$(touch /tmp/owned)",
            "--privileged",
            BACKEND_1.replace("ghcr.io", "docker.io"),
            BACKEND_1.replace("example-owner", "other-owner"),
            BACKEND_1.replace("@sha256:", "@sha512:"),
            BACKEND_1[:-1],
            BACKEND_1 + "a",
            BACKEND_1.replace("example-owner", "example_owner"),
            BACKEND_1.replace("/admin_system_backstage", "/../admin_system_backstage"),
            FRONTEND_1,
        ]
        for image in invalid:
            with self.subTest(image=image), self.assertRaises(manage.DeployError):
                manage.validate_image(image, BACKEND_REPOSITORY)

    def test_allowlist_itself_is_validated(self):
        for repository in ["ghcr.io/x/../../app", "ghcr.io/UPPER/app", "ghcr.io/x/app;id", "ghcr.io/x/app:latest"]:
            with self.subTest(repository=repository), self.assertRaises(manage.DeployError):
                manage.validate_image(repository + "@sha256:" + "a" * 64, repository)

    def test_env_is_literal_not_shell_or_variable_expansion(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            path.write_text("# comment\nPASSWORD='literal$HOME$(whoami)#value'\nNAME=plain\n", encoding="utf-8")
            self.assertEqual(manage.read_env(path), {"PASSWORD": "literal$HOME$(whoami)#value", "NAME": "plain"})

    def test_ambiguous_env_syntax_is_rejected_without_echoing_secrets(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / ".env"
            for text in ["A=secret\nA=another-secret", "export A=secret", "A='secret", "BAD KEY=secret", "A=secret\x00"]:
                path.write_text(text, encoding="utf-8")
                with self.subTest(text=text), self.assertRaises(manage.DeployError) as error:
                    manage.read_env(path)
                self.assertNotIn("secret", str(error.exception))

    def test_atomic_write_preserves_old_file_if_replace_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "images.env"
            path.write_text("old", encoding="utf-8")
            with mock.patch.object(manage.os, "replace", side_effect=OSError("disk failure")):
                with self.assertRaises(OSError):
                    manage.atomic_write(path, "new")
            self.assertEqual(path.read_text(encoding="utf-8"), "old")
            self.assertEqual(list(Path(directory).iterdir()), [path])

    def test_atomic_write_uses_private_permissions_on_linux(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "images.env"
            manage.atomic_write(path, "new\n")
            self.assertEqual(path.read_text(encoding="utf-8"), "new\n")
            if os.name == "posix":
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name).resolve()
        self.config = {
            "BACKEND_REPOSITORY": BACKEND_REPOSITORY,
            "FRONTEND_REPOSITORY": FRONTEND_REPOSITORY,
            "DB_USERNAME": "admin_test",
            "DB_NAME": "admin_test",
            "CORS_ORIGINS": "http://127.0.0.1:18080",
            **SECRETS,
        }
        (self.root / ".env").write_text("".join(f"{key}={value}\n" for key, value in self.config.items()), encoding="utf-8")
        (self.root / "compose.yml").write_text("services: {}\n", encoding="utf-8")
        self.calls = []
        self.fail = lambda args: False
        self.dump = b"PGDMP-test-custom-dump"
        self.runner = mock.Mock(side_effect=self.run_docker)
        self.http = mock.Mock(side_effect=lambda path: b'{"code":0,"data":{"status":"ok"}}' if path == "/health" else b'<!doctype html><html><div id="app"></div></html>')
        self.lock = mock.patch.object(manage, "deployment_lock", side_effect=lambda root: contextlib.nullcontext())
        self.mock_lock = self.lock.start()
        self.addCleanup(self.lock.stop)
        self.manager = manage.Manager(self.root, run=self.runner, fetch=self.http)

    def run_docker(self, args, **kwargs):
        self.calls.append((args, kwargs))
        self.assertIsInstance(args, list)
        self.assertNotIn("shell", kwargs)
        if self.fail(args):
            return subprocess.CompletedProcess(args, 1, b"", SECRETS["DB_PASSWORD"].encode())
        if "pg_dump" in args:
            kwargs["stdout"].write(self.dump)
            return subprocess.CompletedProcess(args, 0, None, b"")
        output = b'[{"Service":"app","State":"running","Health":"healthy"}]' if "ps" in args else b""
        return subprocess.CompletedProcess(args, 0, output, b"")

    def images(self):
        return manage.read_env(self.root / "images.env")

    def history(self):
        return json.loads((self.root / "release-history.json").read_text(encoding="utf-8"))

    def bootstrap(self):
        self.manager.execute("bootstrap", backend=BACKEND_1, frontend=FRONTEND_1)
        self.calls.clear()

    def test_bootstrap_persists_both_images_and_starts_in_dependency_order(self):
        self.bootstrap()
        self.assertEqual(self.images(), {"BACKEND_IMAGE": BACKEND_1, "FRONTEND_IMAGE": FRONTEND_1})
        self.assertEqual(self.history()[-1]["status"], "success")
        self.assertEqual(self.history()[-1]["last_good"], self.images())
        self.http.assert_any_call("/health")
        self.http.assert_any_call("/")

    def test_bootstrap_startup_has_no_seed_or_backup_and_is_bounded(self):
        self.manager.execute("bootstrap", backend=BACKEND_1, frontend=FRONTEND_1)
        commands = [args for args, _ in self.calls]
        self.assertEqual([args[-1] for args in commands if args[:2] == ["docker", "pull"]], [BACKEND_1, FRONTEND_1])
        updates = [args for args in commands if "up" in args]
        self.assertEqual(updates[0][-2:], ["postgres", "redis"])
        self.assertEqual(updates[1][-1], "app")
        self.assertEqual(updates[2][-1], "web")
        self.assertTrue(all("--wait" in args and "--wait-timeout" in args for args in updates))
        self.assertFalse(any("pg_dump" in args or "dist/database/seeds/rbac.seed.js" in args for args in commands))
        self.assertTrue(all(kwargs["timeout"] > 0 for _, kwargs in self.calls))

    def test_successful_bootstrap_cannot_run_again(self):
        self.bootstrap()
        with self.assertRaises(manage.DeployError):
            self.manager.execute("bootstrap", backend=BACKEND_2, frontend=FRONTEND_2)
        self.assertEqual(self.calls, [])
        self.assertEqual(self.images()["BACKEND_IMAGE"], BACKEND_1)

    def test_failed_bootstrap_can_be_retried(self):
        self.fail = lambda args: "up" in args and args[-1] == "app"
        with self.assertRaises(manage.DeployError):
            self.manager.execute("bootstrap", backend=BACKEND_1, frontend=FRONTEND_1)
        self.assertEqual(self.history()[-1]["status"], "failed")
        self.fail = lambda args: False
        self.manager.execute("bootstrap", backend=BACKEND_1, frontend=FRONTEND_1)
        self.assertEqual(self.history()[-1]["status"], "success")

    def test_pull_failure_neither_changes_versions_nor_recreates_containers(self):
        self.bootstrap()
        original = (self.root / "images.env").read_bytes()
        self.fail = lambda args: "pull" in args
        with self.assertRaises(manage.DeployError):
            self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.assertEqual((self.root / "images.env").read_bytes(), original)
        self.assertFalse(any("up" in args or "pg_dump" in args for args, _ in self.calls))
        release = self.history()[-1]
        self.assertEqual(release["status"], "failed")
        self.assertEqual(release["stage"], "pull")
        self.assertEqual(release["old"]["BACKEND_IMAGE"], BACKEND_1)
        self.assertEqual(release["new"]["BACKEND_IMAGE"], BACKEND_2)
        self.assertEqual(release["desired"]["BACKEND_IMAGE"], BACKEND_1)

    def test_frontend_deploy_updates_only_frontend_persistently(self):
        self.bootstrap()
        self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        fresh_manager = manage.Manager(self.root, run=self.runner, fetch=self.http)
        self.assertEqual(fresh_manager.images(), {"BACKEND_IMAGE": BACKEND_1, "FRONTEND_IMAGE": FRONTEND_2})
        updates = [args for args, _ in self.calls if "up" in args]
        self.assertEqual(len(updates), 1)
        self.assertEqual(updates[0][-1], "web")
        self.assertIn("--no-deps", updates[0])
        self.assertFalse(any("pg_dump" in args for args, _ in self.calls))

    def test_backend_deploy_backs_up_then_recreates_app_and_web(self):
        self.bootstrap()
        self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.assertEqual(self.images(), {"BACKEND_IMAGE": BACKEND_2, "FRONTEND_IMAGE": FRONTEND_1})
        actions = ["backup" if "pg_dump" in args else args[-1] for args, _ in self.calls if "pg_dump" in args or "up" in args]
        self.assertEqual(actions, ["backup", "app", "web"])
        self.assertTrue(all("--force-recreate" in args for args, _ in self.calls if "up" in args))
        self.assertEqual(len(list((self.root / "backups").glob("*.dump"))), 1)

    def test_backup_failure_blocks_version_change_and_recreation(self):
        self.bootstrap()
        self.fail = lambda args: "pg_dump" in args
        with self.assertRaises(manage.DeployError):
            self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.assertEqual(self.images()["BACKEND_IMAGE"], BACKEND_1)
        self.assertFalse(any("up" in args for args, _ in self.calls))
        self.assertEqual(self.history()[-1]["stage"], "backup")
        self.assertEqual(self.history()[-1]["status"], "failed")

    def test_failed_health_keeps_desired_version_and_records_last_good(self):
        self.bootstrap()
        self.http.side_effect = manage.DeployError("HTTP verification failed")
        with self.assertRaises(manage.DeployError):
            self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.assertEqual(self.images()["BACKEND_IMAGE"], BACKEND_2)
        release = self.history()[-1]
        self.assertEqual(release["status"], "failed")
        self.assertEqual(release["last_good"]["BACKEND_IMAGE"], BACKEND_1)
        self.assertEqual(release["desired"]["BACKEND_IMAGE"], BACKEND_2)
        commands = json.dumps([args for args, _ in self.calls])
        for forbidden in ["migration:revert", "pg_restore", "dropdb", "down", "volume", "prune"]:
            self.assertNotIn(forbidden, commands)
        self.assertNotIn(BACKEND_1, json.dumps([args for args, _ in self.calls if "pull" in args]))

    def test_secrets_and_docker_stderr_never_enter_history_or_error(self):
        self.bootstrap()
        self.fail = lambda args: "up" in args
        with self.assertRaises(manage.DeployError) as error:
            self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        output = (self.root / "release-history.json").read_text(encoding="utf-8") + str(error.exception)
        for secret in SECRETS.values():
            self.assertNotIn(secret, output)
        self.assertNotIn("DB_PASSWORD", output)

    def test_component_deploy_requires_both_bootstrap_versions(self):
        with self.assertRaises(manage.DeployError):
            self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.assertEqual(self.calls, [])

    def test_failed_bootstrap_cannot_be_promoted_by_component_deploy(self):
        self.fail = lambda args: "up" in args and args[-1] == "app"
        with self.assertRaises(manage.DeployError):
            self.manager.execute("bootstrap", backend=BACKEND_1, frontend=FRONTEND_1)
        self.fail = lambda args: False
        self.calls.clear()
        with self.assertRaisesRegex(manage.DeployError, "successful bootstrap"):
            self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        with self.assertRaisesRegex(manage.DeployError, "successful bootstrap"):
            self.manager.execute("rollback", component="frontend")
        self.assertEqual(self.calls, [])
        self.assertEqual(self.history()[-1]["status"], "failed")
        self.manager.execute("bootstrap", backend=BACKEND_1, frontend=FRONTEND_1)
        self.assertEqual(self.history()[-1]["status"], "success")

    def test_compose_validation_failure_is_recorded_and_blocks_all_up(self):
        self.bootstrap()
        self.fail = lambda args: "config" in args
        with self.assertRaises(manage.DeployError):
            self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        self.assertFalse(any("up" in args for args, _ in self.calls))
        self.assertEqual(self.images()["FRONTEND_IMAGE"], FRONTEND_2)
        self.assertEqual(self.history()[-1]["stage"], "compose_config")
        self.assertEqual(self.history()[-1]["status"], "failed")

    def test_every_release_validates_compose_before_up_and_persists_stage(self):
        self.bootstrap()
        original = self.runner.side_effect
        stages = []
        def observe_stage(args, **kwargs):
            if "config" in args or "up" in args or "pg_dump" in args:
                stages.append(self.history()[-1]["stage"])
            return original(args, **kwargs)
        self.runner.side_effect = observe_stage
        self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.assertEqual(stages, ["backup", "compose_config", "app_health", "web_health"])
        validation = next(args for args, _ in self.calls if "config" in args)
        self.assertEqual(validation[-2:], ["config", "--quiet"])

    def test_empty_backup_is_failure_and_old_backups_are_kept(self):
        self.bootstrap()
        (self.root / "backups").mkdir()
        old = self.root / "backups" / "existing.dump"
        old.write_bytes(b"old backup")
        self.dump = b""
        with self.assertRaises(manage.DeployError):
            self.manager.execute("backup")
        self.assertEqual(old.read_bytes(), b"old backup")
        self.assertEqual(list((self.root / "backups").iterdir()), [old])

    def test_backup_uses_custom_format_private_file_and_never_restores(self):
        self.bootstrap()
        result = self.manager.execute("backup")
        path = Path(result["backup"])
        self.assertEqual(path.read_bytes(), self.dump)
        if os.name == "posix":
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        args = next(args for args, _ in self.calls if "pg_dump" in args)
        self.assertIn("--format=custom", args)
        self.assertIn("-T", args)
        self.assertNotIn(SECRETS["DB_PASSWORD"], args)

    def test_all_operations_share_the_same_lock(self):
        self.bootstrap()
        for action in ["status", "check", "backup"]:
            self.manager.execute(action)
        self.assertEqual(self.mock_lock.call_count, 4)
        self.assertTrue(all(call.args == (self.root,) for call in self.mock_lock.call_args_list))

    def test_shell_compose_and_image_overrides_cannot_change_release(self):
        self.bootstrap()
        with mock.patch.dict(os.environ, {"COMPOSE_FILE": "/tmp/evil.yml", "COMPOSE_PROJECT_NAME": "evil", "BACKEND_IMAGE": "evil:latest", "DB_PASSWORD": "wrong"}):
            self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        args, kwargs = next((args, kwargs) for args, kwargs in self.calls if "up" in args)
        self.assertIn("admin-system-test", args)
        self.assertIn(str(self.root / "compose.yml"), args)
        self.assertNotIn("COMPOSE_FILE", kwargs["env"])
        self.assertEqual(kwargs["env"]["BACKEND_IMAGE"], BACKEND_1)
        self.assertEqual(kwargs["env"]["DB_PASSWORD"], SECRETS["DB_PASSWORD"])


    def test_backend_rollback_requires_explicit_schema_confirmation_before_docker(self):
        self.bootstrap()
        self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.calls.clear()
        with self.assertRaisesRegex(manage.DeployError, "confirm-schema-compatible"):
            self.manager.execute("rollback", component="backend")
        self.assertEqual(self.calls, [])
        self.assertEqual(self.images()["BACKEND_IMAGE"], BACKEND_2)

    def test_rollback_selects_previous_success_for_only_selected_component(self):
        self.bootstrap()
        self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        self.calls.clear()
        result = self.manager.execute("rollback", component="backend", confirm_schema_compatible=True)
        self.assertEqual(self.images(), {"BACKEND_IMAGE": BACKEND_1, "FRONTEND_IMAGE": FRONTEND_2})
        self.assertEqual(result["command"], "rollback")
        self.assertIn("database", result["note"])
        commands = json.dumps([args for args, _ in self.calls])
        self.assertIn("pg_dump", commands)
        for forbidden in ["pg_restore", "migration:revert", "dropdb", "down", "prune"]:
            self.assertNotIn(forbidden, commands)

    def test_frontend_rollback_after_failed_release_uses_last_good(self):
        self.bootstrap()
        self.fail = lambda args: "up" in args
        with self.assertRaises(manage.DeployError):
            self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        self.fail = lambda args: False
        self.manager.execute("rollback", component="frontend")
        self.assertEqual(self.images()["FRONTEND_IMAGE"], FRONTEND_1)

    def test_other_component_success_does_not_promote_failed_version_to_last_good(self):
        self.bootstrap()
        self.fail = lambda args: "up" in args and args[-1] == "app"
        with self.assertRaises(manage.DeployError):
            self.manager.execute("deploy", component="backend", image=BACKEND_2)
        self.fail = lambda args: False
        self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        self.assertEqual(self.history()[-1]["last_good"]["BACKEND_IMAGE"], BACKEND_1)
        self.manager.execute("rollback", component="backend", confirm_schema_compatible=True)
        self.assertEqual(self.images()["BACKEND_IMAGE"], BACKEND_1)

    def test_rollback_without_previous_success_is_rejected(self):
        self.bootstrap()
        with self.assertRaisesRegex(manage.DeployError, "previous successful"):
            self.manager.execute("rollback", component="frontend")
        self.assertEqual(self.calls, [])

    def test_seed_rejects_noninteractive_and_ci_sessions(self):
        self.bootstrap()
        for tty, environment in [(False, {}), (True, {"CI": "true"}), (True, {"GITHUB_ACTIONS": "true"})]:
            with self.subTest(tty=tty, environment=environment), mock.patch.object(manage.sys.stdin, "isatty", return_value=tty), mock.patch.object(manage.sys.stdout, "isatty", return_value=tty), mock.patch.dict(os.environ, environment, clear=True):
                with self.assertRaises(manage.DeployError):
                    self.manager.execute("seed")
        self.assertEqual(self.calls, [])

    def test_manual_seed_disables_synchronize_and_warns_before_output(self):
        self.bootstrap()
        with mock.patch.object(manage.sys.stdin, "isatty", return_value=True), mock.patch.object(manage.sys.stdout, "isatty", return_value=True), mock.patch.dict(os.environ, {}, clear=True), mock.patch("builtins.print") as printer:
            self.manager.execute("seed")
        command = next(args for args, _ in self.calls if "dist/database/seeds/rbac.seed.js" in args)
        self.assertIn("SEED_SYNCHRONIZE=false", command)
        self.assertIn("node", command)
        self.assertNotIn("pnpm", command)
        self.assertIn("credentials", " ".join(str(call) for call in printer.call_args_list))
        self.assertEqual(len(self.history()), 1)

    def test_http_check_rejects_wrong_json_error_envelopes_and_wrong_homepage(self):
        self.bootstrap()
        for body in [b"not json", b"[]", b'{"status":"down"}', b'{"code":2,"data":{"status":"ok"}}']:
            self.http.side_effect = lambda path: body if path == "/health" else b'<html><div id="app"></div></html>'
            with self.subTest(body=body), self.assertRaises(manage.DeployError):
                self.manager.execute("check")
        self.http.side_effect = lambda path: b'{"status":"ok"}' if path == "/health" else b"nginx default page"
        with self.assertRaises(manage.DeployError):
            self.manager.execute("check")

    def test_http_check_accepts_direct_and_nested_health(self):
        self.bootstrap()
        for body in [b'{"status":"ok"}', b'{"code":0,"data":{"status":"ok"}}']:
            self.http.side_effect = lambda path: body if path == "/health" else b'<html><div id="app"></div></html>'
            self.assertEqual(self.manager.execute("check")["status"], "ok")

    def test_timeout_records_failure_without_reverting_versions(self):
        self.bootstrap()
        original = self.runner.side_effect
        def timeout_on_up(args, **kwargs):
            if "up" in args:
                raise subprocess.TimeoutExpired(args, 180, stderr=SECRETS["DB_PASSWORD"].encode())
            return original(args, **kwargs)
        self.runner.side_effect = timeout_on_up
        with self.assertRaises(manage.DeployError) as error:
            self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        self.assertEqual(self.images()["FRONTEND_IMAGE"], FRONTEND_2)
        self.assertEqual(self.history()[-1]["status"], "failed")
        self.assertNotIn(SECRETS["DB_PASSWORD"], str(error.exception))

    def test_status_reports_observed_state_separately_from_desired_and_last_good(self):
        self.bootstrap()
        self.fail = lambda args: "up" in args
        with self.assertRaises(manage.DeployError):
            self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        self.fail = lambda args: False
        result = self.manager.execute("status")
        self.assertEqual(result["desired"]["FRONTEND_IMAGE"], FRONTEND_2)
        self.assertEqual(result["last_good"]["FRONTEND_IMAGE"], FRONTEND_1)
        self.assertEqual(result["last_release_status"], "failed")
        self.assertEqual(result["containers"][0]["Health"], "healthy")

    def test_corrupted_or_unallowlisted_history_fails_closed_without_traceback(self):
        self.bootstrap()
        path = self.root / "release-history.json"
        original = path.read_text(encoding="utf-8")
        wrong = json.loads(original)
        wrong[0]["new"]["BACKEND_IMAGE"] = FRONTEND_1
        for history in [[{}], [{"status": "success", "component": "bogus"}], wrong]:
            path.write_text(json.dumps(history), encoding="utf-8")
            with self.subTest(history=history), self.assertRaises(manage.DeployError):
                self.manager.execute("status")
        self.assertEqual(self.calls, [])

    def test_server_env_does_not_override_docker_process_settings(self):
        self.bootstrap()
        path = self.root / ".env"
        original = path.read_text(encoding="utf-8")
        for extra in ["PATH=/tmp/untrusted", "COMPOSE_FILE=evil.yml", "DOCKER_HOST=tcp://example:2375", "BACKEND_IMAGE=tagged:latest"]:
            path.write_text(original + extra + "\n", encoding="utf-8")
            with self.subTest(extra=extra), self.assertRaises(manage.DeployError):
                self.manager.execute("deploy", component="frontend", image=FRONTEND_2)
        self.assertEqual(self.calls, [])

    def test_reading_images_with_a_fresh_manager_still_enforces_repository_allowlist(self):
        self.bootstrap()
        path = self.root / "images.env"
        path.write_text(f"BACKEND_IMAGE={FRONTEND_1}\nFRONTEND_IMAGE={FRONTEND_1}\n", encoding="utf-8")
        fresh = manage.Manager(self.root, run=self.runner, fetch=self.http)
        with self.assertRaises(manage.DeployError):
            fresh.images()

    def test_invalid_input_is_rejected_before_docker_or_history_writes(self):
        self.bootstrap()
        original = (self.root / "release-history.json").read_bytes()
        for component, image in [("backend", BACKEND_1 + ";id"), ("frontend", BACKEND_1), ("app;id", BACKEND_1)]:
            with self.subTest(component=component, image=image), self.assertRaises(manage.DeployError):
                self.manager.execute("deploy", component=component, image=image)
        self.assertEqual(self.calls, [])
        self.assertEqual((self.root / "release-history.json").read_bytes(), original)


class ComposeContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.root = Path(__file__).resolve().parent
        cls.text = (cls.root / "compose.yml").read_text(encoding="utf-8")

    def test_single_project_four_services_no_build_or_extra_ports(self):
        text = self.text
        self.assertIn("name: admin-system-test", text)
        for service in ("app", "web", "postgres", "redis"):
            self.assertIn("\n  " + service + ":\n", text)
        self.assertNotIn("build:", text)
        self.assertNotIn("container_name:", text)
        self.assertEqual(text.count("ports:"), 1)
        self.assertIn('"127.0.0.1:8080:80"', text)
        self.assertIn("BACKEND_HOST: app", text)

    def test_test_environment_migrations_and_digest_images(self):
        text = self.text
        for expected in ["APP_ENV: test", 'RUN_MIGRATIONS: "true"', 'NODE_OPTIONS: "--max-old-space-size=384"', "${BACKEND_IMAGE:?", "${FRONTEND_IMAGE:?"]:
            self.assertIn(expected, text)
        self.assertNotIn("SEED_SYNCHRONIZE: true", text)
        self.assertIn("postgres:16-alpine", text)
        self.assertIn("redis:7-alpine", text)

    def test_limits_rotation_healthchecks_and_persistent_volumes(self):
        text = self.text
        for expected in ["mem_limit: 640m", "mem_limit: 96m", "mem_limit: 384m", "mem_limit: 160m", 'max-size: "10m"', 'max-file: "3"', "fetch(", "pg_isready", "redis-cli", "wget", "postgres_data:/var/lib/postgresql/data", "redis_data:/data", "uploads:/app/uploads"]:
            self.assertIn(expected, text)
        self.assertEqual(text.count("healthcheck:"), 4)
        self.assertEqual(text.count("cpus:"), 4)
        self.assertEqual(text.count("logging: *logging"), 4)
        self.assertIn("${REDIS_PASSWORD:?", text)

    def test_template_has_allowlists_no_versions_and_safe_test_defaults(self):
        config = manage.read_env(self.root / ".env.example")
        self.assertIn("BACKEND_REPOSITORY", config)
        self.assertIn("FRONTEND_REPOSITORY", config)
        self.assertNotIn("BACKEND_IMAGE", config)
        self.assertNotIn("FRONTEND_IMAGE", config)
        self.assertEqual(config["CORS_ORIGINS"], "http://127.0.0.1:18080")
        for key in SECRETS:
            self.assertTrue(config[key].startswith("REPLACE_"))

    def test_local_gitignore_protects_server_generated_files(self):
        text = (self.root / ".gitignore").read_text(encoding="utf-8")
        for entry in ["/.env", "/images.env", "/release-history.json", "/backups/", "/.deploy.lock"]:
            self.assertIn(entry, text.splitlines())


class LockTests(unittest.TestCase):
    def test_busy_lock_fails_closed_and_never_unlinks_the_lock_file(self):
        fake = mock.Mock(LOCK_EX=2, LOCK_NB=4, LOCK_UN=8)
        fake.flock.side_effect = BlockingIOError()
        with tempfile.TemporaryDirectory() as directory, mock.patch.dict("sys.modules", {"fcntl": fake}):
            with self.assertRaises(manage.DeployError):
                with manage.deployment_lock(Path(directory)):
                    self.fail("A concurrent release acquired the lock")
            self.assertTrue((Path(directory) / ".deploy.lock").is_file())

    def test_lock_releases_on_exception(self):
        fake = mock.Mock(LOCK_EX=2, LOCK_NB=4, LOCK_UN=8)
        with tempfile.TemporaryDirectory() as directory, mock.patch.dict("sys.modules", {"fcntl": fake}):
            with self.assertRaises(ValueError):
                with manage.deployment_lock(Path(directory)):
                    raise ValueError("test")
            self.assertEqual([call.args[1] for call in fake.flock.call_args_list], [6, 8])

    @unittest.skipUnless(os.name == "posix", "real flock requires Linux; exercised by CI")
    def test_real_lock_rejects_second_open_and_can_be_reacquired(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with manage.deployment_lock(root):
                with self.assertRaises(manage.DeployError):
                    with manage.deployment_lock(root):
                        self.fail("Second deployment acquired a held lock")
            with manage.deployment_lock(root):
                self.assertTrue((root / ".deploy.lock").is_file())


class CLITests(unittest.TestCase):
    def test_cli_passes_digest_and_schema_confirmation_to_manager(self):
        with mock.patch.object(manage, "Manager") as manager, mock.patch("builtins.print"):
            manager.return_value.execute.return_value = {"status": "success"}
            self.assertEqual(manage.main(["deploy", "backend", BACKEND_1]), 0)
            manager.return_value.execute.assert_called_once_with("deploy", component="backend", image=BACKEND_1)
            manager.return_value.execute.reset_mock()
            self.assertEqual(manage.main(["rollback", "backend", "--confirm-schema-compatible"]), 0)
            manager.return_value.execute.assert_called_once_with("rollback", component="backend", confirm_schema_compatible=True)

    def test_cli_failure_has_nonzero_exit_and_no_traceback_or_raw_os_error(self):
        with mock.patch.object(manage, "Manager") as manager, mock.patch("builtins.print") as printer:
            manager.return_value.execute.side_effect = OSError("secret-from-system")
            self.assertEqual(manage.main(["status"]), 1)
            output = " ".join(str(call) for call in printer.call_args_list)
            self.assertNotIn("secret-from-system", output)
            self.assertNotIn("Traceback", output)


if __name__ == "__main__":
    unittest.main()
