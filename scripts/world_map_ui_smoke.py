"""Isolated browser coverage for map/list, profile tools and the admin graph.

Synthetic API fixtures only: no database changes or notification delivery.
"""
import json
from pathlib import Path
from urllib.parse import parse_qs,urlsplit
from PIL import Image
from playwright.sync_api import sync_playwright,expect
from smoke import BASE,CHROMIUM,ARTIFACTS,verified_https
from routing_smoke import fixture


def main():
    data=fixture();data['me']['isAdmin']=True
    requests=[];errors=[]
    graph=[{'id':'root','name':'آزمایش علی','handle':'qa_ali','avatarSeed':'علی','invitedBy':None},
           {'id':'first','name':'آزمایش سارا','handle':'qa_sara','avatarSeed':'سارا','invitedBy':'root'},
           {'id':'second','name':'آزمایش نیما','handle':'qa_nima','avatarSeed':'نیما','invitedBy':'first'},
           {'id':'third','name':'آزمایش مریم','handle':'qa_maryam','avatarSeed':'مریم','invitedBy':'second'}]
    version=json.loads((Path(__file__).resolve().parents[1]/'package.json').read_text())['version']
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
        ctx=browser.new_context(viewport={'width':393,'height':852},service_workers='block',permissions=['geolocation'],geolocation={'latitude':35.7012,'longitude':51.4012})
        verified_https(ctx)
        ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
        page=ctx.new_page();page.on('pageerror',lambda e:(errors.append(str(e)),print('Browser error:',str(e),flush=True)))
        def mock(route):
            r=route.request;action=parse_qs(urlsplit(r.url).query).get('action',[''])[0];body=r.post_data_json if r.method=='POST' else None
            requests.append((action,body));result=data
            if action=='nearby':result={'activity':[]}
            elif action=='discover':result={'people':[{'id':'neighbor','name':'آزمایش سارا','handle':'qa_sara','avatarSeed':'سارا','distance':'کمتر از ۳ کیلومتر','connection':None}]}
            elif action=='world-map':result={'activity':[{'id':'world:cluster','lat':35.7,'lng':51.4,'count':4,'status':'done','createdAt':'2026-10-18T00:00:00Z','name':'یه نفر روی نقشه'}],'inView':4,'total':4,'refreshSeconds':30}
            elif action=='profile':data['me'].update(body);result=data
            elif action=='avatar':data['me']['avatarImage']=body['image'];result=data
            elif action=='admin':result={'totals':{'members':4,'today':0,'lifetime':0,'suspended':0},'invites':[],'users':[{'id':'root','name':'آزمایش علی','handle':'qa_ali','role':'member','lifetime':False,'banned':False}],'audit':[]}
            elif action=='admin-invitation-tree':result={'members':graph,'hasMore':False}
            elif action=='admin-support':result={'requests':[]}
            elif action=='admin-invite':result={'url':BASE+'/join?invite=QA-GIFT'}
            route.fulfill(json=result)
        ctx.route('**/api/app?*',mock)
        page.route('**/_vercel/insights/script.js',lambda r:r.fulfill(content_type='application/javascript',body='/* QA */'))
        def go(path):
            response=page.goto(BASE+path,wait_until='domcontentloaded');assert response.status==200
        go('/nearby')
        expect(page.get_by_role('tab',name='نقشه',exact=True)).to_have_attribute('aria-selected','true')
        page.get_by_role('button',name='همه‌جا',exact=True).click()
        expect(page.locator('.map-mascot-count')).to_have_text('۴',timeout=20000)
        assert not [r for r in requests if r[0] in ['location','map-visibility','nearby','discover']]
        assert not page.locator('.map-permission-card').count()
        page.get_by_role('tab',name='آدم‌های نزدیک من',exact=True).click()
        expect(page.locator('.real-map')).to_be_hidden()
        page.get_by_role('button',name='نمایش آدم‌های نزدیک',exact=True).click()
        expect(page.locator('.nearby-person')).to_contain_text('آزمایش سارا',timeout=20000)
        assert not [r for r in requests if r[0] in ['location','map-visibility']]
        page.screenshot(path=str(ARTIFACTS/'world-nearby-list.png'))
        page.get_by_role('tab',name='نقشه',exact=True).click()
        expect(page.locator('.real-map')).to_be_visible()
        page.get_by_role('button',name='اطراف من',exact=True).click()
        expect(page.locator('.map-visibility-shortcut')).to_be_visible(timeout=20000)
        for width,height in [(320,568),(393,852),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            assert page.locator('.real-map').bounding_box()['height']>150
            for label in ['نقشه','آدم‌های نزدیک من']:
                box=page.get_by_role('tab',name=label,exact=True).bounding_box();assert box['y']>=0 and box['y']+box['height']<height
            page.screenshot(path=str(ARTIFACTS/f'world-nearby-map-{width}.png'))
        print('PASS: Worldwide premium map works before location permission; nearby profiles have a separate tab, map state stays mounted, consent remains unchanged and both views fit mobile/desktop.',flush=True)
        page.set_viewport_size({'width':393,'height':852});go('/profile')
        buttons=page.locator('.bottom-nav button')
        assert buttons.nth(0).inner_text()=='من' and buttons.nth(3).inner_text()=='خانه'
        assert buttons.nth(0).bounding_box()['x']>buttons.nth(3).bounding_box()['x']
        page.get_by_role('button',name='من تو شبکه‌های اجتماعی',exact=False).click()
        expect(page.get_by_role('dialog')).to_contain_text('من تو شبکه‌های اجتماعی')
        page.get_by_label('اینستاگرام',exact=True).fill('@qa_social')
        page.get_by_role('button',name='ذخیره حساب‌ها',exact=True).click()
        expect(page.get_by_role('dialog')).to_have_count(0)
        assert [r[1] for r in requests if r[0]=='profile'][-1]=={'socialLinks':{'instagram':'https://www.instagram.com/qa_social'}}
        go('/settings');expect(page.get_by_label('اسمت',exact=True)).to_be_visible();assert not page.get_by_label('اینستاگرام',exact=True).count()
        page.keyboard.press('Escape');expect(page).to_have_url(BASE+'/profile')
        photo=ARTIFACTS/'world-profile-upload.png';Image.new('RGB',(480,360),(150,185,230)).save(photo)
        with page.expect_file_chooser() as chooser:page.get_by_role('button',name='تغییر عکس پروفایل',exact=True).click()
        chooser.value.set_files(str(photo))
        expect(page.locator('.photo-editor')).to_be_visible()
        page.get_by_role('button',name='همین عکس خوبه',exact=True).click()
        expect(page.locator('.photo-editor')).to_have_count(0,timeout=20000)
        assert data['me']['avatarImage'].startswith('data:image/jpeg;base64,')
        print('PASS: Navigation order is reversed; social accounts have their own profile action, settings are separate, and clicking the avatar opens a working photo crop/save flow.',flush=True)
        go('/admin')
        expect(page.locator('.react-flow__node')).to_have_count(4,timeout=30000)
        page.locator('.react-flow__node[data-id="first"]').click()
        expect(page.locator('.invitation-focus')).to_contain_text('آزمایش سارا')
        expect(page.locator('.react-flow__node')).to_have_count(3)
        page.get_by_role('button',name='فهرست شاخه‌ها',exact=True).click()
        expect(page.locator('.invitation-forest')).to_contain_text('آزمایش نیما')
        page.get_by_role('button',name='نمودار دیداری',exact=True).click()
        page.locator('input[name="invite-gift"][value="lifetime"]').check()
        page.get_by_role('button',name='ساخت لینک یک‌بارمصرف',exact=False).click()
        confirmation=page.get_by_role('alertdialog')
        expect(confirmation).to_contain_text('پرمیوم برای همیشه')
        assert not [r for r in requests if r[0]=='admin-invite']
        confirmation.get_by_role('button',name='نه، برگردیم',exact=True).click()
        assert not [r for r in requests if r[0]=='admin-invite']
        page.get_by_role('button',name='ساخت لینک یک‌بارمصرف',exact=False).click()
        page.get_by_role('alertdialog').get_by_role('button',name='بله، دعوت با این هدیه ساخته بشه',exact=True).click()
        expect(page.get_by_label('لینک خصوصی ساخته‌شده',exact=True)).to_have_value(BASE+'/join?invite=QA-GIFT')
        assert [r[1] for r in requests if r[0]=='admin-invite'][-1]=={'giftDays':0,'giftLifetime':True,'confirmed':True}
        page.locator('.admin-user-list input[type="checkbox"]').click()
        expect(page.get_by_role('alertdialog')).to_contain_text('آزمایش علی')
        assert not [r for r in requests if r[0]=='admin-user']
        page.keyboard.press('Escape')
        assert not [r for r in requests if r[0]=='admin-user']
        for width,height in [(320,568),(393,852),(1440,900)]:
            page.set_viewport_size({'width':width,'height':height})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.locator('.admin-gift-options').scroll_into_view_if_needed();page.screenshot(path=str(ARTIFACTS/f'world-admin-gifts-{width}.png'))
        assert not errors,errors
        print('PASS: React Flow shows multiple invitation generations, branch focus and tree fallback; gift cards select and submit the existing one-use lifetime option without overflow.',flush=True)
        browser.close()


if __name__=='__main__':main()
