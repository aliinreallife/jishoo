"""BrowserRouter regression checks with explicit synthetic API fixtures.

No Google authentication or database writes. Run against Vite or a deployed build;
deployment rewrites and the real backend are checked separately.
"""
import copy
from datetime import datetime, timedelta
import json
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright, expect
from smoke import BASE, CHROMIUM, verified_https, ARTIFACTS


def fixture():
    return {
        'me': {'id': 'routing-member', 'name': 'آزمایش مسیر', 'handle': 'qa_routing',
               'avatarSeed': 'آزمایش مسیر', 'registered': True, 'premium': True,
               'socialLinks': {}, 'inviteCode': 'OWN-CODE', 'trialDaysSaved': 7,
               'shareLocation': False, 'discoverable': False, 'notificationsEnabled': True},
        'auth': {'googleEnabled': True, 'phoneLoginEnabled': False},
        'map': {'url': 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
                'maxZoom': 20, 'subdomains': 'abc', 'attribution': 'Synthetic routing fixture'},
        'stats': {'total': 0, 'today': 0, 'week': 0, 'month': 0, 'need': 0,
                  'daily': [], 'monthly': [], 'latest': None},
        'friends': [], 'moments': [], 'circles': [
            {'id': 'legacy-group', 'name': 'جمع آزمایش مسیر', 'people': [], 'members': [], 'shared': True,
             'ownerId': 'routing-member', 'ownerName': 'آزمایش مسیر', 'ownerHandle': 'qa_routing',
             'ownerAvatarSeed': 'آزمایش مسیر', 'inviteCode': 'GROUP-CODE'}],
        'notifications': [{'id': 'old-push', 'route': '/#/circle/legacy-group',
                           'title': 'دعوت قبلی گروه', 'body': 'آزمایش لینک قدیمی',
                           'createdAt': '2026-10-17T08:00:00Z'}],
        'achievements': [], 'invited': [], 'notificationPreferences': [],
        'invitationQuota': {'used': 0, 'remaining': 3, 'limit': 3},
        'testing': True, 'inviteOnly': True, 'publicUrl': BASE,
    }


def main():
    errors, requests = [], []
    data = fixture()
    invitation = {'code': 'TEST-INVITE', 'remaining': 3, 'bonusDays': 7,
                  'inviter': {'id': 'inviter', 'name': 'آزمایش دعوت', 'handle': 'qa_inviter', 'avatarSeed': 'دعوت'}}
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 393, 'height': 852}, service_workers='block')
        verified_https(ctx)
        version=json.loads((Path(__file__).resolve().parents[1]/'package.json').read_text())['version']
        ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release',"+json.dumps(version)+")")
        page = ctx.new_page()
        page.on('pageerror', lambda e: (errors.append(str(e)), print('Browser error:', str(e), flush=True)))

        def mock(route):
            request = route.request
            query = parse_qs(urlsplit(request.url).query)
            action = query.get('action', [''])[0]
            body = request.post_data_json if request.method == 'POST' else None
            requests.append((action, body))
            result = copy.deepcopy(data)
            if action == 'invite': result = invitation
            elif action == 'profile':
                data['me'].update(body)
                result = data
            elif action == 'circle-info':
                result = {'group': {'id': 'not-joined', 'name': 'گروه تازه', 'members': 2, 'owner': invitation['inviter']}}
            elif action == 'profile-public': result = {'profile': invitation['inviter']}
            elif action == 'google-start': result = {'url': '/join?invite=TEST-INVITE&google=cancelled'}
            elif action == 'checkin': result = {**data, 'moments': []}
            route.fulfill(json=result)
        ctx.route('**/api/app?*', mock)

        def go(path, canonical=None):
            response = page.goto(BASE + path, wait_until='domcontentloaded')
            assert response.status == 200, (path, response.status)
            if canonical:
                expect(page).to_have_url(BASE + canonical)

        go('/#how', '/#how')
        expect(page.locator('.landing-page')).to_be_visible()
        page.get_by_role('link', name='بریم جیشو', exact=False).first.click()
        expect(page).to_have_url(BASE + '/home')
        expect(page.locator('.need-card')).to_be_visible()
        page.locator('.bottom-nav').get_by_role('button', name='من', exact=True).click()
        expect(page).to_have_url(BASE + '/profile')
        page.get_by_role('button', name='تنظیمات پروفایل', exact=True).click()
        expect(page).to_have_url(BASE + '/settings')
        expect(page.get_by_role('dialog')).to_contain_text('پروفایل خودت')
        # Fragment sections do not close/reinitialize an unsaved form.
        name = page.get_by_label('اسمت', exact=True)
        name.fill('پیش‌نویس مسیر')
        page.evaluate("location.hash='social-accounts'")
        expect(name).to_have_value('پیش‌نویس مسیر')
        page.go_back()
        expect(page).to_have_url(BASE + '/settings')
        expect(name).to_have_value('پیش‌نویس مسیر')
        page.go_back()
        expect(page).to_have_url(BASE + '/profile')
        expect(page.get_by_role('dialog')).to_have_count(0)
        page.go_forward()
        expect(page).to_have_url(BASE + '/settings')
        expect(page.get_by_role('dialog')).to_contain_text('پروفایل خودت')
        page.keyboard.press('Escape')
        expect(page).to_have_url(BASE + '/profile')
        page.locator('.bottom-nav').get_by_role('button', name='دوست‌ها', exact=True).click()
        expect(page).to_have_url(BASE + '/friends')
        page.go_back(); expect(page).to_have_url(BASE + '/profile')
        page.go_forward(); expect(page).to_have_url(BASE + '/friends')
        print('PASS: Real navigation, Back/Forward, route-based settings and unchanged section-anchor drafts.', flush=True)

        for old, new in [('/#/profile', '/profile'), ('/#profile', '/profile'),
                         ('/#/discover', '/nearby'), ('/#/circle/legacy-group', '/circle/legacy-group'),
                         ('/app/friends', '/friends'), ('/?source=twa#/home', '/home?source=twa')]:
            print('Checking legacy route:', old, flush=True)
            go(old, new)
            expect(page.locator('.bottom-nav')).to_be_visible()
            page.reload(wait_until='domcontentloaded'); expect(page).to_have_url(BASE + new)
            expect(page.locator('.bottom-nav')).to_be_visible()
        go('/settings', '/settings')
        expect(page.get_by_role('dialog')).to_contain_text('پروفایل خودت')
        page.reload(wait_until='domcontentloaded'); expect(page.get_by_role('dialog')).to_contain_text('پروفایل خودت')
        page.get_by_label('اسمت', exact=True).fill('آزمایش ذخیره مسیر')
        page.get_by_role('button', name='ذخیره تغییرات', exact=True).click()
        expect(page).to_have_url(BASE + '/profile')
        assert data['me']['name'] == 'آزمایش ذخیره مسیر'
        for path, selector in [('/stats', '.lovely-stats'), ('/achievements', '.achievements-page'),
                               ('/friends', '.friends-hub'), ('/profile', '.profile-page'),
                               ('/notifications', '.notification-page')]:
            go(path, path); expect(page.locator(selector)).to_be_visible()
            page.reload(wait_until='domcontentloaded'); expect(page.locator(selector)).to_be_visible()
        page.locator('.notification-item').click()
        expect(page).to_have_url(BASE + '/circle/legacy-group')
        expect(page.locator('.group-detail h1')).to_have_text('جمع آزمایش مسیر')
        print('PASS: Old links, PWA/TWA launch URLs, refreshed app pages and stored group notifications resolve correctly.', flush=True)

        go('/home')
        # Keep the three-second window deterministic while the browser performs
        # navigation assertions; the app's actual timer implementation is intact.
        clock_time = datetime(2026, 10, 17, 12, 0, 0)
        page.clock.install(time=clock_time)
        page.clock.pause_at(clock_time + timedelta(seconds=1))
        page.locator('.need-card').click()
        page.keyboard.press('Escape')
        page.get_by_role('button', name='پروفایل من', exact=True).click()
        expect(page).to_have_url(BASE + '/profile')
        expect(page.locator('.undo-checkin')).to_be_visible()
        page.get_by_role('button', name='لغو ثبت', exact=True).click()
        assert not [r for r in requests if r[0] == 'checkin']
        page.clock.resume()
        go('/stories/need', '/stories/need')
        expect(page.get_by_role('button', name='ذخیره PNG', exact=True)).to_be_enabled(timeout=30000)
        page.reload(wait_until='domcontentloaded')
        expect(page.get_by_role('button', name='ذخیره PNG', exact=True)).to_be_enabled(timeout=30000)
        page.screenshot(path=str(ARTIFACTS / 'routing-story-clean-url.png'))
        print('PASS: Pending undo survives page navigation without a write; story selection survives refresh.', flush=True)

        data['me']['registered'] = False
        go('/?invite=TEST-INVITE', '/join?invite=TEST-INVITE')
        expect(page.get_by_role('button', name='با این دعوت عضو بشم', exact=True)).to_be_visible()
        page.get_by_role('button', name='با این دعوت عضو بشم', exact=True).click()
        with page.expect_navigation(wait_until='domcontentloaded'):
            page.get_by_role('button', name='ادامه با Google', exact=True).click()
        expect(page).to_have_url(BASE + '/join?invite=TEST-INVITE')
        body = [r[1] for r in requests if r[0] == 'google-start'][-1]
        assert body['returnTo'] == '/join?invite=TEST-INVITE' and body['inviteCode'] == 'TEST-INVITE', body
        go('/home?login=1', '/home')
        expect(page.get_by_role('dialog')).to_be_visible()
        expect(page.get_by_role('button', name='ادامه با Google', exact=True)).to_be_visible()
        go('/group?group=GROUP-CODE&invite=TEST-INVITE')
        expect(page.locator('.group-link-landing h1')).to_have_text('گروه تازه')
        data['me']['registered'] = True
        data['me']['joinedInviteCode'] = 'TEST-INVITE'
        go('/join?invite=TEST-INVITE')
        expect(page).to_have_url(BASE + '/home', timeout=10000)
        assert not [r for r in requests if r[0] in ['connection-request', 'register']]
        print('PASS: Invitation identity/Google return context, login query handling, group invitation and already-accepted redirects.', flush=True)
        # Old installed/bookmarked links must also work for a brand-new guest.
        data['me']['registered'] = False
        fresh = browser.new_context(viewport={'width': 393, 'height': 852}, service_workers='block')
        verified_https(fresh)
        fresh.route('**/api/app?*', mock)
        first = fresh.new_page()
        first.goto(BASE + '/#/home', wait_until='domcontentloaded')
        expect(first).to_have_url(BASE + '/home')
        expect(first.locator('.need-card')).to_be_visible()
        assert first.evaluate("localStorage.getItem('jishoo:v2-entered')") == 'true'
        fresh.close()
        assert not errors, errors
        browser.close()


if __name__ == '__main__': main()
