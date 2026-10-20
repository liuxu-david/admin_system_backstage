import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("backend_smoke", Path(__file__).with_name("smoke.py"))
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class SmokeTests(unittest.TestCase):
    def test_exercises_health_login_and_cached_user_info(self):
        result = subprocess.CompletedProcess([], 0, stdout="127.0.0.1:49152\n")
        responses = [{"status": "ok"}, {}, {"accessToken": "test-token"}, {"menus": []}]
        with patch.object(smoke, "docker", return_value=result), patch.object(smoke, "wait_database"), patch.object(smoke, "request", side_effect=responses) as api, patch.object(smoke.subprocess, "run", return_value=result) as run:
            smoke.main("local-backend:test")
        self.assertEqual([call.args[1] for call in api.call_args_list], ["/health", "/api/auth/register", "/api/auth/login", "/api/users/info"])
        removals = [call.args[0] for call in run.call_args_list if call.args[0][1:3] == ["rm", "-f"]]
        self.assertEqual(len(removals), 3)
        self.assertTrue(all(command[-1].startswith("admin-ci-") for command in removals))

    def test_failed_api_check_cleans_up_only_created_resources(self):
        result = subprocess.CompletedProcess([], 0, stdout="127.0.0.1:49152\n")
        with patch.object(smoke, "docker", return_value=result), patch.object(smoke, "wait_database"), patch.object(smoke, "request", side_effect=[{"status": "ok"}, RuntimeError("test failure")]), patch.object(smoke.subprocess, "run", return_value=result) as run:
            with self.assertRaises(RuntimeError):
                smoke.main("local-backend:test")
        commands = [call.args[0] for call in run.call_args_list]
        self.assertEqual(len(commands), 4)
        self.assertTrue(all(command[-1].startswith("admin-ci-") for command in commands))
        self.assertFalse(any("prune" in command for command in commands))

    def test_database_timeout_is_finite(self):
        result = subprocess.CompletedProcess([], 1)
        with patch.object(smoke.subprocess, "run", return_value=result) as run, patch.object(smoke.time, "sleep"):
            with self.assertRaises(RuntimeError):
                smoke.wait_database("admin-ci-test-pg", ["pg_isready"])
        self.assertEqual(run.call_count, 60)


if __name__ == "__main__":
    unittest.main()
