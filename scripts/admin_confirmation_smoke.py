"""Real server confirmation and authorization checks using owned QA accounts."""
from security_release_smoke import google_member,owned


def main():
    try:
        admin,state=google_member('آزمایش مدیر تایید',admin=True)
        member,person=google_member('آزمایش گیرنده هدیه')
        change={'id':person['me']['id'],'operation':'lifetime','enabled':True}
        for payload in [change,{**change,'confirmed':False}]:
            assert admin.call('admin-user',payload,expected=400)['error']=='confirmation_required'
        assert not member.bootstrap()['me']['lifetime']
        member.call('admin-user',{**change,'confirmed':True},expected=403)
        admin.call('admin-user',{**change,'confirmed':True})
        assert member.bootstrap()['me']['lifetime']
        assert admin.call('admin-invite',{'giftLifetime':True},expected=400)['error']=='confirmation_required'
        gift=admin.call('admin-invite',{'giftLifetime':True,'confirmed':True})
        offer=member.call('invite&code='+gift['code'])
        assert offer['lifetimeGift'] and offer['remaining']==1
        admin.call('admin-invite-revoke',{'code':gift['code']},expected=400)
        assert member.call('invite&code='+gift['code'])['remaining']==1
        admin.call('admin-invite-revoke',{'code':gift['code'],'confirmed':True})
        member.call('invite&code='+gift['code'],expected=404)
        suspend={**change,'operation':'suspend'}
        admin.call('admin-user',suspend,expected=400)
        admin.call('admin-user',{**suspend,'confirmed':True})
        member.call('bootstrap',expected=403)
        admin.call('admin-user',{**suspend,'enabled':False,'confirmed':True})
        assert member.bootstrap()['me']['registered']
        admin.call('admin-recovery',{},expected=400)
        result=admin.call('admin-recovery',{'confirmed':True})
        assert '/admin?adminAccess=' in result['url']
        print('PASS: Server rejects unconfirmed sensitive changes and unauthorized callers. Confirmed lifetime grants, single-use gifts, revocation, suspension/reactivation and private recovery work on owned accounts.',flush=True)
    finally:
        for client in reversed(owned):client.call('delete-account',{})


if __name__=='__main__':main()
