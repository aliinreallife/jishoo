"""Synthetic UI regressions; no account, message or notification writes.

Neutral basemap fixtures measure layout. API privacy is checked on a QA preview.
"""
import copy,json
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
from playwright.sync_api import sync_playwright,expect
from routing_smoke import fixture
from smoke import BASE,CHROMIUM,ARTIFACTS,verified_https

def main():
 data=fixture();data['me']['shareLocation']=True
 friend={'id':'map-friend','name':'سارای آزمایشی','handle':'qa_sara','avatarSeed':'سارا','status':'accepted','connectionId':'map-connection','socialLinks':{},'linkConnection':'none'}
 public={'id':'map-public','name':'نیما','handle':'qa_nima','avatarSeed':'نیما','achievements':[]};data['friends']=[friend]
 now=datetime.now(timezone.utc).isoformat()
 point={'id':'first-event','markerKey':'stable-person','lat':35.7,'lng':51.4,'status':'need','createdAt':now,'name':friend['name'],'profileHandle':friend['handle'],'profileKind':'profile','avatarSeed':'سارا','isFriend':True}
 state={'points':[point],'hold_map':False,'hold_save':False,'error_save':False,'profile_error':False};calls=[];held=[];saves=[];errors=[]
 out=ARTIFACTS/'map-audit';out.mkdir(exist_ok=True)
 version=json.loads((Path(__file__).resolve().parents[1]/'package.json').read_text())['version']
 def mock(route):
  req=route.request;action=parse_qs(urlsplit(req.url).query).get('action',[''])[0];body=req.post_data_json if req.method=='POST' else None
  calls.append((action,body));result=copy.deepcopy(data)
  if action=='nearby':
   if state['hold_map']:held.append(route);return
   result={'activity':copy.deepcopy(state['points'])}
  elif action=='discover':result={'people':[{**friend,'connection':'accepted','distance':'کمتر از ۳ کیلومتر'},{**public,'connection':None,'distance':'کمتر از ۳ کیلومتر'}]}
  elif action=='profile-public':
   if state['profile_error']:route.fulfill(status=404,json={'message':'این پروفایل پیدا نشد.'});return
   result={'profile':public}
  elif action=='connection-request':
   data['friends']=[friend,{**public,'status':'pending','incoming':False,'connectionId':'public-request'}];result={'friends':copy.deepcopy(data['friends'])}
  elif action=='connection-respond':
   data['friends']=[friend,{**public,'status':'accepted','incoming':True,'connectionId':'public-request','socialLinks':{},'linkConnection':'none'}];result={'friends':copy.deepcopy(data['friends'])}
  elif action=='world-map':result={'activity':[{'id':'world:cell','lat':35.7,'lng':51.4,'status':'done','createdAt':now,'name':'یه نفر روی نقشه','count':1}],'inView':1,'total':1}
  elif action=='location':result={'enabled':True}
  elif action=='checkin':
   if state['hold_save']:saves.append(route);return
   if state['error_save']:route.fulfill(status=503,json={'message':'ثبت انجام نشد؛ دوباره امتحان کن.'});return
   result={'stats':{**data['stats'],'today':1,'week':1,'total':1},'matches':[]}
  route.fulfill(json=result)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':393,'height':852},service_workers='block',reduced_motion='reduce',permissions=['geolocation'],geolocation={'latitude':35.7,'longitude':51.4})
  verified_https(ctx);ctx.route('**/api/app?*',mock);ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  def refresh():
   with page.expect_response(lambda r:'action=nearby' in r.url):page.evaluate('window.dispatchEvent(new Event("jishoo:map-changed"))')
  page.goto(BASE+'/nearby',wait_until='networkidle');page.get_by_role('button',name='نمایش اطراف من',exact=True).click();expect(page.locator('.leaflet-marker-icon')).to_have_count(1)
  page.locator('.leaflet-marker-icon').focus();page.keyboard.press('Space');expect(page.locator('.map-selection-sheet')).to_contain_text('جیش داره');expect(page.locator('.map-profile-action')).to_have_text('پروفایل دوستت')
  point.update(id='second-event',status='done');refresh();expect(page.locator('.map-selection-sheet')).to_contain_text('جیش کرده');page.screenshot(path=str(out/'05-friend-updated.png'))
  other=ctx.new_page();other.goto(BASE+'/home',wait_until='networkidle');point.update(id='cross-tab-event',status='need')
  with page.expect_response(lambda r:'action=nearby' in r.url):other.locator('.need-card').click()
  expect(page.locator('.map-selection-sheet')).to_contain_text('جیش داره');other.close();point['status']='done';refresh()
  state['hold_map']=True
  with page.expect_request(lambda r:'action=nearby' in r.url):page.evaluate('window.dispatchEvent(new Event("focus"))')
  page.wait_for_timeout(100);assert held
  old=copy.deepcopy(state['points']);point.update(id='third-event',status='need');page.evaluate('window.dispatchEvent(new Event("jishoo:map-changed"))');state['hold_map']=False;held.pop().fulfill(json={'activity':old})
  expect(page.locator('.map-selection-sheet')).to_contain_text('جیش داره')
  point.update(profileHandle=None,profileKind='anonymous',isFriend=False,name='یه همسایه',avatarImage=None);refresh();expect(page.locator('.map-profile-action')).to_have_count(0);expect(page.locator('.map-profile-private')).to_contain_text('بی‌نام')
  point.update(profileKind='guest',name='مهمان جیشو');refresh();expect(page.locator('.map-profile-private')).to_contain_text('مهمان')
  state['points']=[];refresh();expect(page.locator('.map-selection-sheet')).to_have_count(0)
  print('PASS: Keyboard pins, stable selection across new events, raced refreshes, revoked identity, anonymous/guest privacy and expired-pin removal.',flush=True)
  state['points']=[{**point,'id':'public-event','profileHandle':public['handle'],'profileKind':'profile','name':public['name']}];refresh();expect(page.locator('.leaflet-marker-icon')).to_have_count(1);page.locator('.leaflet-marker-icon').click();page.locator('.map-profile-action').click();expect(page).to_have_url(BASE+'/u/qa_nima')
  page.get_by_role('button',name='درخواست دوستی',exact=True).click();expect(page.get_by_role('button',name='درخواست دوستی فرستاده شد',exact=True)).to_be_disabled();assert sum(a=='connection-request' for a,_ in calls)==1
  data['friends'][-1]['incoming']=True;page.locator('.bottom-nav').get_by_role('button',name='این نزدیکا',exact=True).click();expect(page.locator('.leaflet-marker-icon')).to_have_count(1);page.locator('.leaflet-marker-icon').click();page.locator('.map-profile-action').click();page.get_by_role('button',name='قبول درخواست دوستی',exact=True).click();expect(page.get_by_role('button',name='دیدن پروفایل دوستت',exact=True)).to_be_enabled();page.screenshot(path=str(out/'06-profile-connected.png'));page.get_by_role('button',name='دیدن پروفایل دوستت',exact=True).click();expect(page.locator('.friend-dialog-head')).to_contain_text(public['name']);page.keyboard.press('Escape')
  print('PASS: Public pins send once, distinguish outgoing/incoming/accepted friendship and keep social-link consent separate.',flush=True)
  page.goto(BASE+'/nearby',wait_until='networkidle');page.get_by_role('button',name='نمایش اطراف من',exact=True).click();page.get_by_role('tab',name='آدم‌های نزدیک من',exact=True).click();page.get_by_role('button',name='دیدن پروفایل '+friend['name'],exact=True).click();expect(page.locator('.friend-dialog-head')).to_contain_text(friend['name']);page.keyboard.press('Escape');page.get_by_role('tab',name='نقشه',exact=True).click()
  ctx.set_geolocation({'latitude':35.701,'longitude':51.401})
  with page.expect_response(lambda r:'action=location' in r.url):page.get_by_role('button',name='مکان من',exact=True).click()
  assert any(a=='location' and b['lat']==35.701 for a,b in calls)
  page.get_by_role('button',name='همه‌جا',exact=True).click();expect(page.locator('.leaflet-marker-icon')).to_have_count(1);page.locator('.leaflet-marker-icon').click();expect(page.locator('.map-profile-private')).to_contain_text('همیشه بی‌نامن');expect(page.locator('.map-profile-action')).to_have_count(0)
  print('PASS: Nearby friend rows open profiles, My Location acquires fresh GPS, worldwide pins stay anonymous.',flush=True)
  for selector in ['.need-card','.done-card']:
   page.goto(BASE+'/home',wait_until='networkidle');state['hold_save']=True;before=sum(a=='checkin' for a,_ in calls);page.locator(selector).click();expect(page.get_by_role('button',name='استوری این لحظه',exact=True)).to_be_visible();assert len(saves)==1 and sum(a=='checkin' for a,_ in calls)==before+1
   expect(page.locator('.undo-checkin')).to_have_count(0);expect(page.locator('.reaction-toolbar')).to_contain_text('در حال ثبت');page.screenshot(path=str(out/('07-need-saving.png' if selector=='.need-card' else '08-done-saving.png')))
   for width,height in [(320,568),(393,852),(1440,900)]:
    page.set_viewport_size({'width':width,'height':height})
    expect(page.locator('.checkin-footer button')).to_be_in_viewport()
    expect(page.get_by_role('button',name='استوری این لحظه',exact=True)).to_be_in_viewport()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   page.set_viewport_size({'width':393,'height':852})
   page.get_by_role('button',name='استوری این لحظه',exact=True).click();expect(page.locator('.full-story-overlay')).to_be_visible();expect(page.locator('.story-undo-slot')).to_have_count(0);state['hold_save']=False;saves.pop().fulfill(json={'stats':{**data['stats'],'today':1,'week':1},'matches':[]});expect(page.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
  state['error_save']=True;page.goto(BASE+'/home',wait_until='networkidle');page.locator('.need-card').click();expect(page.locator('.toast')).to_contain_text('ثبت انجام نشد');expect(page.locator('.checkin-dialog')).to_have_count(0)
  print('PASS: Immediate need/done requests, honest in-flight status, early story sharing without undo and visible save failures.',flush=True)
  state['profile_error']=True;page.goto(BASE+'/u/missing',wait_until='networkidle');expect(page.get_by_role('status').filter(has_text='این پروفایل پیدا نشد.')).to_be_visible();expect(page.get_by_role('button',name='برگشت',exact=True)).to_be_enabled()
  assert not errors,errors;browser.close()
if __name__=='__main__':main()
