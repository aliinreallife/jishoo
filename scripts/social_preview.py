from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1200,'height':630},device_scale_factor=1)
 page.goto('http://127.0.0.1:4173')
 page.set_content('''<!doctype html><html lang="fa" dir="rtl"><head><style>@font-face{font-family:Vazir;src:url('/node_modules/@fontsource/vazirmatn/files/vazirmatn-arabic-700-normal.woff2')}@font-face{font-family:Lalezar;src:url('/node_modules/@fontsource/lalezar/files/lalezar-arabic-400-normal.woff2')}*{box-sizing:border-box}body{margin:0;background:#fff9e4;color:#27283d;font-family:Vazir;width:1200px;height:630px;overflow:hidden}.card{position:relative;display:flex;align-items:center;justify-content:space-between;margin:22px;border:2px solid #e8dfc9;border-radius:40px;width:1156px;height:586px;padding:48px 70px;background:radial-gradient(ellipse at 15% 65%,#ffed9caa,transparent 60%)}.copy{width:550px;position:relative;z-index:2}.brand{font-family:Lalezar;font-size:110px;line-height:1.1;margin:0}.brand span{font-size:30px;color:#e9bd45;vertical-align:middle;margin-right:15px}.line{font-size:37px;line-height:1.9;margin:20px 0 9px}.sub{font-size:22px;line-height:1.9;color:#756d66}.url{margin-top:35px;font-size:17px;letter-spacing:2px;color:#746f88;text-align:right}.art{width:460px;height:500px;object-fit:contain;position:absolute;left:38px;bottom:5px}.star{position:absolute;color:#f0c343;font-size:52px;left:45px;top:44px}.dot{position:absolute;left:439px;top:120px;color:#aaa0df;font-size:35px}</style></head><body><div class="card"><div class="copy"><h1 class="brand">جیشو<span>♥</span></h1><div class="line">یه لحظه از روزت،<br>برای دوستات.</div><div class="sub">یه خبر کوچولو،<br>یه بهونه برای با هم بودن.</div><div class="url" dir="ltr">jishoo.vercel.app</div></div><span class="star">✦</span><span class="dot">✧</span><img class="art" src="/assets/shy-drop.webp" alt="قطره خجالتی جیشو"></div></body></html>''')
 page.evaluate('document.fonts.ready')
 page.locator('img').evaluate('(img)=>img.decode()')
 page.screenshot(path=str(root/'public/assets/social-shy-v3.png'))
 b.close()
