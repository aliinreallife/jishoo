"""Current product/browser checks with real backend data and disposable accounts."""
import json
import secrets
import urllib.parse
import urllib.request
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright,expect
from smoke import context,api,capture,passed,BASE,CHROMIUM,RESULTS,ERRORS,FAILED,ARTIFACTS
from provision_admin import create_invite
from api_smoke import Client

ROOT=Path(__file__).resolve().parents[1]
owned=set()

def phone():return f"+1{secrets.randbelow(789)+201}55501{secrets.randbelow(100):02}"

def signup(page,name,code=None):
    page.get_by_role("button",name="ورود یا ساخت حساب").click()
    page.get_by_label("شماره موبایل",exact=True).fill(phone())
    page.get_by_role("button",name="دریافت کد ورود").click()
    expect(page.get_by_role("heading",name="کد ورودت")).to_be_visible(timeout=15000)
    expect(page.get_by_role("heading",name="اسمت چیه؟")).to_be_visible(timeout=15000)
    page.get_by_label("اسمت",exact=True).fill(name)
    if code:page.get_by_label("کد دعوت",exact=True).fill(code)
    page.get_by_role("button",name="ساخت حساب من").click()
    expect(page.locator(".bottom-nav")).to_be_visible(timeout=25000)
    me=api(page,"bootstrap")["me"]
    assert me["registered"] and me["name"]==name
    owned.add(me["id"])
    return me

def cleanup(page):
    me=api(page,"bootstrap")["me"]
    if me["id"] in owned or not me["registered"]:api(page,"delete-account",{})

def main():
    contexts=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=["--no-sandbox"])
        ctx,page=context(browser,geo=True);contexts.append((ctx,page))
        try:
            starter=create_invite("qa-member")["code"]
            page.goto(BASE,wait_until="domcontentloaded")
            expect(page.get_by_role("button",name="یه سر به جیشو بزن")).to_be_visible(timeout=30000)
            assert page.get_by_role("textbox").count()==0
            capture(page,"v3-welcome.png")
            page.get_by_role("button",name="یه سر به جیشو بزن").click()
            expect(page.locator(".bottom-nav button")).to_have_count(5)
            expect(page.locator(".bottom-nav").get_by_role("button",name="استوری",exact=True)).to_have_count(0)
            assert page.locator(".action-card .profile-avatar-image").count()==0
            expect(page.locator(".need-card img")).to_have_attribute("src","/assets/shy-drop.webp")
            expect(page.locator(".done-card img")).to_have_attribute("src","/assets/happy-drop.webp")
            capture(page,"v3-home.png")
            page.locator(".need-card").click()
            expect(page.locator(".need-reaction-art")).to_be_visible(timeout=20000)
            capture(page,"v3-need.png")
            page.get_by_role("button",name="استوریِ وضعیت اضطراری").click()
            expect(page.locator(".story-need")).to_be_visible()
            expect(page.get_by_role("button",name="اشتراک تصویر",exact=True)).to_be_enabled(timeout=30000)
            assert page.locator(".story-canvas .profile-avatar-image").count()==0
            page.get_by_role("button",name="آسمونی",exact=True).click()
            page.get_by_label("متن کارت اشتراک").fill("جیش دارم؛ کی همراهمه؟")
            expect(page.get_by_role("button",name="اشتراک تصویر",exact=True)).to_be_enabled(timeout=30000)
            capture(page,"v3-need-story.png")
            with page.expect_download() as download:page.get_by_role("button",name="ذخیره PNG").click()
            download.value.save_as(str(ARTIFACTS/"v3-need-export.png"))
            assert Image.open(ARTIFACTS/"v3-need-export.png").size==(1080,1920)
            page.get_by_role("button",name="پست ۱:۱").click()
            expect(page.get_by_role("button",name="اشتراک تصویر",exact=True)).to_be_enabled(timeout=30000)
            with page.expect_download() as download:page.get_by_role("button",name="ذخیره PNG").click()
            download.value.save_as(str(ARTIFACTS/"v3-square-export.png"))
            assert Image.open(ARTIFACTS/"v3-square-export.png").size==(1080,1080)
            page.keyboard.press("Escape")
            page.locator(".done-card").click()
            expect(page.locator(".personal-success img")).to_have_attribute("src","/assets/happy-drop.webp",timeout=15000)
            capture(page,"v3-success.png")
            page.get_by_role("button",name="این آخیش رو استوری کن").click()
            expect(page.locator(".story-checkin")).to_be_visible()
            expect(page.get_by_role("button",name="اشتراک تصویر",exact=True)).to_be_enabled(timeout=30000)
            capture(page,"v3-done-story.png")
            page.keyboard.press("Escape")
            assert api(page,"bootstrap")["stats"]["total"]==1
            passed("Original illustrated mascots, five tabs without share, and both contextual result/share flows work")
            passed("Personalized story themes/captions export real 1080×1920 stories and 1080×1080 posts")

            page.locator(".bottom-nav").get_by_role("button",name="من",exact=True).click()
            page.get_by_role("button",name="عضویت با دعوت",exact=True).click()
            expect(page.locator(".invitation-required")).to_contain_text("ثبت‌نام فقط با دعوته")
            page.get_by_label("شماره موبایل",exact=True).fill(phone())
            page.get_by_role("button",name="دریافت کد ورود").click()
            expect(page.get_by_role("heading",name="اسمت چیه؟")).to_be_visible(timeout=20000)
            page.get_by_label("اسمت",exact=True).fill("آزمایش نگار")
            expect(page.get_by_role("button",name="ساخت حساب من")).to_be_disabled()
            expect(page.locator(".invite-required-help")).to_be_visible()
            capture(page,"v3-invite-required.png")
            page.get_by_label("کد دعوت",exact=True).fill(starter)
            page.get_by_role("button",name="ساخت حساب من").click()
            expect(page.get_by_role("heading",name="سلام آزمایش نگار")).to_be_visible(timeout=25000)
            me=api(page,"bootstrap")["me"];owned.add(me["id"])
            assert api(page,"bootstrap")["stats"]["total"]==1
            page.locator(".bottom-nav").get_by_role("button",name="من",exact=True).click()
            page.get_by_role("button",name="تنظیمات پروفایل").click()
            page.get_by_label("شناسه‌ی یکتا").fill("qa_"+secrets.token_hex(4))
            page.get_by_label("اینستاگرام",exact=True).fill("jishoo_test")
            page.locator('input[type="file"]').set_input_files(str(ROOT/"public/assets/app-icon-192.png"))
            expect(page.locator(".avatar-upload-row .uploaded-avatar")).to_be_visible(timeout=15000)
            capture(page,"v3-avatar-upload.png")
            page.get_by_role("button",name="ذخیره تغییرات").click()
            expect(page.get_by_role("dialog")).to_have_count(0,timeout=15000)
            me=api(page,"bootstrap")["me"]
            assert me["avatarImage"].startswith("data:image/jpeg;base64,")
            capture(page,"v3-profile.png")
            page.reload(wait_until="domcontentloaded")
            expect(page.locator(".profile-avatar .uploaded-avatar")).to_be_visible(timeout=25000)
            page.get_by_role("button",name="تنظیمات پروفایل").click()
            page.get_by_role("button",name="برگشت به شخصیت من").click()
            expect(page.locator(".avatar-upload-row .uploaded-avatar")).to_have_count(0,timeout=15000)
            page.keyboard.press("Escape")
            passed("Invite-only signup is explicit; optional photos persist and removal restores the name-based profile avatar")

            page.locator(".profile-invite-card").click()
            expect(page.locator(".invitation-quota-card")).to_contain_text("۳ دعوت باقی مونده")
            capture(page,"v3-invitation-quota.png")
            peer_ctx,peer=context(browser,geo=True);contexts.append((peer_ctx,peer))
            peer.goto(BASE+"?invite="+me["inviteCode"],wait_until="domcontentloaded")
            expect(peer.locator(".welcome-invite-banner")).to_contain_text("آزمایش نگار",timeout=30000)
            capture(peer,"v3-invited-by.png")
            peer_me=signup(peer,"آزمایش سارا")
            expect(peer.locator(".pending-home")).to_contain_text("منتظر جوابته")
            peer.locator(".bottom-nav").get_by_role("button",name="دوست‌ها",exact=True).click()
            capture(peer,"v3-inviter-request.png")
            peer.locator(".accept-request").click()
            expect(peer.locator(".connected-card")).to_contain_text("آزمایش نگار",timeout=15000)
            page.reload(wait_until="domcontentloaded")
            expect(page.locator(".invitation-quota-card")).to_contain_text("۲ دعوت باقی مونده",timeout=25000)
            expect(page.locator(".invited-members")).to_contain_text("آزمایش سارا")
            page.locator(".bottom-nav").get_by_role("button",name="دوست‌ها",exact=True).click()
            page.locator(".connected-card").click()
            social=page.locator(".social-sharing-choice input").first
            social.click();expect(social).to_be_checked(timeout=10000)
            assert api(peer,"bootstrap")["friends"][0]["socialLinks"]["instagram"].endswith("/jishoo_test")
            notifications=page.locator(".social-sharing-choice input").nth(1)
            notifications.click();expect(notifications).not_to_be_checked(timeout=10000)
            capture(page,"v3-friend-consent.png");page.keyboard.press("Escape")
            passed("Invite links show the inviter, create an incoming request, consume a slot and expose friend-specific consent controls")

            point={"lat":35.70127,"lng":51.40137}
            api(page,"location",{**point,"enabled":True});api(page,"discoverable",{"enabled":True})
            peer.locator(".bottom-nav").get_by_role("button",name="هم‌جیش",exact=True).click()
            peer.get_by_role("button",name="پیدا کردن هم‌جیش‌های اطراف").click()
            expect(peer.locator(".discover-person")).to_contain_text("آزمایش نگار",timeout=20000)
            capture(peer,"v3-discover.png")
            peer.locator(".discover-consent input").click()
            expect(peer.locator(".discover-consent input")).to_be_checked(timeout=15000)
            assert api(peer,"bootstrap")["me"]["discoverable"]
            api(page,"checkin",{"status":"done","visibility":"friends","nonce":secrets.token_hex(12)})
            pair=api(peer,"checkin",{"status":"done","visibility":"friends","nonce":secrets.token_hex(12)})
            assert pair["matches"][0]["kind"]=="together"
            peer.locator(".bottom-nav").get_by_role("button",name="اطراف",exact=True).click()
            peer.get_by_role("button",name="نمایش اطراف من").click()
            expect(peer.locator(".live-map-marker.friend-marker")).to_contain_text("آزمایش نگار",timeout=15000)
            capture(peer,"v3-nearby.png")
            page.reload(wait_until="domcontentloaded")
            expect(page.locator(".bottom-nav")).to_be_visible(timeout=25000)
            page.locator(".bottom-nav").get_by_role("button",name="من",exact=True).click()
            page.locator(".shared-list>button").first.click()
            expect(page.get_by_role("heading",name="شما باهم جیش کردید!")).to_be_visible()
            assert page.locator(".moment-characters .profile-avatar-image").count()==0
            capture(page,"v3-together.png")
            page.get_by_role("button",name="استوری این خاطره").click()
            expect(page.locator(".story-hero-characters .pair-art")).to_be_visible()
            expect(page.get_by_role("button",name="اشتراک تصویر",exact=True)).to_be_enabled(timeout=30000)
            capture(page,"v3-together-story.png")
            page.keyboard.press("Tab");assert page.evaluate("Boolean(document.activeElement.closest('[role=dialog]'))")
            page.keyboard.press("Escape")
            passed("Nearby buddy discovery, explicit discovery consent, labeled friend markers and illustrated pair stories work")

            page.get_by_role("button",name="قشنگی‌های کوچیک من",exact=False).click()
            expect(page.locator(".achievement-card")).to_have_count(5)
            expect(page.locator(".achievement-card.earned").first).to_be_visible()
            capture(page,"v3-achievements.png")
            page.get_by_role("button",name="برگشت",exact=True).click()
            page.get_by_role("button",name="خبرها و اعلان‌ها",exact=False).click()
            expect(page.locator(".notification-item").first).to_be_visible()
            all_notifs=page.locator(".notification-settings input").first
            all_notifs.click();expect(all_notifs).not_to_be_checked(timeout=15000)
            all_notifs.click();expect(all_notifs).to_be_checked(timeout=15000)
            capture(page,"v3-notifications.png")
            if BASE.startswith("http://"):
                assert page.evaluate("navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready).then(r=>r.active.scriptURL.endsWith('/sw.js'))")
            public_ctx,public=context(browser);contexts.append((public_ctx,public))
            public.goto(BASE+"/u/"+me["handle"],wait_until="domcontentloaded")
            expect(public.get_by_role("heading",name="آزمایش نگار",exact=True)).to_be_visible(timeout=25000)
            expect(public.locator(".public-handle")).to_contain_text(me["handle"])
            capture(public,"v3-public-profile.png")
            with urllib.request.urlopen("https://jishoo.vercel.app/u/"+me["handle"],timeout=30) as response:
                html=response.read().decode()
            assert 'property="og:title"' in html and me["handle"] in html and 'property="og:image"' in html
            assert "/assets/social-preview.png" in html
            passed("Leveled achievements, notification settings, public handle profiles and the local push worker render and work")

            admin_code=create_invite("qa-admin")["code"]
            admin_ctx,admin=context(browser);contexts.append((admin_ctx,admin))
            admin.goto(BASE+"?invite="+admin_code,wait_until="domcontentloaded")
            expect(admin.get_by_role("button",name="ورود یا ساخت حساب")).to_be_visible(timeout=25000)
            admin_me=signup(admin,"مدیر آزمایش مرورگر")
            assert admin_me["isAdmin"]
            expect(admin.get_by_role("heading",name="پشت‌صحنه‌ی جیشو")).to_be_visible(timeout=20000)
            expect(admin.locator(".admin-totals>div")).to_have_count(4)
            admin.get_by_role("button",name="ساخت لینک یک‌بارمصرف").click()
            expect(admin.get_by_label("لینک خصوصی ساخته‌شده")).to_be_visible(timeout=15000)
            link=admin.get_by_label("لینک خصوصی ساخته‌شده").input_value()
            assert urllib.parse.parse_qs(urllib.parse.urlsplit(link).query)["invite"]
            admin.get_by_label("جستجوی اعضا").fill("آزمایش نگار")
            lifetime=admin.locator(".admin-user-list article input").first
            expect(lifetime).not_to_be_checked()
            lifetime.click();expect(lifetime).to_be_checked(timeout=15000)
            assert api(page,"bootstrap")["me"]["lifetime"]
            capture(admin,"v3-admin.png")
            admin.locator(".community-heading").scroll_into_view_if_needed()
            capture(admin,"v3-admin-top.png")
            passed("Private-link admin signup opens the dashboard; one-use invitation creation and lifetime gifts work in the UI")

        finally:
            for ctx,q in contexts:
                try:cleanup(q)
                finally:ctx.close()

        for width,height in [(320,640),(375,667),(393,852),(768,1024),(1440,1000)]:
            ctx,q=context(browser,width,height)
            try:
                q.goto(BASE,wait_until="domcontentloaded")
                expect(q.get_by_role("button",name="یه سر به جیشو بزن")).to_be_visible(timeout=30000)
                assert not q.evaluate("document.documentElement.scrollWidth>innerWidth")
                q.get_by_role("button",name="یه سر به جیشو بزن").click()
                expect(q.locator(".bottom-nav")).to_be_in_viewport()
                for tab in ["خانه","هم‌جیش","دوست‌ها","من"]:
                    q.locator(".bottom-nav").get_by_role("button",name=tab,exact=True).click()
                    assert not q.evaluate("document.documentElement.scrollWidth>innerWidth"),f"Overflow {width} {tab}"
                q.locator(".bottom-nav").get_by_role("button",name="خانه",exact=True).click()
                q.locator(".need-card").click()
                expect(q.locator(".need-reaction-art")).to_be_visible(timeout=15000)
                q.get_by_role("button",name="استوریِ وضعیت اضطراری").scroll_into_view_if_needed()
                assert not q.evaluate("document.documentElement.scrollWidth>innerWidth")
                if width in (320,1440):capture(q,f"v3-responsive-{width}.png")
            finally:cleanup(q);ctx.close()
        passed("Five viewport sizes preserve navigation and usable contextual actions without horizontal overflow")
        assert not ERRORS,ERRORS
        assert not FAILED,FAILED
        passed("No page JavaScript errors or failed application assets/API requests")
        (ARTIFACTS/"smoke-results.json").write_text(json.dumps({"passed":RESULTS,"browser_errors":ERRORS,"failed_application_requests":FAILED},ensure_ascii=False,indent=2))
        browser.close()
        print(f"{len(RESULTS)} browser scenarios passed",flush=True)

if __name__=="__main__":main()
