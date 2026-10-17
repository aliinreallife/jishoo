"""Verify the actual changed flows with isolated QA accounts and real backend data."""
import sys,secrets,time,json,urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from smoke import context,api,capture,BASE,CHROMIUM,ARTIFACTS
from browser_smoke import phone
from provision_admin import create_invite
ROOT=Path(__file__).resolve().parents[1]
owned=[]
def create(page,name,code):
    api(page,'bootstrap')
    challenge=api(page,'auth-start',{'phone':phone()})
    ticket=api(page,'auth-verify',{'challengeId':challenge['challengeId'],'code':'123456'})
    result=api(page,'register',{'ticket':ticket['ticket'],'name':name,'inviteCode':code})
    owned.append((page,result['me']['id']))
    return result

def main():
  errors=[]
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
    try:
      ctx,a=context(b)
      a.on('pageerror',lambda error:errors.append(str(error)))
      a.goto(BASE,wait_until='domcontentloaded')
      expect(a.get_by_role('button',name='شروع کنیم')).to_be_visible(timeout=30000)
      first=create(a,'آزمایش سارا',create_invite('qa-member')['code'])
      a.reload();expect(a.locator('.bottom-nav')).to_be_visible(timeout=30000)
      a.locator('.bottom-nav').get_by_role('button',name='من',exact=True).click()
      expect(a.locator('.saved-premium-number')).to_contain_text('۷')
      assert a.locator('.profile-link-card').count()==0
      capture(a,'audit-after-profile.png')
      a.get_by_role('button',name='اشتراک پروفایل من',exact=True).click()
      expect(a.get_by_label('لینک پروفایل من')).to_have_value(first['publicUrl']+'/u/'+first['me']['handle'])
      capture(a,'audit-after-profile-sharing.png');a.keyboard.press('Escape')
      a.get_by_role('button',name='تنظیمات پروفایل').click()
      a.locator('input[type=file]').set_input_files(str(ROOT/'public/assets/shy-drop.webp'))
      expect(a.locator('.photo-editor canvas')).to_be_visible(timeout=15000)
      a.get_by_label('بزرگ‌نمایی',exact=True).fill('1.6')
      a.get_by_role('button',name='چرخاندن عکس',exact=True).click()
      capture(a,'audit-after-photo-crop.png')
      a.get_by_role('button',name='همین عکس خوبه',exact=True).click()
      expect(a.locator('.photo-editor')).to_have_count(0,timeout=20000)
      expect(a.locator('.avatar-upload-row .uploaded-avatar')).to_be_visible()
      a.keyboard.press('Escape')
      assert api(a,'bootstrap')['me']['avatarImage'].startswith('data:image/jpeg;base64,')
      print('PASS: Readable saved days, profile link inside sharing only, and confirmed adjustable photo upload',flush=True)
      ctx2,guest=context(b);guest.on('pageerror',lambda e:errors.append(str(e)))
      guest.goto(BASE+'/?invite='+first['me']['inviteCode'],wait_until='domcontentloaded')
      expect(guest.locator('.inviter-spotlight')).to_contain_text('آزمایش سارا',timeout=30000)
      expect(guest.locator('.invite-landing-features')).to_contain_text('استوری')
      capture(guest,'audit-after-invitation-landing.png')
      guest.get_by_role('button',name='با این دعوت عضو بشم',exact=True).click()
      guest.get_by_label('شماره موبایل',exact=True).fill(phone())
      guest.get_by_role('button',name='دریافت کد ورود',exact=True).click()
      expect(guest.get_by_role('heading',name='اسمت چیه؟')).to_be_visible(timeout=20000)
      guest.get_by_label('اسمت',exact=True).fill('آزمایش نیما')
      assert guest.locator('.consent-label input[type=checkbox]').count()==0
      guest.get_by_role('button',name='ساخت حساب من',exact=True).click()
      expect(guest.locator('.invite-connect-step')).to_be_visible(timeout=20000)
      fresh=api(guest,'bootstrap');owned.append((guest,fresh['me']['id']))
      assert fresh['friends'][0]['status']=='pending'
      capture(guest,'audit-after-invitation-friend-choice.png')
      guest.get_by_role('button',name='آره، به آزمایش سارا وصل بشم').click()
      expect(guest.get_by_role('dialog')).to_have_count(0,timeout=20000)
      assert api(guest,'bootstrap')['friends'][0]['status']=='accepted'
      assert api(a,'bootstrap')['invitationQuota']['used']==1
      print('PASS: Personal invitation landing explains value; separate explicit friendship step connects both users',flush=True)
      ctx.grant_permissions(['notifications'])
      a.goto(BASE+'/#/notifications');expect(a.locator('.device-push-card')).to_be_visible(timeout=20000)
      a.evaluate("() => { window.permissionRequests=0; Notification.requestPermission=()=>{window.permissionRequests++;return Promise.resolve('denied')}; }")
      a.get_by_role('button',name='خبر رفیقام رو برسون',exact=True).click()
      expect(a.get_by_role('dialog',name='یه خبر کوچولو، حتی وقتی نیستی 💧')).to_be_visible()
      assert a.evaluate('window.permissionRequests')==0
      capture(a,'audit-after-push-explanation.png')
      a.get_by_role('button',name='باشه، خبر رفیقام رو برسون',exact=True).click()
      expect(a.locator('.toast')).to_contain_text('اجازه',timeout=5000)
      assert a.evaluate('window.permissionRequests')==1
      a.get_by_role('button',name='فعلاً نه',exact=True).click()
      if BASE.startswith('http://'):
        reg=a.evaluate("async()=>Promise.race([(async()=>{await navigator.serviceWorker.register('/sw.js');const r=await navigator.serviceWorker.ready;return {active:r.active.state,scope:r.scope};})(),new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker activation timed out')),12000))])")
        assert reg['active'] in ('activating','activated')
        a.wait_for_function("async()=>{const r=await navigator.serviceWorker.getRegistration('/');return r?.active?.state==='activated'}",timeout=12000)
      else:
        import os
        request=urllib.request.Request(BASE+'/sw.js',headers={'x-vercel-protection-bypass':os.environ['JISHOO_TEST_BYPASS_SECRET']} if os.environ.get('JISHOO_TEST_BYPASS_SECRET') else {})
        with urllib.request.urlopen(request,timeout=30) as response:assert 'self.addEventListener("push"' in response.read().decode()
      print('PASS: Explanation precedes permission; worker activation checked locally and deployed worker verified',flush=True)
      guest.locator('.need-card').click()
      expect(guest.locator('.checkin-art')).to_be_visible(timeout=20000)
      guest.get_by_role('button',name='اشتراک این خبر',exact=True).click()
      expect(guest.get_by_role('button',name='اشتراک تصویر',exact=True)).to_be_enabled(timeout=30000)
      assert guest.locator('.story-qr').count()==0
      assert guest.get_by_role('button',name='کپی لینک دعوت',exact=True).count()==0
      assert first['me']['inviteCode'] not in guest.locator('.story-canvas').inner_text()
      capture(guest,'audit-after-no-invite-story.png')
      with guest.expect_download() as dl:guest.get_by_role('button',name='ذخیره PNG',exact=True).click()
      dl.value.save_as(str(ARTIFACTS/'audit-no-invite-story.png'))
      guest.keyboard.press('Escape')
      for _ in range(10):
        notes=api(a,'bootstrap')['notifications']
        if any(n['kind']=='checkin' and 'نیما' in n['title'] for n in notes):break
        time.sleep(.3)
      assert any(n['kind']=='checkin' and 'نیما' in n['title'] for n in notes)
      a.goto(BASE+'/#/invite');expect(a.get_by_role('button',name='اشتراک کارت دعوت')).to_be_visible(timeout=20000)
      a.get_by_role('button',name='اشتراک کارت دعوت').click()
      expect(a.get_by_role('button',name='اشتراک تصویر',exact=True)).to_be_enabled(timeout=30000)
      expect(a.locator('.story-qr')).to_be_visible()
      assert first['me']['inviteCode'] in a.locator('.story-canvas').inner_text()
      capture(a,'audit-after-invite-story.png');a.keyboard.press('Escape')
      print('PASS: Friend activity creates a real server notification; only invite stories include invite codes and QR links',flush=True)
      for width in [360,393,768,1440]:
        a.set_viewport_size({'width':width,'height':900});a.goto(BASE+'/#/profile')
        expect(a.locator('.saved-premium-card')).to_be_visible(timeout=15000)
        assert a.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
      a.goto(BASE+'/#/admin');expect(a.get_by_role('heading',name='ورود خصوصی مدیر')).to_be_visible(timeout=15000)
      a.get_by_label('رمز مدیر',exact=True).fill('wrong-test-password')
      a.get_by_role('button',name='ورود به داشبورد',exact=True).click()
      expect(a.locator('.toast')).to_contain_text('معتبر نیست',timeout=15000)
      assert api(a,'bootstrap')['me']['isAdmin'] is False
      assert not errors,errors
      print('PASS: Responsive layouts and protected admin password gate; no page JavaScript errors',flush=True)
    finally:
      for page,uid in owned:
        try:
          if api(page,'bootstrap')['me']['id']==uid:api(page,'delete-account',{})
        except Exception as e:print('QA cleanup requires follow-up:',uid,type(e).__name__,flush=True)
      b.close()
if __name__=='__main__':main()
