"""RTL chart interaction checks with synthetic counts; no account writes."""
import copy
import json
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
from routing_smoke import fixture
from smoke import BASE, CHROMIUM, verified_https, ARTIFACTS


def main():
    version = json.loads((Path(__file__).resolve().parents[1] / 'package.json').read_text())['version']
    daily = [{'day': '2025-11-01', 'count': 9}, {'day': '2026-09-23', 'count': 2}]
    daily += [{'day': f'2026-10-{day}', 'count': count}
              for day, count in zip(range(10, 17), [1, 3, 2, 6, 4, 7, 5])]
    errors = []
    if BASE.startswith('https://'):
        expect.set_options(timeout=60000)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=['--no-sandbox'])

        def open_stats(date, rows):
            data = fixture()
            data['stats'].update(daily=copy.deepcopy(rows), today=5, week=28, month=30,
                                 total=sum(row['count'] for row in rows))
            ctx = browser.new_context(viewport={'width': 393, 'height': 852}, service_workers='block', reduced_motion='reduce')
            verified_https(ctx)
            ctx.route('**/api/app?*', lambda route: route.fulfill(json=data))
            ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release'," + json.dumps(version) + ")")
            page = ctx.new_page()
            page.clock.set_fixed_time(datetime.fromisoformat(date).replace(tzinfo=timezone.utc))
            page.on('pageerror', lambda error: errors.append(str(error)))
            page.goto(BASE + '/stats', wait_until='domcontentloaded')
            expect(page.locator('.stats-trend')).to_be_visible()
            return ctx, page

        ctx, page = open_stats('2026-10-16T10:00:00', daily)
        readout = page.locator('.trend-readout')
        previous = page.get_by_role('button', name='نقطهٔ قبلی نمودار', exact=True)
        following = page.get_by_role('button', name='نقطهٔ بعدی نمودار', exact=True)

        def select_edge(side, hover=False):
            chart = page.locator('.stats-trend svg')
            chart.scroll_into_view_if_needed()
            box = chart.bounding_box()
            position = {'x': box['width'] * (.95 if side == 'right' else .05), 'y': box['height'] / 2}
            if hover:
                page.mouse.move(box['x'] + position['x'], box['y'] + position['y'])
            else:
                chart.click(position=position)

        for width, height in [(320, 640), (393, 852), (1440, 900)]:
            page.set_viewport_size({'width': width, 'height': height})
            page.get_by_role('button', name='هفته', exact=True).click()
            labels = page.locator('.trend-axis-labels.week span')
            expect(labels.first).to_have_text('شنبه')
            expect(labels.last).to_have_text('جمعه')
            assert labels.first.bounding_box()['x'] > labels.last.bounding_box()['x']
            select_edge('right')
            expect(readout).to_contain_text('شنبه')
            expect(readout.locator('strong')).to_contain_text('۱ ')
            expect(previous).to_be_disabled()
            select_edge('left', hover=True)
            expect(readout).to_contain_text('جمعه')
            expect(readout.locator('strong')).to_contain_text('۵ ')
            expect(following).to_be_disabled()
            assert previous.bounding_box()['x'] > following.bounding_box()['x']
            previous.focus()
            page.keyboard.press('Enter')
            expect(readout).to_contain_text('پنجشنبه')
            expect(readout.locator('strong')).to_contain_text('۷ ')
            following.click()
            expect(readout).to_contain_text('جمعه')
            assert page.locator('.calendar-weekdays span').first.bounding_box()['x'] > page.locator('.calendar-weekdays span').last.bounding_box()['x']
            assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth+1')
            page.locator('.lovely-chart-card').screenshot(path=str(ARTIFACTS / f'stats-rtl-week-{width}.png'))
        print('PASS: Saturday starts on the right and Friday ends on the left; clicks, hover and keyboard navigation select matching counts at phone and desktop widths.', flush=True)

        page.set_viewport_size({'width': 393, 'height': 852})
        page.get_by_role('button', name='ماه', exact=True).click()
        select_edge('right')
        expect(readout.locator('span').first).to_contain_text('۱ مهر')
        expect(readout.locator('strong')).to_contain_text('۲ ')
        select_edge('left')
        expect(readout).to_contain_text('هنوز نرسیده')
        page.locator('.lovely-chart-card').screenshot(path=str(ARTIFACTS / 'stats-rtl-month.png'))

        page.get_by_role('button', name='همه‌وقت', exact=True).click()
        select_edge('right')
        expect(readout.locator('span').first).to_contain_text('آبان')
        expect(readout.locator('strong')).to_contain_text('۹ ')
        select_edge('left')
        expect(readout.locator('span').first).to_contain_text('مهر')
        expect(readout.locator('strong')).to_contain_text('۳۰ ')
        page.locator('.lovely-chart-card').screenshot(path=str(ARTIFACTS / 'stats-rtl-year.png'))
        ctx.close()
        print('PASS: Shamsi month and 12-month views run right to left; future dates do not show completed counts.', flush=True)

        for date, rows, name in [
            ('2026-10-12T10:00:00', [row for row in daily if row['day'] <= '2026-10-12'], 'partial'),
            ('2026-10-10T10:00:00', [], 'empty-first-day'),
        ]:
            ctx, page = open_stats(date, rows)
            readout = page.locator('.trend-readout')
            select_edge('right')
            expect(readout).to_contain_text('شنبه')
            if not rows:
                expect(readout.locator('strong')).to_contain_text('۰ ')
            # Completed history fills the right side, leaving future days on the left.
            fill = page.locator('.stats-trend svg path[fill="url(#stats-area)"]')
            assert fill.evaluate('e=>e.getBBox().x>320'), 'Shading extends into future dates'
            select_edge('left')
            expect(readout).to_contain_text('هنوز نرسیده')
            page.locator('.lovely-chart-card').screenshot(path=str(ARTIFACTS / f'stats-rtl-{name}.png'))
            ctx.close()
        assert not errors, errors
        browser.close()
        print('PASS: Partial weeks and empty first-day charts retain RTL history/future shading without browser errors.', flush=True)


if __name__ == '__main__':
    main()
