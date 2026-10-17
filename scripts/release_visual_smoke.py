"""Real PNG identity, fitted viewports, invitation replay and undo checks.

Called with disposable identities by security_release_smoke; never provisions owners.
Native share is instrumented to inspect the File, not to claim OS sheet testing.
"""
import hashlib
import io
import json
import time
from PIL import Image
from playwright.sync_api import expect
from smoke import api, capture, BASE, ARTIFACTS


def verify_release_extras(browser, owner, friend, page_for, new_client):
    ctx, page = page_for(browser, owner)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.add_init_script("""Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(navigator,'share',{configurable:true,value:async payload=>{
        const bytes=await payload.files[0].arrayBuffer();
        window.qaShared={hash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join(''),text:payload.text};
      }});""")
    for kind in ['need', 'checkin', 'weekly', 'invite']:
        page.goto(BASE + '/#/stories/' + kind)
        save = page.get_by_role('button', name='ذخیره PNG', exact=True)
        expect(save).to_be_enabled(timeout=30000)
        for width, height in [(320,568), (393,852), (812,375), (1440,900)]:
            page.set_viewport_size({'width':width, 'height':height})
            for label, dimensions in [('استوری ۹:۱۶',(1080,1920)), ('پست ۱:۱',(1080,1080))]:
                page.get_by_role('button',name=label,exact=True).click()
                preview = page.locator('img.story-raster-preview')
                expect(preview).to_have_js_property('naturalHeight',dimensions[1],timeout=30000)
                expect(save).to_be_enabled(timeout=30000)
                for action in ['ذخیره PNG','اشتراک تصویر']:
                    box=page.get_by_role('button',name=action,exact=True).bounding_box()
                    assert box['y']>=0 and box['y']+box['height']<=height+1 and box['x']>=0 and box['x']+box['width']<=width+1,(kind,width,height,action,box)
                assert page.locator('.story-editor').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1')
                if width==393:
                    digest=preview.evaluate("""async img=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await (await fetch(img.src)).arrayBuffer()))).map(x=>x.toString(16).padStart(2,'0')).join('')""")
                    with page.expect_download() as download:
                        save.click()
                    path=ARTIFACTS/f'release-{kind}-{dimensions[1]}.png'
                    download.value.save_as(str(path));raw=path.read_bytes()
                    assert hashlib.sha256(raw).hexdigest()==digest
                    image=Image.open(io.BytesIO(raw)).convert('RGB')
                    assert image.size==dimensions
                    # The upper illustration must contain actual blue mascot pixels.
                    crop=image.crop((70,150,1010,650 if dimensions[1]==1080 else 1160))
                    blue=sum(1 for r,g,b in crop.getdata() if b>r+25 and g>r+15 and b>130)
                    assert blue>300,(kind,dimensions,'missing mascot',blue)
                    page.evaluate('window.qaShared=null')
                    page.get_by_role('button',name='اشتراک تصویر',exact=True).click()
                    page.wait_for_function('window.qaShared!==null')
                    shared=page.evaluate('window.qaShared');assert shared['hash']==digest
                    assert ('?invite=' in shared['text'])==(kind=='invite'),shared['text']
                    if dimensions[1]==1920:capture(page,f'release-story-{kind}.png')
    # Rendering waits for assets even when the mascot response is slow.
    delayed_ctx, delayed = page_for(browser, owner)
    delayed.route('**/assets/shy-drop.webp',lambda route:(time.sleep(1),route.continue_()))
    delayed.goto(BASE+'/#/stories/need')
    expect(delayed.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
    expect(delayed.locator('img.story-raster-preview')).to_have_js_property('naturalWidth',1080)
    delayed_ctx.close()
    print('PASS: Eight PNGs match preview/download/native-share bytes exactly and contain mascot pixels. Four story types fit four viewport sizes in both formats; delayed assets are awaited. Only invitations carry invite links.',flush=True)

    page.set_viewport_size({'width':393,'height':852});page.goto(BASE+'/#/stats')
    expect(page.locator('.calendar-weekdays span').first).to_have_text('شنبه')
    expect(page.locator('.calendar-weekdays span').last).to_have_text('جمعه')
    assert page.locator('.lovely-column').count()==7
    page.get_by_role('button',name='ماه',exact=True).click()
    assert page.locator('.lovely-column').count() in [29,30,31]
    assert page.locator('.drop-calendar-grid > div').count()==page.locator('.lovely-column').count()
    capture(page,'release-shamsi-calendar.png')
    page.get_by_role('button',name='همه‌وقت',exact=True).click();assert page.locator('.lovely-column').count()==12

    state=owner.bootstrap();code=state['me']['inviteCode']
    # Member invitation page fills the viewport and has no bottom navigation.
    page.goto(BASE+'/#/invite');expect(page.locator('.invite-page')).to_be_visible(timeout=20000)
    box=page.locator('.invite-page').bounding_box();assert box['x']==0 and box['width']==393 and box['height']>=852,box
    assert page.locator('.bottom-nav').count()==0
    guest=new_client();guest_ctx,invitation=page_for(browser,guest)
    for width,height in [(320,568),(1440,900)]:
        invitation.set_viewport_size({'width':width,'height':height});invitation.goto(BASE+'/?invite='+code)
        expect(invitation.locator('.inviter-spotlight')).to_be_visible(timeout=25000)
        box=invitation.locator('.app-shell').bounding_box();assert box['x']==0 and box['y']==0 and box['width']==width and box['height']==height,box
        assert invitation.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        cta=invitation.get_by_role('button',name='با این دعوت عضو بشم',exact=True)
        cta.scroll_into_view_if_needed();expect(cta).to_be_in_viewport()
        capture(invitation,f'release-invitation-{width}.png')
    guest_ctx.close()
    # This friend signed up through the owner's invitation earlier in the suite.
    friend_ctx, accepted=page_for(browser,friend)
    before=owner.bootstrap()['invitationQuota']['used']
    accepted.goto(BASE+'/?invite='+code)
    expect(accepted.get_by_role('heading',name='این دعوت رو قبلاً پذیرفتی 💛',exact=True)).to_be_visible(timeout=20000)
    expect(accepted).to_have_url(BASE+'/#/home',timeout=10000)
    assert owner.bootstrap()['invitationQuota']['used']==before
    friend_ctx.close()
    group=owner.call('circle-create',{'name':'آزمایش دعوت تکراری','shared':True,'members':[]})
    group_code=next(g['inviteCode'] for g in group['circles'] if g['id']==group['id'])
    friend.call('circle-join',{'code':group_code})
    group_ctx,joined=page_for(browser,friend)
    joined.goto(BASE+'/?group='+group_code)
    expect(joined.get_by_role('heading',name='تو قبلاً به این جمع پیوستی 💛',exact=True)).to_be_visible(timeout=20000)
    expect(joined).to_have_url(BASE+'/?group='+group_code+'#/circle/'+group['id'],timeout=10000)
    group_ctx.close()
    print('PASS: Shamsi calendar and chart ranges agree; invitation pages fill phone/desktop viewports with reachable CTAs; accepted links show confirmation and redirect without consuming slots.',flush=True)

    # Real writes stay paused during undo, and sharing also waits for a slow save.
    page.set_viewport_size({'width':393,'height':852});page.goto(BASE+'/#/home')
    calls=[]
    def delay_checkin(route):
        calls.append(time.monotonic());time.sleep(1.2);route.continue_()
    page.route('**/api/app?action=checkin',delay_checkin)
    for kind, selector in [('need','.need-card'),('done','.done-card')]:
        baseline=owner.bootstrap()['stats']['total'];start=time.monotonic()
        page.locator(selector).click()
        share=page.get_by_role('button',name='استوری این لحظه',exact=True)
        expect(share).to_be_disabled();page.wait_for_timeout(800);assert not calls
        # Cancelled attempts cause no API write.
        page.get_by_role('button',name='لغو ثبت',exact=True).click()
        page.wait_for_timeout(2400);assert not calls and owner.bootstrap()['stats']['total']==baseline
        start=time.monotonic();page.locator(selector).click();expect(share).to_be_disabled()
        page.wait_for_timeout(3200);expect(share).to_be_disabled()
        expect(share).to_be_enabled(timeout=15000);assert len(calls)==1 and calls[0]-start>=3
        share.click();expect(page.locator('img.story-raster-preview')).to_be_visible(timeout=30000)
        page.get_by_role('button',name='بستن کارت اشتراک',exact=True).click()
        page.keyboard.press('Escape');calls.clear()
    assert not errors,errors
    ctx.close()
    print('PASS: Undo prevents writes for both actions; the visible story pill remains disabled during grace and delayed server save, then opens the committed result.',flush=True)


if __name__=='__main__':
    from playwright.sync_api import sync_playwright
    from security_release_smoke import google_member, page_for, client, owned, connect
    from smoke import CHROMIUM
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
        try:
            owner,state=google_member('آزمایش تصویر صاحب')
            friend,_=google_member('آزمایش تصویر دوست',state['me']['inviteCode'])
            connect(owner,friend)
            verify_release_extras(browser,owner,friend,page_for,client)
        finally:
            for account in owned:
                try:account.call('delete-account',{})
                except Exception as error:print('Owned visual cleanup:',type(error).__name__,flush=True)
            browser.close()
