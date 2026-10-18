"""Synthetic regressions for deferred downloads, shared reads and stable map DOM."""
import copy, json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright, expect
from routing_smoke import fixture
from smoke import BASE, CHROMIUM, verified_https, ARTIFACTS

def main():
 data=fixture();errors=[];calls=[];held=[];hold={'enabled':False}
 marker={'id':'perf-marker','markerKey':'perf','lat':35.7,'lng':51.4,'name':'آزمایش نقشه','profileHandle':'qa_map','profileKind':'profile','status':'done','avatarSeed':'perf','createdAt':'2026-10-18T09:00:00Z'}
 def mock(route):
  request=route.request;action=parse_qs(urlsplit(request.url).query).get('action',[''])[0];body=request.post_data_json if request.method=='POST' else None
  calls.append(action);result=copy.deepcopy(data)
  if action=='bootstrap' and hold['enabled']:held.append((route,result));return
  if action=='profile':data['me'].update(body);result=copy.deepcopy(data)
  elif action=='nearby':result={'activity':[copy.deepcopy(marker)]}
  route.fulfill(json=result)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':393,'height':852},service_workers='block',geolocation={'latitude':35.7,'longitude':51.4},permissions=['geolocation']);verified_https(ctx)
  version=json.loads((Path(__file__).resolve().parents[1]/'package.json').read_text())['version']
  ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
  ctx.route('**/api/app?*',mock);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/home',wait_until='domcontentloaded');expect(page.locator('.need-card')).to_be_visible();page.evaluate('document.fonts.ready')
  resources=page.evaluate("performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,bytes:e.decodedBodySize}))")
  assert not any(any('/'+name+'-' in row['path'] for name in ['AuthWizard','Stories','Nearby','AdminInvitationGraph','ReleasePage']) for row in resources)
  (ARTIFACTS/'home-resources.json').write_text(json.dumps(resources,indent=2))
  hold['enabled']=True;before=calls.count('bootstrap')
  page.locator('.bottom-nav').get_by_role('button',name='دوست‌ها',exact=True).click();expect(page.locator('.friends-hub')).to_be_visible()
  page.locator('.bottom-nav').get_by_role('button',name='من',exact=True).click();page.locator('.profile-stats-link').click();expect(page.locator('.lovely-stats')).to_be_visible()
  assert len(held)==1 and calls.count('bootstrap')==before+1
  page.get_by_role('button',name='برگشت',exact=True).click();page.get_by_role('button',name='تنظیمات پروفایل',exact=True).click()
  page.get_by_label('اسمت',exact=True).fill('اسم تازهٔ آزمایش');page.get_by_role('button',name='ذخیره تغییرات',exact=True).click();expect(page.locator('.profile-page')).to_contain_text('اسم تازهٔ آزمایش')
  old,snapshot=held.pop();old.fulfill(json=snapshot);hold['enabled']=False
  page.wait_for_timeout(250);expect(page.locator('.profile-page')).to_contain_text('اسم تازهٔ آزمایش')
  print('PASS: Optional screens stay off the home download; overlapping account reads share one request, and a slow pre-edit response cannot overwrite a saved profile.',flush=True)
  page.locator('.bottom-nav').get_by_role('button',name='این نزدیکا',exact=True).click();page.get_by_role('button',name='نمایش اطراف من',exact=True).click();expect(page.locator('.leaflet-marker-icon')).to_have_count(1)
  icon=page.locator('.leaflet-marker-icon').element_handle();page.locator('.leaflet-marker-icon').click();expect(page.locator('.map-profile-action')).to_be_visible()
  expect(page.locator('.nearby-refresh')).to_contain_text('به‌روزرسانی خودکار')
  with page.expect_response(lambda response:'action=nearby' in response.url):page.evaluate('window.dispatchEvent(new Event("focus"))')
  expect(page.locator('.nearby-refresh')).to_contain_text('به‌روزرسانی خودکار');assert icon.evaluate('node=>node.isConnected')
  marker.update(profileHandle=None,profileKind='anonymous',name='یه همسایه')
  with page.expect_response(lambda response:'action=nearby' in response.url):page.evaluate('window.dispatchEvent(new Event("focus"))')
  expect(page.locator('.map-profile-action')).to_have_count(0);expect(page.locator('.map-profile-private')).to_contain_text('بی‌نام');assert not icon.evaluate('node=>node.isConnected')
  print('PASS: An unchanged poll keeps the same Leaflet marker DOM; a privacy change immediately removes its profile action.',flush=True)
  before=len(calls);page.goto(BASE+'/changelog');expect(page.get_by_role('heading',name='تازه‌های جیشو',exact=True)).to_be_visible();expect(page.locator('.release-page')).to_contain_text('نسخهٔ ۰.۷.۰');assert len(calls)==before
  ctx.route('**/assets/AuthWizard-*.js',lambda route:route.abort())
  data['me']['registered']=False;page.goto(BASE+'/home?login=1');expect(page.locator('.screen-recovery')).to_be_visible()
  expect(page.get_by_role('button',name='دوباره باز کن',exact=True)).to_be_visible();ctx.unroute('**/assets/AuthWizard-*.js')
  page.get_by_role('button',name='دوباره باز کن',exact=True).click();expect(page.locator('.need-card')).to_be_visible();expect(page.locator('.screen-recovery')).to_have_count(0)
  print('PASS: A failed optional screen download has a branded recovery action; retry reloads successfully without an automatic refresh.',flush=True)
  assert not errors,errors
  browser.close()

if __name__=='__main__':main()
