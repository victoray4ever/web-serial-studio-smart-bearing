#!/usr/bin/env python3
"""Bridge raw STM32 binary frames from serial to MQTT.

This script reads a serial stream, extracts complete frames delimited by:
  header: 5A A5
  tail:   DD EE

Each complete frame is published to MQTT as raw bytes. This is important:
the MQTT payload is binary data, not an ASCII hex string.

Example:
  python scripts/serial_to_mqtt_raw.py ^
    --serial-port COM12 ^
    --baudrate 921600 ^
    --mqtt-host broker.emqx.io ^
    --mqtt-port 1883 ^
    --topic codex/test/20260422/a1b2c3
"""

from __future__ import annotations

import argparse
import sys
import time

try:
    import serial
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: pyserial\n"
        "Install with: pip install pyserial paho-mqtt"
    ) from exc

try:
    import paho.mqtt.client as mqtt
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Missing dependency: paho-mqtt\n"
        "Install with: pip install pyserial paho-mqtt"
    ) from exc


HEADER = b"\x5A\xA5"
TAIL = b"\xDD\xEE"
MAX_FRAME_LEN = 20000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Publish raw STM32 binary frames from serial to MQTT."
    )
    parser.add_argument("--serial-port", required=True, help="Serial port, e.g. COM12")
    parser.add_argument("--baudrate", type=int, default=921600, help="Serial baudrate")
    parser.add_argument("--timeout", type=float, default=0.05, help="Serial read timeout in seconds")
    parser.add_argument("--mqtt-host", required=True, help="MQTT broker host")
    parser.add_argument("--mqtt-port", type=int, default=1883, help="MQTT broker TCP port")
    parser.add_argument("--topic", required=True, help="MQTT topic to publish frames to")
    parser.add_argument("--username", default="", help="MQTT username")
    parser.add_argument("--password", default="", help="MQTT password")
    parser.add_argument("--client-id", default="stm32-raw-bridge", help="MQTT client id")
    parser.add_argument("--qos", type=int, choices=[0, 1, 2], default=0, help="MQTT QoS")
    parser.add_argument("--retain", action="store_true", help="Publish with MQTT retain flag")
    parser.add_argument("--tls", action="store_true", help="Enable MQTT TLS")
    parser.add_argument(
        "--publish-hex-topic",
        default="",
        help="Optional debug topic to also publish the frame as a hex string",
    )
    return parser.parse_args()


def build_mqtt_client(args: argparse.Namespace) -> mqtt.Client:
    client = mqtt.Client(client_id=args.client_id, protocol=mqtt.MQTTv311)
    if args.username:
        client.username_pw_set(args.username, args.password)
    if args.tls:
        client.tls_set()
    client.connect(args.mqtt_host, args.mqtt_port, keepalive=60)
    client.loop_start()
    return client


def extract_frames(buffer: bytearray) -> list[bytes]:
    frames: list[bytes] = []

    while True:
        start = buffer.find(HEADER)
        if start == -1:
            if len(buffer) > 1:
                del buffer[:-1]
            break

        if start > 0:
            del buffer[:start]
            start = 0

        search_from = len(HEADER)
        end = buffer.find(TAIL, search_from)
        if end == -1:
            if len(buffer) > MAX_FRAME_LEN:
                del buffer[:2]
            break

        frame_end = end + len(TAIL)
        frame = bytes(buffer[:frame_end])
        del buffer[:frame_end]
        frames.append(frame)

    return frames


def main() -> int:
    args = parse_args()

    print(f"[bridge] opening serial: {args.serial_port} @ {args.baudrate}")
    ser = serial.Serial(args.serial_port, args.baudrate, timeout=args.timeout)

    print(f"[bridge] connecting mqtt: {args.mqtt_host}:{args.mqtt_port}")
    client = build_mqtt_client(args)

    buffer = bytearray()
    frame_count = 0

    try:
        while True:
            chunk = ser.read(4096)
            if not chunk:
                continue

            buffer.extend(chunk)
            for frame in extract_frames(buffer):
                info = client.publish(args.topic, payload=frame, qos=args.qos, retain=args.retain)
                info.wait_for_publish()

                if args.publish_hex_topic:
                    hex_payload = frame.hex(" ")
                    debug = client.publish(
                        args.publish_hex_topic,
                        payload=hex_payload.encode("ascii"),
                        qos=args.qos,
                        retain=False,
                    )
                    debug.wait_for_publish()

                frame_count += 1
                print(
                    f"[bridge] published frame #{frame_count}: "
                    f"{len(frame)} bytes, head={frame[:2].hex(' ')}, tail={frame[-2:].hex(' ')}"
                )

    except KeyboardInterrupt:
        print("\n[bridge] stopped by user")
    finally:
        try:
            client.loop_stop()
            client.disconnect()
        finally:
            ser.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())
