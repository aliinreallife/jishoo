"""Synthetic UI + actual PNG export checks. No authentication or database writes."""
import base64,hashlib,json,subprocess
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright,expect
from routing_smoke import fixture
from smoke import BASE,CHROMIUM,ARTIFACTS,verified_https
ROOT=Path(__file__).resolve().parents[1]

def history():
 return json.loads(subprocess.check_output(['node','--input-type=module','-e','import {dailyStreak} from "./lib/streaks.js";import {dayKey,addDays} from "./lib/calendar.js";let now=new Date();console.log(JSON.stringify(dailyStreak([...Array.from({length:365},(_,i)=>dayKey(addDays(now,-i-90))),...Array.from({length:7},(_,i)=>dayKey(addDays(now,-i)))],now)));'],cwd=ROOT))

def main():
 data=fixture();data['stats'].update(streak=history(),total=400,today=1,week=7);errors=[];calls=[]
 version=json.loads((ROOT/'package.json').read_text())['version']
 def mock(route):
  calls.append(route.request.method);route.fulfill(json=data)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  ctx=browser.new_context(viewport={'width':393,'height':852},service_workers='block',accept_downloads=True);verified_https(ctx)
  ctx.route('**/api/app?*',mock)
  ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
  ctx.add_init_script("window.qaInk=[];const fill=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...rest){if(this.canvas.width===1080){const m=this.measureText(String(value));window.qaInk.push({value:String(value),top:y-m.actualBoundingBoxAscent,bottom:y+m.actualBoundingBoxDescent})}return fill.call(this,value,x,y,...rest)}")
  page=ctx.new_page();page.on('pageerror',lambda e:(errors.append(str(e)),print('Browser error:',str(e),flush=True)))
  def go(path):page.goto(BASE+path,wait_until='domcontentloaded')
  def ready():expect(page.get_by_role('button',name='ذخیره PNG',exact=True)).to_be_enabled(timeout=30000)
  def preview():return base64.b64decode(page.locator('.story-raster-preview').evaluate("async node=>{const b=await (await fetch(node.src)).arrayBuffer();let s='';for(const n of new Uint8Array(b))s+=String.fromCharCode(n);return btoa(s)}"))
  go('/home');expect(page.locator('.need-card')).to_be_visible();expect(page.locator('.daily-streak')).to_have_count(0)
  go('/stats');expect(page.locator('.lovely-stats')).to_be_visible();expect(page.locator('.daily-streak')).to_have_count(0)
  go('/profile');expect(page.locator('.streak-profile-card')).to_contain_text('۷ روز پشت‌سرهم');page.screenshot(path=str(ARTIFACTS/'streak-profile.png'))
  page.locator('.streak-profile-card').click();expect(page).to_have_url(BASE+'/streak')
  expect(page.locator('.streak-hero h2')).to_contain_text('۷');expect(page.locator('.streak-best')).to_contain_text('۳۶۵');assert 'رایگان' not in page.locator('.streak-freezes').inner_text()
  expect(page.locator('.streak-milestone')).to_have_count(8);expect(page.locator('.streak-milestone.is-earned')).to_have_count(8)
  hashes=page.locator('.milestone-art canvas').evaluate_all('nodes=>nodes.map(n=>n.toDataURL())');assert len(set(hashes[-8:]))==8
  page.screenshot(path=str(ARTIFACTS/'streak-page.png'),full_page=True)
  page.locator('.streak-collection').scroll_into_view_if_needed();page.screenshot(path=str(ARTIFACTS/'streak-milestones.png'))
  print('PASS: Streak moved from Home/Stats to a clickable Me card; its clean page shows freezes, progress and eight distinct earned badges.',flush=True)
  page.get_by_role('button',name='اشتراک نشان یک دور با خورشید',exact=True).click();expect(page).to_have_url(BASE+'/stories/streak?milestone=365');ready()
  year=preview();year_path=ARTIFACTS/'streak-year-story.png';year_path.write_bytes(year);assert Image.open(year_path).size==(1080,1920)
  with page.expect_download() as d:page.get_by_role('button',name='ذخیره PNG',exact=True).click()
  assert Path(d.value.path()).read_bytes()==year,'Downloaded PNG must match visible preview exactly'
  page.evaluate("Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});Object.defineProperty(navigator,'share',{configurable:true,value:async o=>{const b=await o.files[0].arrayBuffer();let s='';for(const n of new Uint8Array(b))s+=String.fromCharCode(n);window.qaShare={bytes:btoa(s),text:o.text}}})")
  page.get_by_role('button',name='اشتراک تصویر',exact=True).click();page.wait_for_function('window.qaShare')
  shared=page.evaluate('window.qaShare');assert base64.b64decode(shared['bytes'])==year
  assert 'OWN-CODE' not in shared['text'] and '?invite=' not in shared['text']
  page.get_by_role('button',name='پست ۱:۱',exact=True).click();ready();square=preview();square_path=ARTIFACTS/'streak-year-square.png';square_path.write_bytes(square);assert Image.open(square_path).size==(1080,1080)
  page.evaluate('window.qaInk=[]');page.get_by_label('متن کارت اشتراک',exact=True).fill('W'*100);ready()
  ink=page.evaluate('window.qaInk');caption_ink=[r for r in ink if r['value'] and set(r['value'])=={'W'}];award_ink=[r for r in ink if r['value']=='این نشان رو با روزهای واقعی گرفتم.']
  assert caption_ink and award_ink and max(r['bottom'] for r in caption_ink)<award_ink[-1]['top'],ink
  (ARTIFACTS/'streak-long-square.png').write_bytes(preview())
  page.reload(wait_until='domcontentloaded');ready();assert preview()==year,'A milestone query must survive a reload'
  print('PASS: Year milestone refresh/direct links, native sharing and downloaded PNG match the actual raster preview; both 9:16 and square exports render and contain no invitation payload.',flush=True)
  page.get_by_role('button',name='بستن کارت اشتراک',exact=True).click();expect(page).to_have_url(BASE+'/streak')
  page.get_by_role('button',name='اشتراک زنجیرهٔ من',exact=True).click();expect(page).to_have_url(BASE+'/stories/streak');ready()
  current=preview();assert current!=year;(ARTIFACTS/'streak-current-story.png').write_bytes(current)
  page.get_by_label('متن کارت اشتراک',exact=True).fill(('یه قرار هر روزه، با کلی روز قشنگ و یه عالمه لبخند. '*3)[:100]);ready()
  for width,height in [(320,568),(393,852),(1440,900)]:
   page.set_viewport_size({'width':width,'height':height});page.wait_for_timeout(250)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   assert page.locator('.story-editor').evaluate('n=>n.scrollHeight<=n.clientHeight+1')
   for label in ['ذخیره PNG','اشتراک تصویر','بستن کارت اشتراک']:
    box=page.get_by_role('button',name=label,exact=True).bounding_box();assert box['y']>=0 and box['y']+box['height']<=height+1,(label,box)
   page.screenshot(path=str(ARTIFACTS/f'streak-story-layout-{width}.png'))
  print('PASS: Current streak shares separately from historical awards, and all export actions stay visible without scrolling on short phones and desktop.',flush=True)
  page.set_viewport_size({'width':393,'height':852});data['stats']['streak']['best']=7;data['stats']['streak']['current']=0
  go('/achievements');expect(page.locator('.streak-milestone.is-earned')).to_have_count(2);expect(page.locator('.streak-milestone.is-locked')).to_have_count(6)
  assert page.locator('.streak-milestone.is-locked button').count()==0
  go('/streak');expect(page.get_by_role('button',name='اشتراک زنجیرهٔ من',exact=True)).to_be_disabled();expect(page.locator('.streak-milestone.is-earned')).to_have_count(2)
  go('/stories/streak?milestone=365');ready();forged=preview();assert forged!=year,'An unearned query cannot export the year award'
  assert not errors,errors
  assert 'POST' not in calls,'Viewing or exporting must never write events or rewards'
  print('PASS: Achievements also show the collection; earned badges survive an ended streak, locked badges have no share action and an unearned query cannot render the award.',flush=True)
  browser.close()

if __name__=='__main__':main()
