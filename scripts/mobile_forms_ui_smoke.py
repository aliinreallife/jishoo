"""Touch CSS/viewport checks. Chromium emulation does not prove native iOS zoom behavior."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from routing_smoke import fixture
from smoke import BASE,CHROMIUM,verified_https,ARTIFACTS
ROOT=Path(__file__).resolve().parents[1]
FIELDS='input:not([type=checkbox],[type=radio],[type=range],[type=file],[type=color],[type=button],[type=submit],[type=reset],[type=hidden],[type=image]),textarea,select,[contenteditable=true]'

def main():
 data=fixture();errors=[];measurements=[]
 version=json.loads((ROOT/'package.json').read_text())['version']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,service_workers='block');verified_https(ctx)
  ctx.route('**/api/app?*',lambda r:r.fulfill(json=data))
  ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  def check(label):
   rows=page.locator(FIELDS).evaluate_all("nodes=>nodes.filter(n=>n.getClientRects().length&&getComputedStyle(n).visibility!=='hidden').map(n=>({tag:n.tagName,type:n.type,font:parseFloat(getComputedStyle(n).fontSize)}))")
   assert rows and all(r['font']>=16 for r in rows),(label,rows)
   viewport=page.locator('meta[name=viewport]').get_attribute('content')
   assert 'user-scalable=no' not in viewport and 'maximum-scale' not in viewport
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   measurements.append({'scene':label,'fields':rows})
  page.goto(BASE+'/settings',wait_until='domcontentloaded');expect(page.get_by_label('اسمت',exact=True)).to_be_visible(timeout=20000);check('profile settings')
  page.get_by_label('اسمت',exact=True).fill('آزمایش نوشتن روی گوشی');assert page.get_by_label('اسمت',exact=True).input_value()=='آزمایش نوشتن روی گوشی'
  page.keyboard.press('Escape');page.get_by_role('button',name='من تو شبکه‌های اجتماعی',exact=False).click();expect(page.get_by_label('اینستاگرام',exact=True)).to_be_visible();check('social accounts dialog')
  page.goto(BASE+'/friends',wait_until='domcontentloaded');expect(page.locator('.friend-search input')).to_be_visible();check('friend search')
  page.goto(BASE+'/stories/checkin',wait_until='domcontentloaded');expect(page.get_by_label('متن کارت اشتراک',exact=True)).to_be_visible();check('full-screen story editor')
  page.goto(BASE+'/support',wait_until='domcontentloaded');expect(page.locator('textarea')).to_be_visible();check('public support form')
  page.locator('textarea').fill('آزمایش نوشتن؛ این پیام ارسال نمی‌شود.');page.screenshot(path=str(ARTIFACTS/'mobile-support-inputs.png'))
  # New unclassed forms outside app/dialog wrappers must inherit the same baseline.
  page.evaluate("""()=>{const f=document.createElement('form');f.id='qa-plain-form';f.style.fontSize='12px';for(const type of ['text','search','email','password','tel','url','number']){const n=document.createElement('input');n.type=type;f.append(n)}f.append(document.createElement('textarea'));const s=document.createElement('select');s.append(new Option('گزینه','a'));f.append(s);const e=document.createElement('div');e.contentEditable='true';e.textContent='نوشتن';f.append(e);const large=document.createElement('input');large.id='qa-large';large.style.fontSize='22px';f.append(large);document.body.append(f)}""")
  rows=page.locator('#qa-plain-form').locator(FIELDS).evaluate_all('nodes=>nodes.map(n=>parseFloat(getComputedStyle(n).fontSize))');assert all(n>=16 for n in rows),rows
  assert page.locator('#qa-large').evaluate('n=>parseFloat(getComputedStyle(n).fontSize)')==22
  data['me']['registered']=False;data['auth']['pendingGoogle']='qa-mobile@example.invalid';page.goto(BASE+'/home?login=1',wait_until='domcontentloaded');expect(page.get_by_role('dialog')).to_be_visible();expect(page.get_by_role('dialog').locator('input').first).to_be_visible();check('post-Google invitation dialog')
  assert not errors,errors
  (ARTIFACTS/'mobile-form-fonts.json').write_text(json.dumps(measurements,indent=2))
  browser.close()
 print('PASS: Six actual form scenes and unclassed touch controls render at least 16px; larger fields and pinch-zoom remain available. No messages or credentials submitted.',flush=True)

if __name__=='__main__':main()
