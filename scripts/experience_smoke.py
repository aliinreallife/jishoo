"""Focused invitation, reaction, install, Google signup and support UI checks."""
import json,sys,secrets,time,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from smoke import context,api,capture,BASE,CHROMIUM,verified_https
from api_smoke import Client
from auth_integration import seed
from provision_admin import create_invite
ROOT=Path(__file__).resolve().parents[1]
def main():
 owned=[];errors=[];support_id=None;admin=None
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  try:
   ctx,a=context(b,width=320,height=568);a.on('pageerror',lambda e:errors.append(str(e)))
   invite=create_invite('qa-member')['code']
   a.goto(BASE+'/?invite='+invite);expect(a.get_by_role('button',name='با این دعوت عضو بشم',exact=True)).to_be_visible(timeout=30000)
   owned.append((a,api(a,'bootstrap')['me']['id']))
   assert a.evaluate('document.querySelector(".app-shell").getBoundingClientRect().width>=innerWidth-1')
   assert a.evaluate('getComputedStyle(document.querySelector(".app-shell")).overflow')=='visible'
   a.mouse.wheel(0,1200);a.wait_for_function('scrollY>20');a.get_by_role('button',name='با این دعوت عضو بشم',exact=True).scroll_into_view_if_needed();capture(a,'current-invite-fullscreen-320.png')
   a.get_by_role('button',name='با این دعوت عضو بشم',exact=True).click();expect(a.get_by_role('button',name='ادامه با Google',exact=True)).to_be_visible();capture(a,'current-google-banner.png');a.keyboard.press('Escape')
   a.get_by_role('button',name='فعلاً یه سر به جیشو بزنم',exact=False).click()
   sent=[];a.on('request',lambda r:sent.append(r.url) if '/api/app?action=checkin' in r.url else None)
   for width,height in [(320,568),(393,852),(1440,900),(812,375)]:
    a.set_viewport_size({'width':width,'height':height});positions=[]
    for selector,close in [('.done-card','چه حس خوبی!'),('.need-card','باشه، الان برمی‌گردم')]:
     a.locator(selector).click();expect(a.locator('.undo-inline')).to_be_visible();assert a.get_by_role('dialog').get_by_role('button',name='بستن',exact=True).count()==0
     dialog=a.get_by_role('dialog').bounding_box();assert abs(dialog['x'])<1 and abs(dialog['y'])<1 and abs(dialog['width']-width)<1 and abs(dialog['height']-height)<1
     undo=a.locator('.undo-inline').bounding_box();button=a.get_by_role('button',name=close,exact=True).bounding_box();assert undo['y']+undo['height']<=button['y'] and button['y']+button['height']<=height;positions.append((undo['y'],button['y']))
     assert a.evaluate('document.body.style.overflow')=='hidden'
     a.get_by_role('button',name='لغو ثبت',exact=True).click();expect(a.get_by_role('dialog')).to_have_count(0);assert a.evaluate('document.body.style.overflow')!='hidden'
    assert positions[0]==positions[1],(width,height,positions)
   assert not sent and api(a,'bootstrap')['stats']['total']==0
   a.set_viewport_size({'width':393,'height':852});a.locator('.done-card').click();capture(a,'current-reaction-undo.png');a.get_by_role('button',name='لغو ثبت',exact=True).click()
   print('PASS: Invitation scrolls on a short phone; both check-ins fill the viewport at four sizes with identical undo/action positions and no API writes after undo',flush=True)
   for route,title in [('terms','شرایط استفاده'),('privacy','حریم خصوصی')]:
    a.goto(BASE+'/'+route);expect(a.get_by_role('heading',name=title,exact=True)).to_be_visible(timeout=15000);assert a.get_by_role('link',name='پشتیبانی',exact=True).get_attribute('href')=='/support'
   a.goto(BASE+'/support');expect(a.get_by_role('heading',name='اینجاییم که بشنویم')).to_be_visible(timeout=15000)
   a.get_by_label('پیامت',exact=True).fill('Owned browser support check '+secrets.token_hex(8));a.get_by_label('راه تماس برای پاسخ (اختیاری)',exact=True).fill('qa@example.invalid');a.get_by_role('button',name='فرستادن پیام',exact=True).click();expect(a.get_by_role('heading',name='پیامت رسید 💛')).to_be_visible(timeout=20000);reference=a.locator('.support-sent span').inner_text();capture(a,'current-public-support.png')
   assert a.evaluate("async()=>{const r=await fetch('/api/app?action=admin-support');return r.status}")==403
   admin=Client();admin.bootstrap();_,ticket=admin.new_ticket();admin.call('register',{'ticket':ticket,'name':'آزمایش مدیریت رابط','inviteCode':create_invite('qa-admin')['code']});support_id=next(r['id'] for r in admin.call('admin-support')['requests'] if r['id'].startswith(reference))
   adminCtx,adminPage=context(b);token=next(c.value for c in admin.cookies if c.name=='jishoo_session');adminCtx.add_cookies([{'name':'jishoo_session','value':token,'url':BASE,'httpOnly':True,'sameSite':'Lax'}]);adminPage.goto(BASE+'/#/admin')
   ticketCard=adminPage.locator('.admin-support article').filter(has_text=reference);expect(ticketCard).to_be_attached(timeout=20000);ticketCard.scroll_into_view_if_needed();expect(ticketCard).to_be_visible()
   ticketCard.get_by_role('button',name='رسیدگی شد',exact=True).click();expect(ticketCard).to_have_class('resolved',timeout=15000);ticketCard.get_by_role('button',name='بازکردن دوباره',exact=True).click();expect(ticketCard).not_to_have_class('resolved',timeout=15000)
   admin.call('admin-support-delete',{'id':support_id});support_id=None
   print('PASS: Legal links reach support; messages reach the private admin inbox; resolve/reopen work and regular users are denied access',flush=True)
   a.goto(BASE+'/install');expect(a.get_by_role('heading',name='نصب در Chrome اندروید')).to_be_visible(timeout=15000);capture(a,'current-android-install.png')
   ios=b.new_context(viewport={'width':393,'height':852},user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1');verified_https(ios);ip=ios.new_page();ip.goto(BASE+'/install');expect(ip.get_by_role('heading',name='نصب روی آیفون و آیپد')).to_be_visible(timeout=15000);expect(ip.get_by_text('Add to Home Screen',exact=True)).to_be_visible();capture(ip,'current-ios-install.png')
   if BASE.startswith('http://'):
    a.goto(BASE);a.wait_for_function('navigator.serviceWorker.controller!==null',timeout=20000)
    ctx.set_offline(True);a.reload();expect(a.get_by_role('heading',name='یه لحظه بی‌اینترنتیم 💧')).to_be_visible(timeout=15000);capture(a,'current-offline.png');ctx.set_offline(False)
   print('PASS: Android and iOS install guidance renders; real service worker provides a private-data-free offline page locally',flush=True)
   # The helper only seeds synthetic identities on a protected preview, never production.
   if os.environ.get('JISHOO_TEST_BYPASS_SECRET'):
    member=Client();uid=seed(member);token=next(c.value for c in member.cookies if c.name=='jishoo_session')
    googleCtx,google=context(b);owned.append((google,uid));google.on('pageerror',lambda e:errors.append(str(e)))
    googleCtx.add_cookies([{'name':'jishoo_session','value':token,'url':BASE,'httpOnly':True,'sameSite':'Lax'}])
    google.goto(BASE+'/?invite='+create_invite('qa-member')['code']+'&google=continue');expect(google.get_by_role('heading',name='اسمت چیه؟')).to_be_visible(timeout=30000)
    assert google.get_by_label('شماره موبایل',exact=True).count()==0
    google.get_by_label('اسمت',exact=True).fill('آزمایش عضویت گوگل');capture(google,'current-google-signup.png');google.get_by_role('button',name='ساخت حساب من',exact=True).click();expect(google.get_by_role('dialog')).to_have_count(0,timeout=20000)
    assert api(google,'bootstrap')['auth']['googleConnected'] and not api(google,'bootstrap')['auth']['phoneConnected']
    google.locator('.bottom-nav').get_by_role('button',name='من',exact=True).click();google.get_by_role('button',name='تنظیمات پروفایل',exact=True).click();expect(google.get_by_text('شمارهٔ موبایل وصل نیست',exact=True)).to_be_visible(timeout=15000)
    google.get_by_label('شماره موبایل',exact=True).fill(f'+1{secrets.randbelow(789)+201}55501{secrets.randbelow(100):02}');google.get_by_role('button',name='اتصال شماره به حساب',exact=True).click();expect(google.get_by_text('شمارهٔ موبایل وصله',exact=True)).to_be_visible(timeout=20000);assert api(google,'bootstrap')['me']['id']==uid;capture(google,'current-linked-login-methods.png');google.keyboard.press('Escape')
    google.locator('.bottom-nav').get_by_role('button',name='دوست‌ها',exact=True).click();add=google.get_by_role('button',name='افزودن دوست با شناسه',exact=True);assert add.bounding_box()['width']>70;capture(google,'current-friends-button.png')
    print('PASS: Google signup requires name/invite without a phone; optional phone linking stays on the same account; add-friend control has a correctly sized labeled surface',flush=True)
   assert not errors,errors
  finally:
   if support_id and admin:admin.call('admin-support-delete',{'id':support_id})
   if admin:admin.call('delete-account',{})
   for page,uid in owned:
    try:
     if api(page,'bootstrap')['me']['id']==uid:api(page,'delete-account',{})
    except Exception as e:print('Owned UI cleanup:',type(e).__name__,flush=True)
   b.close()
if __name__=='__main__':main()
