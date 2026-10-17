"""Check story ink against social UI margins and verify the restrained UI scale.

Run against the Vite development server. Canvas cases use explicit render-only
fixtures with real fonts/assets; UI/export cases use one disposable guest.
No Google/phone fixture, member registration or synthetic API response is used.
"""
import base64
import hashlib
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright, expect
from api_smoke import Client
from smoke import BASE, CHROMIUM, ARTIFACTS, context

ROOT = Path(__file__).resolve().parents[1]
OUT = ARTIFACTS / "story-safe-area"
OUT.mkdir(exist_ok=True)
VERSION = json.loads((ROOT / "package.json").read_text())["version"]
KINDS = ["need", "checkin", "weekly", "invite", "together", "back-to-back"]
TRACK_INK = """(() => {
  const records = window.qaStoryCanvases = {}, ids = new WeakMap(); let next = 0;
  function capture(ctx, entry) {
    if (ctx.canvas.width !== 1080 || ![1080,1920].includes(ctx.canvas.height)) return;
    if (!ids.has(ctx.canvas)) ids.set(ctx.canvas, ++next);
    const id = ids.get(ctx.canvas); window.qaLastStory = id;
    (records[id] ||= []).push(entry);
  }
  function bounds(ctx,x,y,w,h) {
    const t=ctx.getTransform(), points=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([x,y])=>({x:t.a*x+t.c*y+t.e,y:t.b*x+t.d*y+t.f}));
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    return {left:Math.min(...xs),right:Math.max(...xs),top:Math.min(...ys),bottom:Math.max(...ys),points:[points[0],points[1],points[3],points[2]]};
  }
  const proto=CanvasRenderingContext2D.prototype, fill=proto.fillText, draw=proto.drawImage;
  proto.fillText=function(value,x,y,...rest) {
    const m=this.measureText(String(value));
    capture(this,{type:'text',text:String(value),box:bounds(this,x-m.actualBoundingBoxLeft,y-m.actualBoundingBoxAscent,m.actualBoundingBoxLeft+m.actualBoundingBoxRight,m.actualBoundingBoxAscent+m.actualBoundingBoxDescent)});
    return fill.call(this,value,x,y,...rest);
  };
  proto.drawImage=function(...a) {
    const img=a[0],r=a.length===9?a.slice(5):a.length===5?a.slice(1):[a[1],a[2],img.naturalWidth||img.width,img.naturalHeight||img.height];
    capture(this,{type:'image',box:bounds(this,...r)});return draw.apply(this,a);
  };
})();"""


def check_ink(records, square, label):
    left, right, top, bottom = (0, 1080, 0, 1080) if square else (80, 1000, 250, 1670)
    for row in records:
        b = row["box"]
        assert b["left"] >= left - 1 and b["right"] <= right + 1 and b["top"] >= top - 1 and b["bottom"] <= bottom + 1, (label, row)
    texts = [row for row in records if row["type"] == "text"]
    for i, a in enumerate(texts):
        for b in texts[i + 1:]:
            # Compare the oriented ink rectangles: an axis-aligned envelope
            # would incorrectly report collisions on the tilted weekly card.
            ap, bp = a["box"]["points"], b["box"]["points"]
            separated = False
            for polygon in [ap, bp]:
                for first, second in zip(polygon, polygon[1:] + polygon[:1]):
                    axis = (first["y"] - second["y"], second["x"] - first["x"])
                    length = math.hypot(*axis)
                    if not length:
                        continue
                    av = [point["x"] * axis[0] + point["y"] * axis[1] for point in ap]
                    bv = [point["x"] * axis[0] + point["y"] * axis[1] for point in bp]
                    if min(max(av), max(bv)) - max(min(av), min(bv)) <= 3 * length:
                        separated = True
            assert separated, (label, "overlapping text", a, b)


def main():
    guest = Client()
    state = guest.bootstrap()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=["--no-sandbox"])
        try:
            ctx, page = context(browser, geo=True)
            token = next(c.value for c in guest.cookies if c.name == "jishoo_session")
            ctx.add_cookies([{"name": "jishoo_session", "value": token, "url": BASE, "httpOnly": True, "sameSite": "Lax"}])
            ctx.add_init_script("localStorage.setItem('jishoo:last-seen-release'," + json.dumps(VERSION) + ");localStorage.setItem('jishoo:v2-entered','true')")
            ctx.add_init_script(TRACK_INK)
            ctx.add_init_script("""Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
              Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{
                const bytes=await payload.files[0].arrayBuffer();window.qaShared=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
              }});""")
            errors = []
            page.on("pageerror", lambda error: errors.append(error.stack))
            viewports = [] if "--render-only" in sys.argv else [(320, 568), (393, 852), (812, 375), (1440, 900)]
            for width, height in viewports:
                page.set_viewport_size({"width": width, "height": height})
                for route, selector in [("home", ".action-grid"), ("stats", ".stats-trend"), ("profile", ".premium-card")]:
                    page.goto(BASE + "/#/" + route)
                    expect(page.locator(selector)).to_be_visible(timeout=25000)
                    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), (width, route)
                    if route == "home":
                        assert page.locator('.action-card strong').first.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)') == 22
                    if route == "stats":
                        for text in [".community-heading p", ".trend-navigation > span", ".stats-privacy-note"]:
                            assert 11.5 <= page.locator(text).evaluate("e=>parseFloat(getComputedStyle(e).fontSize)") <= 12.5
                    page.screenshot(path=str(OUT / f"ui-{route}-{width}.png"))
                for kind in ["need", "checkin", "weekly", "invite"]:
                    page.goto(BASE + "/#/stories/" + kind)
                    save = page.get_by_role("button", name="ذخیره PNG", exact=True)
                    expect(save).to_be_enabled(timeout=30000)
                    for label, png_height in [("استوری ۹:۱۶", 1920), ("پست ۱:۱", 1080)]:
                        page.get_by_role("button", name=label, exact=True).click()
                        expect(page.locator("img.story-raster-preview")).to_have_js_property("naturalHeight", png_height)
                        expect(save).to_be_enabled(timeout=30000)
                        for name in ["ذخیره PNG", "اشتراک تصویر"]:
                            box = page.get_by_role("button", name=name, exact=True).bounding_box()
                            assert box["y"] >= 0 and box["y"] + box["height"] <= height + 1, (width, kind, name, box)
                        assert page.locator(".story-editor").evaluate("e=>e.scrollHeight<=e.clientHeight+1")
                        if width == 393:
                            preview_hash = page.locator("img.story-raster-preview").evaluate("""async img=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(img.src)).arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('')""")
                            with page.expect_download() as download:
                                save.click()
                            path = OUT / f"export-{kind}-{png_height}.png"
                            download.value.save_as(str(path))
                            assert hashlib.sha256(path.read_bytes()).hexdigest() == preview_hash
                            page.evaluate("window.qaShared=null")
                            page.get_by_role("button", name="اشتراک تصویر", exact=True).click()
                            page.wait_for_function("window.qaShared!==null")
                            assert page.evaluate("window.qaShared") == preview_hash
                    if width == 393:
                        page.screenshot(path=str(OUT / f"editor-{kind}.png"))
            if viewports:
                page.set_viewport_size({"width": 320, "height": 568})
                page.goto(BASE + "/#/nearby")
                page.get_by_role("button", name="نمایش اطراف من", exact=True).click()
                expect(page.locator(".map-visibility-control")).to_be_visible(timeout=20000)
                for label in ["بزرگ‌نمایی نقشه", "کوچک‌نمایی نقشه", "مکان من"]:
                    button = page.get_by_role("button", name=label, exact=True)
                    assert button.evaluate("e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}")
                page.screenshot(path=str(OUT / "ui-map-320.png"))
                for width, height in [(320, 568), (1440, 900)]:
                    page.set_viewport_size({"width": width, "height": height})
                    for route in ["/", "/support", "/terms", "/privacy", "/changelog"]:
                        page.goto(BASE + route)
                        expect(page.get_by_role("heading", level=1)).to_be_visible(timeout=20000)
                        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), (route, width)
                page.set_viewport_size({"width": 320, "height": 568})
                page.goto(BASE + "/?login=1#/home")
                expect(page.get_by_label("کد دعوت عضویت", exact=True)).to_be_visible(timeout=20000)
                assert page.get_by_label("کد دعوت عضویت", exact=True).evaluate("e=>parseFloat(getComputedStyle(e).fontSize)") == 16
                assert page.locator(".dialog-description").evaluate("e=>parseFloat(getComputedStyle(e).fontSize)") == 12.5
                page.screenshot(path=str(OUT / "ui-signup-320.png"))
                page.keyboard.press("Escape")

                early_ctx, early = context(browser)
                early_ctx.add_cookies([{"name": "jishoo_session", "value": token, "url": BASE, "httpOnly": True, "sameSite": "Lax"}])
                early_ctx.add_init_script("localStorage.setItem('jishoo:last-seen-release'," + json.dumps(VERSION) + ");localStorage.setItem('jishoo:v2-entered','true')")
                early.on("pageerror", lambda error: errors.append(error.stack))
                early.goto(BASE + "/#/stories/need")
                expect(early.get_by_role("button", name="ذخیره PNG", exact=True)).to_be_enabled(timeout=30000)
                early.goto(BASE + "/#/home")
                expect(early.locator(".need-card")).to_be_visible(timeout=20000)
                early.clock.install()
                early.clock.pause_at(datetime.now(timezone.utc))
                writes = []
                early.on("request", lambda request: writes.append(request.url) if "action=checkin" in request.url else None)
                for width, height in [(320, 568), (812, 375)]:
                    early.set_viewport_size({"width": width, "height": height})
                    for selector in [".need-card", ".done-card"]:
                        early.locator(selector).click()
                        early.get_by_role("button", name="استوری این لحظه", exact=True).click()
                        expect(early.locator(".story-undo-slot")).to_be_visible()
                        for label in ["استوری ۹:۱۶", "پست ۱:۱"]:
                            early.get_by_role("button", name=label, exact=True).click()
                            save = early.get_by_role("button", name="ذخیره PNG", exact=True)
                            expect(save).to_be_enabled(timeout=30000)
                            for control in [save, early.get_by_role("button", name="لغو ثبت", exact=True)]:
                                box = control.bounding_box()
                                assert box["y"] >= 0 and box["y"] + box["height"] <= height + 1
                            assert early.locator(".story-editor").evaluate("e=>e.scrollHeight<=e.clientHeight+1")
                        early.screenshot(path=str(OUT / f"ui-undo-{selector[1:]}-{width}.png"))
                        early.get_by_role("button", name="لغو ثبت", exact=True).click()
                        early.clock.run_for(3500)
                        assert not writes
                early_ctx.close()
                assert not errors, errors
                print("PASS: Restrained text scale and all four editors fit four viewports in both formats; eight PNG downloads and native-share files match the previews.", flush=True)
                print("PASS: Public pages, invitation entry, short-phone map controls and both undo/editor layouts remain usable; cancelling prevents event writes.", flush=True)
            if "--ui-only" in sys.argv:
                return
            page.goto(BASE + "/#/stories/need")
            expect(page.get_by_role("button", name="ذخیره PNG", exact=True)).to_be_enabled(timeout=30000)

            # Render-only fixtures stress name/caption length and pair cards without
            # creating fake accounts, events or social relationships in the DB.
            cases = [{"kind": kind, "format": fmt, "caption": "", "count": 37} for kind in KINDS for fmt in ["story", "square"]]
            cases += [{"kind": kind, "format": "story", "caption": ("یه روز ساده کنار دوست‌های خوبم، با کلی لبخند و خاطره. " * 2)[:100], "count": 37} for kind in KINDS]
            cases += [{"kind": kind, "format": "story", "caption": "W" * 100, "count": 37} for kind in KINDS]
            cases += [{"kind": "weekly", "format": "square", "caption": "W" * 100, "count": 37}]
            cases += [{"kind": "weekly", "format": "story", "caption": "", "count": count} for count in [0, 1]]
            previews = []
            for i, case in enumerate(cases):
                result = page.evaluate("""async ({state,options,index})=>{
                  const {renderStoryImage}=await import('/src/story-renderer.js');
                  const QRCode=(await import('/node_modules/.vite/deps/qrcode.js')).default;
                  const data={...state,me:{...state.me,registered:true,name:options.caption?'آزمایش نام طولانی برای کارت جیشو':'علی',handle:'test_story_12345678901234'},stats:{...state.stats,today:5,week:options.count}};
                  const qr=await QRCode.toDataURL('https://jishoo.vercel.app/?invite=TEST-STORY-12345',{width:180,margin:1});
                  const blob=await renderStoryImage({...options,theme:['lemon','lavender','sky'][index%3],data,code:'TEST-STORY-12345',qr,moment:{friend:{name:options.caption?'دوست با نام بلند برای تست تصویر':'سارا'}}});
                  const png=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(blob)});
                  return {png,ink:window.qaStoryCanvases[window.qaLastStory]};
                }""", {"state": state, "options": case, "index": i})
                label = f"{case['kind']}-{case['format']}-{'long-latin' if case['caption'].startswith('W') else 'long-persian' if case['caption'] else case['count']}"
                path = OUT / (label + ".png")
                path.write_bytes(base64.b64decode(result["png"]))
                check_ink(result["ink"], case["format"] == "square", label)
                image = Image.open(path).convert("RGB")
                assert image.size == (1080, 1080 if case["format"] == "square" else 1920)
                assert sum(1 for r, g, b in image.get_flattened_data() if b > r + 25 and g > r + 15 and b > 130) > 300
                if case["format"] == "story" and not case["caption"] and case["count"] == 37:
                    previews.append({"kind": case["kind"], "image": "data:image/png;base64," + result["png"]})
            assert not errors, errors
            print("PASS: Actual canvas text/image bounds for all six card types stay clear of the 250px header and reply design allowances, including long names, 100-character captions and empty/single/full weekly counts. Text does not collide.", flush=True)

            # QA-only simulations of account/progress and reply controls. These
            # overlays are not part of exported PNGs or the product preview.
            page.set_viewport_size({"width": 900, "height": 1040})
            page.set_content("""<style>*{box-sizing:border-box}body{margin:0;padding:20px;background:#e6e1eb;font:14px system-ui}.grid{display:grid;grid-template-columns:repeat(3,270px);gap:20px}figure{margin:0;position:relative;width:270px;height:480px;border-radius:16px;overflow:hidden}img{width:100%;height:100%}.top,.bottom{position:absolute;left:0;right:0;color:white;background:#29233270;padding:14px}.top{top:0;height:13.0208%}.bars{display:flex;gap:3px;margin-bottom:9px}.bars i{height:2px;background:white;flex:1}.id{display:flex;gap:7px;align-items:center;font-size:11px}.avatar{width:20px;height:20px;border:1px solid white;border-radius:50%;background:#b9c9eb}.bottom{bottom:0;height:13.0208%;display:flex;align-items:flex-end;gap:8px;padding-bottom:18px}.reply{border:1px solid #ffffff99;border-radius:30px;padding:8px;flex:1;font-size:11px}</style><div class=grid></div>""")
            page.evaluate("""items=>{const grid=document.querySelector('.grid');for(const item of items){const figure=document.createElement('figure');const img=new Image();img.src=item.image;figure.append(img);const top=document.createElement('div');top.className='top';top.innerHTML='<div class=bars><i></i><i></i><i></i></div><div class=id><span class=avatar></span>username · 2h <span style="margin-left:auto">••• ×</span></div>';const bottom=document.createElement('div');bottom.className='bottom';bottom.innerHTML='<span class=reply>Send message…</span><span>♡</span><span>➤</span>';figure.append(top,bottom);grid.append(figure)}}""", previews)
            page.screenshot(path=str(OUT / "social-overlay-check.png"), full_page=True)
        finally:
            guest.call("delete-account", {})
            browser.close()


if __name__ == "__main__":
    main()
