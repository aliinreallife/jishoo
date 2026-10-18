"""Exercise the empty-social-account reminder with real owned QA members.

Requires the protected preview identity fixture. All accounts are deleted.
"""
from playwright.sync_api import sync_playwright, expect
from security_release_smoke import google_member, connect, page_for, owned
from smoke import BASE, CHROMIUM, capture


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=CHROMIUM,headless=True,args=['--no-sandbox'])
        try:
            sender,s=google_member('آزمایش سارا')
            recipient,r=google_member('آزمایش نیما')
            outsider,o=google_member('آزمایش همسایه')
            recipient.call('profile',{'socialLinks':{}})
            connect(sender,recipient);connect(recipient,outsider)
            print('QA: Three owned members connected; recipient has no social accounts.',flush=True)
            relation=next(f for f in recipient.bootstrap()['friends'] if f['id']==s['me']['id'])
            def request():sender.call('connection-share',{'id':relation['connectionId'],'operation':'request'})
            ctx,page=page_for(browser,recipient)
            errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
            def incoming():
                page.goto(BASE+'/#/friends')
                page.reload()
                page.locator('.link-request-notice').click()
                expect(page.locator('.social-incoming')).to_be_visible(timeout=20000)
                expect(page.locator('.social-setup-reminder')).to_have_count(0)
            request();incoming()
            page.get_by_role('button',name='فعلاً نه',exact=True).click()
            expect(page.locator('.social-none')).to_be_visible()
            expect(page.locator('.social-setup-reminder')).to_have_count(0)
            request();incoming()
            page.get_by_role('button',name='قبول درخواست',exact=True).click()
            prompt=page.get_by_role('dialog',name='هنوز حسابی اضافه نکردی',exact=True)
            expect(prompt).to_be_visible(timeout=20000)
            expect(prompt.get_by_role('button',name='افزودن حساب‌های من',exact=True)).to_be_focused()
            assert next(f for f in recipient.bootstrap()['friends'] if f['id']==s['me']['id'])['linkConnection']=='connected'
            assert recipient.bootstrap()['me']['socialLinks']=={}
            for width,height in [(393,852),(320,568),(812,375),(1440,900)]:
                page.set_viewport_size({'width':width,'height':height})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
                for label in ['افزودن حساب‌های من','فعلاً نه']:
                    button=prompt.get_by_role('button',name=label,exact=True)
                    button.scroll_into_view_if_needed();box=button.bounding_box()
                    assert box['x']>=0 and box['y']>=0 and box['x']+box['width']<=width+1 and box['y']+box['height']<=height+1,(width,label,box)
                capture(page,f'social-setup-reminder-{width}.png')
            page.set_viewport_size({'width':393,'height':852})
            prompt.get_by_role('button',name='فعلاً نه',exact=True).click()
            expect(page.locator('.social-connected')).to_be_visible()
            assert page.get_by_role('dialog').evaluate('e=>e.contains(document.activeElement)')
            page.reload();expect(page.locator('.social-setup-reminder')).to_have_count(0)
            # A new, explicit successful acceptance prompts again; viewing or
            # declining a request never does. Skipping never revokes consent.
            recipient.call('connection-share',{'id':relation['connectionId'],'operation':'disconnect'})
            request();incoming();page.get_by_role('button',name='قبول درخواست',exact=True).click()
            page.get_by_role('button',name='افزودن حساب‌های من',exact=True).click()
            editor=page.get_by_role('dialog',name='من تو شبکه‌های اجتماعی',exact=True)
            expect(editor).to_be_visible()
            expect(editor.locator('input')).to_have_count(5,timeout=20000)
            expect(page.locator('#social-accounts-title')).to_be_focused()
            page.get_by_label('اینستاگرام',exact=True).fill('not_saved')
            editor.get_by_role('button',name='برگشت',exact=True).click()
            assert recipient.bootstrap()['me']['socialLinks']=={}
            page.get_by_role('button',name='اول لینک‌های خودم رو اضافه کنم',exact=True).click()
            page.get_by_label('اینستاگرام',exact=True).fill('qa_social_account')
            page.get_by_label('وب‌سایت',exact=True).fill('javascript:alert(1)')
            expect(page.get_by_role('button',name='ذخیره حساب‌ها',exact=True)).to_be_disabled()
            expect(page.get_by_label('وب‌سایت',exact=True)).to_have_attribute('aria-invalid','true')
            expect(page.locator('.social-field-error')).to_be_visible()
            expect(editor).to_be_visible()
            assert recipient.bootstrap()['me']['socialLinks']=={}
            page.get_by_label('وب‌سایت',exact=True).fill('')
            page.get_by_label('اسپاتیفای',exact=True).fill('spotify:user:qa.music')
            capture(page,'social-accounts-editor.png')
            page.get_by_role('button',name='ذخیره حساب‌ها',exact=True).click()
            expect(page.locator('.social-connected')).to_be_visible(timeout=20000)
            saved=recipient.bootstrap()['me']
            assert saved['name']==r['me']['name'] and saved['handle']==r['me']['handle']
            assert 'qa_social_account' in saved['socialLinks']['instagram']
            assert saved['socialLinks']['spotify']=='https://open.spotify.com/user/qa.music'
            assert next(f for f in sender.bootstrap()['friends'] if f['id']==r['me']['id'])['socialLinks']==saved['socialLinks']
            assert next(f for f in outsider.bootstrap()['friends'] if f['id']==r['me']['id'])['socialLinks']=={}
            sender_ctx,sender_page=page_for(browser,sender)
            sender_page.goto(BASE+'/friends');sender_page.locator('.connected-card').first.click()
            spotify_link=sender_page.get_by_role('link',name='اسپاتیفای',exact=False)
            expect(spotify_link).to_have_attribute('href','https://open.spotify.com/user/qa.music')
            expect(spotify_link).to_be_visible();sender_ctx.close()
            recipient.call('connection-share',{'id':relation['connectionId'],'operation':'disconnect'})
            request();incoming();page.get_by_role('button',name='قبول درخواست',exact=True).click()
            expect(page.locator('.social-connected')).to_be_visible()
            expect(page.locator('.social-setup-reminder')).to_have_count(0)
            page.keyboard.press('Escape');page.goto(BASE+'/#/profile')
            page.get_by_role('button',name='من تو شبکه‌های اجتماعی',exact=False).click()
            expect(page.get_by_label('اینستاگرام',exact=True)).to_have_value('@qa_social_account')
            expect(page.get_by_label('اسپاتیفای',exact=True)).to_have_value('@qa.music')
            assert not errors,errors
            print('PASS: Empty-profile acceptance opens the responsive reminder; decline/view/filled profiles do not. Skip retains consent, cancel discards drafts, the short editor rejects unsafe links and saves without changing name/handle. Only mutually accepted friends see added accounts; full profile settings still show them.',flush=True)
            ctx.close()
        finally:
            for owner in reversed(owned):owner.call('delete-account',{})
            browser.close()


if __name__=='__main__':main()
