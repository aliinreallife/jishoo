"""Map geometry checks with synthetic data; no account or location writes."""
import json,os
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from playwright.sync_api import sync_playwright,expect
from routing_smoke import fixture
from smoke import BASE,CHROMIUM,ARTIFACTS,verified_https
ROOT=Path(__file__).resolve().parents[1]
CAPTURE=os.environ.get('JISHOO_LAYOUT_CAPTURE_ONLY')=='1'

def main():
 data=fixture();data['me'].update(shareLocation=True,discoverable=True);errors=[];metrics=[]
 version=json.loads((ROOT/'package.json').read_text())['version']
 def mock(route):
  action=parse_qs(urlsplit(route.request.url).query).get('action',[''])[0]
  result={'activity':[],'approximate':True} if action=='nearby' else {'activity':[],'inView':0,'total':0,'refreshSeconds':30} if action=='world-map' else {'enabled':True} if action=='location' else data
  route.fulfill(json=result)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(service_workers='block',geolocation={'latitude':35.7,'longitude':51.4},permissions=['geolocation']);verified_https(ctx)
  ctx.route('**/api/app?*',mock)
  ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  def inspect(state,w,h):
   selector='.map-permission-card' if state in ['permission','denied'] else '.map-calm-state'
   result=page.evaluate('''selector=>{
    const box=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
    const card=document.querySelector(selector),scene=document.querySelector('.nearby-map-pane'),app=document.querySelector('.app-scroll');
    return {card:box(card),map:box(scene),visibility:box(document.querySelector('.map-visibility-shortcut')),controls:[...document.querySelectorAll('.map-controls button,.map-locate-control')].map(box),scope:box(document.querySelector('.map-scope-switch')),nav:box(document.querySelector('.bottom-nav')),appOverflow:app.scrollHeight-app.clientHeight,cardOverflow:card.scrollHeight-card.clientHeight,sceneOverflow:scene.scrollHeight-scene.clientHeight,rootOverflow:document.documentElement.scrollWidth-innerWidth,header:box(document.querySelector('.nearby-heading'))};
   }''',selector)
   result.update(state=state,width=w,height=h);metrics.append(result)
   page.screenshot(path=str(ARTIFACTS/f'map-layout-{state}-{w}x{h}{"-before" if CAPTURE else ""}.png'))
   if CAPTURE:return
   def overlaps(a,b):return min(a['right'],b['right'])-max(a['x'],b['x'])>1 and min(a['bottom'],b['bottom'])-max(a['y'],b['y'])>1
   assert result['rootOverflow']<=1 and result['appOverflow']<=1 and result['cardOverflow']<=1 and result['sceneOverflow']<=1,result
   assert result['visibility']['bottom']<=result['map']['y'],result
   assert result['map']['height']>=200,result
   assert result['map']['bottom']-result['card']['bottom']<=18,result
   assert result['card']['height']<=125,result
   assert not overlaps(result['card'],result['visibility']),result
   assert not overlaps(result['card'],result['scope']),result
   for control in result['controls']:
    assert control['height']>=44 and control['width']>=44,result
    assert not overlaps(result['card'],control),result
    assert not overlaps(result['visibility'],control),result
   assert result['map']['bottom']<=result['nav']['y']+1,result
  for w,h in [(320,568),(360,640),(393,852),(500,900),(768,700),(1280,720),(1440,900)]:
   page.set_viewport_size({'width':w,'height':h});page.goto(BASE+'/nearby',wait_until='domcontentloaded')
   expect(page.locator('.map-permission-card')).to_be_visible(timeout=20000);inspect('permission',w,h)
   if not CAPTURE:
    page.evaluate("()=>{window.qaGeo=navigator.geolocation.getCurrentPosition;navigator.geolocation.getCurrentPosition=(ok,fail)=>fail({code:1})}")
    page.get_by_role('button',name='نمایش اطراف من',exact=True).click()
    expect(page.locator('.map-permission-error')).to_be_visible();inspect('denied',w,h)
    page.evaluate('()=>{navigator.geolocation.getCurrentPosition=window.qaGeo}')
   page.get_by_role('button',name='نمایش اطراف من',exact=True).click()
   expect(page.locator('.map-calm-state')).to_be_visible(timeout=15000);inspect('empty',w,h)
  assert not errors,errors
  (ARTIFACTS/('map-layout-before.json' if CAPTURE else 'map-layout-after.json')).write_text(json.dumps(metrics,indent=2))
  print(('Captured baseline: permission and empty' if CAPTURE else 'PASS: permission, denied and empty')+' states checked at seven phone/tablet/desktop sizes; notices, controls, map height and scrolling measured.',flush=True)
  browser.close()

if __name__=='__main__':main()
