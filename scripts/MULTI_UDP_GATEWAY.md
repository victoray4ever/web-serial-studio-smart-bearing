# MEMS-CMS Multi-UDP Gateway

The gateway receives UDP datagrams from multiple devices on one port, assigns
each sender a stable `sourceId`, and either preserves the original datagram
boundary or reassembles a fragmented byte stream into complete protocol frames
before publishing the payload plus source metadata to MEMS-CMS over WebSocket.

## Start

Install the same WebSocket dependency used by the legacy UDP bridge:

```powershell
pip install websockets
python scripts/multi_udp_gateway.py --config scripts/multi_udp_gateway.json
```

In MEMS-CMS, select **UDP**, choose **Multi-UDP Gateway**, keep the default
`ws://localhost:8765` endpoint, and connect.

## Configuration

- `udp.host` and `udp.port`: UDP listen endpoint shared by all devices.
- `websocket.host` and `websocket.port`: endpoint used by MEMS-CMS.
- `routing.devices`: fixed IP-to-`sourceId` assignments.
- `routing.unknownDevices`: `drop`, `ip`, or `ip-port`. `ip` is the default
  choice when sender ports aren't stable.
- `routing.sequence`: optional sequence field inside the original UDP payload.
  Set `enabled` to `true`, then specify byte `offset`, `size` and `byteOrder`.
- `routing.frameNumbering`: adds an independent, continuous `frameNumber` to
  every accepted packet for each `sourceId`. This doesn't modify the original
  UDP payload; the number is carried in the WebSocket metadata envelope.
- `routing.devices`: fixed mappings support `ip`, `sourceId`, `title`, optional
  receive-source `port`, and `commandPort` for directed commands.
- `aggregation.mode`: use `realtime` for legacy one-datagram forwarding or
  `frame` for per-source frame reassembly.
- `aggregation.frame`: frame mode settings. `startDelimiter` and `endDelimiter`
  are hexadecimal bytes; `frameLength` is the total frame size including both
  delimiters (use `0` for delimiter-only detection). `timeoutMs` discards an
  incomplete frame after the source becomes idle, and `maxBufferBytes` limits
  damaged or delimiter-free streams.
- `status.offlineAfterMs`: device offline timeout used by the status panel.
- `outbound`: optional default UDP destination for commands sent from MEMS-CMS.

Project `sources[].sourceId` and dataset `sourceId` values should match the
gateway configuration. Multiple devices can reuse the same parser and local
dataset indexes because MEMS-CMS routes them by `sourceId` first.

In frame mode each `sourceId` owns an independent buffer, so a missing or
offline device cannot block other sources. UDP packet counters remain raw
datagram counts, while frame counters and `frameNumber` advance only after a
complete frame has passed delimiter and fixed-length validation.

After MEMS-CMS connects, use the **Configure** button in the gateway status
card to edit these parameters. Changes are written atomically back to the JSON
file. Device routing, sequence and status settings apply immediately; UDP or
WebSocket listen endpoint changes require a gateway restart. For safety,
remote configuration is limited to localhost unless `control.allowRemote` is
enabled.

For commands sent from the MEMS-CMS console, select a discovered source in the
UDP sidebar. The browser wraps the unchanged command payload with its target
`sourceId`; the gateway removes that envelope and sends the raw payload to the
device IP and configured `commandPort`. `outbound.defaultSourceId` is used when
the browser doesn't select a target. The fallback `outbound.host` and `port`
remain available for legacy/default routing.
