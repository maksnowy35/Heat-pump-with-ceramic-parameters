from app.core import modbus


def test_crc_known_vector():
    # read 10 holding registers from 0 at unit 1: CRC C5 CD
    assert modbus.read_request(1, 3, 0, 10).hex(" ").upper() == "01 03 00 00 00 0A C5 CD"


def test_frames_from_the_original_scripts():
    assert modbus.read_request(1, modbus.READ_INPUT, 4036, 1).hex(" ").upper() == "01 04 0F C4 00 01 73 23"
    assert modbus.write_request(1, 4004, 2)[:6].hex(" ").upper() == "01 06 0F A4 00 02"


def test_response_crc_is_valid():
    raw = modbus.read_response(1, 3, [315, 352])
    assert modbus.crc16(raw[:-2]) == raw[-2] | raw[-1] << 8


def test_simulator():
    s = modbus.Simulator(unit=1)
    a = s.read(1, "holding", 3130, 2)
    assert a.ok and len(a.values) == 2 and a.values == s.read(1, "holding", 3130, 2).values
    assert not s.read(2, "holding", 3130, 1).ok                          # no answer from other ids
    bad = s.read(1, "input", 9999, 2)
    assert not bad.ok and bad.response[1] == 0x84 and bad.response[2] == 2  # exception 02
    assert s.write(1, 4004, 2).ok and s.read(1, "holding", 4004, 1).values == [2]


def test_scan_finds_the_device_first_on_input_registers():
    hits = modbus.scan(modbus.Simulator(unit=7), range(1, 32), 3130)
    assert hits == [{"unit": 7, "kind": "input", "value": hits[0]["value"]}]


def test_describe_request_and_response():
    req = modbus.describe(modbus.read_request(1, 4, 4036, 1))
    assert [f["field"] for f in req] == ["unit id", "function", "start address", "register count",
                                         "CRC-16 (low byte first)"]
    resp = modbus.describe(modbus.read_response(1, 4, [7]))
    assert resp[2]["field"] == "byte count" and resp[3]["hex"] == "0007"
