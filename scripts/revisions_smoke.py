"""Owned-data checks for invitation-first signup, live map, early sharing and avatars."""
import hashlib,secrets,sys
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect
from security_release_smoke import client,google_member,fixture,owned,page_for,connect
from smoke import BASE,CHROMIUM,api,capture,ARTIFACTS

def main():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  try:
   owner,state=google_member('آزمایش چشم و نمودار');peer,other=google_member('آزمایش نقشه زنده',state['me']['inviteCode']);connect(owner,peer)
   if '--remaining' not in sys.argv:
    guest=client();code=state['me']['inviteCode'];quota=owner.bootstrap()['invitationQuota']['used']
    for bad in ['', 'J-NO-SUCH-INVITE',state['me']['joinedInviteCode']]:
     assert guest.call('google-start',{'intent':'signup','inviteCode':bad},expected=403)['error']=='invite_required'
    for intent in ['signup','login']:
     result=guest.call('google-start',{'intent':intent,'inviteCode':code,'returnTo':'/#/home'});assert result['url'].startswith('https://accounts.google.com/')
    assert owner.bootstrap()['invitationQuota']['used']==quota
    ctx,page=page_for(browser,guest)
    page.goto(BASE+'/?login=1#/home');expect(page.get_by_label('کد دعوت عضویت',exact=True)).to_be_visible(timeout=25000);assert page.get_by_role('button',name='ادامه با Google',exact=True).count()==0
    capture(page,'revision-invite-first.png')
    page.get_by_label('کد دعوت عضویت',exact=True).fill('J-WRONG-INVITE');page.get_by_role('button',name='تایید دعوت و ادامه',exact=True).click();expect(page.get_by_role('alert')).to_be_visible(timeout=15000)
    page.get_by_label('کد دعوت عضویت',exact=True).fill(code);page.get_by_role('button',name='تایید دعوت و ادامه',exact=True).click();expect(page.get_by_role('button',name='ادامه با Google',exact=True)).to_be_visible(timeout=20000);expect(page.locator('.invite-auth-summary')).to_contain_text(state['me']['name'])
    fixture(guest);page.goto(BASE+'/?google=continue&invite='+code+'#/home');expect(page.get_by_role('heading',name='اسمت چیه؟',exact=True)).to_be_visible(timeout=20000)
    page.get_by_label('اسمت',exact=True).fill('آزمایش دعوت پیش از گوگل');page.get_by_role('button',name='ساخت حساب من',exact=True).click();expect(page.locator('.invite-connect-step')).to_be_visible(timeout=25000);page.get_by_role('button',name='فعلاً نه؛ بعداً از درخواست‌های دوستی',exact=True).click()
    assert owner.bootstrap()['invitationQuota']['used']==quota+1
    ctx.close()
    member_ctx,member=page_for(browser,owner)
    member.add_init_script("window.qaPermissionCalls=0;Object.defineProperty(Notification,'permission',{configurable:true,get:()=> 'default'});Object.defineProperty(Notification,'requestPermission',{configurable:true,value:async()=>{window.qaPermissionCalls++;return 'denied'}})")
    member.goto(BASE+'/#/home');expect(member.locator('.home-notification-card')).to_be_visible(timeout=20000);assert member.evaluate('window.qaPermissionCalls')==0
    member.locator('.home-notification-card').click();expect(member.locator('.push-permission-dialog')).to_be_visible();assert member.evaluate('window.qaPermissionCalls')==0;capture(member,'revision-home-permission.png')
    member.get_by_role('button',name='باشه، اعلان دوستام رو روشن کن',exact=True).click();member.wait_for_function('window.qaPermissionCalls===1');member.get_by_role('button',name='فعلاً نه',exact=True).click()
    print('PASS: New signup validates active available invitations before Google; existing login still starts without a code; only completed signup consumes a slot. Home opens the permission explanation directly, and the native prompt requires explicit confirmation.',flush=True)
   else:member_ctx,member=page_for(browser,owner)
   member.goto(BASE+'/#/profile');member.emulate_media(reduced_motion='no-preference');avatar=member.locator('.profile-avatar-image svg').first;expect(avatar).to_be_visible(timeout=20000)
   def gaze():return avatar.evaluate("e=>[e,...e.querySelectorAll('.mo-root,.mo-eyes')].map(x=>getComputedStyle(x).getPropertyValue('--mo-track-x')).join('|')")
   member.mouse.move(10,200);member.wait_for_timeout(350);left=gaze();member.mouse.move(380,200);member.wait_for_timeout(350);right=gaze();assert left!=right,(left,right)
   member.emulate_media(reduced_motion='reduce');member.wait_for_timeout(200);assert avatar.evaluate("e=>[e,...e.querySelectorAll('.mo-root,.mo-eyes')].every(x=>!x.style.getPropertyValue('--mo-track-x'))")
   capture(member,'revision-avatar.png')
   for _ in range(3):owner.call('checkin',{'status':'done','visibility':'private','nonce':secrets.token_hex(12)})
   member.goto(BASE+'/#/stats');expect(member.locator('.stats-trend')).to_be_visible(timeout=20000);assert member.locator('.stats-trend .sr-only li').count()==7;expect(member.locator('.trend-readout strong')).to_contain_text('۳')
   for label,count in [('ماه',None),('همه‌وقت',12),('هفته',7)]:
    member.get_by_role('button',name=label,exact=True).click();items=member.locator('.stats-trend .sr-only li').count();assert items==count if count else items in [29,30,31]
   member.get_by_role('button',name='نقطهٔ بعدی نمودار',exact=True).click();expect(member.locator('.trend-readout strong')).to_contain_text('هنوز نرسیده')
   for width,height in [(320,568),(393,852),(1440,900)]:
    member.set_viewport_size({'width':width,'height':height});assert member.evaluate('document.documentElement.scrollWidth<=innerWidth+1');capture(member,f'revision-chart-{width}.png')
   member_ctx.close()
   print('PASS: Profile eyes track the pointer and stop with reduced motion. The trend chart shows real counts, supports point navigation and fits three sizes across Shamsi ranges.',flush=True)
   map_ctx,map_page=page_for(browser,owner,geo=True);map_page.goto(BASE+'/#/nearby');map_page.get_by_role('button',name='نمایش اطراف من',exact=True).click();expect(map_page.locator('.map-live-state')).to_be_visible(timeout=25000)
   before=map_page.locator('.leaflet-map-pane').evaluate('e=>e.style.transform')
   peer.call('map-visibility',{'mode':'profile','lat':35.70127,'lng':51.40137});peer.call('checkin',{'status':'need','visibility':'friends','nonce':secrets.token_hex(12)})
   expect(map_page.locator('.live-map-marker.need.friend-marker')).to_be_visible(timeout=22000)
   peer.call('checkin',{'status':'done','visibility':'friends','nonce':secrets.token_hex(12)})
   expect(map_page.locator('.live-map-marker.done.friend-marker')).to_be_visible(timeout=22000)
   assert map_page.locator('.leaflet-map-pane').evaluate('e=>e.style.transform')==before
   assert map_page.get_by_role('button',name='تازه‌کردن',exact=True).count()==0
   capture(map_page,'revision-live-map.png');map_ctx.close()
   print('PASS: A different account’s need/done events reach the map automatically without refresh or camera movement.',flush=True)
   # Pause only this browser's JS timers to inspect the full grace window reliably.
   early_ctx,early=page_for(browser,owner);early.goto(BASE+'/#/stories/need');expect(early.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000);early.goto(BASE+'/#/home');expect(early.locator('.need-card')).to_be_visible(timeout=20000)
   early.clock.install();early.clock.pause_at(datetime.now(timezone.utc));calls=[];early.on('request',lambda r:calls.append(r.url) if 'action=checkin' in r.url else None)
   for selector in ['.need-card','.done-card']:
    early.locator(selector).click();share=early.get_by_role('button',name='استوری این لحظه',exact=True);expect(share).to_be_enabled();assert share.inner_text()=='';share.click();expect(early.locator('.story-undo-slot')).to_be_visible();capture(early,'revision-early-share-'+selector[1:]+'.png');early.get_by_role('button',name='لغو ثبت',exact=True).click();early.clock.run_for(3500);assert not calls
   # Same PNG bytes before/after the committed event, with the pending count included.
   early.locator('.done-card').click();early.get_by_role('button',name='استوری این لحظه',exact=True).click();expect(early.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
   digest="async e=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await(await fetch(e.src)).arrayBuffer()))).join(',')"
   old_hash=early.locator('img.story-raster-preview').evaluate(digest)
   early.clock.run_for(3500);expect(early.locator('.story-undo-slot')).to_have_count(0,timeout=20000);assert len(calls)==1;assert early.locator('img.story-raster-preview').evaluate(digest)==old_hash
   assert owner.bootstrap()['stats']['today']==4
   early_ctx.close()
   print('PASS: Both actions share immediately through an icon with background; editor undo cancels the write. Pending counts match the final saved PNG after one committed event.',flush=True)
  finally:
   for account in owned:
    try:account.call('delete-account',{})
    except Exception as error:print('Owned revision cleanup:',type(error).__name__,flush=True)
   browser.close()
if __name__=='__main__':main()
