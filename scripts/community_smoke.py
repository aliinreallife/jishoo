"""Live, disposable-account verification of invitations, admin, discovery and notifications."""
import io
import json
from pathlib import Path
import secrets
import time
import urllib.parse
from PIL import Image

from api_smoke import Client
from provision_admin import create_invite

ROOT=Path(__file__).resolve().parents[1]
RESULTS=[]
clients=[]
owned=set()

def passed(label):
    RESULTS.append(label)
    print("PASS:",label,flush=True)

def member(code,name):
    client=Client();clients.append(client)
    phone,ticket=client.new_ticket()
    value=client.call("register",{"ticket":ticket,"name":name,"inviteCode":code})
    owned.add(value["me"]["id"])
    return client,value,phone

def peer(data,user_id):
    return next(friend for friend in data["friends"] if friend["id"]==user_id)

def main():
    try:
        root_code=create_invite("qa-admin")["code"]
        admin,root,root_phone=member(root_code,"مدیر آزمایش جامعه")
        assert root["me"]["isAdmin"] and root["me"]["handle"]!="ali"
        assert root["invitationQuota"]["limit"] is None
        admin.call("profile",{"handle":"ali"},expected=409)
        guest=Client();clients.append(guest);guest.bootstrap()
        guest.call("admin",expected=401)
        passed("A private single-use capability creates an elevated QA admin; ali stays reserved for the owner")
        original_personal=root["me"]["inviteCode"]
        first,first_data,_=member(original_personal,"آزمایش دعوت خصوصی")
        reuse=Client();clients.append(reuse);_,reuse_ticket=reuse.new_ticket()
        reuse.call("register",{"ticket":reuse_ticket,"name":"آزمایش دعوت مصرف‌شده","inviteCode":original_personal},expected=410)
        assert admin.bootstrap()["me"]["inviteCode"]!=original_personal
        passed("Admins can issue unlimited invitations, while even their profile invitation admits only one signup")

        one=admin.call("admin-invite",{})["code"]
        a,ra,phone_a=member(one,"آزمایش آوا")
        assert ra["invitationQuota"]=={"used":0,"limit":3,"remaining":3}
        a.call("admin",expected=403)
        a.call("admin-invite",{},expected=403)
        a.call("admin-user",{"id":ra["me"]["id"],"operation":"lifetime","enabled":True},expected=403)
        a.call("profile",{"handle":"ali"},expected=409)
        passed("Ordinary accounts receive three slots and cannot use admin actions or claim ali")

        b,rb,_=member(ra["me"]["inviteCode"],"آزمایش بهار")
        c,rc,_=member(ra["me"]["inviteCode"],"آزمایش سینا")
        d,rd,_=member(ra["me"]["inviteCode"],"آزمایش دریا")
        state=a.bootstrap()
        assert state["invitationQuota"]=={"used":3,"limit":3,"remaining":0}
        assert len(state["invited"])==3 and state["me"]["trialDaysSaved"]==28
        assert rb["invitationQuota"]["remaining"]==3
        relation=peer(rb,ra["me"]["id"])
        assert relation["incoming"] and relation["status"]=="pending"
        b.call("connection-respond",{"id":relation["connectionId"],"accept":True})
        e=Client();clients.append(e);_,ticket=e.new_ticket()
        e.call("register",{"ticket":ticket,"name":"آزمایش آخر","inviteCode":ra["me"]["inviteCode"]},expected=410)
        e.call("register",{"ticket":ticket,"name":"آزمایش آخر","inviteCode":one},expected=410)
        next_one=admin.call("admin-invite",{})["code"]
        re=e.call("register",{"ticket":ticket,"name":"آزمایش آخر","inviteCode":next_one})
        owned.add(re["me"]["id"])
        passed("Three successful signups exhaust a member's invite; each child gets three slots and an incoming friend request")

        handle="qa_"+secrets.token_hex(4)
        a.call("profile",{"handle":"xy"},expected=400)
        changed=a.call("profile",{"handle":handle,"socialLinks":{"instagram":"jishoo_test"}})
        b.call("profile",{"handle":handle},expected=409)
        profile=a.call("profile-public&handle="+handle)["profile"]
        assert profile["handle"]==handle and "phone" not in json.dumps(profile)
        picture=Image.open(ROOT/"public/assets/app-icon-192.png").convert("RGB")
        content=io.BytesIO();picture.save(content,format="JPEG",quality=80)
        import base64
        image="data:image/jpeg;base64,"+base64.b64encode(content.getvalue()).decode()
        result=a.call("avatar",{"image":image})
        stored=result["me"]["avatarImage"]
        decoded=Image.open(io.BytesIO(base64.b64decode(stored.split(",")[1])))
        assert decoded.size==(320,320) and decoded.format=="JPEG"
        assert peer(b.bootstrap(),ra["me"]["id"])["avatarImage"]==stored
        a.call("avatar",{"image":"data:image/svg+xml;base64,PHN2Zz4="},expected=400)
        a.call("avatar",{"image":None})
        assert a.bootstrap()["me"]["avatarImage"] is None
        assert b.bootstrap()["friends"][0]["socialLinks"]=={}
        a.call("connection-share",{"id":relation["connectionId"],"enabled":True})
        assert peer(b.bootstrap(),ra["me"]["id"])["socialLinks"]["instagram"].endswith("/jishoo_test")
        passed("Unique public handles, persistent photo uploads/removal and per-friend social consent work")

        b.call("notifications-read",{})
        before=len(b.call("notifications")["notifications"])
        for _ in range(6):a.call("checkin",{"status":"need","visibility":"friends","nonce":secrets.token_hex(12)})
        achievements=a.bootstrap()["achievements"]
        assert next(x for x in achievements if x["slug"]=="light_steps")["progress"]==0
        assert next(x for x in achievements if x["slug"]=="good_days")["progress"]==0
        notices=b.call("notifications")["notifications"]
        assert len(notices)==before+1
        b.call("notification-pref",{"scope":"friend","id":ra["me"]["id"],"enabled":False})
        before=len(notices)
        for _ in range(3):a.call("checkin",{"status":"done","visibility":"friends","nonce":secrets.token_hex(12)})
        assert len(b.call("notifications")["notifications"])==before
        progress=next(x for x in a.bootstrap()["achievements"] if x["slug"]=="light_steps")
        assert progress["progress"]==1 and progress["level"]==1
        b.call("notification-pref",{"scope":"friend","id":ra["me"]["id"],"enabled":True})
        passed("Repeated need taps earn no achievement progress; repeated done taps count once and friend notifications can be muted")

        pending=b.call("connection-request",{"handle":rc["me"]["handle"]})
        connection=peer(c.bootstrap(),rb["me"]["id"])
        c.call("connection-respond",{"id":connection["connectionId"],"accept":True})
        circle=b.call("circle-create",{"name":"جمع اعلان آزمایش","members":[rc["me"]["id"]]})["circles"][0]
        b.call("notification-pref",{"scope":"circle","id":circle["id"],"enabled":False})
        e.call("notification-pref",{"scope":"circle","id":circle["id"],"enabled":False},expected=404)
        before=len(b.call("notifications")["notifications"])
        c.call("checkin",{"status":"done","visibility":"friends","nonce":secrets.token_hex(12)})
        assert len(b.call("notifications")["notifications"])==before
        b.call("notification-pref",{"scope":"circle","id":circle["id"],"enabled":True})
        c.call("checkin",{"status":"need","visibility":"friends","nonce":secrets.token_hex(12)})
        assert len(b.call("notifications")["notifications"])==before+1
        b.call("notifications-read",{})
        assert all(n["readAt"] for n in b.call("notifications")["notifications"])
        b.call("push-subscribe",{"subscription":{"endpoint":"https://example.com/private","keys":{"p256dh":"A"*87,"auth":"A"*22}}},expected=400)
        assert b.bootstrap()["vapidPublicKey"]
        passed("Per-collection notification controls, read state and push-provider validation are enforced")

        point={"lat":35.70127,"lng":51.40137}
        for client in (a,b):
            client.call("location",{**point,"enabled":True})
            client.call("discoverable",{"enabled":True})
        people=a.call("discover",point)["people"]
        person=next(p for p in people if p["id"]==rb["me"]["id"])
        assert person["name"]=="آزمایش بهار" and "lat" not in person and "lng" not in person
        c.call("discoverable",{"enabled":True},expected=400)
        b.call("location",{"enabled":False})
        assert not b.bootstrap()["me"]["discoverable"]
        assert not any(p["id"]==rb["me"]["id"] for p in a.call("discover",point)["people"])
        passed("Nearby discovery is opt-in, exposes no coordinates, and disappears when location sharing is revoked")

        admin.call("admin-user",{"id":ra["me"]["id"],"operation":"lifetime","enabled":True})
        assert a.bootstrap()["me"]["lifetime"]
        admin.call("admin-user",{"id":ra["me"]["id"],"operation":"lifetime","enabled":False})
        assert not a.bootstrap()["me"]["lifetime"]
        admin.call("admin-user",{"id":rd["me"]["id"],"operation":"suspend","enabled":True})
        d.call("bootstrap",expected=403)
        admin.call("admin-user",{"id":rd["me"]["id"],"operation":"suspend","enabled":False})
        assert d.bootstrap()["me"]["registered"]
        unused=admin.call("admin-invite",{})["code"]
        admin.call("admin-invite-revoke",{"code":unused})
        assert any(not i["active"] for i in admin.call("admin")["invites"] if i["code"]==unused)
        passed("Admin-only lifetime gifts/revocation, account suspension and single-use invitation revocation work")

        returning=Client();clients.append(returning);returning.bootstrap()
        ordinary=returning.verify(root_phone)
        assert ordinary["registered"] and not ordinary["me"]["isAdmin"]
        returning.call("admin",expected=403)
        returning.call("google-start",{"intent":"link"},expected=403)
        recovery=admin.call("admin-recovery",{})["url"]
        token=urllib.parse.parse_qs(urllib.parse.urlsplit(recovery).query)["adminAccess"][0]
        returning.call("admin-redeem",{"token":token})
        assert returning.bootstrap()["me"]["isAdmin"]
        returning.call("admin-redeem",{"token":token},expected=403)
        private_claim=create_invite("qa-admin")["code"]
        e.call("claim-admin",{"code":private_claim})
        assert e.bootstrap()["me"]["isAdmin"]
        e.call("claim-admin",{"code":private_claim},expected=403)
        passed("Demo phone login cannot elevate an admin; private recovery and existing-account admin claims are single-use")

    finally:
        for client in clients:
            try:
                current=client.call("bootstrap")["me"]
                if current["id"] in owned or not current["registered"]:client.call("delete-account",{})
            except Exception as error:print("Cleanup check:",type(error).__name__,flush=True)
        (ROOT/"artifacts/community-smoke-results.json").write_text(json.dumps({"passed":RESULTS},indent=2))
        print("Removed only disposable QA accounts and their related data.",flush=True)
    print(f"{len(RESULTS)} community API scenarios passed",flush=True)

if __name__=="__main__":main()
