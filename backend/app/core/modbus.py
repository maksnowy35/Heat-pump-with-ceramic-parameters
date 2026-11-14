"""Modbus RTU: request/response frames, a simulated controller and the serial link.

Port of szukanie_modnusa.py (scan unit IDs 1-31 for a device answering on register 3130, input then
holding registers) and Zmiana_rejestrow.py (read register 4036 as input and holding register,
write a single register). Without a serial port configured, the API talks to a simulated controller,
so the tools and the frames they produce can be explored anywhere.
"""
import os
from dataclasses import dataclass, field

READ_HOLDING, READ_INPUT, WRITE_SINGLE = 0x03, 0x04, 0x06
FUNCTIONS = {"holding": READ_HOLDING, "input": READ_INPUT}
EXCEPTIONS = {1: "illegal function", 2: "illegal data address", 3: "illegal data value", 4: "device failure"}


def crc16(data: bytes) -> int:
    """CRC-16/MODBUS (poly 0xA001 reflected, init 0xFFFF); sent low byte first."""
    crc = 0xFFFF
    for b in data:
        crc ^= b
        for _ in range(8):
            crc = (crc >> 1) ^ 0xA001 if crc & 1 else crc >> 1
    return crc


def frame(pdu: bytes, unit: int) -> bytes:
    body = bytes([unit]) + pdu
    c = crc16(body)
    return body + bytes([c & 0xFF, c >> 8])


def read_request(unit: int, function: int, address: int, count: int) -> bytes:
    return frame(bytes([function]) + address.to_bytes(2, "big") + count.to_bytes(2, "big"), unit)


def write_request(unit: int, address: int, value: int) -> bytes:
    return frame(bytes([WRITE_SINGLE]) + address.to_bytes(2, "big") + (value & 0xFFFF).to_bytes(2, "big"), unit)


def read_response(unit: int, function: int, values: list[int]) -> bytes:
    data = b"".join((v & 0xFFFF).to_bytes(2, "big") for v in values)
    return frame(bytes([function, len(data)]) + data, unit)


def exception_response(unit: int, function: int, code: int) -> bytes:
    return frame(bytes([function | 0x80, code]), unit)


def describe(raw: bytes) -> list[dict]:
    """Byte-by-byte meaning of a request or response frame, for display."""
    if len(raw) < 4:
        return []
    out = [{"hex": f"{raw[0]:02X}", "field": "unit id"}]
    fc = raw[1]
    out.append({"hex": f"{fc:02X}", "field": "function" if fc < 0x80 else "exception (function | 0x80)"})
    body = raw[2:-2]
    if fc >= 0x80:
        out.append({"hex": f"{body[0]:02X}", "field": f"exception code: {EXCEPTIONS.get(body[0], '?')}"})
    elif fc in (READ_HOLDING, READ_INPUT) and len(body) == 4:      # request; a response body is odd
        out += [{"hex": body[:2].hex().upper(), "field": "start address"},
                {"hex": body[2:].hex().upper(), "field": "register count"}]
    elif fc in (READ_HOLDING, READ_INPUT):
        out.append({"hex": f"{body[0]:02X}", "field": "byte count"})
        for i in range(1, len(body), 2):
            out.append({"hex": body[i:i + 2].hex().upper(), "field": f"register value {i // 2}"})
    elif fc == WRITE_SINGLE:
        out += [{"hex": body[:2].hex().upper(), "field": "address"},
                {"hex": body[2:].hex().upper(), "field": "value"}]
    out.append({"hex": raw[-2:].hex().upper(), "field": "CRC-16 (low byte first)"})
    return out


@dataclass
class Settings:
    port: str = "simulator"
    baudrate: int = 19200
    parity: str = "N"
    stopbits: int = 1
    bytesize: int = 8
    timeout: float = 2.0


@dataclass
class Exchange:
    ok: bool
    values: list[int]
    request: bytes
    response: bytes | None
    error: str | None = None


@dataclass
class Simulator:
    """A controller at one unit id. Registers hold arbitrary but stable values; addresses above
    `max_address` answer with exception 02, other unit ids do not answer (timeout)."""
    unit: int = 1
    max_address: int = 9999
    written: dict[int, int] = field(default_factory=dict)

    def _value(self, kind: str, address: int) -> int:
        if kind == "holding" and address in self.written:
            return self.written[address]
        return (address * 37 + (11 if kind == "input" else 5) * 101) % 1000

    def read(self, unit: int, kind: str, address: int, count: int) -> Exchange:
        fc = FUNCTIONS[kind]
        req = read_request(unit, fc, address, count)
        if unit != self.unit:
            return Exchange(False, [], req, None, "no response (timeout)")
        if address + count - 1 > self.max_address:
            return Exchange(False, [], req, exception_response(unit, fc, 2), EXCEPTIONS[2])
        values = [self._value(kind, a) for a in range(address, address + count)]
        return Exchange(True, values, req, read_response(unit, fc, values))

    def write(self, unit: int, address: int, value: int) -> Exchange:
        req = write_request(unit, address, value)
        if unit != self.unit:
            return Exchange(False, [], req, None, "no response (timeout)")
        if address > self.max_address:
            return Exchange(False, [], req, exception_response(unit, WRITE_SINGLE, 2), EXCEPTIONS[2])
        self.written[address] = value & 0xFFFF
        return Exchange(True, [value & 0xFFFF], req, req)   # FC06 echoes the request


class Serial:
    """Real RS-485 link through pymodbus (only when MODBUS_PORT is set)."""

    def __init__(self, s: Settings):
        from pymodbus.client import ModbusSerialClient
        self.client = ModbusSerialClient(port=s.port, baudrate=s.baudrate, parity=s.parity,
                                         stopbits=s.stopbits, bytesize=s.bytesize, timeout=s.timeout)

    def _call(self, fn, *args, unit: int, **kw):
        try:
            return fn(*args, device_id=unit, **kw)      # pymodbus >= 3.10
        except TypeError:
            return fn(*args, slave=unit, **kw)          # older releases, as in the original scripts

    def read(self, unit: int, kind: str, address: int, count: int) -> Exchange:
        fc = FUNCTIONS[kind]
        req = read_request(unit, fc, address, count)
        if not self.client.connect():
            return Exchange(False, [], req, None, "port not available")
        fn = self.client.read_input_registers if kind == "input" else self.client.read_holding_registers
        r = self._call(fn, address, count=count, unit=unit)
        if r.isError():
            return Exchange(False, [], req, None, str(r))
        return Exchange(True, list(r.registers), req, read_response(unit, fc, list(r.registers)))

    def write(self, unit: int, address: int, value: int) -> Exchange:
        req = write_request(unit, address, value)
        if not self.client.connect():
            return Exchange(False, [], req, None, "port not available")
        r = self._call(self.client.write_register, address, value, unit=unit)
        if r.isError():
            return Exchange(False, [], req, None, str(r))
        return Exchange(True, [value], req, req)


def settings_from_env() -> Settings:
    return Settings(
        port=os.environ.get("MODBUS_PORT", "simulator"),
        baudrate=int(os.environ.get("MODBUS_BAUDRATE", "19200")),
        parity=os.environ.get("MODBUS_PARITY", "N"),
        timeout=float(os.environ.get("MODBUS_TIMEOUT", "2")),
    )


def writes_allowed() -> bool:
    return os.environ.get("MODBUS_PORT", "simulator") == "simulator" or os.environ.get("MODBUS_ALLOW_WRITE") == "1"


def scan(link, units: range, address: int) -> list[dict]:
    """For each unit id: input register first, then holding register (szukanie_modnusa.py)."""
    found = []
    for unit in units:
        for kind in ("input", "holding"):
            x = link.read(unit, kind, address, 1)
            if x.ok:
                found.append({"unit": unit, "kind": kind, "value": x.values[0]})
                break
    return found
