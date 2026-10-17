"""Capture actual owned-account screens and check readable, fitted UI text."""
import json,sys,secrets
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect
from security_release_smoke import google_member,client,page_for,owned,connect
from smoke import BASE,CHROMIUM,ARTIFACTS
STAGE=sys.argv[1] if len(sys.argv)>1 else 'after'
OUT=ARTIFACTS/('readability-'+STAGE);OUT.mkdir(exist_ok=True)

def screenshot(page,name):
 page.screenshot(path=str(OUT/(name+'.png')))

def main():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  try:
   owner,state=google_member('آزمایش خوانایی');peer,_=google_member('آزمایش دوستی',state['me']['inviteCode']);connect(owner,peer)
   owner.call('checkin',{'status':'done','visibility':'private','nonce':secrets.token_hex(12)})
   ctx,page=page_for(browser,owner,geo=True)
   page.add_init_script("localStorage.setItem('jishoo:last-seen-release',"+json.dumps("0.2.1" if STAGE=="before" else "0.2.2")+")")
   errors=[];page.on('pageerror',lambda error:errors.append(error.stack))
   for route,selector in [('home','.action-grid'),('stats','.stats-trend'),('profile','.premium-card'),('friends','.connected-card'),('invite','.invitation-quota-card')]:
    page.goto(BASE+'/#/'+route);page.reload();expect(page.locator(selector)).to_be_visible(timeout=25000);screenshot(page,'01-'+route)
   page.goto(BASE+'/#/profile');page.get_by_role('button',name='تنظیمات پروفایل',exact=True).click();expect(page.locator('.account-connections')).to_be_visible(timeout=20000);screenshot(page,'02-settings');page.keyboard.press('Escape')
   page.goto(BASE+'/#/friends');page.locator('.connected-card').first.click();expect(page.locator('.social-connection')).to_be_visible(timeout=20000);screenshot(page,'03-social-consent');page.keyboard.press('Escape')
   page.goto(BASE+'/#/home');page.locator('.home-notification-card').click();expect(page.locator('.push-permission-dialog')).to_be_visible();screenshot(page,'04-push-explanation');page.keyboard.press('Escape')
   page.goto(BASE+'/#/nearby');page.get_by_role('button',name='نمایش اطراف من',exact=True).click();expect(page.locator('.map-visibility-control')).to_be_visible(timeout=20000);screenshot(page,'05-map')
   guest=client();guest_ctx,auth=page_for(browser,guest);auth.on('pageerror',lambda error:errors.append(error.stack));auth.goto(BASE+'/?login=1#/home');expect(auth.get_by_label('کد دعوت عضویت',exact=True)).to_be_visible(timeout=20000);screenshot(auth,'06-invite-entry')
   auth.get_by_label('کد دعوت عضویت',exact=True).fill(state['me']['inviteCode']);auth.get_by_role('button',name='تایید دعوت و ادامه',exact=True).click();expect(auth.locator('.google-banner')).to_be_visible(timeout=20000);screenshot(auth,'07-google');guest_ctx.close()
   page.goto(BASE+'/#/stories/need');expect(page.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000);screenshot(page,'08-story-editor')
   if STAGE!='before':
    for width,height in [(320,568),(393,852)]:
     page.set_viewport_size({'width':width,'height':height});page.goto(BASE+'/#/nearby');page.reload()
     page.get_by_role('button',name='نمایش اطراف من',exact=True).click()
     expect(page.locator('.map-visibility-control')).to_be_visible(timeout=25000)
     panel=page.locator('.around-panel');screenshot(page,f'09-map-{width}')
     assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
     for mode in ['پنهان','بی‌نام','با پروفایلم']:
      button=page.get_by_role('button',name=mode,exact=True)
      button.scroll_into_view_if_needed();expect(button).to_be_in_viewport()
      assert button.evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=13
     page.get_by_role('button',name='جمع‌کردن گزینه‌های نقشه',exact=True).click();expect(panel).to_be_hidden()
     page.get_by_role('button',name='نمایش گزینه‌های نقشه',exact=True).click();expect(panel).to_be_visible()
     page.wait_for_timeout(300)
     page.get_by_role('button',name='بزرگ‌نمایی نقشه',exact=True).click();page.wait_for_timeout(60)
     page.get_by_role('button',name='خانه',exact=True).click();expect(page.locator('.action-grid')).to_be_visible()
     page.wait_for_timeout(350)
    for width,height in [(320,568),(393,852),(812,375),(1440,900)]:
     page.set_viewport_size({'width':width,'height':height})
     for route,selector in [('stats','.stats-trend'),('profile','.premium-card'),('friends','.connected-card'),('stories/need','.story-editor')]:
      page.goto(BASE+'/#/'+route);page.reload();expect(page.locator(selector)).to_be_visible(timeout=25000)
      assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,height,route,'horizontal overflow')
      if route=='stories/need':
       save=page.get_by_role('button',name='ذخیره PNG',exact=True);expect(save).to_be_enabled(timeout=30000);box=save.bounding_box();assert box['y']>=0 and box['y']+box['height']<=height+1,(width,height,box)
       assert page.locator('.story-editor').evaluate('e=>e.scrollHeight<=e.clientHeight+1')
      screenshot(page,f'09-{route.replace("/","-")}-{width}')
    page.set_viewport_size({'width':393,'height':852});page.goto(BASE+'/#/home');page.reload();expect(page.locator('.home-notification-card')).to_be_visible(timeout=25000)
    assert page.locator('.home-notification-card small').evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=13
    page.goto(BASE+'/#/stats');expect(page.locator('.trend-navigation')).to_be_visible(timeout=20000)
    for selector in ['.community-heading p','.trend-readout > span','.trend-readout small','.trend-navigation > span','.stats-privacy-note']:
     assert page.locator(selector).evaluate('e=>parseFloat(getComputedStyle(e).fontSize)')>=13,selector
    early_ctx,early=page_for(browser,owner)
    early.on('pageerror',lambda error:errors.append(error.stack))
    early.goto(BASE+'/#/stories/need');expect(early.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
    early.goto(BASE+'/#/home');expect(early.locator('.need-card')).to_be_visible(timeout=20000)
    early.clock.install();early.clock.pause_at(datetime.now(timezone.utc));writes=[]
    early.on('request',lambda request:writes.append(request.url) if 'action=checkin' in request.url else None)
    for width,height in [(320,568),(812,375)]:
     early.set_viewport_size({'width':width,'height':height})
     for selector in ['.need-card','.done-card']:
      early.locator(selector).click();early.get_by_role('button',name='استوری این لحظه',exact=True).click()
      expect(early.locator('.story-undo-slot')).to_be_visible()
      for label in ['استوری ۹:۱۶','پست ۱:۱']:
       early.get_by_role('button',name=label,exact=True).click()
       save=early.get_by_role('button',name='ذخیره PNG',exact=True);expect(save).to_be_enabled(timeout=30000)
       for control in [save,early.get_by_role('button',name='لغو ثبت',exact=True)]:
        box=control.bounding_box();assert box['y']>=0 and box['y']+box['height']<=height+1,(selector,width,label,box)
       assert early.locator('.story-editor').evaluate('e=>e.scrollHeight<=e.clientHeight+1')
      screenshot(early,f'10-undo-{selector[1:]}-{width}')
      early.get_by_role('button',name='لغو ثبت',exact=True).click();early.clock.run_for(3500);assert not writes
    early_ctx.close()
    public_ctx,public=page_for(browser,owner)
    public.on('pageerror',lambda error:errors.append(error.stack))
    for width,height in [(320,568),(1440,900)]:
     public.set_viewport_size({'width':width,'height':height})
     for route in ['/','/terms','/privacy','/support','/changelog']:
      public.goto(BASE+route);expect(public.get_by_role('heading',level=1)).to_be_visible(timeout=20000)
      assert public.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(route,width)
      screenshot(public,f'10-{route.strip("/") or "landing"}-{width}')
    public_ctx.close()
   assert not errors,errors
   print('PASS: '+STAGE+' screenshots captured; '+('readable sizes, map controls, story undo, public pages and four responsive viewport checks passed.' if STAGE!='before' else 'baseline complete.'),flush=True)
  finally:
   for account in owned:
    try:account.call('delete-account',{})
    except Exception as error:print('Owned readability cleanup:',type(error).__name__,flush=True)
   browser.close()
if __name__=='__main__':main()
