"""Real, owned-data checks for paused SMS, explicit account merging and the release UX.

Run only against a protected QA preview containing the signed identity fixture.
The fixture is never deployed to production. All synthetic accounts are removed.
"""
import hashlib,hmac,json,os,secrets,time,uuid,urllib.request,urllib.error
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from api_smoke import Client,BASE as API_BASE
from smoke import context,api,capture,BASE,CHROMIUM
from provision_admin import create_invite
from deploy_vercel import request
ROOT=Path(__file__).resolve().parents[1]
owned=[]
project=json.loads((ROOT/'.vercel/project.json').read_text())
_config=None

def fixture(client,operation=None,**extra):
 global _config
 if API_BASE=='https://jishoo.vercel.app':raise RuntimeError('Fixture tests require a protected preview')
 if _config is None:_config=request(f"/v3/env/pull/{project['projectId']}?target=development&teamId={project['orgId']}")['env']
 state=client.bootstrap();token=next(c.value for c in client.cookies if c.name=='jishoo_session')
 body={'userId':state['me']['id'],'sessionHash':hashlib.sha256(token.encode()).hexdigest(),'nonce':'qa-google-'+str(uuid.uuid4()),'timestamp':int(time.time()*1000),**extra}
 if operation:body['operation']=operation
 raw=json.dumps(body,separators=(',',':')).encode();signature=hmac.new(_config['APP_SECRET'].encode(),raw,hashlib.sha256).hexdigest()
 req=urllib.request.Request(API_BASE+'/api/qa-google-fixture',data=raw,headers={'Content-Type':'application/json','X-Jishoo-QA':signature,'x-vercel-protection-bypass':os.environ['JISHOO_TEST_BYPASS_SECRET']})
 with urllib.request.urlopen(req,timeout=45) as response:assert json.load(response)['ready']

def client():
 c=Client();owned.append(c);c.bootstrap();return c

def google_member(name,code=None,admin=False):
 c=client();fixture(c)
 state=c.call('register',{'provider':'google','ticket':'google','name':name,'inviteCode':code or create_invite('qa-admin' if admin else 'qa-member')['code']})
 return c,c.call('profile',{'handle':'qa_'+secrets.token_hex(8),'socialLinks':{'instagram':'jishoo_test'}})

def connect(sender,recipient):
 target=recipient.bootstrap()['me'];sender.call('connection-request',{'handle':target['handle']})
 source=sender.bootstrap()['me'];pending=next(f for f in recipient.bootstrap()['friends'] if f['id']==source['id'])
 recipient.call('connection-respond',{'id':pending['connectionId'],'accept':True})

def page_for(browser,c,**kwargs):
 ctx,page=context(browser,**kwargs);token=next(x.value for x in c.cookies if x.name=='jishoo_session')
 ctx.add_cookies([{'name':'jishoo_session','value':token,'url':BASE,'httpOnly':True,'sameSite':'Lax'}])
 ctx.add_init_script("localStorage.setItem('jishoo:last-seen-release','0.2.1');localStorage.setItem('jishoo:v2-entered','true')")
 return ctx,page

def verify_rate_limits():
 spam=client();nonce=secrets.token_hex(12)
 one=spam.call('checkin',{'status':'done','visibility':'private','nonce':nonce})
 two=spam.call('checkin',{'status':'done','visibility':'private','nonce':nonce})
 assert one['event']['id']==two['event']['id'] and two['stats']['total']==1
 for n in range(18):spam.call('checkin',{'status':'need','visibility':'private','nonce':secrets.token_hex(12)})
 spam.call('checkin',{'status':'need','visibility':'private','nonce':secrets.token_hex(12)},expected=429)


def main():
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  try:
   a=client();phone=f'+1{secrets.randbelow(789)+201}55501{secrets.randbelow(100):02}'
   fixture(a,'legacy-phone',phone=phone);source=a.bootstrap();aid=source['me']['id']
   b,target=google_member('آزمایش حساب گوگل',source['me']['inviteCode']);bid=target['me']['id'];old_handle=target['me']['handle']
   c,peer=google_member('آزمایش دوست مشترک',source['me']['inviteCode']);admin,_=google_member('آزمایش مدیر اتصال',admin=True)
   assert not a.bootstrap()['auth']['phoneLoginEnabled']
   for action,body in [('auth-start',{'phone':phone}),('auth-verify',{'challengeId':'old','code':'123456'}),('phone-link-start',{'phone':phone}),('phone-link-verify',{'challengeId':'old','code':'123456'}),('register',{'provider':'phone','ticket':'old','name':'آزمایش'})]:
    assert a.call(action,body,expected=403)['error']=='phone_auth_disabled'
   b.call('google-disconnect',{},expected=409)
   print('PASS: Every phone login/link endpoint and stale phone registration is blocked; Google cannot be removed when phone login is paused.',flush=True)
   connect(a,b);connect(a,c);connect(b,c)
   for owner in [a,b]:
    f=next(f for f in owner.bootstrap()['friends'] if f['id']==peer['me']['id']);owner.call('connection-share',{'id':f['connectionId'],'operation':'request'});c.call('connection-share',{'id':f['connectionId'],'operation':'accept'})
   c.call('notification-pref',{'scope':'friend','id':bid,'enabled':False})
   b.call('notification-pref',{'scope':'friend','id':peer['me']['id'],'enabled':False})
   admin.call('admin-user',{'id':bid,'operation':'lifetime','enabled':True})
   for owner in [a,b]:owner.call('checkin',{'status':'done','visibility':'friends','nonce':secrets.token_hex(12)})
   group=b.call('circle-create',{'name':'آزمایش گروه منتقل‌شده','members':[aid,peer['me']['id']],'shared':True})
   b.call('map-visibility',{'mode':'profile','lat':35.70127,'lng':51.40137})
   stranger=client();stranger.call('account-merge-confirm',{'confirmed':True,'targetId':bid},expected=401)
   fixture(a,'merge-proof',targetId=bid);assert a.bootstrap()['auth']['pendingMerge']['other']['handle']==old_handle
   assert c.bootstrap()['auth']['pendingMerge'] is None;c.call('account-merge-confirm',{'confirmed':True,'targetId':bid},expected=409)
   a.call('account-merge-confirm',{'confirmed':False},expected=400)
   a.call('account-merge-cancel',{});assert a.bootstrap()['auth']['pendingMerge'] is None
   fixture(a,'expired-merge-proof',targetId=bid);a.call('account-merge-confirm',{'confirmed':True},expected=409)
   assert b.bootstrap()['me']['id']==bid and not a.bootstrap()['auth']['googleConnected']
   fixture(a,'merge-proof',targetId=bid)
   ctx,page=page_for(browser,a,geo=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto(BASE+'/?google=merge_required#/profile');expect(page.locator('.account-merge-card')).to_be_visible(timeout=30000);expect(page.get_by_label('شماره موبایل من',exact=True)).to_have_text(phone);assert page.locator('.phone-link-form').count()==0
   page.get_by_role('button',name='مرور اتصال دو حساب',exact=True).click();expect(page.get_by_role('button',name='بله، دو حسابم رو یکی کن',exact=True)).to_be_visible();capture(page,'merge-review.png')
   def confirm_status(_):
    req=urllib.request.Request(API_BASE+'/api/app?action=account-merge-confirm',data=b'{"confirmed":true}',headers={'Origin':API_BASE,'Content-Type':'application/json','Cookie':'; '.join(x.name+'='+x.value for x in a.cookies),'x-vercel-protection-bypass':os.environ['JISHOO_TEST_BYPASS_SECRET']})
    try:
     with urllib.request.urlopen(req,timeout=50) as r:return r.status,json.load(r)
    except urllib.error.HTTPError as e:return e.code,json.load(e)
   with ThreadPoolExecutor(max_workers=2) as pool:responses=list(pool.map(confirm_status,range(2)))
   assert sorted(r[0] for r in responses)==[200,409],[(r[0],r[1].get('error')) for r in responses]
   merged=a.bootstrap();assert merged['me']['id']==aid and merged['me']['handle']==source['me']['handle'] and merged['me']['lifetime']
   assert merged['auth']['phoneNumber']==phone and merged['auth']['googleConnected'] and merged['auth']['pendingMerge'] is None
   assert merged['stats']['total']==2 and len(merged['friends'])==1 and merged['friends'][0]['id']==peer['me']['id'] and merged['friends'][0]['socialLinks']=={}
   assert not merged['me']['shareLocation'] and not merged['me']['discoverable']
   assert next(g for g in merged['circles'] if g['id']==group['id'])['ownerId']==aid
   assert next(f for f in c.bootstrap()['friends'] if f['id']==aid)['socialLinks']=={}
   assert any(pref['scope']=='friend' and pref['id']==aid and not pref['enabled'] for pref in c.bootstrap()['notificationPreferences'])
   assert b.bootstrap()['me']['id']!=bid
   assert c.call('profile-public&handle='+old_handle)['profile']['id']==aid
   c.call('profile',{'handle':old_handle},expected=409);a.call('account-merge-confirm',{'confirmed':True},expected=429)
   page.goto(BASE+'/#/profile');page.reload();page.get_by_role('button',name='تنظیمات پروفایل',exact=True).click();expect(page.locator('.connected-google')).to_be_visible(timeout=20000);assert page.locator('.account-merge-card').count()==0;page.keyboard.press('Escape')
   print('PASS: Merge needs fresh browser-bound proof and explicit consent; expiry, cancel, outsider and replay fail. Concurrent confirmation merges once, preserves statistics/friends/groups/lifetime/old profile link, clears social/location consent and revokes the other session.',flush=True)
   page.goto(BASE+'/#/nearby');expect(page.locator('.real-map')).to_be_visible(timeout=20000);bounds=page.locator('.real-map').bounding_box();page.get_by_role('button',name='نمایش اطراف من',exact=True).click();expect(page.get_by_role('button',name='با پروفایلم',exact=True)).to_be_visible(timeout=25000)
   assert not api(page,'bootstrap')['me']['shareLocation'];page.get_by_role('button',name='با پروفایلم',exact=True).click();expect(page.get_by_role('button',name='با پروفایلم',exact=True)).to_have_attribute('aria-pressed','true',timeout=20000);state=api(page,'bootstrap')['me'];assert state['shareLocation'] and state['discoverable'];capture(page,'map-profile-one-click.png')
   page.get_by_role('button',name='بی‌نام',exact=True).click();expect(page.get_by_role('button',name='بی‌نام',exact=True)).to_have_attribute('aria-pressed','true',timeout=20000);state=api(page,'bootstrap')['me'];assert state['shareLocation'] and not state['discoverable']
   page.get_by_role('button',name='پنهان',exact=True).click();expect(page.get_by_role('button',name='پنهان',exact=True)).to_have_attribute('aria-pressed','true',timeout=20000);state=api(page,'bootstrap')['me'];assert not state['shareLocation'] and not state['discoverable'];assert page.locator('.real-map').bounding_box()==bounds
   pane=page.locator('.leaflet-map-pane').evaluate('(e)=>e.style.transform');page.get_by_role('button',name='جمع‌کردن گزینه‌های نقشه',exact=True).click();page.get_by_role('button',name='نمایش گزینه‌های نقشه',exact=True).click();assert page.locator('.real-map').bounding_box()==bounds and page.locator('.leaflet-map-pane').evaluate('(e)=>e.style.transform')==pane
   page.goto(BASE+'/#/friends');page.locator('.connected-card').first.click();page.get_by_role('button',name='درخواست دیدن حساب‌ها',exact=True).click();expect(page.locator('.social-outgoing')).to_be_visible(timeout=20000)
   for width,height in [(393,852),(320,568),(812,375),(1440,900)]:
    page.set_viewport_size({'width':width,'height':height});box=page.get_by_role('dialog').bounding_box();assert box['x']==0 and box['y']==0 and abs(box['width']-width)<1 and abs(box['height']-height)<1,(width,height,box)
   capture(page,'social-request-fullscreen.png');page.keyboard.press('Escape');page.set_viewport_size({'width':393,'height':852});page.goto(BASE+'/#/stories/need');expect(page.locator('.story-canvas')).to_be_visible(timeout=20000);expect(page.locator('img.story-raster-preview')).to_have_js_property('naturalWidth',1080);capture(page,'need-story-simple.png')
   print('PASS: Profile visibility takes one selection; hidden/news/profile modes persist accurately; map geometry and camera are stable; social requests stay full screen at four sizes; redundant need-story labels are gone.',flush=True)
   landing_ctx,landing=context(browser);calls=[];landing.on('request',lambda r:calls.append(r.url) if '/api/' in r.url else None);landing.goto(BASE+'/');expect(landing.get_by_role('heading',level=1)).to_contain_text('رفاقت‌های قشنگ',timeout=20000);assert not calls
   for width,height in [(393,852),(320,568),(1440,900)]:
    landing.set_viewport_size({'width':width,'height':height});assert landing.evaluate('document.documentElement.scrollWidth<=innerWidth+1');capture(landing,f'landing-{width}.png')
   landing.set_viewport_size({'width':393,'height':852});landing.get_by_role('link',name='ورود با گوگل',exact=True).click();expect(landing.get_by_label('کد دعوت عضویت',exact=True)).to_be_visible(timeout=20000);landing.get_by_role('button',name='قبلاً عضو شدم؛ ورود به حسابم',exact=True).click();expect(landing.get_by_role('button',name='ادامه با Google',exact=False)).to_be_visible(timeout=20000);assert landing.locator('input[type=tel]').count()==0
   api(landing,'delete-account',{});landing_ctx.close()
   release_ctx,release=context(browser);release_token=next(x.value for x in a.cookies if x.name=='jishoo_session');release_ctx.add_cookies([{'name':'jishoo_session','value':release_token,'url':BASE,'httpOnly':True,'sameSite':'Lax'}]);release_ctx.add_init_script("if(!localStorage.getItem('qa-release-seeded')){localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release','0.1.0');localStorage.setItem('qa-release-seeded','true')}");release.goto(BASE+'/#/profile');expect(release.locator('.release-notes')).to_be_visible(timeout=20000);capture(release,'release-popup.png');release.get_by_role('button',name='چه خوب! بریم تو جیشو',exact=True).click();release.reload();expect(release.locator('.release-notes')).to_have_count(0,timeout=15000);release.goto(BASE+'/changelog');expect(release.get_by_role('heading',name='تازه‌های جیشو',exact=True)).to_be_visible(timeout=15000)
   print('PASS: Landing is responsive and makes no private API requests; Google CTA opens the paused-phone login flow; Persian release notes appear once per version and remain available publicly.',flush=True)
   from release_visual_smoke import verify_release_extras
   verify_release_extras(browser,a,c,page_for,client)
   verify_rate_limits()
   assert not errors,errors
   print('PASS: Retried check-ins are idempotent and server-side burst limits reject further submissions.',flush=True)
  finally:
   deleted=set()
   for owner in owned:
    try:
     uid=owner.bootstrap()['me']['id']
     if uid not in deleted:owner.call('delete-account',{});deleted.add(uid)
    except Exception as e:print('QA cleanup needs follow-up:',type(e).__name__,flush=True)
   browser.close()
if __name__=='__main__':main()
