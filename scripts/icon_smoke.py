"""Verify installed-icon cache migration and offline assets in a real browser.

Uses one fresh local browser context, no accounts or private API fixtures.
"""
from playwright.sync_api import sync_playwright, expect
from smoke import BASE, CHROMIUM, context, capture


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
        try:
            ctx,page=context(browser)
            page.goto(BASE+'/offline.html')
            page.evaluate("""async()=>{
              await(await caches.open('jishoo-public-v1')).put('/qa-stale-icon',new Response('old'));
              await(await caches.open('qa-unrelated-cache')).put('/qa-other',new Response('keep'));
              localStorage.setItem('qa-preserved-setting','keep');
            }""")
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(BASE+'/')
            expect(page.locator('.landing-brand img')).to_have_js_property('naturalWidth',64)
            page.wait_for_function("navigator.serviceWorker.controller !== null")
            keys=page.evaluate('caches.keys()')
            assert 'jishoo-public-v1' not in keys and 'jishoo-public-v2' in keys and 'qa-unrelated-cache' in keys,keys
            assert page.evaluate("localStorage.getItem('qa-preserved-setting')")=='keep'
            files=page.evaluate("async()=>[...(await(await caches.open('jishoo-public-v2')).keys())].map(r=>new URL(r.url).pathname)")
            for path in ['/assets/favicon-v2-32.png','/assets/favicon-v2-64.png','/assets/apple-touch-icon-v2.png','/assets/app-icon-v2-192.png','/assets/app-icon-v2-512.png','/assets/app-icon-v2-maskable-512.png','/assets/notification-badge-v2.png']:
                assert path in files,path
            assert page.locator('link[rel="apple-touch-icon"]').get_attribute('href')=='/assets/apple-touch-icon-v2.png'
            assert page.locator('link[rel="icon"][sizes="32x32"]').get_attribute('href')=='/assets/favicon-v2-32.png'
            capture(page,'consistent-icon-landing.png')
            ctx.set_offline(True)
            page.goto(BASE+'/qa-offline-navigation')
            expect(page.get_by_role('heading',level=1)).to_contain_text('بی‌اینترنتیم')
            expect(page.locator('main img')).to_have_js_property('naturalWidth',192)
            capture(page,'consistent-icon-offline.png')
            assert not errors,errors
            print('PASS: The real service worker replaces the stale public icon cache, preserves unrelated storage, preloads versioned icons and renders the new icon offline. Browser/Apple references match the manifest identity.',flush=True)
            ctx.close()
        finally:browser.close()


if __name__=='__main__':main()
