"""Check invitation ancestry and desktop restoration using owned QA members."""
import json
from playwright.sync_api import sync_playwright, expect
from security_release_smoke import google_member, client, owned, page_for
from smoke import BASE, CHROMIUM, capture


def contains(outer, inner):
    return inner['x'] >= outer['x'] - 1 and inner['y'] >= outer['y'] - 1 and inner['x'] + inner['width'] <= outer['x'] + outer['width'] + 1 and inner['y'] + inner['height'] <= outer['y'] + outer['height'] + 1


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=['--no-sandbox'])
        try:
            admin, root = google_member('آزمایش ریشهٔ دعوت', admin=True)
            alice, a = google_member('آزمایش شاخهٔ اول', root['me']['inviteCode'])
            bob, b = google_member('آزمایش شاخهٔ دوم', a['me']['inviteCode'])
            carol, c = google_member('آزمایش شاخهٔ سوم', b['me']['inviteCode'])
            guest = client()
            guest.call('admin-invitation-tree', expected=401)
            alice.call('admin-invitation-tree', expected=403)
            members = []
            offset = 0
            while True:
                result = admin.call('admin-invitation-tree&offset=' + str(offset))
                members += result['members']
                if not result['hasMore']: break
                offset = result['nextOffset']
            indexed = {u['id']: u for u in members}
            for child, parent in [(a, root), (b, a), (c, b)]:
                row = indexed[child['me']['id']]
                assert row['invitedBy'] == parent['me']['id']
                assert set(row) <= {'id','name','handle','avatarSeed','invitedBy','joinedAt','banned'}
            print('PASS: Real invitation ancestry spans three generations; guest/member access is rejected and only minimal profile fields are returned.', flush=True)
            ctx, page = page_for(browser, admin, width=1440, height=900)
            errors = []
            page.on('pageerror', lambda e: errors.append(str(e)))
            page.goto(BASE + '/#/admin')
            tree = page.locator('.admin-invitation-tree')
            expect(tree).to_be_visible(timeout=30000)
            page.get_by_label('جستجو در درخت دعوت‌ها', exact=True).fill(root['me']['handle'])
            page.locator('.invitation-tree-results button').first.click()
            for data in [root, a, b]:
                expect(page.locator('[data-member-id="' + data['me']['id'] + '"]')).to_be_visible()
            second = page.get_by_role('button', name='زیرشاخه‌های ' + b['me']['name'], exact=True)
            second.click()
            third = page.locator('[data-member-id="' + c['me']['id'] + '"]')
            expect(third).to_be_visible()
            expect(third).to_contain_text('نسل ۳')
            second.click()
            expect(third).to_have_count(0)
            page.get_by_label('جستجو در درخت دعوت‌ها', exact=True).fill(c['me']['handle'])
            page.locator('.invitation-tree-results button').first.click()
            for data in [root, a, b, c]:
                expect(page.locator('.invitation-focus')).to_contain_text(data['me']['name'])
            capture(page, 'admin-invitation-tree-desktop.png')
            page.set_viewport_size({'width':393,'height':852})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
            capture(page, 'admin-invitation-tree-phone.png')
            print('PASS: Admin tree search, three-level expansion/collapse, generation labels and ancestry breadcrumbs work at phone and desktop widths.', flush=True)
            page.goto(BASE + '/#/home')
            expect(page.locator('.home-page')).to_be_visible(timeout=20000) if page.locator('.home-page').count() else expect(page.locator('.v2-home')).to_be_visible(timeout=20000)
            assert page.locator('.testing-banner').count() == 0
            for width, height in [(1440,900),(1024,768),(768,1024),(393,852),(320,568),(812,375)]:
                page.set_viewport_size({'width':width,'height':height})
                shell = page.locator('.app-shell').bounding_box()
                framed = width >= 501 and height >= 600
                assert abs(shell['width'] - (414 if framed else width)) < 2, (width,height,shell)
                assert shell['y'] >= 0 and shell['y'] + shell['height'] <= height + 1
                expect(page.locator('.desktop-brand')).to_be_visible() if width >= 851 and height >= 600 else expect(page.locator('.desktop-brand')).to_be_hidden()
                buttons = page.locator('.bottom-nav button').all()
                xs = [button.bounding_box()['x'] for button in buttons]
                assert xs == sorted(xs,reverse=True), xs
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                capture(page, f'desktop-frame-{width}-{height}.png')
            page.set_viewport_size({'width':1440,'height':900})
            for selector in ['.need-card','.done-card']:
                page.locator(selector).click()
                dialog = page.get_by_role('dialog')
                expect(dialog).to_be_visible()
                shell = page.locator('.app-shell').bounding_box()
                assert contains(shell, dialog.bounding_box()), (shell,dialog.bounding_box())
                capture(page,'desktop-' + selector[1:] + '.png')
                page.keyboard.press('Escape')
            page.goto(BASE + '/#/profile')
            page.get_by_role('button',name='تنظیمات پروفایل',exact=True).click()
            expect(page.get_by_role('dialog')).to_be_visible()
            assert contains(page.locator('.app-shell').bounding_box(), page.get_by_role('dialog').bounding_box())
            page.keyboard.press('Escape')
            assert not errors, errors
            assert not page.locator('script[src*="/_vercel/"]').count()
            print('PASS: Desktop mobile frame/sidebar restored, phones/landscape remain full screen, navigation reads RTL, testing badge is absent, dialogs fit the frame and disabled observability loads no scripts.', flush=True)
            ctx.close()
        finally:
            for owner in reversed(owned):
                owner.call('delete-account', {})
            browser.close()


if __name__ == '__main__': main()
