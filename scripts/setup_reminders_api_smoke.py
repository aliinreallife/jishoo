"""Protected preview integration; only owned QA members, no provider messages."""
import json, os, secrets, subprocess, urllib.request, urllib.error
from security_release_smoke import google_member, client, fixture, owned, project
from api_smoke import BASE
from deploy_vercel import request

def main():
    if BASE=='https://jishoo.vercel.app':raise RuntimeError('Protected QA preview required')
    try:
        accounts=[google_member('آزمایش یادآوری '+str(n))[0] for n in range(4)]
        member=accounts[0];state=member.bootstrap();other=accounts[1].bootstrap()['me']
        assert state['me']['checkinReminders']=={'inApp':True,'push':False,'snoozedUntil':None}
        assert state['me']['createdAt'] and state['stats']['lastDoneAt'] is None
        guest=client();guest.call('reminder-prefs',{'push':True},expected=401)
        member.call('reminder-prefs',expected=405)
        for body in [{},{'push':'true'},{'inApp':1},{'snoozeDays':-1},{'snoozeDays':300}]:member.call('reminder-prefs',body,expected=400)
        prefs=member.call('reminder-prefs',{'push':True,'inApp':False,'snoozeDays':7,'userId':other['id']})['preferences']
        assert prefs['push'] and not prefs['inApp'] and prefs['snoozedUntil']
        assert accounts[1].bootstrap()['me']['checkinReminders']['push'] is False
        assert member.bootstrap()['me']['notificationsEnabled'] is True
        member.call('reminder-prefs',{'push':False,'inApp':True,'snoozeDays':0})
        old=member.bootstrap()['me']
        for links in [{'instagram':'https://x.com/ali'},{'telegram':'https://t.me/joinchat/abc'},{'x':'https://x.com/ali/status/1'},{'website':'https://127.0.0.1'}]:member.call('profile',{'socialLinks':links},expected=400)
        new=member.call('profile',{'socialLinks':{'instagram':'@ali.real','telegram':'@AliInRealLife','x':'http://twitter.com/AliInRealLife_?tracking=1','website':'example.org/about'}})['me']
        assert new['socialLinks']=={'instagram':'https://www.instagram.com/ali.real','telegram':'https://t.me/AliInRealLife','x':'https://x.com/AliInRealLife_','website':'https://example.org/about'}
        assert new['name']==old['name'] and new['handle']==old['handle']
        assert member.call('profile',{'name':old['name']})['me']['socialLinks']==new['socialLinks']
        print('PASS: Real API enforces member-only POST preferences, validates fields, scopes changes to self and normalizes safe social links without changing identity.',flush=True)
        cfg=request(f"/v3/env/pull/{project['projectId']}?target=development&teamId={project['orgId']}")['env']
        ids=[a.bootstrap()['me']['id'] for a in accounts]
        subprocess.run(['node','--use-system-ca','--use-env-proxy','scripts/reminders_sql_smoke.mjs'],env={**os.environ,'DATABASE_URL':cfg['DATABASE_URL'],'JISHOO_QA_IDS':json.dumps(ids)},check=True,timeout=90)
        # Exercise the changed merge SQL with a fictional legacy phone account;
        # no OTP, actual phone ownership claim, or admin privilege is involved.
        source=client();phone=f'+1{secrets.randbelow(789)+201}55501{secrets.randbelow(100):02}'
        fixture(source,'legacy-phone',phone=phone)
        source.call('reminder-prefs',{'inApp':False,'push':False,'snoozeDays':7})
        member.call('reminder-prefs',{'inApp':True,'push':True,'snoozeDays':0})
        fixture(source,'merge-proof',targetId=ids[0])
        source.call('account-merge-confirm',{'confirmed':False},expected=400)
        source.call('account-merge-confirm',{'confirmed':True})
        merged=source.bootstrap()
        assert merged['me']['checkinReminders']['inApp'] is False and merged['me']['checkinReminders']['push'] is False
        assert merged['me']['checkinReminders']['snoozedUntil']
        assert merged['auth']['googleConnected'] and merged['auth']['phoneNumber']==phone
        print('PASS: A real explicit account merge preserves reminder opt-outs and snooze, and retains the linked Google/legacy-phone identity.',flush=True)
        for method,expected in [('GET',401),('POST',405)]:
            req=urllib.request.Request(BASE+'/api/reminders',method=method,headers={'x-vercel-protection-bypass':os.environ['JISHOO_TEST_BYPASS_SECRET']})
            try:response=urllib.request.urlopen(req,timeout=45)
            except urllib.error.HTTPError as error:response=error
            with response:assert response.status==expected,(method,response.status)
        print('PASS: Deployed cron rejects unauthenticated GET and all POST requests; no real pushes were sent.',flush=True)
    finally:
        for account in reversed(owned):
            if account.owned_id:account.call('delete-account',{})
        print('Removed only owned reminder QA accounts.',flush=True)

if __name__=='__main__':main()
