"""Owned QA accounts on a protected preview: actual map authorization and freshness."""
import secrets,time
from security_release_smoke import client,google_member,owned
from api_smoke import BASE

def main():
 assert BASE!='https://jishoo.vercel.app'
 p={'lat':-18.30012,'lng':-149.80123}
 try:
  viewer,v=google_member('آزمایش بیننده نقشه');target,t=google_member('آزمایش صاحب نقشه',v['me']['inviteCode']);guest=client()
  target.call('map-visibility',{'mode':'profile',**p})
  target.call('checkin',{'status':'done','visibility':'friends','nonce':secrets.token_hex(12)})
  rows=viewer.call('nearby',p)['activity'];assert len(rows)==1;first=rows[0];assert first['profileHandle']==t['me']['handle'] and first['name']==t['me']['name'] and not first['isFriend']
  assert guest.call('nearby',p)['activity'][0]['profileHandle']==t['me']['handle']
  own=target.call('nearby',p)['activity'][0];assert own['isMe'] and own['profileHandle']==t['me']['handle']
  # Seed the shared snapshot, then change status. The next fetch must not reuse it.
  box='world-map&south=-19&north=-18&west=-150&east=-149&zoom=10'
  assert viewer.call(box)['activity'][0]['status']=='done'
  started=time.monotonic();event=target.call('checkin',{'status':'need','visibility':'friends','nonce':secrets.token_hex(12)})['event']
  fresh=viewer.call('nearby',p)['activity'][0];assert fresh['status']=='need' and fresh['id']==event['id'] and fresh['markerKey']==first['markerKey']
  assert viewer.call(box)['activity'][0]['status']=='need'
  print('PASS: Own/opted-in public profiles are openable, event keys remain stable, local and world APIs expose the saved status on the next request. Check-in + both reads %.2fs.'%(time.monotonic()-started),flush=True)
  target.call('map-visibility',{'mode':'news',**p})
  anon=viewer.call('nearby',p)['activity'][0];assert anon['profileHandle'] is None and anon['profileKind']=='anonymous' and anon['avatarImage'] is None and anon['name']=='یه همسایه'
  viewer.call('connection-request',{'handle':t['me']['handle']})
  assert viewer.call('nearby',p)['activity'][0]['profileHandle'] is None
  pending=next(f for f in target.bootstrap()['friends'] if f['id']==v['me']['id']);target.call('connection-respond',{'id':pending['connectionId'],'accept':True})
  friend=viewer.call('nearby',p)['activity'][0];assert friend['isFriend'] and friend['profileHandle']==t['me']['handle']
  assert guest.call('nearby',p)['activity'][0]['profileHandle'] is None
  # Breaking friendship must revoke the exception while retaining anonymity.
  viewer.call('connection-respond',{'id':pending['connectionId'],'accept':False})
  assert viewer.call('nearby',p)['activity'][0]['profileHandle'] is None
  target.call('map-visibility',{'mode':'hidden'});assert viewer.call('nearby',p)['activity']==[]
  target.call('map-visibility',{'mode':'profile','lat':p['lat']+.06,'lng':p['lng']});target.call('checkin',{'status':'done','visibility':'friends','nonce':secrets.token_hex(12)})
  assert viewer.call('nearby',p)['activity']==[]
  target.call('map-visibility',{'mode':'hidden'});target.call('map-visibility',{'mode':'profile',**p});target.call('checkin',{'status':'done','visibility':'private','nonce':secrets.token_hex(12)})
  assert viewer.call('nearby',p)['activity']==[]
  guest.call('map-visibility',{'mode':'news',**p});guest.call('checkin',{'status':'need','visibility':'friends','nonce':secrets.token_hex(12)})
  row=viewer.call('nearby',p)['activity'][0];assert row['profileKind']=='guest' and row['profileHandle'] is None and row['avatarImage'] is None
  for row in viewer.call(box)['activity']:assert not any(key in row for key in ['handle','profileHandle','userId','avatarSeed','avatarImage'])
  print('PASS: Pending friendship does not reveal anonymous identity; accepted friendship does, disconnect revokes it. Hidden/private/far activity is excluded, guests have no profile, worldwide activity has no identities.',flush=True)
 finally:
  for c in reversed(owned):
   try:
    if c.owned_id and c.bootstrap()['me']['id']==c.owned_id:c.call('delete-account',{})
   except Exception as e:print('Owned QA cleanup needs follow-up:',type(e).__name__,flush=True)
if __name__=='__main__':main()
