from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import argparse
import os
import socket
import subprocess
import time


ROOT = Path(__file__).resolve().parents[1]
EDGE_CANDIDATES = [
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
    Path("msedge"),
]


SCENARIOS = [
    ("image1.png", "/docs/web-system-architecture-diagram.svg", (1600, 900), 1800),
    ("image2.png", "/?capture=main-dashboard", (1600, 980), 2600),
    ("image3.png", "/?capture=project-editor", (1600, 1020), 3200),
    ("image4.png", "/?capture=preferences", (1600, 1020), 3200),
    ("image5.png", "/?capture=mqtt-config", (1600, 1020), 2600),
    ("image6.png", "/?capture=console", (1600, 1020), 2600),
    ("image7.png", "/?capture=project-dashboard", (1600, 1020), 3600),
]


class RepoStaticHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)


def find_edge() -> str:
    for candidate in EDGE_CANDIDATES:
      if candidate.exists():
          return str(candidate)
    return "msedge"


def pick_port(preferred: int) -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", preferred))
        return sock.getsockname()[1]


def run_server(port: int):
    server = ThreadingHTTPServer(("127.0.0.1", port), RepoStaticHandler)
    thread = Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, thread


def capture(edge_path: str, url: str, out_path: Path, width: int, height: int, budget_ms: int):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        edge_path,
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        "--run-all-compositor-stages-before-draw",
        f"--window-size={width},{height}",
        f"--virtual-time-budget={budget_ms}",
        f"--screenshot={out_path}",
        url,
    ]
    subprocess.run(cmd, check=True)


def main():
    parser = argparse.ArgumentParser(description="Capture screenshots for the design document.")
    parser.add_argument("--output-dir", required=True, help="Directory where the PNG assets will be saved.")
    parser.add_argument("--port", type=int, default=8123, help="Preferred local HTTP port.")
    args = parser.parse_args()

    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    edge_path = find_edge()
    port = pick_port(args.port)
    server, thread = run_server(port)
    try:
        time.sleep(0.6)
        for filename, path, (width, height), budget in SCENARIOS:
            capture(edge_path, f"http://127.0.0.1:{port}{path}", output_dir / filename, width, height, budget)
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


if __name__ == "__main__":
    main()
