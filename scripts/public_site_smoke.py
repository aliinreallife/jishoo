"""Public HTML, discovery, hydration and form checks; no real account/message writes."""
import json
import os
import re
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from playwright.sync_api import sync_playwright, expect
from smoke import BASE, CHROMIUM, verified_https, ARTIFACTS

PATHS = ['/', '/about', '/install', '/privacy', '/terms', '/support', '/changelog']


class Document(HTMLParser):
    def __init__(self):
        super().__init__(); self.meta = {}; self.canonical = []; self.title = ''; self.body = []; self.in_title = False
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta': self.meta[attrs.get('name', attrs.get('property', ''))] = attrs.get('content')
        if tag == 'link' and attrs.get('rel') == 'canonical': self.canonical.append(attrs.get('href'))
        if tag == 'title': self.in_title = True
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
    def handle_data(self, value):
        if self.in_title: self.title += value
        self.body.append(value)


def main():
    if BASE.startswith('https://'): expect.set_options(timeout=60000)
    def read(path):
        headers = {}
        if os.environ.get('JISHOO_TEST_BYPASS_SECRET'):
            headers['x-vercel-protection-bypass'] = os.environ['JISHOO_TEST_BYPASS_SECRET']
        request = urllib.request.Request(BASE + path, headers=headers)
        with urllib.request.urlopen(request, timeout=45) as response:
            assert response.status == 200, path
            return response.read().decode(), response.headers
    titles = []; origin = None
    for path in PATHS:
        html, _ = read(path); doc = Document(); doc.feed(html)
        origin = origin or doc.meta['jishoo:origin']
        assert doc.canonical == [origin + path], (path, doc.canonical)
        assert doc.meta['robots'].startswith('index,')
        assert doc.meta['og:url'] == origin + path
        assert doc.meta['og:title'] == doc.title and doc.meta['twitter:title'] == doc.title
        assert 'data-prerendered="' + path + '"' in html
        assert len(''.join(doc.body)) > 800
        assert 'Switched to client rendering' not in html
        schemas = re.findall(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
        assert len(schemas) == 1; json.loads(schemas[0])
        titles.append(doc.title)
    assert len(set(titles)) == len(PATHS)
    sitemap, _ = read('/sitemap.xml')
    urls = [node.text for node in ET.fromstring(sitemap).iter('{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    assert set(urls) == {origin + path for path in PATHS}
    robots, _ = read('/robots.txt')
    assert 'User-agent: *' in robots and '\nAllow: /' in robots and f'Sitemap: {origin}/sitemap.xml' in robots
    assert '\nDisallow: /\n' not in robots
    guide, _ = read('/llms.txt'); facts, _ = read('/about.md')
    assert origin + '/about' in guide and origin + '/privacy' in guide
    assert 'not a medical' in guide and 'Phone login' in guide and 'not an automatic listening integration' in guide
    assert 'mutual acceptance' in facts and 'roughly 200-metre' in facts
    for path in ['/home', '/profile', '/admin', '/join', '/stories/checkin', '/app-shell.html']:
        html, headers = read(path); doc = Document(); doc.feed(html)
        assert 'noindex' in headers.get('X-Robots-Tag', ''), path
        assert doc.meta['robots'].startswith('noindex') and not doc.canonical, path
        assert 'data-prerendered' not in html
    print('PASS: Seven complete public HTML documents have unique metadata, canonicals and valid schema; crawler files contain only public documentation and account routes remain noindex.', flush=True)

    errors = []; posts = []; bootstrap = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM, headless=True, args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width':393,'height':852}, service_workers='block', java_script_enabled=False)
        verified_https(ctx); page = ctx.new_page()
        for path in PATHS:
            page.goto(BASE + path, wait_until='domcontentloaded')
            expect(page.locator('#root h1')).to_have_count(1)
            expect(page.locator('#root h1')).to_be_visible()
        page.goto(BASE + '/')
        expect(page.locator('.landing-header .landing-brand')).to_have_text('jishoo')
        expect(page.locator('.landing-hero-copy')).to_contain_text('ثبت دستی و اختیاری')
        expect(page.locator('.landing-footer a[href="/privacy"]')).to_be_visible()
        page.goto(BASE + '/privacy')
        page.get_by_role('link', name='Google sign-in & your data — English summary', exact=True).click()
        expect(page.locator('#google-data')).to_be_visible()
        assert page.url.endswith('/privacy#google-data')
        expect(page.locator('#google-data a[href="https://developers.google.com/terms/api-services-user-data-policy"]')).to_be_visible()
        expect(page.locator('#google-data a[href="https://myaccount.google.com/connections"]')).to_be_visible()
        expect(page.locator('#google-data a[href="/support"]').first).to_be_visible()
        page.goto(BASE + '/install')
        page.locator('details.install-steps > summary').click()
        assert page.locator('body').inner_text().find('Safari') >= 0
        assert page.locator('body').inner_text().find('Chrome') >= 0
        page.goto(BASE + '/about'); page.screenshot(path=str(ARTIFACTS/'seo-about-no-js.png'))
        ctx.close()
        print('PASS: All seven public pages remain readable without JavaScript, including the Android and iOS installation instructions.', flush=True)

        def mock(route):
            action = parse_qs(urlsplit(route.request.url).query).get('action',[''])[0]
            if action == 'support-send' and route.request.method == 'POST':
                posts.append(route.request.post_data_json); route.fulfill(json={'reference':'QA-SEO-123'})
            else:
                bootstrap.append(action); route.abort()
        ctx = browser.new_context(viewport={'width':393,'height':852}, service_workers='block', reduced_motion='reduce')
        verified_https(ctx); ctx.route('**/api/app?*', mock)
        page = ctx.new_page(); page.set_default_navigation_timeout(60000)
        page.on('pageerror', lambda error: errors.append(str(error)))
        for path in PATHS:
            page.goto(BASE + path, wait_until='networkidle')
            expect(page.locator('#root h1')).to_have_count(1)
            expect(page.locator('#root h1')).to_be_visible()
            assert len(page.locator('link[rel="canonical"]').all()) == 1
            assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth+1'), path
        assert not bootstrap, bootstrap
        page.goto(BASE + '/support', wait_until='networkidle')
        page.get_by_label('پیامت', exact=True).fill('آزمایش محلی فرم پشتیبانی پس از آماده‌سازی صفحه')
        page.get_by_label('راه تماس برای پاسخ (اختیاری)', exact=True).fill('qa@example.invalid')
        page.get_by_role('button', name='فرستادن پیام', exact=True).click()
        expect(page.get_by_role('status')).to_contain_text('QA-SEO-123')
        assert len(posts) == 1 and posts[0]['contact'] == 'qa@example.invalid'
        page.goto(BASE, wait_until='networkidle')
        assert page.locator('.landing-sample img').evaluate('e=>new URL(e.currentSrc).pathname.includes("landing-happy-v1-128")')
        page.screenshot(path=str(ARTIFACTS/'seo-landing-hydrated.png'))
        for width in [320, 1280]:
            page.set_viewport_size({'width':width,'height':852})
            assert page.evaluate('()=>document.documentElement.scrollWidth<=innerWidth+1')
            brand = page.locator('.landing-header .landing-brand').bounding_box()
            nav = page.locator('.landing-header nav').bounding_box()
            assert nav['x'] + nav['width'] <= brand['x'] + 1, (width, brand, nav)
        page.screenshot(path=str(ARTIFACTS/'google-branding-home-desktop.png'))
        page.goto(BASE + '/privacy#google-data', wait_until='networkidle')
        expect(page.locator('#google-data')).to_be_visible()
        page.screenshot(path=str(ARTIFACTS/'google-branding-privacy-english.png'))
        ctx.close()

        ctx = browser.new_context(viewport={'width':390,'height':844}, service_workers='block', user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1')
        verified_https(ctx); page = ctx.new_page(); page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(BASE + '/install', wait_until='networkidle')
        expect(page.get_by_role('heading',name='نصب روی آیفون و آیپد',exact=True)).to_be_visible()
        page.screenshot(path=str(ARTIFACTS/'seo-install-ios-emulated.png'))
        ctx.close(); browser.close()
    assert not errors, errors
    print('PASS: Public pages hydrate without errors, open no account sessions, keep the support form working through a mocked send, and show iOS guidance after device detection.', flush=True)


if __name__ == '__main__': main()
