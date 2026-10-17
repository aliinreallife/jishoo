"""Verify mutual link consent and single-use premium gifts with disposable accounts."""
import concurrent.futures
import secrets
from api_smoke import Client
from provision_admin import create_invite
from auth_integration import seed
import os

clients=[]
def account(code,name,extra=None):
    client=Client();clients.append(client);_,ticket=client.new_ticket()
    result=client.call('register',{'ticket':ticket,'name':name,'inviteCode':code,**(extra or {})})
    return client,result

def main():
    try:
        admin,root=account(create_invite('qa-admin')['code'],'مدیر آزمایش هدیه')
        for bad in [{'giftDays':-1},{'giftDays':1.5},{'giftDays':3651},{'giftDays':30,'giftLifetime':True},{'giftLifetime':'true'}]:
            admin.call('admin-invite',bad,expected=400)
        gift=admin.call('admin-invite',{'giftDays':30})['code']
        info=admin.call('invite&code='+gift);assert info['bonusDays']==30 and not info['lifetimeGift'] and info['remaining']==1
        a,ra=account(gift,'آزمایش هدیه مدت‌دار');assert ra['me']['trialDaysSaved']==30 and ra['me']['trialUntil'] is None and not ra['me']['lifetime'] and not ra['me']['isAdmin']
        reuse=Client();clients.append(reuse);_,ticket=reuse.new_ticket();reuse.call('register',{'ticket':ticket,'name':'آزمایش استفاده دوباره','inviteCode':gift},expected=410)
        life=admin.call('admin-invite',{'giftLifetime':True})['code'];b,rb=account(life,'آزمایش هدیه همیشگی');assert rb['me']['lifetime'] and rb['me']['trialDaysSaved']==0 and not rb['me']['isAdmin']
        normal=admin.call('admin-invite',{})['code'];c,rc=account(normal,'آزمایش ناظر',{'giftDays':3650,'giftLifetime':True});assert rc['me']['trialDaysSaved']==7 and not rc['me']['lifetime']
        c.call('admin-invite',{'giftLifetime':True},expected=403)
        print('PASS: Only elevated admins issue bounded day/lifetime gifts; invite previews report them; signup grants exactly the stored gift; reuse and forged signup entitlements are rejected.',flush=True)
        if os.environ.get('JISHOO_TEST_BYPASS_SECRET'):
            g=Client();clients.append(g);seed(g);code=admin.call('admin-invite',{'giftDays':90})['code']
            r=g.call('register',{'provider':'google','ticket':'google','name':'آزمایش هدیه گوگل','inviteCode':code});assert r['auth']['googleConnected'] and not r['auth']['phoneConnected'] and r['me']['trialDaysSaved']==90
            print('PASS: Google-first registration without a phone receives the stored subscription gift atomically.',flush=True)
        code=admin.call('admin-invite',{'giftDays':365})['code'];contenders=[]
        for name in ['آزمایش همزمان یک','آزمایش همزمان دو']:
            candidate=Client();clients.append(candidate);_,ticket=candidate.new_ticket();contenders.append((candidate,{'ticket':ticket,'name':name,'inviteCode':code}))
        def claim(item):
            client,body=item
            try:
                result=client.call('register',body);assert result['me']['trialDaysSaved']==365;return True
            except AssertionError as e:
                detail=e.args[0];assert isinstance(detail,tuple) and detail[0]=='register' and detail[1] in (400,410),e;return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:assert sum(pool.map(claim,contenders))==1
        print('PASS: Concurrent signups consume a premium invitation once and grant exactly one subscription.',flush=True)
        a.call('profile',{'socialLinks':{'instagram':'jishoo_test'}});b.call('profile',{'socialLinks':{'telegram':'jishoo_test'}})
        a.call('connection-request',{'handle':rb['me']['handle']});relation=b.bootstrap()['friends'][0];rid=relation['connectionId'];b.call('connection-respond',{'id':rid,'accept':True})
        def friend(client):return next(f for f in client.bootstrap()['friends'] if f['connectionId']==rid)
        def hidden():
            for client in (a,b):assert friend(client)['socialLinks']=={} and friend(client)['status']=='accepted'
        def op(client,operation,status=200):return client.call('connection-share',{'id':rid,'operation':operation},expected=status)
        for operation in ['request','accept','decline','disconnect']:op(c,operation,404)
        op(a,'accept',409);op(a,'request');hidden();assert friend(a)['linkConnection']=='outgoing' and friend(b)['linkConnection']=='incoming'
        op(a,'accept',409);op(a,'request',409);hidden();op(b,'decline');hidden();op(b,'accept',409)
        op(a,'request');op(a,'cancel');op(b,'accept',409);hidden()
        op(b,'request');op(a,'accept');assert friend(a)['socialLinks']['telegram']=='https://t.me/jishoo_test' and friend(b)['socialLinks']['instagram'].endswith('/jishoo_test')
        op(a,'disconnect');hidden();assert friend(a)['linkConnection']==friend(b)['linkConnection']=='none'
        op(b,'accept',409);op(a,'request');hidden();op(b,'accept');op(b,'disconnect');hidden()
        print('PASS: Links require one request and the other person’s acceptance; self/stale/outsider acceptance fails; decline/cancel/disconnect remove both grants while friendship remains.',flush=True)
    finally:
        deleted=set()
        for client in clients:
            try:
                me=client.bootstrap()['me']
                if me['id'] not in deleted:client.call('delete-account',{});deleted.add(me['id'])
            except Exception as e:print('Owned consent/gift cleanup:',type(e).__name__,flush=True)
if __name__=='__main__':main()
