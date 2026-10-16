"""Create a private one-use owner/QA invitation without exposing server credentials."""
import argparse
import hashlib
import hmac
import json
from pathlib import Path
import time
import urllib.request
import uuid

from deploy_vercel import request

ROOT=Path(__file__).resolve().parents[1]

def create_invite(purpose="owner"):
    project=json.loads((ROOT/".vercel/project.json").read_text())
    config=request(f"/v3/env/pull/{project['projectId']}?target=development&teamId={project['orgId']}")["env"]
    body={"purpose":purpose,"timestamp":int(time.time()*1000),"nonce":str(uuid.uuid4())}
    message=f"owner-bootstrap:{purpose}:{body['timestamp']}:{body['nonce']}".encode()
    signature=hmac.new(config["APP_SECRET"].encode(),message,hashlib.sha256).hexdigest()
    req=urllib.request.Request(config.get("PUBLIC_APP_URL","https://jishoo.vercel.app")+"/api/app?action=owner-bootstrap",data=json.dumps(body).encode(),headers={"Content-Type":"application/json","X-Jishoo-Setup":signature},method="POST")
    with urllib.request.urlopen(req,timeout=40) as response:
        return json.load(response)

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--purpose",choices=["owner","qa-admin","qa-member"],default="owner")
    args=parser.parse_args()
    result=create_invite(args.purpose)
    path=ROOT/".vercel"/(args.purpose+"-invite.json")
    path.write_text(json.dumps(result,indent=2)+"\n")
    path.chmod(0o600)
    print(f"Private one-use {args.purpose} invitation saved to ignored .vercel/{path.name}. No credentials were logged.")

if __name__=="__main__":main()
