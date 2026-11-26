import sys, os, tempfile
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "app"))
from synapse_core import SynapticMemory, ExperienceLog


def test_recall():
    m = SynapticMemory()
    for _ in range(5):
        m.learn({"雨": 1.0, "傘": 1.0, "濡れない": 0.8}, reward=1.0)
    act = m.activate({"雨": 1.0})
    assert "傘" in act and act["傘"] > 0.1, act
    print("recall OK", act)


def test_forgetting_and_protection():
    m = SynapticMemory()
    for _ in range(10):
        m.learn({"重要": 1.0, "記憶": 1.0}, reward=1.0)
    m.learn({"一時": 1.0, "メモ": 1.0}, reward=0.2)
    for _ in range(50):
        m.decay_all()
    act = m.activate({"重要": 1.0})
    assert "記憶" in act, "重要な記憶が消えすぎている"
    print("protection OK", act)


def test_snapshot_roundtrip():
    m = SynapticMemory()
    m.learn({"空": 1.0, "青い": 1.0}, reward=1.0)
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        path = f.name
    m.save(path)
    m2 = SynapticMemory()
    m2.load(path)
    assert m2.stats() == m.stats()
    os.unlink(path)
    print("snapshot OK")


def test_log():
    with tempfile.NamedTemporaryFile(suffix=".jsonl", delete=False) as f:
        path = f.name
    log = ExperienceLog(path)
    rec = log.add(["a"], "chat", "hello", 1.0)
    assert log.get(rec["id"])["result"] == "hello"
    os.unlink(path)
    print("log OK")


if __name__ == "__main__":
    test_recall()
    test_forgetting_and_protection()
    test_snapshot_roundtrip()
    test_log()
    print("ALL TESTS PASSED")
