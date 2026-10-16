"""Install a salted admin password hash; keep the initial password out of Git."""
import hashlib,json,os,secrets
from pathlib import Path
from deploy_vercel import request
ROOT=Path(__file__).resolve().parents[1]
def main():
    path=ROOT/'.vercel/admin-password.json'
    if path.exists():
        config=json.loads(path.read_text())
    else:
        password='Jishoo-'+secrets.token_urlsafe(18)
        salt=secrets.token_hex(16)
        config={'password':password,'hash':salt+':'+hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1,dklen=64).hex()}
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'w') as file:json.dump(config,file)
    project=json.loads((ROOT/'.vercel/project.json').read_text())
    request(f"/v10/projects/{project['projectId']}/env?teamId={project['orgId']}&upsert=true",'POST',{'key':'ADMIN_PASSWORD_HASH','value':config['hash'],'type':'encrypted','target':['production','preview','development']})
    print('Admin password hash configured for Vercel. Initial password is in the private ignored owner file.')
if __name__=='__main__':main()
