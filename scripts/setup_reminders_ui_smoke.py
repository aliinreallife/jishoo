"""Deterministic consent, validation, release-focus and exported-story regressions.

All API responses are synthetic. No native permission requests or real pushes.
"""
import copy, hashlib, json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from PIL import Image
from playwright.sync_api import sync_playwright, expect
from routing_smoke import fixture
from smoke import BASE, CHROMIUM, verified_https, ARTIFACTS

def main():
    # The verified HTTPS adapter serializes cloud reads. Local CI keeps its
    # strict default assertions; deployed checks allow network/proxy overhead.
    if BASE.startswith('https://'):expect.set_options(timeout=60000)
    data = fixture(); requests = []; errors = []
    data['me'].update(createdAt=(datetime.now(timezone.utc)-timedelta(days=3)).isoformat(), mapVisibilityReviewed=False,
                      checkinReminders={'inApp': True, 'push': False, 'snoozedUntil': None})
    data['publicUrl'] = 'https://JISHOO.Example'
    version = json.loads((Path(__file__).resolve().parents[1]/'package.json').read_text())['version']
    def mock(route):
        req=route.request; action=parse_qs(urlsplit(req.url).query).get('action',[''])[0]
        body=req.post_data_json if req.method=='POST' else None; requests.append((action,body))
        result=copy.deepcopy(data)
        if action=='profile': data['me'].update(body); result=copy.deepcopy(data)
        elif action=='map-visibility':
            mode=body['mode']; data['me'].update(mapVisibilityReviewed=True,shareLocation=mode!='hidden',discoverable=mode=='profile');result={'mode':mode}
        elif action=='reminder-prefs':
            prefs=data['me']['checkinReminders']
            for key in ['inApp','push']:
                if key in body:prefs[key]=body[key]
            if 'snoozeDays' in body:prefs['snoozedUntil']=(datetime.now(timezone.utc)+timedelta(days=7)).isoformat() if body['snoozeDays']==7 else None
            result={'preferences':copy.deepcopy(prefs)}
        elif action=='checkin':
            data['stats']['lastDoneAt']=datetime.now(timezone.utc).isoformat();result=copy.deepcopy(data)
        route.fulfill(json=result)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':393,'height':852},service_workers='block',reduced_motion='reduce')
        verified_https(ctx);ctx.route('**/api/app?*',mock)
        ctx.add_init_script("""localStorage.setItem('jishoo:v2-entered','true');
          window.__gpsCalls=0; navigator.geolocation.getCurrentPosition=(_,deny)=>{window.__gpsCalls++;deny({code:1})};
          window.__storyText=[];const fill=CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...rest){
            const m=this.measureText(value),matrix=this.getTransform(),point=new DOMPoint(x,y).matrixTransform(matrix);
            const corners=[[x-m.actualBoundingBoxLeft,y-m.actualBoundingBoxAscent],[x+m.actualBoundingBoxRight,y-m.actualBoundingBoxAscent],[x-m.actualBoundingBoxLeft,y+m.actualBoundingBoxDescent],[x+m.actualBoundingBoxRight,y+m.actualBoundingBoxDescent]].map(([a,b])=>new DOMPoint(a,b).matrixTransform(matrix));
            window.__storyText.push({value:String(value),x:point.x,y:point.y,top:Math.min(...corners.map(p=>p.y)),bottom:Math.max(...corners.map(p=>p.y))});return fill.call(this,value,x,y,...rest)};
          window.__storyBlobs=new Map();const create=URL.createObjectURL;
          URL.createObjectURL=function(blob){const url=create.call(this,blob);window.__storyBlobs.set(url,blob);return url};
        """)
        page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/home',wait_until='domcontentloaded')
        expect(page.locator('#release-title')).to_be_focused()
        page.keyboard.press('Tab');assert page.locator('.release-dialog').evaluate('e=>e.contains(document.activeElement)')
        page.keyboard.press('Escape');expect(page.locator('.release-dialog')).to_have_count(0)
        expect(page.locator('.checkin-reminder')).to_be_visible()
        page.locator('.reminder-snooze').click();expect(page.locator('.checkin-reminder')).to_have_count(0)
        assert requests[-1]==('reminder-prefs',{'snoozeDays':7})
        print('PASS: Release starts on its heading; keyboard navigation works. Inactivity card snoozes without a permission request.',flush=True)

        page.goto(BASE+'/profile');card=page.locator('.setup-progress');expect(card).to_be_visible()
        page.locator('.setup-progress-heading').click();ring=card.get_by_role('progressbar');expect(ring).to_have_attribute('aria-valuenow','0')
        card.locator('.setup-step-action').first.click();expect(page.locator('.visibility-editor')).to_be_visible()
        page.locator('input[value=profile]').check();page.get_by_role('button',name='ذخیرهٔ انتخاب',exact=True).click()
        expect(page.locator('.visibility-permission')).to_be_visible();assert page.evaluate('window.__gpsCalls')==0
        assert not any(action=='map-visibility' for action,_ in requests)
        page.get_by_role('button',name='اجازهٔ مکان و ذخیرهٔ انتخاب',exact=True).click()
        expect(page.get_by_role('alert')).to_contain_text('انتخاب قبلی‌ت تغییری نکرده')
        assert page.evaluate('window.__gpsCalls')==1;assert not data['me']['shareLocation']
        page.get_by_role('button',name='برگشت به انتخاب نمایش',exact=True).click()
        page.locator('input[value=hidden]').check();page.get_by_role('button',name='ذخیرهٔ انتخاب',exact=True).click()
        expect(page.locator('.visibility-editor')).to_have_count(0);expect(ring).to_have_attribute('aria-valuenow','2')
        assert page.evaluate('window.__gpsCalls')==1
        while card.locator('.setup-step-skip').count():card.locator('.setup-step-skip').first.click()
        expect(ring).to_have_attribute('aria-valuenow','5')
        assert ring.locator('b svg').evaluate('e=>e.getBoundingClientRect().width<=24&&getComputedStyle(e).transform==="none"')
        for width,height in [(320,568),(393,852),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            card.screenshot(path=str(ARTIFACTS/f'setup-progress-{width}.png'))
        page.set_viewport_size({'width':393,'height':852})
        print('PASS: Visibility choice precedes GPS explanation and native request; denial preserves privacy. Hidden choice and optional skips complete setup without GPS.',flush=True)

        page.get_by_role('button',name='من تو شبکه‌های اجتماعی',exact=False).last.click()
        editor=page.get_by_role('dialog',name='من تو شبکه‌های اجتماعی',exact=True);expect(editor).to_be_visible()
        expect(page.locator('#social-accounts-title')).to_be_focused()
        for width,height in [(320,568),(393,852),(812,375),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            box=editor.get_by_role('button',name='ذخیره حساب‌ها',exact=True).bounding_box()
            assert box['y']>=0 and box['y']+box['height']<=height+1,(width,height,box)
        page.set_viewport_size({'width':393,'height':852})
        ig=page.get_by_label('اینستاگرام',exact=True);tg=page.get_by_label('تلگرام',exact=True)
        ig.fill('https://x.com/ali');expect(ig).to_have_attribute('aria-invalid','true')
        expect(page.get_by_role('button',name='ذخیره حساب‌ها',exact=True)).to_be_disabled()
        before=sum(a=='profile' for a,_ in requests);assert before==0
        ig.fill('@ali.real');tg.fill('@AliInRealLife');page.get_by_label('ایکس',exact=True).fill('http://twitter.com/AliInRealLife_?s=21')
        spotify=page.get_by_label('اسپاتیفای',exact=True)
        spotify.fill('https://open.spotify.com/track/abc')
        expect(spotify).to_have_attribute('aria-invalid','true');expect(page.get_by_role('button',name='ذخیره حساب‌ها',exact=True)).to_be_disabled()
        spotify.fill('spotify:user:ali.music')
        page.get_by_label('وب‌سایت',exact=True).fill('example.org/about');ig.focus();tg.focus()
        expect(ig).to_have_value('@ali.real');expect(spotify).to_have_value('@ali.music')
        expect(editor).not_to_contain_text('لینک پروفایل:')
        editor.screenshot(path=str(ARTIFACTS/'social-validation-editor.png'))
        editor.screenshot(path=str(ARTIFACTS/'social-design-02-after.png'))
        page.get_by_role('button',name='ذخیره حساب‌ها',exact=True).click();expect(editor).to_have_count(0)
        assert data['me']['socialLinks']=={'instagram':'https://www.instagram.com/ali.real','telegram':'https://t.me/AliInRealLife','x':'https://x.com/AliInRealLife_','spotify':'https://open.spotify.com/user/ali.music','website':'https://example.org/about'}
        print('PASS: Invalid platform URLs block Save; IDs and URLs normalize consistently in fields and the saved payload.',flush=True)

        page.goto(BASE+'/notifications');settings=page.locator('.reminder-settings');expect(settings).to_be_visible()
        expect(settings.get_by_role('switch',name='یادآوری روی گوشی',exact=False)).to_have_attribute('aria-checked','false')
        settings.get_by_role('switch',name='یادآوری روی گوشی',exact=False).click()
        prompt=page.locator('.push-permission-dialog');expect(prompt).to_be_visible()
        expect(prompt).to_contain_text('حداکثر هفته‌ای یک‌بار')
        page.keyboard.press('Escape');expect(prompt).to_have_count(0);assert data['me']['checkinReminders']['push'] is False
        settings.get_by_role('switch',name='کارت داخل جیشو',exact=False).click();assert data['me']['checkinReminders']['inApp'] is False
        assert data['me']['notificationsEnabled'] is True
        print('PASS: Personal push stays off until explicit permission; cancel and inline opt-out preserve friend notification choices.',flush=True)

        data['me']['checkinReminders'].update(inApp=True,snoozedUntil=None)
        page.goto(BASE+'/home');expect(page.locator('.checkin-reminder')).to_be_visible()
        before=sum(a=='checkin' for a,_ in requests);page.locator('.reminder-private').click()
        expect(page.locator('.checkin-reminder')).to_have_count(0)
        # Actual commit waits through the existing three-second undo window.
        page.wait_for_function('()=>document.querySelector(".undo-checkin")!==null')
        assert sum(a=='checkin' for a,_ in requests)==before
        with page.expect_response(lambda r:'action=checkin' in r.url):page.wait_for_timeout(3400)
        assert [body for action,body in requests if action=='checkin'][-1]['visibility']=='private'
        print('PASS: Reminder check-in uses private visibility and retains the existing undo grace period.',flush=True)

        for kind in ['checkin','need','weekly','invite','streak']:
            page.goto(BASE+'/stories/'+kind);preview=page.locator('.story-raster-preview');expect(preview).to_be_visible(timeout=20000)
            page.wait_for_function('()=>document.querySelector(".story-raster-preview")?.naturalHeight===1920')
            assert page.evaluate('window.__storyText.some(t=>t.value==="jishoo.example"&&t.y<=1720&&t.y>=1600)')
            assert page.evaluate('window.__storyText.some(t=>t.value==="لینک برنامه")')
            with page.expect_download() as output:page.get_by_role('button',name='ذخیره',exact=False).click()
            path=Path(output.value.path());raw=path.read_bytes()
            # Retain the actual preview Blob: production CSP correctly blocks
            # fetch(blob:) and must not be weakened for a test.
            visible=page.evaluate('async()=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",await window.__storyBlobs.get(document.querySelector(".story-raster-preview").src).arrayBuffer())),b=>b.toString(16).padStart(2,"0")).join("")')
            assert visible==hashlib.sha256(raw).hexdigest()
            with Image.open(path) as image:
                assert image.size==(1080,1920);image.save(ARTIFACTS/f'story-website-{kind}.png')
            page.get_by_role('button',name='پست ۱:۱',exact=True).click()
            page.wait_for_function('()=>document.querySelector(".story-raster-preview")?.naturalHeight===1080')
            assert page.evaluate('()=>{const d=window.__storyText.filter(t=>t.value==="jishoo.example").at(-1),tag=window.__storyText.filter(t=>t.value==="یه لحظه از روزت، برای دوستات.").at(-1);return d.bottom<tag.top&&d.top>984}')
        manifest=page.evaluate('async()=>await(await fetch("/manifest.webmanifest")).json()')
        assert manifest['name']==manifest['short_name']=='jishoo'
        assert page.locator('meta[name=apple-mobile-web-app-title]').get_attribute('content')=='jishoo'
        assert not errors,errors
        print('PASS: All five story kinds and square exports render a lowercase configured-domain badge; PNG preview/download dimensions and installed app names match.',flush=True)
        ctx.close()
        # Explicit fake browser APIs verify the full opt-in ordering without
        # contacting a provider or requesting permission on the test machine.
        data['me']['notificationsEnabled']=False;data['vapidPublicKey']='AQ'
        pushctx=browser.new_context(viewport={'width':393,'height':852},service_workers='block')
        verified_https(pushctx);pushctx.route('**/api/app?*',mock)
        pushctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+");"+"""
          window.__permissionCalls=0;window.__permissionResult='denied';let subscribed=false;
          window.Notification=class {static permission='default';static async requestPermission(){window.__permissionCalls++;return this.permission=window.__permissionResult}};
          window.PushManager=class {};
          const sub={options:{},toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/qa-only',keys:{p256dh:'qa',auth:'qa'}})};
          const reg={active:{state:'activated'},addEventListener:()=>{},update:async()=>{},pushManager:{getSubscription:async()=>subscribed?sub:null,subscribe:async()=>{subscribed=true;return sub}}};
          Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve(reg),register:async()=>reg,getRegistration:async()=>reg,addEventListener:()=>{}}});
        """)
        pushpage=pushctx.new_page();pushpage.on('pageerror',lambda e:errors.append(str(e)))
        pushpage.goto(BASE+'/notifications');pushsettings=pushpage.locator('.reminder-settings')
        pushsettings.get_by_role('switch',name='یادآوری روی گوشی',exact=False).click()
        confirm=pushpage.get_by_role('button',name='باشه، یادآوری روی گوشی رو روشن کن',exact=True)
        assert pushpage.evaluate('window.__permissionCalls')==0
        before=len(requests);confirm.click();expect(pushpage.locator('.toast.visible')).to_contain_text('اجازهٔ اعلان داده نشده')
        assert data['me']['checkinReminders']['push'] is False
        assert not any(a in ['push-subscribe','reminder-prefs'] for a,_ in requests[before:])
        pushpage.keyboard.press('Escape')
        # Simulate changing the browser's blocked permission in its settings.
        pushpage.evaluate('Notification.permission="default";window.__permissionResult="granted"')
        pushsettings.get_by_role('switch',name='یادآوری روی گوشی',exact=False).click();confirm.click()
        expect(pushpage.locator('.push-permission-dialog')).to_have_count(0)
        expect(pushsettings.get_by_role('switch',name='یادآوری روی گوشی',exact=False)).to_have_attribute('aria-checked','true')
        actions=[a for a,_ in requests[before:]]
        assert actions.index('push-subscribe')<actions.index('notification-pref')<actions.index('reminder-prefs')
        assert pushpage.evaluate('window.__permissionCalls')==2
        assert not errors,errors
        print('PASS: A denied personal-push permission saves no opt-in. A later explicit grant saves the device, restores the explained master setting, then saves personal consent.',flush=True)
        browser.close()

if __name__=='__main__':main()
