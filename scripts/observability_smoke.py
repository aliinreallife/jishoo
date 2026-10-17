"""Exercise the enabled production SDK adapters without provider delivery.

Build with both VITE_VERCEL_*_ENABLED=true, serve on JISHOO_BASE_URL, and run
against the real QA API bridge. Only the external provider scripts are stubbed.
"""
from playwright.sync_api import sync_playwright, expect
from api_smoke import Client
from smoke import BASE, CHROMIUM, context


def main():
    guest = Client()
    guest.bootstrap()
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
        try:
            ctx,page = context(browser)
            token = next(c.value for c in guest.cookies if c.name == 'jishoo_session')
            ctx.add_cookies([{'name':'jishoo_session','value':token,'url':BASE,'httpOnly':True,'sameSite':'Lax'}])
            ctx.add_init_script("localStorage.setItem('jishoo:v2-entered','true');localStorage.setItem('jishoo:last-seen-release','0.3.0')")
            page.route('**/_vercel/insights/script.js',lambda route:route.fulfill(content_type='application/javascript',body="""
              window.qaViews=[];
              window.va=(kind,data)=>{if(kind==='beforeSend')window.qaAnalyticsFilter=data;
                if(kind==='pageview')window.qaViews.push({route:data.route,path:data.path,
                  filtered:window.qaAnalyticsFilter({type:'pageview',url:new URL(data.path,location.origin).href})});};
              for(const args of window.vaq||[])window.va(...args);
            """))
            page.route('**/_vercel/speed-insights/script.js',lambda route:route.fulfill(content_type='application/javascript',body="""
              window.si=(kind,data)=>{if(kind==='beforeSend')window.qaSpeedFilter=data;};
              for(const args of window.siq||[])window.si(...args);
            """))
            errors=[]
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(BASE+'/#/home')
            page.wait_for_function("() => window.qaViews?.length > 0 && typeof window.qaSpeedFilter === 'function'")
            expect(page.locator('script[src="/_vercel/insights/script.js"]')).to_have_attribute('data-disable-auto-track','1')
            speed=page.locator('script[src="/_vercel/speed-insights/script.js"]')
            expect(speed).to_have_attribute('data-sample-rate','0.1')
            page.evaluate("location.hash='/stats'")
            page.wait_for_function("() => window.qaViews.some(v=>v.path==='/app/stats')")
            expect(speed).to_have_attribute('data-route','/app/stats')
            page.evaluate("history.replaceState(history.state,'', '/join?invite=PRIVATE-INVITATION');dispatchEvent(new PopStateEvent('popstate',{state:history.state}))")
            page.wait_for_function("() => window.qaViews.some(v=>v.path==='/invite')")
            views=page.evaluate('window.qaViews')
            assert all('PRIVATE' not in str(v) and '?' not in v['filtered']['url'] for v in views),views
            vital=page.evaluate("window.qaSpeedFilter({type:'vital',url:location.origin+'/u/private_handle?invite=PRIVATE',route:'/u/private_handle',name:'LCP',value:1200})")
            assert vital['route']=='/invite' and vital['url']==BASE+'/invite',vital
            count=len(views)
            page.evaluate("history.replaceState(history.state,'', '/admin?adminAccess=PRIVATE-ADMIN');dispatchEvent(new PopStateEvent('popstate',{state:history.state}))")
            page.wait_for_function("() => location.pathname==='/admin'")
            assert page.evaluate("window.qaAnalyticsFilter({type:'pageview',url:location.href})") is None
            assert page.evaluate("window.qaSpeedFilter({type:'vital',url:location.href,route:'/admin',name:'LCP',value:1})") is None
            assert len(page.evaluate('window.qaViews'))==count
            assert not errors,errors
            print('PASS: Enabled production build injects both React SDKs, tracks clean and legacy routes, samples vitals at 10%, strips private URLs and suppresses admin metrics. Provider scripts were local stubs; no metrics were delivered.',flush=True)
            ctx.close()
        finally:
            guest.call('delete-account',{})
            browser.close()


if __name__=='__main__':main()
