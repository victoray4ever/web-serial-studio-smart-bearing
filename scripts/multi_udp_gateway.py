#!/usr/bin/env python3
"""JSON-configured multi-UDP gateway for MEMS-CMS.

The gateway owns one UDP socket, assigns every sender a stable ``sourceId``
and can either forward each UDP datagram immediately or reassemble fragmented
protocol frames independently for each source. Metadata is carried in a
compact WebSocket envelope::

    b"MUG1" + uint32_le(json_length) + json_metadata + udp_payload

Text WebSocket messages are reserved for gateway hello/status notifications.

Run with::

    python scripts/multi_udp_gateway.py --config scripts/multi_udp_gateway.json

Dependency::

    pip install websockets
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import signal
import struct
import time
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    from websockets.legacy.server import WebSocketServerProtocol, serve
except ImportError as exc:  # pragma: no cover
    try:
        from websockets import WebSocketServerProtocol, serve
    except ImportError:
        raise SystemExit("Missing dependency: websockets\nInstall with: pip install websockets") from exc


MAGIC = b"MUG1"
COMMAND_MAGIC = b"MUC1"
PROTOCOL_VERSION = 1


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Receive, identify and multiplex multiple UDP data sources.")
    parser.add_argument(
        "--config",
        default=str(Path(__file__).with_name("multi_udp_gateway.json")),
        help="Path to the gateway JSON configuration file",
    )
    return parser.parse_args()


def load_config(path: str | Path) -> dict[str, Any]:
    config_path = Path(path).expanduser().resolve()
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise SystemExit(f"Gateway config not found: {config_path}") from exc
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid gateway JSON at {config_path}:{exc.lineno}: {exc.msg}") from exc

    if not isinstance(config, dict):
        raise SystemExit("Gateway configuration root must be a JSON object")
    config["_config_path"] = str(config_path)
    return config


def port_number(value: Any, name: str, default: int) -> int:
    try:
        port = int(value if value is not None else default)
    except (TypeError, ValueError) as exc:
        raise SystemExit(f"{name} must be an integer") from exc
    if not 1 <= port <= 65535:
        raise SystemExit(f"{name} must be between 1 and 65535")
    return port


def source_key(ip: str, port: int | None = None) -> str:
    suffix = f"-{port}" if port is not None else ""
    return f"udp-{ip.replace('.', '-')}{suffix}"


@dataclass
class DeviceStats:
    source_id: str
    title: str
    ip: str
    port: int
    packets: int = 0
    bytes: int = 0
    frames: int = 0
    frame_bytes: int = 0
    buffered_bytes: int = 0
    reassembly_dropped_bytes: int = 0
    incomplete_frames: int = 0
    invalid_frames: int = 0
    lost: int = 0
    duplicates: int = 0
    out_of_order: int = 0
    last_sequence: int | None = None
    frame_number: int = 0
    last_seen: float = 0.0

    def as_dict(self, offline_after_ms: int) -> dict[str, Any]:
        now = time.time()
        age_ms = int(max(0.0, now - self.last_seen) * 1000) if self.last_seen else None
        return {
            "sourceId": self.source_id,
            "title": self.title,
            "ip": self.ip,
            "port": self.port,
            "packets": self.packets,
            "bytes": self.bytes,
            "frames": self.frames,
            "frameBytes": self.frame_bytes,
            "bufferedBytes": self.buffered_bytes,
            "reassemblyDroppedBytes": self.reassembly_dropped_bytes,
            "incompleteFrames": self.incomplete_frames,
            "invalidFrames": self.invalid_frames,
            "lost": self.lost,
            "duplicates": self.duplicates,
            "outOfOrder": self.out_of_order,
            "lastSequence": self.last_sequence,
            "lastFrameNumber": self.frame_number,
            "lastSeen": int(self.last_seen * 1000) if self.last_seen else None,
            "ageMs": age_ms,
            "online": age_ms is not None and age_ms <= offline_after_ms,
        }


@dataclass
class DeviceDefinition:
    source_id: str
    title: str
    ip: str
    port: int | None = None
    command_port: int | None = None
    sequence: dict[str, Any] = field(default_factory=dict)

    def matches(self, addr: tuple[str, int]) -> bool:
        return self.ip == addr[0] and (self.port is None or self.port == addr[1])


def hex_bytes(value: Any, name: str) -> bytes:
    if isinstance(value, bytes):
        result = value
    else:
        try:
            result = bytes.fromhex(str(value or ""))
        except ValueError as exc:
            raise ValueError(f"{name} must contain hexadecimal bytes") from exc
    if not result:
        raise ValueError(f"{name} must not be empty")
    return result


@dataclass
class ReassemblyResult:
    frames: list[bytes] = field(default_factory=list)
    dropped_bytes: int = 0
    incomplete_frames: int = 0
    invalid_frames: int = 0


class FrameReassembler:
    """Per-source byte-stream buffer with delimiter and fixed-length recovery."""

    def __init__(self, definition: dict[str, Any]):
        self.start = hex_bytes(definition.get("startDelimiter", "5A A5"), "aggregation.frame.startDelimiter")
        self.end = hex_bytes(definition.get("endDelimiter", "DD EE"), "aggregation.frame.endDelimiter")
        self.frame_length = max(0, int(definition.get("frameLength", 0) or 0))
        self.timeout_seconds = max(0.1, float(definition.get("timeoutMs", 2000)) / 1000.0)
        self.max_buffer_bytes = max(1024, int(definition.get("maxBufferBytes", 65536) or 65536))
        minimum_length = len(self.start) + len(self.end)
        if self.frame_length and self.frame_length < minimum_length:
            raise ValueError(f"aggregation.frame.frameLength must be at least {minimum_length}")
        if self.frame_length > self.max_buffer_bytes:
            raise ValueError("aggregation.frame.maxBufferBytes must be >= frameLength")
        self.buffer = bytearray()
        self.last_update = 0.0

    def expire(self, now: float) -> ReassemblyResult:
        result = ReassemblyResult()
        if self.buffer and self.last_update and now - self.last_update > self.timeout_seconds:
            result.dropped_bytes = len(self.buffer)
            result.incomplete_frames = 1
            self.buffer.clear()
            self.last_update = 0.0
        return result

    def feed(self, payload: bytes, now: float) -> ReassemblyResult:
        result = self.expire(now)
        if payload:
            self.buffer.extend(payload)
            self.last_update = now
        self._extract(result)
        if len(self.buffer) > self.max_buffer_bytes:
            overflow = len(self.buffer) - self.max_buffer_bytes
            result.dropped_bytes += overflow
            result.invalid_frames += 1
            del self.buffer[:overflow]
            self._resync_to_start(result)
        if not self.buffer:
            self.last_update = 0.0
        return result

    def _resync_to_start(self, result: ReassemblyResult) -> bool:
        start_pos = self.buffer.find(self.start)
        if start_pos >= 0:
            if start_pos:
                result.dropped_bytes += start_pos
                del self.buffer[:start_pos]
            return True
        keep = min(len(self.buffer), max(0, len(self.start) - 1))
        drop = len(self.buffer) - keep
        if drop:
            result.dropped_bytes += drop
            del self.buffer[:drop]
        return False

    def _extract(self, result: ReassemblyResult) -> None:
        while self._resync_to_start(result):
            if self.frame_length:
                if len(self.buffer) < self.frame_length:
                    return
                end_pos = self.frame_length - len(self.end)
                if bytes(self.buffer[end_pos:self.frame_length]) == self.end:
                    result.frames.append(bytes(self.buffer[:self.frame_length]))
                    del self.buffer[:self.frame_length]
                    continue
                result.invalid_frames += 1
                next_start = self.buffer.find(self.start, 1)
                drop = next_start if next_start >= 0 else 1
                result.dropped_bytes += drop
                del self.buffer[:drop]
                continue

            end_pos = self.buffer.find(self.end, len(self.start))
            if end_pos < 0:
                return
            frame_end = end_pos + len(self.end)
            result.frames.append(bytes(self.buffer[:frame_end]))
            del self.buffer[:frame_end]


class DeviceRegistry:
    def __init__(self, config: dict[str, Any]):
        routing = config.get("routing") or {}
        self.unknown_policy = str(routing.get("unknownDevices", "ip")).lower()
        if self.unknown_policy not in ("drop", "ip", "ip-port"):
            raise ValueError("routing.unknownDevices must be drop, ip, or ip-port")
        self.default_sequence = routing.get("sequence") or {}
        self.frame_numbering = routing.get("frameNumbering") or {"enabled": True, "start": 1}
        self.numbering_enabled = self.frame_numbering.get("enabled", True) is not False
        self.numbering_start = max(0, int(self.frame_numbering.get("start", 1) or 0))
        self.devices: list[DeviceDefinition] = []
        self.stats: dict[str, DeviceStats] = {}
        source_ids: set[str] = set()

        for index, raw in enumerate(routing.get("devices") or []):
            if not isinstance(raw, dict) or not raw.get("ip"):
                raise SystemExit(f"routing.devices[{index}] requires an ip")
            source_id = str(raw.get("sourceId") or raw.get("deviceId") or f"device-{index + 1}")
            if source_id in source_ids:
                raise ValueError(f"Duplicate sourceId: {source_id}")
            source_ids.add(source_id)
            device_port = int(raw["port"]) if raw.get("port") is not None else None
            if device_port is not None and not 1 <= device_port <= 65535:
                raise ValueError(f"routing.devices[{index}].port must be between 1 and 65535")
            command_port = int(raw["commandPort"]) if raw.get("commandPort") is not None else None
            if command_port is not None and not 1 <= command_port <= 65535:
                raise ValueError(f"routing.devices[{index}].commandPort must be between 1 and 65535")
            device = DeviceDefinition(
                source_id=source_id,
                title=str(raw.get("title") or source_id),
                ip=str(raw["ip"]),
                port=device_port,
                command_port=command_port,
                sequence=raw.get("sequence") or self.default_sequence,
            )
            self.devices.append(device)
            self.stats[source_id] = DeviceStats(
                source_id, device.title, device.ip, device.port or 0,
                frame_number=self.numbering_start - 1,
            )

    def resolve(self, addr: tuple[str, int]) -> DeviceDefinition | None:
        device = next((candidate for candidate in self.devices if candidate.matches(addr)), None)
        if device:
            return device
        if self.unknown_policy == "drop":
            return None
        source_id = source_key(addr[0], addr[1] if self.unknown_policy == "ip-port" else None)
        return DeviceDefinition(source_id=source_id, title=source_id, ip=addr[0], port=addr[1], sequence=self.default_sequence)

    def device_stats(self, device: DeviceDefinition, addr: tuple[str, int]) -> DeviceStats:
        if device.source_id not in self.stats:
            self.stats[device.source_id] = DeviceStats(
                device.source_id, device.title, addr[0], addr[1],
                frame_number=self.numbering_start - 1,
            )
        stats = self.stats[device.source_id]
        stats.title = device.title
        stats.ip = addr[0]
        stats.port = addr[1]
        return stats

    def command_destination(self, source_id: str) -> tuple[str, int] | None:
        device = next((item for item in self.devices if item.source_id == source_id), None)
        stats = self.stats.get(source_id)
        if device:
            port = device.command_port or device.port or (stats.port if stats else 0)
            return (device.ip, port) if port else None
        if stats and stats.port:
            return stats.ip, stats.port
        return None


def extract_sequence(payload: bytes, definition: dict[str, Any]) -> int | None:
    if not definition or definition.get("enabled", True) is False:
        return None
    try:
        offset = int(definition.get("offset", 0))
        size = int(definition.get("size", 4))
        byteorder = str(definition.get("byteOrder", "little")).lower()
        signed = bool(definition.get("signed", False))
    except (TypeError, ValueError):
        return None
    if size not in (1, 2, 4, 8) or offset < 0 or offset + size > len(payload):
        return None
    if byteorder not in ("little", "big"):
        byteorder = "little"
    return int.from_bytes(payload[offset:offset + size], byteorder=byteorder, signed=signed)


def update_sequence_stats(stats: DeviceStats, sequence: int | None, bits: int) -> None:
    if sequence is None:
        return
    modulus = 1 << max(1, bits)
    if stats.last_sequence is None:
        stats.last_sequence = sequence
        return
    expected = (stats.last_sequence + 1) % modulus
    if sequence == stats.last_sequence:
        stats.duplicates += 1
        return
    if sequence == expected:
        stats.last_sequence = sequence
        return
    forward = (sequence - expected) % modulus
    backward = (expected - sequence) % modulus
    if forward < backward:
        stats.lost += forward
        stats.last_sequence = sequence
    else:
        stats.out_of_order += 1


def encode_packet(metadata: dict[str, Any], payload: bytes) -> bytes:
    encoded = json.dumps(metadata, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return MAGIC + struct.pack("<I", len(encoded)) + encoded + payload


def decode_command_packet(packet: bytes) -> tuple[dict[str, Any], bytes] | None:
    if len(packet) < 8 or packet[:4] != COMMAND_MAGIC:
        return None
    metadata_length = struct.unpack("<I", packet[4:8])[0]
    payload_offset = 8 + metadata_length
    if metadata_length <= 0 or payload_offset > len(packet):
        raise ValueError("Invalid gateway command envelope")
    metadata = json.loads(packet[8:payload_offset].decode("utf-8"))
    return metadata, packet[payload_offset:]


class UdpReceiver(asyncio.DatagramProtocol):
    def __init__(self, gateway: "MultiUdpGateway"):
        self.gateway = gateway
        self.transport: asyncio.DatagramTransport | None = None

    def connection_made(self, transport: asyncio.BaseTransport) -> None:
        self.transport = transport  # type: ignore[assignment]
        self.gateway.udp_transport = self.transport

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        self.gateway.receive_datagram(data, addr)

    def error_received(self, exc: Exception) -> None:
        print(f"[udp] socket error: {exc}")


class MultiUdpGateway:
    def __init__(self, config: dict[str, Any]):
        self.config = config
        self.registry = DeviceRegistry(config)
        self.clients: set[WebSocketServerProtocol] = set()
        self.udp_transport: asyncio.DatagramTransport | None = None
        self.started_at = time.time()
        self.received_packets = 0
        self.received_bytes = 0
        self.forwarded_frames = 0
        self.forwarded_bytes = 0
        self.dropped_packets = 0
        self.command_packets = 0
        self.command_errors = 0

        udp = config.get("udp") or {}
        websocket = config.get("websocket") or {}
        status = config.get("status") or {}
        outbound = config.get("outbound") or {}
        aggregation = config.get("aggregation") or {}
        self.udp_host = str(udp.get("host", "0.0.0.0"))
        self.udp_port = port_number(udp.get("port"), "udp.port", 4000)
        self.ws_host = str(websocket.get("host", "127.0.0.1"))
        self.ws_port = port_number(websocket.get("port"), "websocket.port", 8765)
        self.status_interval = max(0.2, float(status.get("intervalMs", 1000)) / 1000.0)
        self.offline_after_ms = max(1000, int(status.get("offlineAfterMs", 5000)))
        self.outbound_host = str(outbound.get("host", "")).strip()
        self.outbound_port = int(outbound.get("port", 0) or 0)
        self.aggregation_mode = str(aggregation.get("mode", "realtime")).lower()
        if self.aggregation_mode not in ("realtime", "frame"):
            raise SystemExit("aggregation.mode must be 'realtime' or 'frame'")
        self.frame_aggregation = deepcopy(aggregation.get("frame") or {})
        if self.aggregation_mode == "frame":
            FrameReassembler(self.frame_aggregation)
        self.reassemblers: dict[str, FrameReassembler] = {}

    def public_config(self) -> dict[str, Any]:
        return {key: deepcopy(value) for key, value in self.config.items() if not key.startswith("_")}

    def _control_allowed(self, websocket: WebSocketServerProtocol) -> bool:
        control = self.config.get("control") or {}
        if bool(control.get("allowRemote", False)):
            return True
        remote = getattr(websocket, "remote_address", None)
        host = remote[0] if isinstance(remote, tuple) and remote else "127.0.0.1"
        return host in ("127.0.0.1", "::1", "localhost")

    def update_config(self, incoming: dict[str, Any]) -> bool:
        if not isinstance(incoming, dict):
            raise ValueError("config must be a JSON object")
        candidate = deepcopy(incoming)
        candidate["_config_path"] = self.config.get("_config_path", "")

        udp = candidate.get("udp") or {}
        websocket = candidate.get("websocket") or {}
        status = candidate.get("status") or {}
        outbound = candidate.get("outbound") or {}
        aggregation = candidate.get("aggregation") or {}
        next_udp_host = str(udp.get("host", "0.0.0.0"))
        next_udp_port = port_number(udp.get("port"), "udp.port", 4000)
        next_ws_host = str(websocket.get("host", "127.0.0.1"))
        next_ws_port = port_number(websocket.get("port"), "websocket.port", 8765)
        next_status_interval = max(0.2, float(status.get("intervalMs", 1000)) / 1000.0)
        next_offline_after = max(1000, int(status.get("offlineAfterMs", 5000)))
        next_aggregation = str(aggregation.get("mode", "realtime")).lower()
        if next_aggregation not in ("realtime", "frame"):
            raise ValueError("aggregation.mode must be 'realtime' or 'frame'")
        next_frame_aggregation = deepcopy(aggregation.get("frame") or {})
        if next_aggregation == "frame":
            FrameReassembler(next_frame_aggregation)
        next_registry = DeviceRegistry(candidate)

        restart_required = (
            next_udp_host != self.udp_host or next_udp_port != self.udp_port or
            next_ws_host != self.ws_host or next_ws_port != self.ws_port
        )
        numbering_changed = (
            (candidate.get("routing") or {}).get("frameNumbering") !=
            (self.config.get("routing") or {}).get("frameNumbering")
        )
        if not numbering_changed:
            for source_id, stats in self.registry.stats.items():
                if source_id in next_registry.stats:
                    next_registry.stats[source_id] = stats

        config_path = Path(str(candidate.get("_config_path") or "")).resolve()
        serialized = {key: value for key, value in candidate.items() if not key.startswith("_")}
        temporary = config_path.with_suffix(config_path.suffix + ".tmp")
        temporary.write_text(json.dumps(serialized, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        temporary.replace(config_path)

        self.config = candidate
        self.registry = next_registry
        self.status_interval = next_status_interval
        self.offline_after_ms = next_offline_after
        self.outbound_host = str(outbound.get("host", "")).strip()
        self.outbound_port = int(outbound.get("port", 0) or 0)
        self.aggregation_mode = next_aggregation
        self.frame_aggregation = next_frame_aggregation
        self.reassemblers.clear()
        for stats in self.registry.stats.values():
            stats.buffered_bytes = 0
        return restart_required

    async def handle_control(self, websocket: WebSocketServerProtocol, request: dict[str, Any]) -> bool:
        message_type = request.get("type")
        if message_type == "gateway.status.request":
            await websocket.send(json.dumps(self.status_message(), ensure_ascii=False, separators=(",", ":")))
            return True
        if message_type == "gateway.config.request":
            if not self._control_allowed(websocket):
                response = {"type": "gateway.error", "message": "Remote gateway configuration is disabled"}
            else:
                response = {"type": "gateway.config", "config": self.public_config()}
            await websocket.send(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
            return True
        if message_type == "gateway.config.update":
            if not self._control_allowed(websocket):
                response = {"type": "gateway.error", "message": "Remote gateway configuration is disabled"}
            else:
                try:
                    restart_required = self.update_config(request.get("config"))
                    response = {
                        "type": "gateway.config.saved",
                        "config": self.public_config(),
                        "restartRequired": restart_required,
                    }
                    print(f"[cfg] configuration saved (restart required={restart_required})")
                except (OSError, TypeError, ValueError, SystemExit) as exc:
                    response = {"type": "gateway.error", "message": str(exc)}
            await websocket.send(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
            return True
        if message_type == "gateway.command":
            try:
                if request.get("payloadBase64") is not None:
                    payload = base64.b64decode(str(request.get("payloadBase64")), validate=True)
                elif request.get("payloadHex") is not None:
                    payload = bytes.fromhex(str(request.get("payloadHex")))
                else:
                    payload = str(request.get("payloadText", "")).encode("utf-8")
                destination = self.route_command(payload, str(request.get("sourceId") or ""))
                response = {
                    "type": "gateway.command.result", "ok": True,
                    "sourceId": request.get("sourceId") or "", "host": destination[0], "port": destination[1],
                }
            except (ValueError, TypeError) as exc:
                response = {"type": "gateway.command.result", "ok": False, "message": str(exc)}
            await websocket.send(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
            return True
        return False

    def receive_datagram(self, payload: bytes, addr: tuple[str, int]) -> None:
        device = self.registry.resolve(addr)
        if device is None:
            self.dropped_packets += 1
            return

        now = time.time()
        stats = self.registry.device_stats(device, addr)
        stats.packets += 1
        stats.bytes += len(payload)
        stats.last_seen = now
        self.received_packets += 1
        self.received_bytes += len(payload)

        if self.aggregation_mode == "frame":
            reassembler = self.reassemblers.get(device.source_id)
            if reassembler is None:
                reassembler = FrameReassembler(self.frame_aggregation)
                self.reassemblers[device.source_id] = reassembler
            result = reassembler.feed(payload, now)
            self._apply_reassembly_result(stats, result, len(reassembler.buffer))
            frames = result.frames
        else:
            frames = [payload]

        for frame in frames:
            self._forward_frame(device, stats, frame, addr, now)

    def _apply_reassembly_result(
        self, stats: DeviceStats, result: ReassemblyResult, buffered_bytes: int,
    ) -> None:
        stats.buffered_bytes = buffered_bytes
        stats.reassembly_dropped_bytes += result.dropped_bytes
        stats.incomplete_frames += result.incomplete_frames
        stats.invalid_frames += result.invalid_frames

    def _forward_frame(
        self,
        device: DeviceDefinition,
        stats: DeviceStats,
        payload: bytes,
        addr: tuple[str, int],
        now: float,
    ) -> None:
        device_sequence = extract_sequence(payload, device.sequence)
        sequence_size = int(device.sequence.get("size", 4) or 4) if device.sequence else 4
        update_sequence_stats(stats, device_sequence, sequence_size * 8)
        if self.registry.numbering_enabled:
            stats.frame_number += 1
            frame_number: int | None = stats.frame_number
        else:
            frame_number = None
        stats.frames += 1
        stats.frame_bytes += len(payload)
        self.forwarded_frames += 1
        self.forwarded_bytes += len(payload)

        metadata = {
            "type": "gateway.data",
            "version": PROTOCOL_VERSION,
            "sourceId": device.source_id,
            "sourceTitle": device.title,
            "sourceIp": addr[0],
            "sourcePort": addr[1],
            "frameNumber": frame_number,
            "deviceSequence": device_sequence,
            "sequence": device_sequence if device_sequence is not None else frame_number,
            "sequenceSource": "device" if device_sequence is not None else "gateway",
            "timestamp": int(now * 1000),
            "payloadLength": len(payload),
            "aggregationMode": self.aggregation_mode,
            "reassembled": self.aggregation_mode == "frame",
        }
        packet = encode_packet(metadata, payload)
        for client in tuple(self.clients):
            asyncio.create_task(self._send(client, packet))

    def _expire_reassembly(self, now: float) -> None:
        if self.aggregation_mode != "frame":
            return
        for source_id, reassembler in self.reassemblers.items():
            result = reassembler.expire(now)
            stats = self.registry.stats.get(source_id)
            if stats:
                self._apply_reassembly_result(stats, result, len(reassembler.buffer))

    def route_command(self, payload: bytes, source_id: str = "") -> tuple[str, int]:
        outbound = self.config.get("outbound") or {}
        target_source_id = str(source_id or outbound.get("defaultSourceId") or "")
        destination = self.registry.command_destination(target_source_id) if target_source_id else None
        if destination is None and self.outbound_host and 1 <= self.outbound_port <= 65535:
            destination = self.outbound_host, self.outbound_port
        if destination is None:
            self.command_errors += 1
            raise ValueError(f"No command route for sourceId '{target_source_id}'")
        if not self.udp_transport:
            self.command_errors += 1
            raise ValueError("UDP transport is not ready")
        self.udp_transport.sendto(payload, destination)
        self.command_packets += 1
        print(f"[udp] command {len(payload)} bytes -> {target_source_id or 'default'} {destination[0]}:{destination[1]}")
        return destination

    async def _send(self, client: WebSocketServerProtocol, message: str | bytes) -> None:
        try:
            await client.send(message)
        except Exception:
            self.clients.discard(client)

    def status_message(self) -> dict[str, Any]:
        self._expire_reassembly(time.time())
        devices = [stats.as_dict(self.offline_after_ms) for stats in self.registry.stats.values()]
        return {
            "type": "gateway.status",
            "version": PROTOCOL_VERSION,
            "gateway": str(self.config.get("name") or "MEMS-CMS Multi UDP Gateway"),
            "aggregationMode": self.aggregation_mode,
            "configPath": self.config.get("_config_path", ""),
            "uptimeMs": int((time.time() - self.started_at) * 1000),
            "clients": len(self.clients),
            "packets": self.received_packets,
            "bytes": self.received_bytes,
            "frames": self.forwarded_frames,
            "frameBytes": self.forwarded_bytes,
            "bufferedBytes": sum(device["bufferedBytes"] for device in devices),
            "reassemblyDroppedBytes": sum(device["reassemblyDroppedBytes"] for device in devices),
            "incompleteFrames": sum(device["incompleteFrames"] for device in devices),
            "invalidFrames": sum(device["invalidFrames"] for device in devices),
            "dropped": self.dropped_packets,
            "lost": sum(device["lost"] for device in devices),
            "duplicates": sum(device["duplicates"] for device in devices),
            "outOfOrder": sum(device["outOfOrder"] for device in devices),
            "commands": self.command_packets,
            "commandErrors": self.command_errors,
            "onlineDevices": sum(1 for device in devices if device["online"]),
            "knownDevices": len(devices),
            "devices": devices,
            "timestamp": int(time.time() * 1000),
        }

    async def status_loop(self) -> None:
        while True:
            await asyncio.sleep(self.status_interval)
            message = json.dumps(self.status_message(), ensure_ascii=False, separators=(",", ":"))
            await asyncio.gather(*(self._send(client, message) for client in tuple(self.clients)))

    async def handle_client(self, websocket: WebSocketServerProtocol, _path: str = "") -> None:
        self.clients.add(websocket)
        hello = {
            "type": "gateway.hello",
            "version": PROTOCOL_VERSION,
            "gateway": str(self.config.get("name") or "MEMS-CMS Multi UDP Gateway"),
            "udp": {"host": self.udp_host, "port": self.udp_port},
        }
        await websocket.send(json.dumps(hello, ensure_ascii=False, separators=(",", ":")))
        await websocket.send(json.dumps(self.status_message(), ensure_ascii=False, separators=(",", ":")))
        print(f"[ws] client connected ({len(self.clients)} total)")
        try:
            async for message in websocket:
                if isinstance(message, str):
                    try:
                        request = json.loads(message)
                    except json.JSONDecodeError:
                        request = None
                    if isinstance(request, dict) and await self.handle_control(websocket, request):
                        continue
                    payload = message.encode("utf-8")
                else:
                    payload = bytes(message)
                    try:
                        command = decode_command_packet(payload)
                        if command:
                            metadata, command_payload = command
                            destination = self.route_command(command_payload, str(metadata.get("sourceId") or ""))
                            response = {
                                "type": "gateway.command.result", "ok": True,
                                "sourceId": metadata.get("sourceId") or "", "host": destination[0], "port": destination[1],
                            }
                            await websocket.send(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
                            continue
                    except (ValueError, TypeError, json.JSONDecodeError) as exc:
                        response = {"type": "gateway.command.result", "ok": False, "message": str(exc)}
                        await websocket.send(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
                        continue
                try:
                    self.route_command(payload)
                except ValueError as exc:
                    response = {"type": "gateway.command.result", "ok": False, "message": str(exc)}
                    await websocket.send(json.dumps(response, ensure_ascii=False, separators=(",", ":")))
        finally:
            self.clients.discard(websocket)
            print(f"[ws] client disconnected ({len(self.clients)} total)")

    async def run(self) -> None:
        loop = asyncio.get_running_loop()
        transport, _protocol = await loop.create_datagram_endpoint(
            lambda: UdpReceiver(self),
            local_addr=(self.udp_host, self.udp_port),
        )
        print(f"[udp] listening on {self.udp_host}:{self.udp_port}")
        print(f"[ws] listening on ws://{self.ws_host}:{self.ws_port}")
        print(f"[cfg] {self.config.get('_config_path', '')}")

        status_task = asyncio.create_task(self.status_loop())
        try:
            async with serve(self.handle_client, self.ws_host, self.ws_port, max_size=None):
                stop = asyncio.Future()
                for sig in (signal.SIGINT, signal.SIGTERM):
                    try:
                        loop.add_signal_handler(sig, stop.cancel)
                    except (NotImplementedError, RuntimeError):
                        pass
                try:
                    await stop
                except asyncio.CancelledError:
                    pass
        finally:
            status_task.cancel()
            transport.close()


def main() -> int:
    args = parse_args()
    gateway = MultiUdpGateway(load_config(args.config))
    try:
        asyncio.run(gateway.run())
    except KeyboardInterrupt:
        pass
    print("[gateway] stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
