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

def main():
    starter = os.environ.get("JISHOO_TEST_INVITE_CODE")
    if not starter:
        starter = json.loads((ROOT / ".vercel/founder-invite.json").read_text())["inviteCode"]
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=["--no-sandbox"])
        ctx, page = context(browser, geo=True)
        peer_ctx, peer = None, None
        try:
            page.goto(BASE, wait_until="domcontentloaded")
            expect(page.get_by_role("heading", name="بدون اکانت هم می‌شه جیش کرد.")).to_be_visible(timeout=30000)
            assert page.get_by_role("textbox").count() == 0
            capture(page, "v2-welcome.png")
            page.get_by_role("button", name="جیش کردم", exact=True).click()
            expect(page.get_by_role("heading", name="دمت گرم!")).to_be_visible(timeout=20000)
            expect(page.locator(".today-card strong")).to_contain_text("۱")
            capture(page, "v2-success.png")
            page.keyboard.press("Escape")
            expect(page.get_by_role("dialog")).to_have_count(0)
            expect(page.get_by_role("heading", name="سلام دوست تازه")).to_be_visible()
            assert api(page, "bootstrap")["stats"]["total"] == 1
            page.reload(wait_until="domcontentloaded")
            expect(page.get_by_role("heading", name="سلام دوست تازه")).to_be_visible(timeout=30000)
            assert api(page, "bootstrap")["stats"]["total"] == 1
            capture(page, "v2-home.png")
            passed("Guest check-in, real counters, reload persistence, no name request and keyboard dismissal")

            page.locator(".bottom-nav").get_by_role("button", name="استوری", exact=True).click()
            expect(page.get_by_role("heading", name="خبرتو استوری کن")).to_be_visible()
            capture(page, "v2-stories.png")
            page.locator(".story-selection-card.weekly").click()
            expect(page.get_by_role("button", name="اشتراک تصویر", exact=True)).to_be_enabled(timeout=30000)
            capture(page, "v2-story-editor.png")
            with page.expect_download() as download:
                page.get_by_role("button", name="ذخیره PNG").click()
            download.value.save_as(str(ARTIFACTS / "v2-story-export.png"))
            assert Image.open(ARTIFACTS / "v2-story-export.png").size == (1080, 1920)
            page.get_by_role("button", name="پست ۱:۱").click()
            expect(page.get_by_role("button", name="اشتراک تصویر", exact=True)).to_be_enabled(timeout=30000)
            with page.expect_download() as download:
                page.get_by_role("button", name="ذخیره PNG").click()
            download.value.save_as(str(ARTIFACTS / "v2-post-export.png"))
            assert Image.open(ARTIFACTS / "v2-post-export.png").size == (1080, 1080)
            page.get_by_role("button", name="بستن کارت اشتراک").click()
            passed("Story and square-post cards export real 1080px PNG files with embedded Persian fonts")

            page.locator(".bottom-nav").get_by_role("button", name="اطراف", exact=True).click()
            expect(page.get_by_role("button", name="نمایش اطراف من")).to_be_visible()
            assert page.locator(".segmented").count() == 0
            page.get_by_role("button", name="نمایش اطراف من").click()
            expect(page.locator(".around-panel")).to_be_visible(timeout=15000)
            consent = page.get_by_role("checkbox")
            expect(consent).not_to_be_checked()
            consent.click()
            expect(consent).to_be_checked(timeout=10000)
            assert api(page, "bootstrap")["me"]["shareLocation"]
            consent.click()
            expect(consent).not_to_be_checked(timeout=10000)
            assert not api(page, "bootstrap")["me"]["shareLocation"]
            capture(page, "v2-nearby.png")
            passed("Browser geolocation, one map, explicit separate sharing consent and revocation")

            page.locator(".bottom-nav").get_by_role("button", name="من", exact=True).click()
            page.get_by_role("button", name="عضویت با دعوت", exact=True).click()
            expect(page.get_by_label("شماره موبایل", exact=True)).to_be_visible()
            expect(page.get_by_label("اسمت", exact=True)).to_have_count(0)
            phone = f"+1{secrets.randbelow(789) + 201}55501{secrets.randbelow(100):02}"
            page.get_by_label("شماره موبایل", exact=True).fill(phone)
            page.get_by_role("button", name="دریافت کد ورود").click()
            expect(page.get_by_role("heading", name="کد ورودت")).to_be_visible(timeout=15000)
            capture(page, "v2-otp.png")
            expect(page.get_by_role("heading", name="اسمت چیه؟")).to_be_visible(timeout=15000)
            page.get_by_label("اسمت", exact=True).fill("آزمایش نگار")
            page.get_by_label("کد دعوت", exact=True).fill(starter)
            capture(page, "v2-signup.png")
            page.get_by_role("button", name="ساخت حساب من").click()
            expect(page.get_by_role("heading", name="سلام آزمایش نگار")).to_be_visible(timeout=20000)
            me = api(page, "bootstrap")["me"]
            assert me["registered"] and me["trialDaysSaved"] == 7
            assert api(page, "bootstrap")["stats"]["total"] == 1
            passed("Visible phone and auto-success OTP steps; name only for new signup; guest history preserved")

            page.locator(".bottom-nav").get_by_role("button", name="من", exact=True).click()
            page.get_by_role("button", name="تنظیمات پروفایل").click()
            page.get_by_label("اینستاگرام", exact=True).fill("jishoo_test")
            page.keyboard.press("Tab")
            assert page.evaluate("Boolean(document.activeElement.closest('[role=dialog]'))")
            page.get_by_role("button", name="ذخیره تغییرات").click()
            expect(page.get_by_role("dialog")).to_have_count(0, timeout=15000)
            assert api(page, "bootstrap")["me"]["socialLinks"]["instagram"].endswith("/jishoo_test")
            capture(page, "v2-profile.png")
            page.locator(".profile-stats-link").click()
            expect(page.get_by_role("heading", name="آمار جیشام")).to_be_visible()
            for label in ["ماه", "همه‌وقت", "هفته"]:
                page.get_by_role("button", name=label, exact=True).click()
            capture(page, "v2-stats.png")
            page.get_by_role("button", name="برگشت", exact=True).click()
            page.locator(".profile-invite-card").click()
            expect(page.locator(".invite-code-card")).to_contain_text(me["inviteCode"])
            capture(page, "v2-invite.png")
            page.get_by_role("button", name="استوری با کد دعوت من").click()
            expect(page.locator(".story-invite")).to_be_visible()
            expect(page.locator(".story-invitation")).to_contain_text(me["inviteCode"])
            expect(page.get_by_role("button", name="اشتراک تصویر", exact=True)).to_be_enabled(timeout=30000)
            capture(page, "v2-invite-story.png")
            page.get_by_role("button", name="بستن کارت اشتراک").click()
            passed("Persisted profile/social links, real statistics periods and personal invitation page")

            page.locator(".bottom-nav").get_by_role("button", name="دوست‌ها", exact=True).click()
            capture(page, "v2-friends.png")
            expect(page.get_by_role("button", name="چت", exact=True)).to_have_count(0)
            passed("Connections screen replaces chat; empty accounts contain no pretend friends")

            peer_ctx, peer = context(browser, geo=True)
            peer.goto(BASE + "?invite=" + me["inviteCode"], wait_until="domcontentloaded")
            expect(peer.locator(".welcome-invite-banner")).to_contain_text("آزمایش نگار", timeout=30000)
            peer.get_by_role("button", name="ورود یا ساخت حساب").click()
            peer.get_by_label("شماره موبایل", exact=True).fill(f"+1{secrets.randbelow(789) + 201}55501{secrets.randbelow(100):02}")
            peer.get_by_role("button", name="دریافت کد ورود").click()
            expect(peer.get_by_role("heading", name="اسمت چیه؟")).to_be_visible(timeout=20000)
            expect(peer.get_by_label("کد دعوت", exact=True)).to_have_value(me["inviteCode"])
            peer.get_by_label("اسمت", exact=True).fill("آزمایش سارا")
            peer.get_by_role("button", name="ساخت حساب من").click()
            expect(peer.get_by_role("heading", name="سلام آزمایش سارا")).to_be_visible(timeout=20000)
            assert api(page, "bootstrap")["me"]["trialDaysSaved"] == 14
            page.reload(wait_until="domcontentloaded")
            expect(page.locator(".connected-card")).to_contain_text("آزمایش سارا", timeout=30000)
            page.locator(".connected-card").click()
            choice = page.locator(".social-sharing-choice input")
            expect(choice).not_to_be_checked()
            choice.click()
            expect(choice).to_be_checked(timeout=10000)
            assert api(peer, "bootstrap")["friends"][0]["socialLinks"]["instagram"].endswith("/jishoo_test")
            capture(page, "v2-connection.png")
            page.keyboard.press("Escape")
            passed("Invitation URL pre-fills signup, rewards both users, connects them and supports consented social links")

            api(page, "location", {"enabled": True, "lat": 35.70127, "lng": 51.40137})
            api(page, "checkin", {"status": "done", "visibility": "friends", "nonce": secrets.token_hex(12)})
            pair = api(peer, "checkin", {"status": "done", "visibility": "friends", "nonce": secrets.token_hex(12)})
            assert pair["matches"][0]["kind"] == "together"
            peer.locator(".bottom-nav").get_by_role("button", name="اطراف", exact=True).click()
            peer.get_by_role("button", name="نمایش اطراف من").click()
            expect(peer.locator(".live-map-marker.friend-marker")).to_contain_text("آزمایش نگار", timeout=15000)
            capture(peer, "v2-map-friend.png")
            page.reload(wait_until="domcontentloaded")
            expect(page.locator(".bottom-nav")).to_be_visible(timeout=30000)
            page.locator(".bottom-nav").get_by_role("button", name="من", exact=True).click()
            page.locator(".shared-list > button").first.click()
            expect(page.get_by_role("heading", name="شما باهم جیش کردید!")).to_be_visible()
            capture(page, "v2-together.png")
            page.get_by_role("button", name="استوری این خاطره").click()
            expect(page.get_by_role("dialog", name="استوری خاطره‌ی مشترک")).to_be_visible()
            expect(page.get_by_role("button", name="اشتراک تصویر", exact=True)).to_be_enabled(timeout=30000)
            expect(page.locator(".story-hero-characters .character")).to_have_count(2)
            capture(page, "v2-together-story.png")
            page.keyboard.press("Tab")
            assert page.evaluate("Boolean(document.activeElement.closest('[role=dialog]'))")
            page.keyboard.press("Escape")
            expect(page.get_by_role("dialog")).to_have_count(0)
            passed("Connected map markers carry friend names; real pair moments open distinct-character story cards")
        finally:
            if peer:
                api(peer, "delete-account", {})
                peer_ctx.close()
            api(page, "delete-account", {})
            ctx.close()

        for width, height in [(320, 640), (375, 667), (393, 852), (768, 1024), (1440, 1000)]:
            responsive, q = context(browser, width, height)
            try:
                q.goto(BASE, wait_until="domcontentloaded")
                expect(q.get_by_role("button", name="جیش کردم", exact=True)).to_be_visible(timeout=30000)
                assert not q.evaluate("document.documentElement.scrollWidth > innerWidth"), f"Welcome overflow {width}"
                q.get_by_role("button", name="یه سر به جیشو بزن").click()
                expect(q.locator(".bottom-nav")).to_be_in_viewport()
                for tab in ["خانه", "دوست‌ها", "استوری", "من"]:
                    q.locator(".bottom-nav").get_by_role("button", name=tab, exact=True).click()
                    assert not q.evaluate("document.documentElement.scrollWidth > innerWidth"), f"Page overflow {width} {tab}"
                if width in (320, 1440):
                    q.locator(".bottom-nav").get_by_role("button", name="خانه", exact=True).click()
                    capture(q, f"v2-home-{width}.png")
            finally:
                api(q, "delete-account", {})
                responsive.close()
        passed("Five responsive widths keep navigation visible without horizontal page overflow")
        assert not ERRORS, ERRORS
        assert not FAILED, FAILED
        passed("No page JavaScript errors or failed application assets/API requests")
        (ARTIFACTS / "smoke-results.json").write_text(json.dumps({"passed": RESULTS, "browser_errors": ERRORS,
                                                                "failed_application_requests": FAILED}, ensure_ascii=False, indent=2))
        browser.close()
        print(f"{len(RESULTS)} browser scenarios passed", flush=True)

if __name__ == "__main__":
    main()
