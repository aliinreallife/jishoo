"""Check fitted exports, private phone display, map controls and free-feature clarity."""
import json,secrets
from PIL import Image
from playwright.sync_api import sync_playwright,expect
from smoke import context,api,capture,BASE,CHROMIUM,ARTIFACTS
from api_smoke import Client
from provision_admin import create_invite

def main():
 clients=[];errors=[]
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  try:
   owner=Client();clients.append(owner);phone,ticket=owner.new_ticket();joined=owner.call('register',{'ticket':ticket,'name':'آزمایش نمایش','inviteCode':create_invite('qa-member')['code']})
   assert joined['auth']['phoneNumber']==phone
   peer=Client();clients.append(peer);otherPhone,ticket=peer.new_ticket();other=peer.call('register',{'ticket':ticket,'name':'آزمایش حریم','inviteCode':joined['me']['inviteCode'],'connectInviter':True})
   assert other['auth']['phoneNumber']==otherPhone and phone not in json.dumps(other,ensure_ascii=False)
   public=peer.call('profile-public&handle='+joined['me']['handle']);assert phone not in json.dumps(public,ensure_ascii=False) and 'auth' not in public
   guest=Client();clients.append(guest);assert guest.bootstrap()['auth']['phoneNumber'] is None
   ctx,page=context(browser,geo=True);token=next(c.value for c in owner.cookies if c.name=='jishoo_session');ctx.add_cookies([{'name':'jishoo_session','value':token,'url':BASE,'httpOnly':True,'sameSite':'Lax'}]);page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+'/#/profile')
   page.get_by_role('button',name='تنظیمات پروفایل',exact=True).click();expect(page.get_by_label('شماره موبایل من',exact=True)).to_have_text(phone,timeout=15000);capture(page,'display-own-phone.png');page.keyboard.press('Escape')
   expect(page.locator('.premium-free-hint')).to_contain_text('همیشه رایگانه');page.locator('.premium-card').click();expect(page.locator('.premium-free')).to_contain_text('اشتراک لازم نیست');expect(page.locator('.premium-free')).to_contain_text('دوست‌ها، گروه‌ها');expect(page.locator('.premium-extra')).to_contain_text('تبادل حساب‌های اجتماعی');capture(page,'display-free-premium.png');page.keyboard.press('Escape')
   print('PASS: Owner sees the full linked number in settings; friends/public profiles/guests never receive it; free and premium capabilities are clearly separated.',flush=True)
   page.goto(BASE+'/#/nearby');expect(page.locator('.real-map')).to_be_visible(timeout=15000);before=page.locator('.real-map').bounding_box();page.get_by_role('button',name='نمایش اطراف من',exact=True).click();expect(page.locator('.around-panel')).to_be_visible(timeout=20000);assert page.locator('.real-map').bounding_box()==before
   sharing=api(page,'bootstrap')['me']['shareLocation'];transform=page.locator('.leaflet-map-pane').evaluate('(e)=>e.style.transform');page.get_by_role('button',name='جمع‌کردن گزینه‌های نقشه',exact=True).click();expect(page.locator('.around-panel')).to_be_hidden();assert page.locator('.real-map').bounding_box()==before and page.locator('.leaflet-map-pane').evaluate('(e)=>e.style.transform')==transform;capture(page,'display-map-only.png')
   page.get_by_role('button',name='نمایش گزینه‌های نقشه',exact=True).click();expect(page.locator('.around-panel')).to_be_visible();page.locator('.nearby-people-trigger').click();expect(page.locator('.discovery-visibility')).to_be_visible();assert page.locator('.real-map').bounding_box()==before and api(page,'bootstrap')['me']['shareLocation']==sharing
   print('PASS: Geolocation and opening/closing map options preserve map geometry, camera transform and location-sharing consent.',flush=True)
   for kind in ['checkin','need','weekly','invite']:
    page.goto(BASE+'/#/stories/'+kind);expect(page.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
    assert page.locator('.story-invitation').count()==(1 if kind=='invite' else 0)
    if kind=='invite':assert page.locator('.story-invitation').evaluate('(e)=>getComputedStyle(e).backgroundColor')=='rgba(0, 0, 0, 0)'
    for width,height in [(320,568),(393,852),(1440,900),(812,375)]:
     page.set_viewport_size({'width':width,'height':height})
     for format,size in [('استوری ۹:۱۶',(1080,1920)),('پست ۱:۱',(1080,1080))]:
      page.get_by_role('button',name=format,exact=True).click();page.wait_for_timeout(120)
      for label in ['ذخیره PNG','اشتراک تصویر']:
       bounds=page.get_by_role('button',name=label,exact=True).bounding_box();assert bounds['y']>=0 and bounds['y']+bounds['height']<=height and bounds['x']>=0 and bounds['x']+bounds['width']<=width,(kind,width,height,label,bounds)
       assert bounds['y']+bounds['height']<=page.locator('.bottom-nav').bounding_box()['y']
      assert page.locator('.story-editor').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1')
      assert page.locator('.story-canvas').evaluate('(e)=>[...e.children].every(child=>child.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom+1)')
      if (width,height)==(393,852):
       expect(page.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
       with page.expect_download() as dl:page.get_by_role('button',name='ذخیره PNG',exact=True).click()
       path=ARTIFACTS/f'display-{kind}-{size[1]}.png';dl.value.save_as(str(path));image=Image.open(path);assert image.format=='PNG' and image.size==size
       if format=='استوری ۹:۱۶':capture(page,f'display-story-{kind}.png')
   print('PASS: Four story kinds fit four portrait/landscape/desktop sizes in both formats without scrolling to save; eight actual PNG exports retain full resolution and the white footer panel is gone.',flush=True)
   page.set_viewport_size({'width':393,'height':852});page.get_by_role('button',name='استوری ۹:۱۶',exact=True).click();page.get_by_label('متن کارت اشتراک',exact=True).fill('یه لحظه از روزم برای دوستام. '*3);expect(page.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
   api(page,'checkin',{'status':'done','visibility':'friends','nonce':secrets.token_hex(12)});peer.call('checkin',{'status':'done','visibility':'friends','nonce':secrets.token_hex(12)})
   page.goto(BASE+'/#/profile');page.reload();page.locator('.memory-card').first.click();page.get_by_role('button',name='اشتراک این خاطره',exact=True).click()
   for format,size in [('استوری ۹:۱۶',(1080,1920)),('پست ۱:۱',(1080,1080))]:
    page.get_by_role('button',name=format,exact=True).click();expect(page.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
    assert page.locator('.story-invitation').count()==0
    assert page.locator('.story-canvas').evaluate('(e)=>[...e.children].every(child=>child.getBoundingClientRect().bottom<=e.getBoundingClientRect().bottom+1)')
    with page.expect_download() as dl:page.get_by_role('button',name='ذخیره PNG',exact=True).click()
    path=ARTIFACTS/f'display-together-{size[1]}.png';dl.value.save_as(str(path));assert Image.open(path).size==size
   print('PASS: A real shared moment exports both sizes without the footer box or clipped canvas content.',flush=True)
   assert not errors,errors
  finally:
   for client in clients:
    try:client.call('delete-account',{})
    except Exception as e:print('Owned display cleanup:',type(e).__name__,flush=True)
   browser.close()
if __name__=='__main__':main()
