"""Exercise actual service-worker updates across two production builds.

Uses synthetic account API responses and a local release-switching HTTP server.
No database writes, notification delivery, or changes to release source files.
"""
import json
import mimetypes
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
from playwright.sync_api import sync_playwright, expect
from routing_smoke import fixture
from smoke import CHROMIUM, ARTIFACTS

ROOT = Path(__file__).resolve().parents[1]


def main():
    with tempfile.TemporaryDirectory(prefix='jishoo-update-') as temporary:
        directories = []
        for index in range(2):
            result = subprocess.run(['npm', 'run', 'build'], cwd=ROOT, capture_output=True, text=True)
            assert result.returncode == 0, result.stdout + result.stderr
            directory = Path(temporary) / str(index)
            shutil.copytree(ROOT / 'dist', directory)
            directories.append(directory)
        releases = [json.loads((directory / 'version.json').read_text()) for directory in directories]
        assert releases[0]['buildId'] != releases[1]['buildId']
        state = {'stage': 0, 'critical': False, 'metadata_failure': False, 'bootstrap_failure': False, 'checks': 0}
        data = fixture()
        errors, mutations = [], []
        hold_save = {'enabled': False, 'received': threading.Event(), 'release': threading.Event()}

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def api(self, body=None):
                action = parse_qs(urlsplit(self.path).query).get('action', [''])[0]
                if body is not None:
                    mutations.append((action, body))
                if action == 'profile' and hold_save['enabled']:
                    hold_save['received'].set()
                    hold_save['release'].wait(15)
                failed = action == 'bootstrap' and state['bootstrap_failure']
                result = {'message': 'آزمایش ناسازگاری نسخه'} if failed else {'stats': data['stats'], 'matches': []} if action == 'checkin' else data
                payload = json.dumps(result).encode()
                self.send_response(503 if failed else 200)
                self.send_header('Content-Type', 'application/json')
                self.send_header('Cache-Control', 'no-store')
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

            def do_POST(self):
                self.api(json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0)))))

            def do_GET(self):
                path = urlsplit(self.path).path
                if path.startswith('/api/'):
                    return self.api()
                if path == '/version.json':
                    state['checks'] += 1
                    metadata = dict(releases[state['stage']])
                    if state['critical']:
                        metadata.update(version='9.0.0', minimumSupportedVersion='9.0.0', buildId='critical-test-build')
                    data = json.dumps(metadata).encode()
                    self.send_response(503 if state['metadata_failure'] else 200)
                    self.send_header('Content-Type', 'application/json')
                else:
                    relative = path.lstrip('/')
                    file = directories[state['stage']] / relative
                    if not file.is_file() and relative.startswith('assets/'):
                        file = directories[1 - state['stage']] / relative
                    if not file.is_file():
                        file = directories[state['stage']] / 'index.html'
                    data = file.read_bytes()
                    self.send_response(200)
                    self.send_header('Content-Type', mimetypes.guess_type(file)[0] or 'application/octet-stream')
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Cache-Control', 'no-store')
                self.end_headers()
                self.wfile.write(data)

        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = 'http://127.0.0.1:' + str(server.server_port)
        data['publicUrl'] = base

        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=['--no-sandbox'])
                ctx = browser.new_context(viewport={'width': 393, 'height': 852})
                ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');if(!localStorage.getItem('jishoo:last-seen-release'))localStorage.setItem('jishoo:last-seen-release'," + json.dumps(releases[0]['version']) + ")")
                page = ctx.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                original_url = base + '/home?source=twa#today'
                page.goto(original_url, wait_until='networkidle')
                page.wait_for_function('navigator.serviceWorker.controller !== null', timeout=15000)
                expect(page.locator('[data-app-update]')).to_have_count(0)
                draft = ctx.new_page()
                draft.on('pageerror', lambda error: errors.append(str(error)))
                draft.goto(base + '/settings', wait_until='networkidle')
                if not draft.get_by_label('اسمت', exact=True).count():
                    draft.screenshot(path=str(ARTIFACTS / 'app-update-draft-debug.png'))
                    print('Draft page:', draft.locator('body').inner_text()[:1200], 'Errors:', errors, flush=True)
                draft.get_by_label('اسمت', exact=True).fill('پیش‌نویس محفوظ می‌مونه')
                draft.evaluate('window.qaDocument = "original-draft-document"')
                page.bring_to_front()
                state['stage'] = 1
                page.evaluate('async () => (await navigator.serviceWorker.getRegistration("/")).update()')
                page.wait_for_function('async () => Boolean((await navigator.serviceWorker.getRegistration("/"))?.waiting)', timeout=20000)
                expect(page.locator('[data-app-update]')).to_be_visible(timeout=15000)
                assert page.url == original_url
                expect(draft.get_by_label('اسمت', exact=True)).to_have_value('پیش‌نویس محفوظ می‌مونه')
                expect(draft.locator('[data-app-update]')).to_have_count(0)
                for width, height in [(320, 568), (393, 852), (1440, 900)]:
                    page.set_viewport_size({'width': width, 'height': height})
                    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
                    box = page.locator('.app-update-card').bounding_box()
                    assert box['x'] >= 0 and box['y'] >= 0 and box['y'] + box['height'] <= height
                    page.screenshot(path=str(ARTIFACTS / f'app-update-{width}.png'))
                page.set_viewport_size({'width': 393, 'height': 852})
                print('PASS: A changed build produces a waiting worker and a responsive update banner without reloading either tab or disturbing a draft.', flush=True)

                # Check Later without waiting an hour in real time.
                page.clock.install()
                page.get_by_role('button', name='بعداً', exact=True).click()
                expect(page.locator('[data-app-update]')).to_have_count(0)
                page.clock.fast_forward(3601000)
                page.evaluate('window.dispatchEvent(new Event("online"))')
                expect(page.locator('[data-app-update]')).to_be_visible()
                page.locator('.need-card').click()
                expect(page.locator('[data-app-update]')).to_have_count(0)
                page.keyboard.press('Escape')
                expect(page.locator('.undo-checkin')).to_be_visible()
                expect(page.locator('[data-app-update]')).to_have_count(0)
                page.get_by_role('button', name='لغو ثبت', exact=True).click()
                expect(page.locator('[data-app-update]')).to_be_visible()
                assert not [action for action, _ in mutations if action == 'checkin']

                page.get_by_role('button', name='پروفایل من', exact=True).click()
                page.get_by_role('button', name='تنظیمات پروفایل', exact=True).click()
                page.get_by_label('اسمت', exact=True).fill('ذخیرهٔ در حال انجام')
                hold_save['enabled'] = True
                page.get_by_role('button', name='ذخیره تغییرات', exact=True).click()
                page.wait_for_timeout(150)
                assert hold_save['received'].wait(2)
                page.keyboard.press('Escape')
                expect(page.get_by_role('dialog')).to_have_count(0)
                expect(page.locator('[data-app-update]')).to_have_count(0)
                hold_save['release'].set()
                hold_save['enabled'] = False
                expect(page.locator('[data-app-update]')).to_be_visible()
                print('PASS: Later snoozes a build; Undo and outstanding profile saves prevent update prompts and preserve pending actions.', flush=True)

                ctx.set_offline(True)
                expect(page.get_by_role('button', name='به‌روزرسانی', exact=True)).to_be_disabled()
                expect(page.locator('[data-app-update]')).to_contain_text('اول به اینترنت وصل شو')
                ctx.set_offline(False)
                expect(page.get_by_role('button', name='به‌روزرسانی', exact=True)).to_be_enabled()
                page.evaluate("history.replaceState(history.state,'','/profile?source=twa#today');window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}))")
                expect(page.get_by_role('button', name='تنظیمات پروفایل', exact=True)).to_be_visible()
                state['metadata_failure'] = True
                page.evaluate("window.qaDocument='failed-update-kept-document'")
                page.get_by_role('button', name='به‌روزرسانی', exact=True).click()
                expect(page.locator('.app-update-error')).to_contain_text('به‌روزرسانی انجام نشد')
                assert page.evaluate('window.qaDocument') == 'failed-update-kept-document'
                state['metadata_failure'] = False
                page.evaluate("localStorage.setItem('jishoo:last-seen-release','0.4.0');window.qaDocument='old-document'")
                before_url = page.url
                page.get_by_role('button', name='به‌روزرسانی', exact=True).click()
                page.wait_for_function('window.qaDocument === undefined', timeout=20000)
                assert page.url == before_url
                page.wait_for_function('async () => !(await navigator.serviceWorker.getRegistration("/"))?.waiting')
                expect(page.locator('.release-notes')).to_be_visible(timeout=15000)
                page.get_by_role('button', name='چه خوب! بریم تو جیشو', exact=True).click()
                expect(page.locator('[data-app-update]')).to_have_count(0)
                assert draft.evaluate('window.qaDocument') == 'original-draft-document'
                expect(draft.get_by_label('اسمت', exact=True)).to_have_value('پیش‌نویس محفوظ می‌مونه')
                print('PASS: Offline updates are disabled; explicit updating activates the real waiting worker, reloads only that tab at its current URL and shows release notes afterward.', flush=True)

                # A critical compatibility floor is synthetic; no unsafe build is published.
                state['metadata_failure'] = True
                page.evaluate('window.dispatchEvent(new Event("online"))')
                page.wait_for_timeout(150)
                expect(page.locator('[data-app-update]')).to_have_count(0)
                state['metadata_failure'] = False
                page.get_by_role('button', name='تنظیمات پروفایل', exact=True).click()
                page.get_by_label('اسمت', exact=True).fill('قبل از به‌روزرسانی ضروری')
                state['critical'] = True
                page.evaluate('window.dispatchEvent(new Event("online"))')
                expect(page.locator('[data-app-update]')).to_have_count(0)
                page.keyboard.press('Escape')
                expect(page.get_by_role('alertdialog')).to_be_visible(timeout=15000)
                assert not page.get_by_role('button', name='بعداً', exact=True).count()
                page.keyboard.press('Escape')
                expect(page.get_by_role('alertdialog')).to_be_visible()
                page.keyboard.press('Tab')
                assert page.get_by_role('button', name='به‌روزرسانی', exact=True).evaluate('(node) => node === document.activeElement')
                page.screenshot(path=str(ARTIFACTS / 'app-update-required.png'))
                checks = state['checks']
                for _ in range(3):
                    page.evaluate('window.dispatchEvent(new Event("focus"))')
                page.wait_for_timeout(200)
                assert state['checks'] == checks
                assert not errors, errors
                print('PASS: Failed metadata checks are harmless; critical updates wait for edits, cannot be dismissed and retain keyboard focus. Resume checks are throttled.', flush=True)
                state['critical'] = False
                state['stage'] = 0
                plain = browser.new_context(service_workers='block', viewport={'width': 393, 'height': 852})
                plain.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release'," + json.dumps(releases[0]['version']) + ")")
                plain_page = plain.new_page()
                plain_page.goto(base + '/home', wait_until='networkidle')
                expect(plain_page.locator('.need-card')).to_be_visible()
                state['stage'] = 1
                plain_page.evaluate("window.qaDocument='without-worker';window.dispatchEvent(new Event('online'))")
                expect(plain_page.locator('[data-app-update]')).to_be_visible()
                plain_page.get_by_role('button', name='به‌روزرسانی', exact=True).click()
                plain_page.wait_for_function('window.qaDocument === undefined', timeout=15000)
                expect(plain_page.locator('.need-card')).to_be_visible()
                expect(plain_page.locator('[data-app-update]')).to_have_count(0)
                print('PASS: Ordinary browser tabs can also update when service workers are unavailable.', flush=True)
                state['bootstrap_failure'] = True
                state['critical'] = True
                recovery = plain.new_page()
                recovery.goto(base + '/home', wait_until='networkidle')
                expect(recovery.get_by_role('alertdialog')).to_be_visible(timeout=15000)
                print('PASS: A failed or incompatible account API does not hide the critical-update recovery prompt.', flush=True)
                browser.close()
        finally:
            server.shutdown()


if __name__ == '__main__':
    main()
