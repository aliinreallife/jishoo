"""Live-backend checks for quieter reactions, explicit social controls and shared groups."""
import secrets,time,json,sys,urllib.parse
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
from smoke import context,api,capture,BASE,CHROMIUM,ARTIFACTS
from browser_smoke import phone
from provision_admin import create_invite
ROOT=Path(__file__).resolve().parents[1]
owned=[]
def member(page,name):
 start=api(page,'auth-start',{'phone':phone()})
 ticket=api(page,'auth-verify',{'challengeId':start['challengeId'],'code':'123456'})
 result=api(page,'register',{'ticket':ticket['ticket'],'name':name,'inviteCode':create_invite('qa-member')['code']})
 owned.append((page,result['me']['id']))
 handle='qa_'+secrets.token_hex(4)
 return api(page,'profile',{'handle':handle,'socialLinks':{'instagram':'jishoo_test'}})
def status(page,action,body,expected):
 result=page.evaluate("""async ({action,body})=>{const r=await fetch('/api/app?action='+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,body:await r.json()}}""",{'action':action,'body':body})
 assert result['status']==expected,(action,result)
 return result['body']
def main():
 errors=[];contexts=[]
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
  try:
   ctx,a=context(b,geo=True);contexts.append((ctx,a));a.on('pageerror',lambda e:errors.append(str(e)))
   a.goto(BASE,wait_until='domcontentloaded')
   expect(a.get_by_role('button',name='شروع کنیم',exact=True)).to_be_visible(timeout=30000)
   assert 'بدون اکانت' not in a.get_by_role('heading',level=1).inner_text()
   capture(a,'v4-welcome.png');a.get_by_role('button',name='شروع کنیم',exact=True).click()
   expect(a.locator('.bottom-nav button')).to_have_count(4)
   assert a.locator('.bottom-nav').inner_text().count('این نزدیکا')==1
   sent=[];a.on('request',lambda r:sent.append(r.url) if '/api/app?action=checkin' in r.url else None)
   for button in ['.done-card','.need-card']:
    a.locator(button).click();expect(a.locator('.undo-checkin')).to_be_visible()
    a.get_by_role('button',name='لغو ثبت',exact=True).click()
    expect(a.get_by_role('dialog')).to_have_count(0)
   assert len(sent)==0 and api(a,'bootstrap')['stats']['total']==0
   a.locator('.done-card').click();capture(a,'v4-undo-window.png')
   expect(a.locator('.undo-checkin')).to_have_count(0,timeout=6000)
   expect(a.get_by_role('button',name='اشتراک این خبر',exact=True)).to_be_enabled(timeout=20000)
   assert api(a,'bootstrap')['stats']['today']==1 and len(sent)==1
   assert a.get_by_role('button',name='این لحظه رو استوری کن').count()==0
   capture(a,'v4-done-result.png');a.get_by_role('button',name='چه حس خوبی!',exact=True).click()
   a.locator('.need-card').click();expect(a.get_by_role('button',name='اشتراک این خبر',exact=True)).to_be_enabled(timeout=20000)
   expect(a.get_by_role('dialog')).to_contain_text('الان برمی‌گردم!')
   assert 'همراه' not in a.get_by_role('dialog').inner_text() and 'فوری ولی' not in a.get_by_role('dialog').inner_text()
   capture(a,'v4-need-result.png');a.get_by_role('button',name='باشه، الان برمی‌گردم',exact=True).click()
   first=member(a,'آزمایش سارا');a.reload();expect(a.locator('.bottom-nav')).to_be_visible(timeout=30000)
   a.locator('.bottom-nav').get_by_role('button',name='من',exact=True).click()
   assert a.locator('.profile-link-card').count()==0
   a.get_by_role('button',name='اشتراک پروفایل من',exact=True).click()
   expect(a.get_by_label('لینک پروفایل من')).to_have_value(first['publicUrl']+'/u/'+first['me']['handle'])
   a.keyboard.press('Escape')
   print('PASS: Four tabs, low-priority guest copy, both three-second undos write nothing, quiet results and share-only profile link',flush=True)
   ctx2,c=context(b,geo=True);contexts.append((ctx2,c));c.on('pageerror',lambda e:errors.append(str(e)))
   c.goto(BASE,wait_until='domcontentloaded');expect(c.get_by_role('button',name='شروع کنیم',exact=True)).to_be_visible(timeout=30000)
   second=member(c,'آزمایش نیما');c.reload();expect(c.locator('.bottom-nav')).to_be_visible(timeout=30000)
   a.locator('.bottom-nav').get_by_role('button',name='دوست‌ها',exact=True).click()
   a.get_by_role('button',name='افزودن دوست با شناسه',exact=True).click()
   a.get_by_label('شناسهٔ دوستت',exact=True).fill('@'+second['me']['handle'])
   a.get_by_role('button',name='درخواست وصل‌شدن',exact=True).click()
   expect(a.get_by_role('dialog')).to_have_count(0,timeout=15000)
   c.goto(BASE+'/#/friends');expect(c.locator('.request-summary')).to_be_visible(timeout=20000);c.locator('.request-summary').click()
   c.get_by_role('button',name='قبول درخواست آزمایش سارا',exact=True).click()
   expect(c.locator('.request-card')).to_have_count(0,timeout=15000)
   a.reload();expect(a.locator('.connected-card')).to_be_visible(timeout=20000);capture(a,'v4-friends.png')
   a.locator('.connected-card').click()
   assert a.locator('.social-sharing-choice input').count()==0
   expect(a.locator('.social-connection')).to_contain_text('اگر قبول کنه')
   assert api(c,'bootstrap')['friends'][0]['socialLinks']=={}
   a.get_by_role('button',name='درخواست دیدن حساب‌ها',exact=True).click()
   expect(a.get_by_role('button',name='لغو درخواست',exact=True)).to_be_visible(timeout=15000)
   assert api(c,'bootstrap')['friends'][0]['socialLinks']=={}
   c.reload();c.locator('.link-request-notice').click()
   c.get_by_role('button',name='قبول درخواست',exact=True).click()
   expect(c.get_by_role('button',name='قطع اشتراک حساب‌ها',exact=True)).to_be_visible(timeout=15000)
   assert api(c,'bootstrap')['friends'][0]['socialLinks']['instagram'].endswith('/jishoo_test')
   c.keyboard.press('Escape')
   a.reload();a.locator('.connected-card').click()
   expect(a.get_by_role('button',name='قطع اشتراک حساب‌ها',exact=True)).to_be_visible(timeout=15000)
   a.get_by_role('button',name='خبرهای آزمایش نیما روشنه',exact=False).click()
   expect(a.get_by_role('button',name='آزمایش نیما بی‌صداست',exact=False)).to_be_visible(timeout=15000)
   capture(a,'v4-friend-permissions.png');a.keyboard.press('Escape')
   print('PASS: @handle friendship, incoming acceptance, mutual social requests/acceptance and mute actions',flush=True)
   a.get_by_role('button',name='گروه‌ها',exact=True).click();a.get_by_role('button',name='گروه تازه',exact=False).click()
   a.get_by_label('اسم جمع',exact=True).fill('جمع خودمونی آزمایش')
   a.locator('.circle-picker input').check();a.get_by_role('dialog').get_by_role('button',name='ساخت گروه',exact=True).click()
   expect(a.get_by_role('heading',name='جمع خودمونی آزمایش',exact=True)).to_be_visible(timeout=20000)
   group=next(g for g in api(a,'bootstrap')['circles'] if g['name']=='جمع خودمونی آزمایش')
   assert group['shared'] and len(group['invited'])==1 and second['me']['id'] not in group['members']
   pending=next(g for g in api(c,'bootstrap')['circles'] if g['id']==group['id']);assert pending['pending'] and pending['inviteCode'] is None
   c.goto(BASE+'/#/circle/'+group['id']);expect(c.get_by_role('button',name='به گروه بپیوندم',exact=True)).to_be_visible(timeout=20000)
   capture(c,'v4-group-invitation.png');c.get_by_role('button',name='به گروه بپیوندم',exact=True).click()
   expect(c.locator('.group-summary')).to_be_visible(timeout=15000)
   status(c,'circle-rotate',{'id':group['id']},403)
   c.get_by_role('button',name='خبرهای این گروه روشنه',exact=False).click()
   expect(c.get_by_role('button',name='این گروه بی‌صداست',exact=False)).to_be_visible(timeout=15000)
   ctx3,d=context(b);contexts.append((ctx3,d));d.on('pageerror',lambda e:errors.append(str(e)))
   d.goto(BASE,wait_until='domcontentloaded');expect(d.get_by_role('button',name='شروع کنیم',exact=True)).to_be_visible(timeout=30000)
   third=member(d,'آزمایش رویا');d.reload();expect(d.locator('.bottom-nav')).to_be_visible(timeout=30000)
   status(d,'circle-invite',{'id':group['id'],'handle':second['me']['handle']},404)
   a.get_by_role('button',name='دعوت با شناسه یا لینک گروه',exact=True).click()
   a.get_by_label('شناسهٔ دوست',exact=True).fill('@'+third['me']['handle'])
   a.get_by_role('button',name='فرستادن دعوت',exact=True).click()
   expect(a.get_by_label('شناسهٔ دوست',exact=True)).to_have_value('',timeout=15000)
   assert api(d,'bootstrap')['friends']==[]
   pendingThird=next(g for g in api(d,'bootstrap')['circles'] if g['id']==group['id']);assert pendingThird['pending'] and pendingThird['people']==[]
   a.keyboard.press('Escape');a.reload();expect(a.locator('.group-summary')).to_be_visible(timeout=20000);capture(a,'v4-shared-group.png')
   d.goto(BASE+'/?group='+group['inviteCode']);expect(d.get_by_role('heading',name='جمع خودمونی آزمایش',exact=True)).to_be_visible(timeout=20000)
   capture(d,'v4-group-link.png');d.get_by_role('button',name='به گروه بپیوندم',exact=True).click()
   expect(d.locator('.group-summary')).to_be_visible(timeout=20000)
   assert api(d,'bootstrap')['friends']==[]
   thirdGroup=next(g for g in api(d,'bootstrap')['circles'] if g['id']==group['id']);assert not thirdGroup['pending'] and 'socialLinks' not in json.dumps(thirdGroup)
   api(a,'circle-rotate',{'id':group['id']})
   result=d.evaluate("async code=>{const r=await fetch('/api/app?action=circle-info&code='+code);return r.status}",group['inviteCode']);assert result==404
   d.get_by_role('button',name='خروج از گروه',exact=True).click();d.get_by_role('dialog').get_by_role('button',name='خروج از گروه',exact=True).click()
   expect(d.locator('.friends-hub')).to_contain_text('رفقای من',timeout=15000)
   assert not any(g['id']==group['id'] for g in api(d,'bootstrap')['circles'])
   print('PASS: Shared groups require acceptance, exact-handle invitations work without forced friendship, link joining/rotation/leaving and role boundaries work',flush=True)
   a.goto(BASE+'/#/friends');expect(a.locator('.connected-card')).to_be_visible(timeout=20000);a.locator('.connected-card').click()
   a.get_by_role('button',name='قطع دوستی با آزمایش نیما',exact=True).click()
   a.get_by_role('button',name='قطع دوستی',exact=True).click()
   expect(a.get_by_role('dialog')).to_have_count(0,timeout=15000)
   assert api(a,'bootstrap')['friends']==[] and api(c,'bootstrap')['friends']==[]
   assert second['me']['id'] in next(g for g in api(a,'bootstrap')['circles'] if g['id']==group['id'])['members']
   a.goto(BASE+'/#/stats');expect(a.get_by_role('heading',name='قصهٔ قطره‌هات')).to_be_visible(timeout=20000)
   expect(a.locator('.lovely-chart .lovely-column')).to_have_count(7)
   a.get_by_role('button',name='ماه',exact=True).click();expect(a.locator('.lovely-chart .lovely-column')).to_have_count(30)
   a.get_by_role('button',name='همه‌وقت',exact=True).click();expect(a.locator('.lovely-chart .lovely-column')).to_have_count(12)
   expect(a.locator('.drop-calendar-grid > div')).to_have_count(21)
   baseline=a.locator('.lovely-chart-track').evaluate_all('(els)=>els.map(el=>el.getBoundingClientRect().bottom)');assert max(baseline)-min(baseline)<2
   expect(a.locator('.toast.visible')).to_have_count(0,timeout=6000);capture(a,'v4-stats.png')
   print('PASS: Disconnect revokes friendship/social access while group membership stays separate; real week/month/year chart ranges render',flush=True)
   point={'lat':35.70127,'lng':51.40137}
   for page in [a,c]:api(page,'location',{**point,'enabled':True});api(page,'checkin',{'status':'need','visibility':'friends','nonce':secrets.token_hex(12)})
   api(c,'discoverable',{'enabled':True})
   a.goto(BASE+'/#/nearby');a.reload();expect(a.get_by_role('heading',name='این نزدیکا')).to_be_visible(timeout=20000)
   a.get_by_role('button',name='نمایش اطراف من',exact=True).click()
   expect(a.locator('.nearby-people-trigger')).to_be_visible(timeout=20000)
   expect(a.locator('.live-map-marker')).to_have_count(2,timeout=20000)
   anchors=a.locator('.map-avatar-icon').evaluate_all('(els)=>els.map(el=>el.style.marginLeft)');assert len(set(anchors))==2
   a.locator('.nearby-people-trigger').click();expect(a.locator('.nearby-person')).to_contain_text('آزمایش نیما',timeout=15000)
   a.wait_for_function("() => {const panel=document.querySelector('.around-panel').getBoundingClientRect();return [...document.querySelectorAll('.live-map-marker')].every(el=>el.getBoundingClientRect().bottom<panel.top)}",timeout=10000)
   capture(a,'v4-nearby-unified.png')
   assert len(api(a,'nearby',point)['activity'])==2
   print('PASS: One nearby page contains the map and opt-in people list; shared-cell markers separate visually while coordinates remain coarse',flush=True)
   a.goto(BASE+'/#/notifications');expect(a.get_by_role('button',name='اعلان تستی روی همهٔ دستگاه‌ها',exact=True)).to_be_visible(timeout=20000)
   a.get_by_role('button',name='اعلان تستی روی همهٔ دستگاه‌ها',exact=True).click()
   expect(a.locator('.toast')).to_contain_text('هنوز دستگاهی',timeout=15000)
   capture(a,'v4-notifications.png')
   for width in [320,393,768,1440]:
    a.set_viewport_size({'width':width,'height':900});a.goto(BASE+'/#/stats');expect(a.locator('.stats-hero-card')).to_be_visible(timeout=15000)
    assert a.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
   legalCtx,legal=context(b);contexts.append((legalCtx,legal));calls=[];legal.on('request',lambda r:calls.append(r.url) if '/api/' in r.url else None)
   for kind,title in [('terms','شرایط استفاده'),('privacy','حریم خصوصی')]:
    legal.goto(BASE+'/'+kind,wait_until='networkidle');expect(legal.get_by_role('heading',name=title,exact=True)).to_be_visible(timeout=20000);capture(legal,'v4-'+kind+'.png')
   assert not calls,calls
   assert not errors,errors
   print('PASS: Test-notification control targets the account, public legal pages load without API/session creation, responsive stats and no app JavaScript errors',flush=True)
  finally:
   for page,uid in owned:
    try:
     if api(page,'bootstrap')['me']['id']==uid:api(page,'delete-account',{})
    except Exception as e:print('Owned QA cleanup needs follow-up:',uid,type(e).__name__,flush=True)
   b.close()
if __name__=='__main__':main()
