"""Owned-data Google registration/linking tests using an explicitly isolated preview fixture."""
import hashlib,hmac,json,os,secrets,sys,time,uuid,urllib.request,urllib.parse,urllib.error
from pathlib import Path
from api_smoke import Client,BASE
from provision_admin import create_invite
from deploy_vercel import request
ROOT=Path(__file__).resolve().parents[1]
owned=[];support_ids=[]
def seed(client):
 data=client.bootstrap();assert not data['me']['registered']
 project=json.loads((ROOT/'.vercel/project.json').read_text());env=request(f"/v3/env/pull/{project['projectId']}?target=development&teamId={project['orgId']}")['env']
 token=next(c.value for c in client.cookies if c.name=='jishoo_session')
 body={'userId':data['me']['id'],'sessionHash':hashlib.sha256(token.encode()).hexdigest(),'nonce':'qa-google-'+str(uuid.uuid4()),'timestamp':int(time.time()*1000)}
 raw=json.dumps(body,separators=(',',':')).encode();signature=hmac.new(env['APP_SECRET'].encode(),raw,hashlib.sha256).hexdigest()
 headers={'Content-Type':'application/json','X-Jishoo-QA':signature,'x-vercel-protection-bypass':os.environ['JISHOO_TEST_BYPASS_SECRET']}
 with urllib.request.urlopen(urllib.request.Request(BASE+'/api/qa-google-fixture',data=raw,headers=headers),timeout=35) as r:assert json.load(r)['ready']
 return data['me']['id']
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):return None
def callback(client,url):
 headers={'Cookie':'; '.join(c.name+'='+c.value for c in client.cookies),'x-vercel-protection-bypass':os.environ['JISHOO_TEST_BYPASS_SECRET']}
 try:urllib.request.build_opener(NoRedirect()).open(urllib.request.Request(url,headers=headers),timeout=30)
 except urllib.error.HTTPError as e:
  assert e.code==303
  return urllib.parse.parse_qs(urllib.parse.urlsplit(e.headers['Location']).query)['google'][0]
 raise AssertionError('OAuth callback did not redirect')
def main():
 if 'jishoo.vercel.app'==urllib.parse.urlsplit(BASE).netloc:raise SystemExit('Use an isolated preview, never production, for Google fixtures.')
 admin=None
 try:
  a=Client();b=Client();owned.extend([a,b]);uid=seed(a)
  state=a.bootstrap();assert state['auth']['pendingGoogle'] and state['auth']['googleEnabled']
  a.call('register',{'provider':'google','ticket':'google','name':'آزمایش گوگل بدون دعوت'},expected=400)
  code=create_invite('qa-member')['code']
  joined=a.call('register',{'provider':'google','ticket':'google','name':'آزمایش گوگل','inviteCode':code})
  assert joined['me']['id']==uid and joined['me']['registered']
  assert joined['auth']['googleConnected'] and not joined['auth']['phoneConnected'] and not joined['auth']['pendingGoogle']
  a.call('google-disconnect',{},expected=400)
  print('PASS: Verified Google proof plus invitation creates one account without a phone; Google cannot be removed before adding another login method',flush=True)
  phone=f'+1{secrets.randbelow(789)+201}55501{secrets.randbelow(100):02}'
  challenge=a.call('phone-link-start',{'phone':phone})
  a.call('auth-verify',{'challengeId':challenge['challengeId'],'code':'123456'},expected=400)
  linked=a.call('phone-link-verify',{'challengeId':challenge['challengeId'],'code':'123456'})
  assert linked['me']['id']==uid and linked['auth']['phoneConnected'] and linked['auth']['googleConnected']
  a.call('phone-link-verify',{'challengeId':challenge['challengeId'],'code':'123456'},expected=400)
  b.bootstrap();b.call('phone-link-start',{'phone':phone},expected=401)
  restored=b.verify(phone);assert restored['me']['id']==uid and restored['auth']['googleConnected'];b.owned_id=None
  print('PASS: Phone linking uses a separate one-use verification purpose; both login methods preserve the same profile',flush=True)
  auth_url=a.call('google-start',{'intent':'login','returnTo':'/#/profile'})['url'];parts=urllib.parse.urlsplit(auth_url);q=urllib.parse.parse_qs(parts.query)
  assert parts.netloc=='accounts.google.com' and q['code_challenge_method']==['S256'] and q['redirect_uri']==['https://jishoo.vercel.app/api/auth/google']
  callback_url=BASE+'/api/auth/google?'+urllib.parse.urlencode({'state':q['state'][0],'error':'access_denied'})
  stranger=Client();owned.append(stranger);stranger.bootstrap();assert callback(stranger,callback_url)=='error'
  assert callback(a,callback_url)=='cancelled' and callback(a,callback_url)=='error'
  print('PASS: Google authorization uses PKCE; callback states are browser-bound and one-use',flush=True)
  a.call('google-disconnect',{});assert not a.bootstrap()['auth']['googleConnected']
  c=Client();owned.append(c);seed(c)
  restored=c.verify(phone);assert restored['me']['id']==uid and not restored['auth']['googleConnected']
  # Explicit consent links the verified Google proof to the existing phone account.
  d=Client();owned.append(d);seed(d);challenge=d.call('auth-start',{'phone':phone});linked=d.call('auth-verify',{'challengeId':challenge['challengeId'],'code':'123456','linkGoogle':True})
  assert linked['me']['id']==uid and linked['auth']['googleConnected'];d.owned_id=None;c.owned_id=None
  print('PASS: Google links to an existing phone account only with the explicit continuation',flush=True)
  admin=Client();owned.append(admin);_,ticket=admin.new_ticket();admin.call('register',{'ticket':ticket,'name':'آزمایش مدیریت پشتیبانی','inviteCode':create_invite('qa-admin')['code']})
  reference=a.call('support-send',{'message':'Owned QA support check '+secrets.token_hex(8),'contact':'qa@example.invalid'})['reference']
  a.call('admin-support',expected=403)
  row=next(r for r in admin.call('admin-support')['requests'] if r['id'].startswith(reference));support_ids.append(row['id'])
  admin.call('admin-support-resolve',{'id':row['id'],'resolved':True});admin.call('admin-support-delete',{'id':row['id']});support_ids.clear()
  print('PASS: Support is private, persists for elevated admins, and can be resolved/deleted without repository access',flush=True)
 finally:
  if admin:
   for sid in support_ids:
    try:admin.call('admin-support-delete',{'id':sid})
    except Exception:print('Owned support cleanup needs follow-up',flush=True)
  deleted=set()
  for client in owned:
   try:
    current=client.bootstrap()['me'];uid=current['id']
    if uid not in deleted:client.call('delete-account',{});deleted.add(uid)
   except Exception as e:print('Owned auth QA cleanup:',type(e).__name__,flush=True)
 print('Auth integration checks completed; only disposable QA data was used.',flush=True)
if __name__=='__main__':main()
