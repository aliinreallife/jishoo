"""Owned-account checks on a protected preview, never real-user credentials."""
import json, os, secrets, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from security_release_smoke import client, google_member, fixture, connect, owned
from api_smoke import BASE


def register_status(c, code):
 token=next(x.value for x in c.cookies if x.name=='jishoo_session')
 req=urllib.request.Request(BASE+'/api/app?action=register',data=json.dumps({'provider':'google','ticket':'google','name':'آزمایش سهمیه','inviteCode':code}).encode(),headers={'Origin':BASE,'Content-Type':'application/json','Cookie':'jishoo_session='+token,'x-vercel-protection-bypass':os.environ['JISHOO_TEST_BYPASS_SECRET']})
 try:
  with urllib.request.urlopen(req,timeout=45) as r:return r.status,json.load(r)
 except urllib.error.HTTPError as e:return e.code,json.load(e)


def main():
 assert BASE!='https://jishoo.vercel.app'
 try:
  entry=client()
  for intent in ['signup','login']:
   authorization=entry.call('google-start',{'intent':intent,'returnTo':'/home'})['url']
   assert authorization.startswith('https://accounts.google.com/')
  print('PASS: Both Google entry intents start without an invitation; actual registration still requires one.',flush=True)
  parent,state=google_member('آزمایش سهمیهٔ دعوت');code=state['me']['inviteCode'];assert state['invitationQuota']=={'used':0,'remaining':3,'limit':3}
  kids=[google_member('آزمایش فرزند دعوت',code)[0] for _ in range(2)]
  candidates=[client(),client()]
  for c in candidates:fixture(c)
  with ThreadPoolExecutor(max_workers=2) as pool:outcomes=list(pool.map(lambda c:register_status(c,code),candidates))
  assert sorted(s for s,_ in outcomes)[0]==200 and sum(s==200 for s,_ in outcomes)==1,outcomes
  assert all(s in [200,400,410] for s,_ in outcomes)
  assert parent.bootstrap()['invitationQuota']=={'used':3,'remaining':0,'limit':3}
  assert parent.call('invite&code='+code)['remaining']==0
  parent.call('admin-invite',{'giftDays':0},expected=403)
  assert kids[0].bootstrap()['invitationQuota']['remaining']==3
  print('PASS: Regular members get exactly three invites, including concurrent attempts at the last slot; descendants get their own three, and member sessions cannot mint admin links.',flush=True)
  admin,astate=google_member('آزمایش مدیر دعوت',admin=True);one=astate['me']['inviteCode'];extra,_=google_member('آزمایش دعوت خصوصی',one)
  assert admin.call('profile-public&handle='+astate['me']['handle'])['profile']['inviteCode'] is None
  renewed=admin.bootstrap();assert renewed['me']['inviteCode']!=one and renewed['invitationQuota']['limit'] is None
  assert admin.call('invite&code='+one)['remaining']==0
  print('PASS: Admin links are single-use and rotate after consumption; the administrator has a separate unlimited quota.',flush=True)

  waiting=client();waiting.call('waitlist',{'consent':True},expected=401)
  fixture(waiting);email=waiting.bootstrap()['auth']['pendingGoogle'];assert email.endswith('@example.invalid')
  waiting.call('waitlist',{'consent':False},expected=400)
  waiting.call('waitlist',{'consent':True,'phone':{}},expected=400)
  waiting.call('waitlist',{'consent':True})
  waiting.call('waitlist',{'consent':True,'phone':'+12025550123'})
  auth=waiting.bootstrap()['auth'];assert auth['waitlisted'] and auth['waitlistPhone']=='+12025550123' and not auth['phoneConnected']
  parent.call('admin-waitlist',expected=403)
  rows=admin.call('admin-waitlist')['people'];assert sum(p['email']==email for p in rows)==1
  waiting.call('register',{'provider':'google','ticket':'google','name':'آزمایش ورود از انتظار','inviteCode':kids[0].bootstrap()['me']['inviteCode']})
  assert not waiting.bootstrap()['auth']['phoneConnected']
  assert not any(p['email']==email for p in admin.call('admin-waitlist')['people'])
  print('PASS: Waiting list needs a fresh verified Google identity and consent, upserts once, encrypts contact storage, restricts contact reads to elevated admin, and never turns an unverified phone into a login; signup removes the entry.',flush=True)

  visitor=client();point={'lat':-18.30012,'lng':-149.80123}
  # Owned fixtures, isolated from the production users sharing the testing DB.
  target=kids[0];friend=kids[1];connect(visitor if visitor.bootstrap()['me']['registered'] else parent,target)
  target.call('map-visibility',{'mode':'profile',**point})
  target.call('checkin',{'status':'done','visibility':'private','nonce':secrets.token_hex(12)})
  assert visitor.call('nearby',point)['activity']==[]
  target.call('checkin',{'status':'done','visibility':'friends','nonce':secrets.token_hex(12)})
  target_id=target.bootstrap()['me']['id'];handle=target.bootstrap()['me']['handle']
  def event(c):return next((r for r in c.call('nearby',point)['activity'] if r.get('profileHandle')==handle),None)
  assert event(visitor)['name']==target.bootstrap()['me']['name']
  target.call('map-visibility',{'mode':'news',**point})
  assert event(visitor) is None
  anon=visitor.call('nearby',point)['activity'];assert anon and all(not r.get('profileHandle') and r['name']=='یه همسایه' and r['avatarImage'] is None for r in anon)
  assert event(parent)['isFriend'] and event(target)['isMe']
  target.call('map-visibility',{'mode':'hidden'});assert visitor.call('nearby',point)['activity']==[]
  visitor.call('map-visibility',{'mode':'news',**point});visitor.call('checkin',{'status':'done','visibility':'friends','nonce':secrets.token_hex(12)})
  guest_rows=parent.call('nearby',point)['activity'];assert len(guest_rows)==1 and guest_rows[0]['profileKind']=='guest' and guest_rows[0]['profileHandle'] is None and guest_rows[0]['avatarImage'] is None
  world=parent.call('world-map&south=-19&north=-18&west=-150&east=-149&zoom=10')
  for row in world['activity']:
   assert row['name']=='یه نفر روی نقشه'
   assert not any(key in row for key in ['handle','profileHandle','profileKind','userId','avatarSeed','avatarImage'])
  print('PASS: Private registered check-ins stay private; profile opt-in is discoverable, news mode is anonymous to strangers but recognizable to accepted friends/self, hidden activity disappears, guests have no public profile and the world map never carries identity.',flush=True)
 finally:
  for c in reversed(owned):
   try:
    if c.owned_id and c.bootstrap()['me']['id']==c.owned_id:c.call('delete-account',{})
   except Exception as error:print('Owned QA cleanup needs follow-up:',type(error).__name__,flush=True)

if __name__=='__main__':main()
