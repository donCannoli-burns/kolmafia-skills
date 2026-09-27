import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).parents[1] / "kolmafia" / "scripts" / "agent_skill_bridge.py"
spec = importlib.util.spec_from_file_location("agent_skill_bridge", MODULE)
bridge = importlib.util.module_from_spec(spec)
assert spec and spec.loader
sys.modules[spec.name] = bridge
spec.loader.exec_module(bridge)


class BridgeTests(unittest.TestCase):
    def test_native_alias_round_trip(self):
        prompt = "Observe first. Unicode: café ✓"
        cmd = bridge.native_alias_command("demo", prompt)
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "GLOBAL_aliases.txt"
            p.write_text("agentskill.demo\t" + cmd.split(" => ", 1)[1] + "\n", encoding="utf-8")
            self.assertEqual(bridge.parse_aliases(p)["demo"], prompt)

    def test_latest_complete_frame(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "active_session.test"
            p.write_text(
                "noise\n"
                "AGENTSKILL_BEGIN|v=1|id=1|name=demo\n"
                "system prompt\n\nUSER_SKILL_PROMPT:\nhello world\n"
                "AGENTSKILL_END|v=1|id=1|name=demo\n",
                encoding="utf-8",
            )
            frame = bridge.read_latest(p, "demo")
            self.assertIsNotNone(frame)
            self.assertEqual(frame.name, "demo")
            self.assertIn("hello world", frame.prompt)

    def test_sync_reason(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "active_session.test"
            p.write_text(
                "AGENTSKILL_SYNC|v=1|reason=login\nAGENTSKILL_SYNC|v=1|reason=make-a-new-skill\n",
                encoding="utf-8",
            )
            self.assertEqual(bridge.latest_sync(p), "make-a-new-skill")

    def test_invalid_skill_name_rejected(self):
        with self.assertRaises(ValueError):
            bridge.native_alias_command("bad name", "x")


if __name__ == "__main__":
    unittest.main()
