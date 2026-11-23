"""Synthetic UI checks for cute density maps, consent, viewport counts and streaks."""
import json,math,subprocess
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright,expect
from routing_smoke import fixture
from smoke import BASE,CHROMIUM,ARTIFACTS,verified_https

ROOT=Path(__file__).resolve().parents[1]

def main():
 data=fixture();data['me']['mapVisibilityReviewed']=False
 data['stats']['streak']=json.loads(subprocess.check_output(['node','--input-type=module','-e','import {dailyStreak} from "./lib/streaks.js";import {dayKey,addDays} from "./lib/calendar.js";const now=new Date();console.log(JSON.stringify(dailyStreak(Array.from({length:21},(_,i)=>dayKey(addDays(now,-i))),now)));'],cwd=ROOT))
 now=datetime.now(timezone.utc).isoformat();phase={'kind':'one'};requests=[];errors=[];held=[];hold={'enabled':False}
 def rows():
  n={'empty':0,'one':1,'same':2,'few':3,'dense':30}[phase['kind']]
  return [{'id':'map-'+str(i),'markerKey':str(i),'name':'یه همسایه','avatarSeed':'anon-'+str(i),'lat':35.7005 if phase['kind']=='same' else 35.7+(i%6-2)*.002,'lng':51.4005 if phase['kind']=='same' else 51.4+(i//6-2)*.002,'status':'need' if i%3==0 else 'done','createdAt':now,'isFriend':False,'isMe':False} for i in range(n)]
 def mock(route):
  request=route.request;qs=parse_qs(urlsplit(request.url).query);action=qs.get('action',[''])[0];body=request.post_data_json if request.method=='POST' else None
  requests.append((action,body));result=data
  if action=='nearby':
   if hold['enabled']:held.append(route);return
   result={'activity':rows(),'approximate':True}
  elif action=='discover':result={'people':[{'id':'neighbor','name':'سارای آزمایشی','handle':'qa_sara','avatarSeed':'سارا','distance':'کمتر از ۳ کیلومتر','connection':None}]}
  elif action=='map-visibility':
   if not body.get('reviewOnly'):data['me'].update(shareLocation=body['mode']!='hidden',discoverable=body['mode']=='profile')
   data['me']['mapVisibilityReviewed']=True;result={'mode':'profile' if data['me']['discoverable'] else 'news' if data['me']['shareLocation'] else 'hidden'}
  elif action=='location':result={'enabled':data['me']['shareLocation']}
  elif action=='world-map':
   if hold['enabled']:held.append(route);return
   points=rows();south=float(qs.get('south',[-90])[0]);north=float(qs.get('north',[90])[0]);west=float(qs.get('west',[-180])[0]);east=float(qs.get('east',[180])[0]);points=[row for row in points if south<=row['lat']<=north and (west<=row['lng']<=east if west<=east else row['lng']>=west or row['lng']<=east)]
   result={'activity':[{**row,'count':1,'isFriend':False,'name':'یه نفر روی نقشه'} for row in points],'total':len(rows()),'inView':len(points),'refreshSeconds':30}
  elif action=='profile':data['me'].update(body);result=data
  route.fulfill(json=result)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':393,'height':852},service_workers='block',geolocation={'latitude':35.7,'longitude':51.4},permissions=['geolocation'])
  verified_https(ctx);ctx.route('**/api/app?*',mock)
  version=json.loads((ROOT/'package.json').read_text())['version']
  ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
  page=ctx.new_page();page.on('pageerror',lambda error:(errors.append(str(error)),print('Browser error:',error,flush=True)))
  page.goto(BASE+'/nearby',wait_until='domcontentloaded')
  expect(page.get_by_role('dialog')).to_contain_text('خودت انتخاب کن چطور دیده بشی',timeout=20000)
  expect(page.locator('input[name="map-visibility"][value="hidden"]')).to_be_checked()
  page.screenshot(path=str(ARTIFACTS/'soft-map-first-visibility.png'))
  page.get_by_role('button',name='فعلاً همین‌طور بمونه',exact=True).click()
  expect(page.get_by_role('dialog')).to_have_count(0)
  page.get_by_role('button',name='نمایش اطراف من',exact=True).click()
  expect(page.locator('.live-map-marker')).to_have_count(1,timeout=15000)
  expect(page.locator('.nearby-count')).to_contain_text('۱ نفر در این نما')
  assert not [body for action,body in requests if action in ['location','map-visibility'] and body.get('mode') in ['news','profile']]
  assert not page.locator('.around-panel').count()
  assert page.locator('.live-map-marker > span').first.evaluate('node=>getComputedStyle(node).borderRadius')=='50%'
  page.screenshot(path=str(ARTIFACTS/'soft-map-one-person.png'))
  for _ in range(3):page.get_by_role('button',name='کوچک‌نمایی نقشه',exact=True).click();page.wait_for_timeout(200)
  expect(page.locator('.nearby-map-pane')).to_have_attribute('data-presentation','characters')
  assert not page.locator('canvas.jishoo-heatmap-layer').count()
  page.get_by_role('button',name='مکان من',exact=True).click();page.wait_for_timeout(400)
  print('PASS: First-time choices preserve hidden defaults; viewing needs no publishing consent, and a lone participant stays a character even when zoomed out.',flush=True)
  phase['kind']='same';page.evaluate('window.dispatchEvent(new Event("focus"))')
  overlapping=page.locator('.leaflet-marker-icon:has(.spread-map-marker)')
  expect(overlapping).to_have_count(2)
  expect(page.locator('.nearby-count')).to_contain_text('۲ نفر در این نما')
  expect(page.locator('.map-mascot-count')).to_have_count(0)
  a,b=[pin.bounding_box() for pin in overlapping.all()]
  assert math.hypot(a['x']-b['x'],a['y']-b['y']) >= 66, (a,b)
  for pin in overlapping.all():
   pin.click()
   expect(page.locator('.map-profile-private')).to_be_visible()
   page.get_by_role('button',name='بستن جزئیات نقشه',exact=True).click()
  assert [pin.bounding_box() for pin in overlapping.all()]==[a,b]
  page.screenshot(path=str(ARTIFACTS/'soft-map-same-spot.png'))
  print('PASS: Two nearby participants at the same point get stable, distinct tap targets without revealing a profile.',flush=True)
  phase['kind']='dense';page.evaluate('window.dispatchEvent(new Event("focus"))')
  expect(page.locator('canvas.jishoo-heatmap-layer')).to_be_visible(timeout=20000)
  expect(page.locator('.nearby-map-pane')).to_have_attribute('data-presentation','heat')
  colored=page.locator('canvas.jishoo-heatmap-layer').evaluate('node=>{let p=node.getContext("2d").getImageData(0,0,node.width,node.height).data,n=0;for(let i=3;i<p.length;i+=4)if(p[i]>10)n++;return n}')
  assert colored>1000,colored
  page.screenshot(path=str(ARTIFACTS/'soft-map-dense-heat.png'))
  page.get_by_role('button',name='نزدیک‌تر ببین، شخصیت‌ها پیداشون می‌شه',exact=True).click()
  expect(page.locator('.nearby-map-pane')).to_have_attribute('data-presentation','characters',timeout=15000)
  assert page.locator('.live-map-marker').count()>0
  page.locator('.live-map-marker').first.click()
  expect(page.locator('.map-selection-sheet')).to_be_visible()
  expect(page.locator('.nearby-status-strip')).to_be_visible()
  page.get_by_role('button',name='بستن جزئیات نقشه',exact=True).click()
  page.screenshot(path=str(ARTIFACTS/'soft-map-close-characters.png'))
  print('PASS: Dense data produces a real weighted pastel heat canvas; zooming reveals tappable characters and a compact detail sheet without hiding the live count.',flush=True)
  page.wait_for_timeout(500)
  hold['enabled']=True;before=page.locator('.nearby-count strong').inner_text();camera=page.locator('.leaflet-map-pane').get_attribute('style')
  page.evaluate('window.dispatchEvent(new Event("focus"))')
  expect(page.locator('.nearby-refresh')).to_contain_text('در حال تازه‌شدن')
  assert page.locator('.nearby-count strong').inner_text()==before
  assert held
  held.pop().fulfill(json={'activity':rows(),'approximate':True});hold['enabled']=False
  expect(page.locator('.nearby-refresh')).to_contain_text('به‌روزرسانی خودکار')
  assert page.locator('.leaflet-map-pane').get_attribute('style')==camera,(camera,page.locator('.leaflet-map-pane').get_attribute('style'))
  ctx.set_offline(True);expect(page.locator('.nearby-refresh')).to_contain_text('اتصال قطع شده')
  ctx.set_offline(False)
  phase['kind']='empty';page.evaluate('window.dispatchEvent(new Event("focus"))')
  expect(page.locator('.map-calm-state')).to_be_visible(timeout=15000)
  expect(page.locator('.nearby-count')).to_contain_text('۰ نفر در این نما')
  page.screenshot(path=str(ARTIFACTS/'soft-map-calm-empty.png'))
  hold['enabled']=True;page.evaluate('window.dispatchEvent(new Event("focus"))')
  expect(page.locator('.nearby-refresh')).to_contain_text('در حال تازه‌شدن')
  expect(page.locator('.map-calm-state')).to_be_visible()
  empty_node=page.locator('.map-calm-state').element_handle()
  empty_size=empty_node.bounding_box()
  expect(page.locator('.map-calm-state')).to_have_attribute('aria-busy','true')
  expect(page.locator('.map-calm-state strong')).to_have_text('داریم دور و برت رو نیگا می‌کنیم…')
  page.wait_for_timeout(2100)
  assert empty_node.evaluate('node=>node.isConnected'), 'An empty-to-empty refresh must keep the same card mounted'
  held.pop().fulfill(json={'activity':[],'approximate':True});hold['enabled']=False
  expect(page.locator('.nearby-refresh')).to_contain_text('به‌روزرسانی خودکار')
  assert empty_node.evaluate('node=>node.isConnected')
  expect(page.locator('.map-calm-state')).to_have_attribute('aria-busy','false')
  expect(page.locator('.map-calm-state strong')).to_have_text('هنوز ثبت تازه‌ای اینجا نیست')
  assert empty_node.bounding_box()['height']==empty_size['height']
  ctx.set_offline(True)
  expect(page.locator('.map-calm-state strong')).to_have_text('نقشه آفلاینه')
  assert empty_node.evaluate('node=>node.isConnected')
  assert empty_node.bounding_box()['height']==empty_size['height']
  ctx.set_offline(False)
  print('PASS: A slow empty-to-empty local refresh preserves the same empty card while only the refresh indicator changes.',flush=True)
  print('PASS: Count remains during real fetching, automatic refresh preserves the camera, offline is explicit and an empty view has an honest friendly invitation state.',flush=True)
  phase['kind']='one';page.get_by_role('tab',name='آدم‌های نزدیک من',exact=True).click()
  expect(page.locator('.nearby-person')).to_have_count(1)
  expect(page.locator('.nearby-count')).to_contain_text('۱ پروفایل نزدیک')
  page.get_by_role('tab',name='نقشه',exact=True).click()
  page.get_by_role('button',name='نمایش من روی نقشه: پنهان',exact=True).click()
  page.locator('input[name="map-visibility"][value="profile"]').check()
  page.get_by_role('button',name='ذخیرهٔ انتخاب',exact=True).click()
  expect(page.get_by_role('dialog')).to_have_count(0)
  assert data['me']['shareLocation'] and data['me']['discoverable']
  submitted=[body for action,body in requests if action=='map-visibility' and body['mode']=='profile'][-1]
  assert submitted['lat']==35.7 and submitted['lng']==51.4
  page.locator('.bottom-nav').get_by_role('button',name='من',exact=True).click()
  expect(page.locator('.profile-map-visibility')).to_contain_text('با پروفایلم')
  page.get_by_role('button',name='تنظیمات پروفایل',exact=True).click()
  page.get_by_label('اسمت',exact=True).fill('پیش‌نویس محفوظ')
  page.locator('.settings-map-visibility').click()
  page.locator('input[name="map-visibility"][value="hidden"]').check()
  page.get_by_role('button',name='ذخیرهٔ انتخاب',exact=True).click()
  expect(page.get_by_label('اسمت',exact=True)).to_have_value('پیش‌نویس محفوظ')
  page.keyboard.press('Escape')
  expect(page.locator('.profile-map-visibility')).to_contain_text('پنهان')
  print('PASS: Profile/map settings share one choice, explicit publishing includes location permission, settings drafts survive and hiding restores the private setting.',flush=True)
  page.goto(BASE+'/home',wait_until='domcontentloaded');expect(page.locator('.daily-streak')).to_have_count(0)
  page.goto(BASE+'/profile',wait_until='domcontentloaded');page.locator('.streak-profile-card').click()
  expect(page).to_have_url(BASE+'/streak');expect(page.locator('.daily-streak')).to_contain_text('۲۱ روز پشت‌سرهم')
  expect(page.locator('.streak-freezes')).to_contain_text('۲ از ۲')
  page.get_by_role('button',name='چطوریه؟',exact=True).click();expect(page.locator('.streak-explanation')).to_contain_text('همیشه رایگانن')
  page.screenshot(path=str(ARTIFACTS/'soft-map-detail-streak.png'))
  page.goto(BASE+'/nearby',wait_until='domcontentloaded');page.get_by_role('button',name='همه‌جا',exact=True).click()
  expect(page.locator('.nearby-count')).to_contain_text('۱ نفر در این نما',timeout=15000)
  assert not [r for r in requests if r[0]=='location' and not r[1].get('refreshOnly')]
  for width,height in [(320,568),(393,852),(1440,900)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(400)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   expect(page.locator('.nearby-status-strip')).to_be_visible()
   assert page.locator('.real-map').bounding_box()['height']>170
   for button in page.locator('.map-controls button').all():assert button.bounding_box()['height']>=44
   page.screenshot(path=str(ARTIFACTS/f'soft-map-layout-{width}.png'))
  phase['kind']='empty';page.evaluate('window.dispatchEvent(new Event("online"))')
  expect(page.locator('.map-calm-state')).to_be_visible(timeout=15000)
  hold['enabled']=True;page.evaluate('window.dispatchEvent(new Event("online"))')
  expect(page.locator('.nearby-refresh')).to_contain_text('در حال تازه‌شدن')
  world_empty=page.locator('.map-calm-state').element_handle()
  expect(page.locator('.map-calm-state strong')).to_have_text('داریم این گوشه رو نیگا می‌کنیم…')
  page.wait_for_timeout(2100);assert world_empty.evaluate('node=>node.isConnected')
  held.pop().fulfill(json={'activity':[],'total':0,'inView':0,'refreshSeconds':30});hold['enabled']=False
  expect(page.locator('.nearby-refresh')).to_contain_text('به‌روزرسانی خودکار')
  assert world_empty.evaluate('node=>node.isConnected')
  # A different world viewport is unconfirmed until its response arrives. The
  # existing card must stay in place and explain checking rather than vanish.
  hold['enabled']=True
  with page.expect_request(lambda request:parse_qs(urlsplit(request.url).query).get('action')==['world-map']):
   page.get_by_role('button',name='کوچک‌نمایی نقشه',exact=True).click()
  expect(page.locator('.map-calm-state')).to_have_attribute('aria-busy','true')
  assert world_empty.evaluate('node=>node.isConnected'), 'An unconfirmed world viewport must keep the same card'
  assert world_empty.bounding_box()['height']==empty_size['height']
  expect(page.locator('.map-calm-state strong')).to_have_text('داریم این گوشه رو نیگا می‌کنیم…')
  page.screenshot(path=str(ARTIFACTS/'soft-map-checking-world.png'))
  expect(page.locator('.nearby-refresh')).to_contain_text('در حال تازه‌شدن')
  assert held
  while held:held.pop().fulfill(json={'activity':[],'total':0,'inView':0,'refreshSeconds':30})
  hold['enabled']=False
  expect(page.locator('.map-calm-state')).to_have_attribute('aria-busy','false')
  expect(page.locator('.map-calm-state strong')).to_have_text('هنوز ثبت تازه‌ای اینجا نیست')
  assert world_empty.evaluate('node=>node.isConnected')
  phase['kind']='one';page.evaluate('window.dispatchEvent(new Event("online"))')
  expect(page.locator('.nearby-count')).to_contain_text('۱ نفر در این نما',timeout=15000)
  expect(page.locator('.map-calm-state')).to_have_count(0)
  print('PASS: The world map also keeps confirmed emptiness during a slow refresh and removes it when real activity arrives.',flush=True)
  assert not errors,errors
  browser.close()
 print('PASS: Streak inventory/help renders, the anonymous world view works before geolocation and map/status controls fit small phones and desktop.',flush=True)

if __name__=='__main__':main()
