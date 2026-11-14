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
