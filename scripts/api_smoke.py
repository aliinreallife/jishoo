"""Exercise the deployed testing API with owned disposable accounts, then remove them."""

import http.cookiejar
import json
import os
from pathlib import Path
from provision_admin import create_invite
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = os.environ.get("JISHOO_TEST_API", "https://jishoo.vercel.app").rstrip("/")
RESULTS = []


def passed(label):
    RESULTS.append(label)
    print("PASS:", label, flush=True)


class Client:
    def __init__(self):
        self.cookies = http.cookiejar.CookieJar()
        self.http = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))
        self.owned_id = None

    def call(self, action, body=None, expected=200):
        headers = {"Origin": BASE, "Accept": "application/json"}
        payload = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            payload = json.dumps(body).encode()
        req = urllib.request.Request(BASE + "/api/app?action=" + action, data=payload, headers=headers)
        try:
            with self.http.open(req, timeout=40) as response:
                status, value = response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            status, value = error.code, json.loads(error.read())
        assert status == expected, (action, status, value.get("error"), value.get("message"))
        return value

    def bootstrap(self):
        value = self.call("bootstrap")
        if self.owned_id is None and not value["me"]["registered"]:
            self.owned_id = value["me"]["id"]
        return value

    def verify(self, phone):
        start = self.call("auth-start", {"phone": phone})
        assert start["demo"] is True
        return self.call("auth-verify", {"challengeId": start["challengeId"], "code": "123456"})

    def new_ticket(self):
        self.bootstrap()
        # NANP's reserved fictional 555-0100..0199 range. No SMS is sent.
        phone = f"+1{secrets.randbelow(789) + 201}55501{secrets.randbelow(100):02}"
        result = self.verify(phone)
        assert not result["registered"], "Fictional test number already used; rerun with a fresh number."
        return phone, result["ticket"]


def main():
    starter = os.environ.get("JISHOO_TEST_INVITE_CODE")
    if not starter:
        starter = create_invite("qa-member")["code"]
    clients = [Client() for _ in range(4)]
    a, b, c, returning = clients
    try:
        health = a.call("health")
        assert health == {"ready": True, "database": True, "testing": True, "inviteOnly": True}
        guest = a.bootstrap()
        assert not guest["me"]["registered"] and guest["me"]["premium"]
        assert guest["stats"]["total"] == 0 and guest["friends"] == []
        assert not guest["me"]["shareLocation"]
        passed("Real database and premium guest access; no seeded activity or location consent")

        phone_a, ticket_a = a.new_ticket()
        a.call("register", {"ticket": ticket_a, "name": "آزمایش علی"}, expected=400)
        a.call("register", {"ticket": ticket_a, "name": "آزمایش علی", "inviteCode": "INVALID-QA"}, expected=404)
        ra = a.call("register", {"ticket": ticket_a, "name": "آزمایش علی", "inviteCode": starter})
        assert ra["me"]["registered"] and ra["me"]["avatarSeed"] == "آزمایش علی"
        assert ra["me"]["trialDaysSaved"] == 7 and ra["me"]["trialUntil"] is None
        code_a = ra["me"]["inviteCode"]
        passed("Phone demo verification, invite-only signup, name-based character, and saved seven-day gift")

        _, ticket_b = b.new_ticket()
        rb = b.call("register", {"ticket": ticket_b, "name": "آزمایش سارا", "inviteCode": code_a, "connectInviter": True})
        assert rb["me"]["trialDaysSaved"] == 7
        assert a.bootstrap()["me"]["trialDaysSaved"] == 14
        relation = rb["friends"][0]
        assert relation["status"] == "accepted" and relation["socialLinks"] == {}
        assert relation["avatarSeed"] != rb["me"]["avatarSeed"]
        relation_id = relation["connectionId"]
        passed("Both sides receive referral credit once and can consent to connecting")

        _, ticket_c = c.new_ticket()
        rc = c.call("register", {"ticket": ticket_c, "name": "آزمایش نیما", "inviteCode": create_invite("qa-member")["code"]})
        assert rc["friends"] == []
        a.call("profile", {"socialLinks": {"instagram": "jishoo_test"}})
        assert b.bootstrap()["friends"][0]["socialLinks"] == {}
        c.call("connection-share", {"id": relation_id, "enabled": True}, expected=404)
        a.call("connection-share", {"id": relation_id, "enabled": "true"}, expected=400)
        a.call("connection-share", {"id": relation_id, "enabled": True})
        assert b.bootstrap()["friends"][0]["socialLinks"]["instagram"] == "https://www.instagram.com/jishoo_test"
        a.call("connection-share", {"id": relation_id, "enabled": False})
        assert b.bootstrap()["friends"][0]["socialLinks"] == {}
        a.call("profile", {"socialLinks": {"website": "javascript:alert(1)"}}, expected=400)
        passed("Social links stay private until a per-friend grant; revocation and membership checks work")

        a.call("circle-create", {"name": "جمع آزمایش", "members": [rc["me"]["id"]]}, expected=403)
        circle = a.call("circle-create", {"name": "جمع آزمایش", "members": [rb["me"]["id"]]})
        assert circle["circles"][0]["members"] == [rb["me"]["id"]]
        c.call("connection-request", {"code": code_a})
        pending = next(f for f in a.bootstrap()["friends"] if f["id"] == rc["me"]["id"])
        assert pending["status"] == "pending" and pending["incoming"]
        # An outsider cannot accept a connection between other users.
        b.call("connection-respond", {"id": pending["connectionId"], "accept": True})
        assert next(f for f in a.bootstrap()["friends"] if f["id"] == rc["me"]["id"])["status"] == "pending"
        a.call("connection-respond", {"id": pending["connectionId"], "accept": True})
        assert next(f for f in c.bootstrap()["friends"] if f["id"] == ra["me"]["id"])["status"] == "accepted"
        a.call("connection-respond", {"id": pending["connectionId"], "accept": False})
        passed("Mutual connection requests and private friend collections enforce membership")

        point = {"lat": 35.70127, "lng": 51.40137}
        a.call("location", {**point, "enabled": True})
        private = a.call("checkin", {"status": "done", "visibility": "private", "nonce": secrets.token_hex(12)})
        assert not any(e["id"] == private["event"]["id"] for e in c.call("nearby", point)["activity"])
        nonce_a = secrets.token_hex(12)
        ea = a.call("checkin", {"status": "done", "visibility": "friends", "nonce": nonce_a})
        duplicate = a.call("checkin", {"status": "done", "visibility": "friends", "nonce": nonce_a})
        assert duplicate["event"]["id"] == ea["event"]["id"] and duplicate["stats"]["total"] == ea["stats"]["total"]
        friends_map = b.call("nearby", point)["activity"]
        marker = next(e for e in friends_map if e["id"] == ea["event"]["id"])
        assert marker["isFriend"] and marker["name"] == "آزمایش علی"
        assert abs(marker["lat"] - point["lat"]) < .002 and marker["lat"] != point["lat"]
        anonymous = next(e for e in c.call("nearby", point)["activity"] if e["id"] == ea["event"]["id"])
        assert not anonymous["isFriend"] and anonymous["name"] == "یه همسایه"
        assert "userId" not in anonymous and "phone" not in anonymous
        passed("Check-ins are idempotent; map coordinates are coarse, private posts hidden, and strangers anonymous")

        eb = b.call("checkin", {"status": "done", "visibility": "friends", "nonce": secrets.token_hex(12)})
        assert any(m["kind"] == "together" for m in eb["matches"])
        assert any(m["kind"] == "together" for m in a.bootstrap()["moments"])
        passed("Connected shared check-ins create a real together moment for both people")
        back_to_back_after = time.monotonic() + 65

        a.call("location", {"enabled": False})
        assert not any(e["id"] == ea["event"]["id"] for e in b.call("nearby", point)["activity"])
        a.call("location", {**point, "enabled": True})
        assert not any(e["id"] == ea["event"]["id"] for e in b.call("nearby", point)["activity"])
        passed("Location revocation removes existing coordinates and reenabling does not republish old posts")

        returning.bootstrap()
        returning.call("checkin", {"status": "done", "nonce": secrets.token_hex(12)})
        before = a.bootstrap()["stats"]["total"]
        restored = returning.verify(phone_a)
        assert restored["registered"] and restored["me"]["id"] == ra["me"]["id"]
        assert restored["me"]["trialDaysSaved"] == 14 and restored["stats"]["total"] == before + 1
        # This browser now legitimately owns the same QA account; cleanup only once.
        returning.owned_id = None
        passed("Existing-phone login restores the account without asking for a name or granting another referral")

        remaining = back_to_back_after - time.monotonic()
        if remaining > 0:
            print("Checking the real back-to-back time interval…", flush=True)
            time.sleep(remaining)
        late = a.call("checkin", {"status": "done", "visibility": "friends", "nonce": secrets.token_hex(12)})
        assert any(m["kind"] == "back-to-back" for m in late["matches"])
        passed("The real one-to-five-minute interval creates a back-to-back moment")
    finally:
        for client in clients:
            if client.owned_id:
                current = client.call("bootstrap")["me"]
                if current["id"] == client.owned_id:
                    client.call("delete-account", {})
        print("Removed only the disposable accounts created by this test.", flush=True)
        (ROOT / "artifacts").mkdir(exist_ok=True)
        (ROOT / "artifacts/api-smoke-results.json").write_text(json.dumps({"passed": RESULTS}, indent=2))
    print(f"{len(RESULTS)} API scenarios passed", flush=True)


if __name__ == "__main__":
    main()
