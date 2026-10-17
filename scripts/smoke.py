"""Browser checks against the real testing backend; only owned QA data is removed."""
import json
import os
from pathlib import Path
import secrets
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "artifacts"
ARTIFACTS.mkdir(exist_ok=True)
BASE = os.environ.get("JISHOO_BASE_URL", "http://127.0.0.1:4173/").rstrip("/")
CHROMIUM = os.environ.get("CHROMIUM_EXECUTABLE_PATH", "/usr/bin/chromium")
RESULTS, ERRORS, FAILED = [], [], []

def passed(label):
    RESULTS.append(label)
    print("PASS:", label, flush=True)

def api(page, action, body=None):
    return page.evaluate("""async ({action,body}) => {
      const response = await fetch('/api/app?action='+action, body === null ? {} : {
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
      });
      if(!response.ok) throw new Error('QA API failed: '+action+' '+response.status);
      return await response.json();
    }""", {"action": action, "body": body})

def verified_https(context):
    # urllib verifies TLS with the system CA, which includes the managed cloud
    # proxy CA missing from Chromium. Keep the deployed origin and real data.
    # No TLS bypass, synthetic app responses or browser credential files.
    if not BASE.startswith("https://") or os.environ.get("JISHOO_SYSTEM_HTTPS") != "1":
        return
    origin = urllib.parse.urlsplit(BASE)
    origin = origin.scheme + "://" + origin.netloc
    cache = {}
    def handle(route):
        request = route.request
        cacheable = request.method == "GET" and "/api/" not in request.url
        if cacheable and request.url in cache:
            route.fulfill(**cache[request.url])
            return
        headers = {k: v for k, v in request.all_headers().items()
                   if k not in ("host", "accept-encoding", "connection", "content-length")}
        if os.environ.get("JISHOO_TEST_BYPASS_SECRET"):
            headers["x-vercel-protection-bypass"] = os.environ["JISHOO_TEST_BYPASS_SECRET"]
        req = urllib.request.Request(request.url, data=request.post_data_buffer, headers=headers, method=request.method)
        try:
            response = urllib.request.urlopen(req, timeout=40)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            result = {"status": response.code, "body": response.read(),
                      "headers": {k.lower(): v for k, v in response.headers.items()
                                  if k.lower() not in ("content-length", "content-encoding", "transfer-encoding", "connection")}}
        if cacheable:
            cache[request.url] = result
        route.fulfill(**result)
    context.route(origin + "/**", handle)

def context(browser, width=393, height=852, geo=False):
    ctx = browser.new_context(viewport={"width": width, "height": height}, device_scale_factor=1,
                              reduced_motion="reduce", accept_downloads=True,
                              geolocation={"latitude": 35.70127, "longitude": 51.40137},
                              permissions=["geolocation"] if geo else [])
    verified_https(ctx)
    page = ctx.new_page()
    page.on("pageerror", lambda error: ERRORS.append(str(error)))
    page.on("response", lambda response: FAILED.append(f"{response.status} {response.url}")
            if response.status >= 400 and urllib.parse.urlsplit(response.url).netloc == urllib.parse.urlsplit(BASE).netloc else None)
    return ctx, page

def capture(page, name):
    page.screenshot(path=str(ARTIFACTS / name))

if __name__ == "__main__":
    from v4_smoke import main
    main()
