"""Run deterministic UI checks against a local build; no DB/auth secrets needed."""
import os, sys, subprocess, urllib.request, signal, socket, argparse
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SUITES = ["public_site_smoke.py", "routing_smoke.py", "stats_rtl_smoke.py", "setup_reminders_ui_smoke.py", "navigation_signup_ui_smoke.py", "map_interactions_smoke.py", "soft_map_ui_smoke.py",
          "map_layout_smoke.py", "mobile_forms_ui_smoke.py", "streak_page_ui_smoke.py", "world_map_ui_smoke.py", "performance_ui_smoke.py"]

def main():
    parser = argparse.ArgumentParser(); parser.add_argument("--port", type=int, default=4173); args = parser.parse_args()
    with socket.socket() as probe: probe.bind(("127.0.0.1", args.port))
    env = {**os.environ, "JISHOO_BASE_URL": f"http://127.0.0.1:{args.port}", "JISHOO_SYSTEM_HTTPS": "0"}
    if not env.get("CHROMIUM_EXECUTABLE_PATH"):
        with sync_playwright() as p:
            env["CHROMIUM_EXECUTABLE_PATH"] = p.chromium.executable_path
    process = subprocess.Popen(["npm", "run", "preview", "--", "--host", "127.0.0.1", "--port", str(args.port), "--strictPort"], cwd=ROOT, stdout=subprocess.DEVNULL, env=env, start_new_session=True)
    try:
        # A bounded readiness check with a functional HTML response.
        import time
        for _ in range(50):
            if process.poll() is not None: raise RuntimeError("Preview server failed to start (port 4173 must be available).")
            try:
                with urllib.request.urlopen(env["JISHOO_BASE_URL"], timeout=1) as response:
                    if response.status == 200 and b'id="root"' in response.read(): break
            except (OSError, urllib.error.URLError): pass
            time.sleep(.1)
        else: raise RuntimeError("Preview did not become ready.")
        for suite in SUITES:
            print("Running", suite, flush=True)
            subprocess.run([sys.executable, str(ROOT / "scripts" / suite)], cwd=ROOT, env=env, check=True, timeout=180)
    finally:
        try: os.killpg(process.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        try: process.wait(timeout=10)
        except subprocess.TimeoutExpired: os.killpg(process.pid, signal.SIGKILL); process.wait()

if __name__ == "__main__": main()
