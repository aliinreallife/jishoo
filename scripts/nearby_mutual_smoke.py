"""Real owned-account integration checks on a protected preview fixture.

No push subscriptions are created; real inbox fan-out is checked without sending
messages to anyone's devices. QA locations are isolated in the open Pacific.
"""
import json
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlencode
from security_release_smoke import google_member, connect, owned
from api_smoke import Client


def main():
    def notes(client, kind): return [n for n in client.bootstrap()['notifications'] if n['kind']==kind]
    def wait_for(test, label):
        deadline=time.monotonic()+15
        while time.monotonic()<deadline:
            if test(): return
            time.sleep(.3)
        raise AssertionError(label)
    def done(client, private=False, nonce=None):
        return client.call('checkin',{'status':'done','visibility':'private' if private else 'friends','nonce':nonce or secrets.token_hex(12)})
    try:
        a,sa=google_member('آزمایش هم‌زمانی اول')
        b,sb=google_member('آزمایش هم‌زمانی دوم')
        c,sc=google_member('آزمایش دور از محله')
        d,sd=google_member('آزمایش ثبت خصوصی')
        saved_links=sa['me']['socialLinks']
        assert a.call('profile',{'name':sa['me']['name']})['me']['socialLinks']==saved_links,'Separate profile settings must preserve social accounts'
        lat=3+secrets.randbelow(100)/1000;lng=-141+secrets.randbelow(100)/1000
        for client,delta in [(a,0),(b,.002),(c,.3),(d,.001)]:
            client.call('map-visibility',{'mode':'news','lat':lat+delta,'lng':lng})
        done(c);done(d,True);done(a)
        nonce=secrets.token_hex(12);result=done(b,nonce=nonce)
        assert not result['matches'], 'Non-friends must not create named friend memories'
        wait_for(lambda:len(notes(a,'nearby-moment'))==len(notes(b,'nearby-moment'))==1,'Both anonymous inboxes')
        for client in [a,b]:
            n=notes(client,'nearby-moment')[0]
            text=json.dumps(n,ensure_ascii=False)
            assert n['route']=='/nearby'
            for member in [sa,sb]:
                for key in ['id','name','handle']:assert member['me'][key] not in text
            assert not client.bootstrap()['moments'], 'Anonymous coincidences must not expose a profile memory'
        assert not notes(c,'nearby-moment') and not notes(d,'nearby-moment')
        assert done(b,nonce=nonce)['event']['id']==result['event']['id']
        with ThreadPoolExecutor(max_workers=2) as pool:list(pool.map(done,[a,b]))
        time.sleep(1)
        assert len(notes(a,'nearby-moment'))==len(notes(b,'nearby-moment'))==1
        print('PASS: Nearby non-friends notify both anonymously; distance/private filtering, retries and simultaneous repeated taps do not expose identities or duplicate alerts.',flush=True)
        params=urlencode({'south':lat-.04,'north':lat+.04,'west':lng-.04,'east':lng+.04,'zoom':14})
        action='world-map&'+params
        world=a.call(action)
        assert world['inView']==2,world['inView']
        for member in [sa,sb,sc,sd]:
            for key in ['id','name','handle']:assert member['me'][key] not in json.dumps(world,ensure_ascii=False)
        with ThreadPoolExecutor(max_workers=30) as pool:worlds=list(pool.map(lambda _:a.call(action),range(30)))
        assert all(w['activity']==world['activity'] for w in worlds)
        b.call('map-visibility',{'mode':'hidden'})
        assert a.call(action)['inView']==1,'Hiding must invalidate the shared snapshot'
        guest=Client();owned.append(guest);guest.bootstrap();guest.call(action,expected=401)
        a.call('world-map&north=NaN',expected=400)
        print('PASS: Thirty concurrent world-map reads share anonymous results; hidden/private points are excluded, hiding invalidates the cache and guests cannot use the premium endpoint.',flush=True)
        connect(a,b)
        done(a);done(b)
        wait_for(lambda:len(notes(a,'friend-moment'))==len(notes(b,'friend-moment'))==1,'Both friend inboxes')
        assert not notes(a,'checkin') and not notes(b,'checkin'),'A mutual alert replaces a redundant ordinary check-in alert'
        connect(a,c)
        c.call('notification-pref',{'scope':'friend','id':sa['me']['id'],'enabled':False})
        done(c)
        wait_for(lambda:len(notes(a,'friend-moment'))==2,'Unmuted participant still notified')
        assert not notes(c,'friend-moment'),'Friend mute must remain effective'
        print('PASS: Both friend participants receive mutual notices regardless of distance; per-friend mutes are respected and ordinary duplicates are suppressed.',flush=True)
    finally:
        for client in reversed(owned):
            client.call('delete-account',{})


if __name__=='__main__':main()
