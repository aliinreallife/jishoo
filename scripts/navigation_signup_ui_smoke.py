"""Browser regressions with synthetic API data; no account or email writes."""
import copy, json, re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright, expect
from routing_smoke import fixture
from smoke import BASE, CHROMIUM, ARTIFACTS, verified_https


def main():
 data=fixture();data["me"]["shareLocation"]=True;calls=[];errors=[];held=[];hold={'enabled':False}
 friend={'id':'friend','name':'سارای آزمایشی','handle':'qa_sara','avatarSeed':'sara','status':'accepted','connectionId':'friend-connection','socialLinks':{},'linkConnection':'none'}
 data['friends']=[friend]
 data['moments']=[{'id':'moment','kind':'back-to-back','friend':friend,'createdAt':datetime.now(timezone.utc).isoformat()}]
 invite={'code':'TEST-INVITE','remaining':3,'bonusDays':7,'inviter':friend}
 kind={'marker':'public'}
 def mock(route):
  request=route.request;action=parse_qs(urlsplit(request.url).query).get('action',[''])[0];body=request.post_data_json if request.method=='POST' else None
  calls.append((action,body));result=copy.deepcopy(data)
  if action=='bootstrap' and hold['enabled']:held.append(route);return
  if action=='invite':result=invite
  elif action=='waitlist':
   data['auth'].update(waitlisted=True,waitlistPhone=(body.get('phone') or data['auth'].get('waitlistPhone')));result={'joined':True,'phone':data['auth']['waitlistPhone']}
  elif action=='register':
   data['me']['registered']=True;data['me']['name']=body['name'];result=copy.deepcopy(data)
  elif action=='profile-public':result={'profile':{**friend,'handle':'qa_public','name':'همسایهٔ آزمایشی','achievements':[]}}
  elif action=='nearby':
   marker={'id':'map-event','markerKey':'map-marker','lat':35.7,'lng':51.4,'status':'done','createdAt':datetime.now(timezone.utc).isoformat(),'name':'همسایهٔ آزمایشی','profileHandle':'qa_public','profileKind':'profile','avatarSeed':'public'}
   if kind['marker']=='friend':marker.update(name=friend['name'],profileHandle=friend['handle'],isFriend=True)
   elif kind['marker']=='self':marker.update(name='خودت',profileHandle=data['me']['handle'],isMe=True)
   elif kind['marker']=='anonymous':marker.update(name='یه همسایه',profileHandle=None,profileKind='anonymous')
   elif kind['marker']=='guest':marker.update(name='مهمان جیشو',profileHandle=None,profileKind='guest')
   result={'activity':[marker]}
  elif action=='discover':result={'people':[]}
  elif action=='world-map':result={'activity':[],'inView':0,'total':0}
  route.fulfill(json=result)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':393,'height':852},service_workers='block',geolocation={'latitude':35.7,'longitude':51.4},permissions=['geolocation'],has_touch=True)
  verified_https(ctx)
  version=json.loads((Path(__file__).resolve().parents[1]/'package.json').read_text())['version']
  ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
  ctx.route('**/api/app?*',mock);page=ctx.new_page();page.on('pageerror',lambda error:errors.append(str(error)))
  page.goto(BASE+'/profile');page.locator('.memory-card').click();expect(page.locator('.moment-title')).to_contain_text('پشت سر هم')
  page.get_by_role('button',name='اشتراک این خاطره',exact=True).click();expect(page.locator('.full-story-overlay')).to_be_visible()
  page.go_back();expect(page.locator('.full-story-overlay')).to_have_count(0);expect(page.locator('.moment-title')).to_be_visible()
  page.go_back();expect(page.get_by_role('dialog')).to_have_count(0);expect(page).to_have_url(BASE+'/profile')
  page.go_forward();expect(page.locator('.moment-title')).to_be_visible();page.get_by_role('button',name='بستن',exact=True).click();expect(page.get_by_role('dialog')).to_have_count(0)
  page.locator('.profile-invite-card').click()
  origin=page.evaluate('history.state.usr.appFrom');expect(page.locator('.invite-page')).to_be_visible()
  page.screenshot(path=str(ARTIFACTS/'invite-centered-070.png'))
  box=page.locator('.invite-page > h2').bounding_box();shell=page.locator('.app-shell').bounding_box();assert abs(box['x']+box['width']/2-shell['x']-shell['width']/2)<2
  page.get_by_role('button',name='برگشت',exact=True).click();expect(page).to_have_url(BASE+origin)
  page.locator('.bottom-nav').get_by_role('button',name='خانه',exact=True).click();page.get_by_role('button',name='آمار من',exact=True).click();expect(page).to_have_url(BASE+'/stats')
  page.get_by_role('button',name='برگشت',exact=True).click();expect(page).to_have_url(BASE+'/home')
  print('PASS: Browser Back/Forward and Close traverse moment/story layers; page Back returns to the actual origin and invitation copy is centered.',flush=True)

  page.goto(BASE+'/nearby');page.get_by_role('button',name='نمایش اطراف من',exact=True).click();expect(page.locator('.leaflet-marker-icon')).to_have_count(1)
  page.get_by_role('button',name='بزرگ‌نمایی نقشه',exact=True).click();page.wait_for_timeout(450)
  box=page.locator('.real-map').bounding_box();page.mouse.move(box['x']+box['width']*.65,box['y']+box['height']*.65);page.mouse.down();page.mouse.move(box['x']+box['width']*.65+55,box['y']+box['height']*.65+30,steps=12);page.mouse.up();page.wait_for_timeout(700)
  marker=page.locator('.leaflet-marker-icon').bounding_box();page.locator('.bottom-nav').get_by_role('button',name='خانه',exact=True).click();page.locator('.bottom-nav').get_by_role('button',name='این نزدیکا',exact=True).click()
  expect(page.locator('.leaflet-marker-icon')).to_have_count(1);page.wait_for_timeout(300)
  restored=page.locator('.leaflet-marker-icon').bounding_box();assert abs(restored['x']-marker['x'])<2 and abs(restored['y']-marker['y'])<2,(marker,restored)
  assert page.locator('.map-permission-card').count()==0
  page.locator('.leaflet-marker-icon').click();page.locator('.map-profile-action').click();expect(page).to_have_url(BASE+'/u/qa_public');page.get_by_role('button',name='برگشت',exact=True).click();expect(page).to_have_url(BASE+'/nearby')
  for who in ['friend','self','anonymous','guest']:
   kind['marker']=who
   expect(page.locator('.nearby-refresh')).to_contain_text('به‌روزرسانی خودکار')
   with page.expect_response(lambda response:'action=nearby' in response.url):page.evaluate('window.dispatchEvent(new Event("focus"))')
   expected_name={'friend':friend['name'],'self':'خودت','anonymous':'یه همسایه','guest':'مهمان جیشو'}[who]
   expect(page.locator('.leaflet-marker-icon')).to_have_attribute('title',re.compile(re.escape(expected_name)))
   page.locator('.leaflet-marker-icon').click()
   if who=='friend':
    page.locator('.map-profile-action').click();expect(page.locator('.friend-dialog-head')).to_contain_text(friend['name']);page.go_back();expect(page.get_by_role('dialog')).to_have_count(0)
   elif who=='self':
    data['me']['shareLocation']=True;page.locator('.map-profile-action').click();expect(page).to_have_url(BASE+'/profile');page.go_back();expect(page).to_have_url(BASE+'/nearby')
   else:
    expect(page.locator('.map-profile-action')).to_have_count(0);expect(page.locator('.map-profile-private')).to_contain_text('مهمان' if who=='guest' else 'بی‌نام')
  page.get_by_role('button',name='همه‌جا',exact=True).click();expect(page.locator('.map-scope-switch button').last).to_have_attribute('aria-pressed','true')
  page.locator('.bottom-nav').get_by_role('button',name='من',exact=True).click();page.locator('.bottom-nav').get_by_role('button',name='این نزدیکا',exact=True).click();expect(page.locator('.map-scope-switch button').last).to_have_attribute('aria-pressed','true')
  page.get_by_role('tab',name='آدم‌های نزدیک من',exact=True).click();page.locator('.bottom-nav').get_by_role('button',name='خانه',exact=True).click();page.locator('.bottom-nav').get_by_role('button',name='این نزدیکا',exact=True).click();expect(page.get_by_role('tab',name='آدم‌های نزدیک من',exact=True)).to_have_attribute('aria-selected','true')
  print('PASS: Panned/zoomed local camera, geolocation, world scope and list selection survive main-tab navigation; eligible self/friend/public pins open the right profile, anonymous/guest pins do not.',flush=True)

  data['me']['registered']=False;data['auth']['pendingGoogle']=None;page.goto(BASE+'/home?login=1');expect(page.locator('.auth-entry-step')).to_be_visible();expect(page.get_by_role('button',name='ادامه با Google',exact=True)).to_be_visible();expect(page.locator('.auth-entry-step input')).to_have_count(0)
  page.get_by_role('button',name='فعلاً مهمان باشم',exact=True).click();expect(page.get_by_role('dialog')).to_have_count(0)
  data['auth']['pendingGoogle']='qa-only@example.invalid';page.goto(BASE+'/home?google=continue');expect(page.get_by_role('heading',name='کد دعوت داری؟',exact=True)).to_be_visible()
  page.get_by_role('button',name='دعوت ندارم؛ به فهرست انتظار بپیوندم',exact=True).click();expect(page.locator('.auth-waiting-step')).to_contain_text('از دوستی که عضو جیشوئه')
  page.locator('.auth-waiting-step input[type=tel]').fill('+12025550123');page.get_by_role('button',name='ذخیرهٔ شمارهٔ تماس',exact=True).click();expect(page.locator('.toast')).to_contain_text('ذخیره شد')
  page.screenshot(path=str(ARTIFACTS/'waitlist-070.png'));page.get_by_role('button',name='از دوستم کد دعوت گرفتم',exact=True).click();page.get_by_label('کد دعوت عضویت',exact=True).fill(invite['code']);page.get_by_role('button',name='تایید دعوت و ادامه',exact=True).click()
  expect(page.get_by_role('heading',name='اسمت چیه؟',exact=True)).to_be_visible();expect(page.locator('.auth-wizard input')).to_have_count(1);expect(page.locator('.pending-google-note')).to_contain_text('فقط اسمت')
  page.get_by_label('اسمت',exact=True).fill('آزمایش اسم');page.screenshot(path=str(ARTIFACTS/'signup-name-only-070.png'));page.get_by_role('button',name='ساخت حساب من',exact=True).click();expect(page.locator('.invite-connect-step')).to_be_visible()
  submitted=[body for action,body in calls if action=='register'][-1];assert submitted['inviteCode']==invite['code'] and submitted['name']=='آزمایش اسم' and submitted['connectInviter'] is False
  print('PASS: Google is visible first, verified newcomers choose invitation/waitlist, optional contact persists, guests can continue and verified signup only asks for a name while friendship remains a separate choice.',flush=True)
  hold['enabled']=True;loading=ctx.new_page();loading.goto(BASE+'/home',wait_until='domcontentloaded')
  expect(loading.locator('.app-shell > .jishoo-loading')).to_be_visible();expect(loading.locator('.jishoo-loading > strong')).to_have_text('جیشو');expect(loading.locator('.jishoo-loading > p')).to_be_visible()
  assert loading.locator('.app-shell > .jishoo-loading').evaluate('e=>getComputedStyle(e).backgroundColor')=='rgb(255, 249, 230)'
  loading.screenshot(path=str(ARTIFACTS/'loading-070.png'));held.pop().fulfill(json=data);hold['enabled']=False;expect(loading.locator('.need-card')).to_be_visible();loading.close()
  print('PASS: Loading keeps a visible brand and progress copy on the same background as the installed icon.',flush=True)
  assert not errors,errors
  browser.close()

if __name__=='__main__':main()
