import pytest
from fastapi.testclient import TestClient

from app.core import dataset
from app.main import app
from tests.conftest import make_record

client = TestClient(app)
API = "/api/v1"


def test_health():
    assert client.get(f"{API}/health").json()["status"] == "ok"


def test_demo_dataset_listed():
    items = client.get(f"{API}/datasets").json()
    demo = next(d for d in items if d["id"] == "demo")
    assert demo["rows"] > 100_000 and demo["missing_flags"] > 0 and len(demo["gaps"]) == 1


def test_blocks_on_demo():
    r = client.post(f"{API}/datasets/demo/blocks", json={"start": "2025-02-22T08:24:58", "minutes": 30})
    assert r.status_code == 200
    body = r.json()
    assert 14 <= len(body["blocks"]) <= 16
    assert 2.5 < body["summary"]["cop_total"] < 4.5


def test_blocks_outside_record():
    r = client.post(f"{API}/datasets/demo/blocks", json={"start": "2024-01-01T00:00:00"})
    assert r.status_code == 422


def test_cumulative_on_demo():
    body = client.post(f"{API}/datasets/demo/cumulative", json={"max_points": 800}).json()
    n = len(body["hours"])
    assert n <= 1000 and len(body["cop_total"]) == n and len(body["p_discharge"]) == n
    assert body["off"] and body["gaps"]


def test_upload_excel():
    raw = dataset.to_excel(make_record(minutes=10))
    r = client.post(f"{API}/datasets", files=[("files", ("report.xlsx", raw, "application/octet-stream"))])
    assert r.status_code == 200, r.text
    info = r.json()
    assert info["source"] == "upload" and info["rows"] == 300
    assert client.get(f"{API}/datasets/{info['id']}").status_code == 200


def test_upload_garbage():
    r = client.post(f"{API}/datasets", files=[("files", ("x.csv", b"a,b\n1,2\n", "text/csv"))])
    assert r.status_code == 422


def test_window_and_cycle():
    r = client.post(f"{API}/datasets/demo/window", json={"start": "2025-02-22T08:24:58", "minutes": 30})
    assert r.status_code == 200
    body = r.json()
    assert len(body["seconds"]) == len(body["series"]["t1"]) > 800
    c = client.post(f"{API}/datasets/demo/window",
                    json={"start": "2025-02-22T08:24:58", "minutes": 2, "align_to_cycle": True}).json()
    assert c["rows"] == 60 and c["start"] == "2025-02-22T08:26:00"
    assert 2.5 < c["totals"]["cop_total"] < 5


def test_phase_tools_on_demo():
    s = client.get(f"{API}/datasets/demo/phases").json()
    assert s["missing"] == 3600 and s["plan"]["half_s"] == 60
    prev = client.post(f"{API}/datasets/demo/phases/preview", json=s["plan"]).json()
    assert prev["filled"] == 3600 and len(prev["t2"]) == len(prev["supply_rebuilt"])
    info = client.post(f"{API}/datasets/demo/phases/apply", json=s["plan"]).json()
    assert info["missing_flags"] == 0
    assert client.post(f"{API}/datasets/demo/reset").json()["missing_flags"] == 3600


def test_window_finder():
    out = client.post(f"{API}/datasets/demo/windows/check", json={"windows": [
        {"start": "2025-02-22T08:24:58"}, {"start": "2025-03-25T17:13:02"}]}).json()
    assert [o["status"] for o in out] == ["ok", "missing"]
    sug = client.get(f"{API}/datasets/demo/windows/suggest?n=5").json()
    assert 3 <= len(sug) <= 5


def test_ntc_endpoint():
    body = client.post(f"{API}/ntc", json={"current_ma": 2.5, "supply_v": 9}).json()
    assert body["reading"]["t_linear"] == pytest.approx(34.26, abs=0.01)
    assert body["b_values"]["B25/50"] == pytest.approx(3470, abs=1)
    assert body["b_values"]["B25/100"] == pytest.approx(3526, abs=1)
    assert 0.4 < max(body["interp_error"]) < 0.7


def test_ntc_rejects_ptc_table():
    assert client.post(f"{API}/ntc", json={"table": [[0, 100], [10, 110], [20, 120]]}).status_code == 422


def test_modbus_simulated():
    assert client.get(f"{API}/modbus").json()["simulated"]
    r = client.post(f"{API}/modbus/read", json={"unit": 1, "kind": "input", "address": 4036}).json()
    assert r["ok"] and r["request"] == "01 04 0F C4 00 01 73 23"
    assert client.post(f"{API}/modbus/write", json={"unit": 1, "address": 4004, "value": 2}).json()["ok"]
    hits = client.post(f"{API}/modbus/scan", json={"unit_from": 1, "unit_to": 31, "address": 3130}).json()
    assert [h["unit"] for h in hits] == [1]


def test_regenerator_endpoint():
    body = client.post(f"{API}/regenerator", json={"heat_capacity": 95000}).json()
    assert body["values"]["tau"] == pytest.approx(12.5, abs=0.05)
    assert body["thesis"]["dp"] == 58.6 and len(body["rows"]) == 2


def test_cop_vs_tout():
    pts = client.post(f"{API}/datasets/demo/cop-vs-tout", json={}).json()
    assert len(pts) >= 5
    temps = [p["t_out"] for p in pts]
    assert temps == sorted(temps)
    assert pts[0]["cop_total"] > pts[-1]["cop_total"]
