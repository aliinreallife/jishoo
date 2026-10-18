import test from "node:test";
import assert from "node:assert/strict";
import { compareVersions, validRelease, updateRequired } from "../src/update-rules.js";
import { dailyStreak } from "../lib/streaks.js";
import { streakMilestones, earnedStreakMilestones, shareableStreakMilestone } from "../lib/streak-milestones.js";
import { mapPresentation, nearestLongitude } from "../src/map-presentation.js";
import { invitationForest, invitationPath } from "../src/invitation-tree.js";
import { observabilityPage, redactMetricEvent } from "../src/observability.js";
import { canonicalPath, readPage, screenPath, notificationPath } from "../src/routing.js";
import { nearbyMomentEligible, nearbyMomentKind, mutualPayload, queueMutualNotice, notifyMutualMoments } from "../lib/mutual-moments.js";
import { clusterWorldActivity, worldViewport } from "../lib/world-map.js";
import { mapProfile } from "../lib/map-profile.js";
import { blobatar } from "blobatar/blob";
import {
  normalizePhone,
  phoneHash,
  encryptPhone,
  decryptPhone,
  pairKind,
  approximateLocation,
  distanceKm,
  cleanSocialLinks,
  premium,
  normalizeHandle,
  cleanAvatarImage,
} from "../lib/core.js";

process.env.APP_SECRET =
  "unit-tests-only-a-fixed-secret-of-at-least-32-characters";
test("local map profile eligibility protects anonymous members and guests", () => {
  const row = { id: "event", user_id: "other", registered: true, handle: "sara", name: "سارا", avatar_seed: "private-seed", avatar_image: "private-photo" };
  const anonymous = mapProfile(row, "viewer");
  assert.equal(anonymous.profileHandle, null);
  assert.equal(anonymous.profileKind, "anonymous");
  assert.equal(anonymous.name, "یه همسایه");
  assert.equal(anonymous.avatarImage, null);
  assert.notEqual(anonymous.avatarSeed, row.avatar_seed);
  for (const permitted of [{ ...row, discoverable: true }, { ...row, connection_id: "accepted" }, { ...row, user_id: "viewer" }]) {
    assert.equal(mapProfile(permitted, "viewer").profileHandle, "sara");
    assert.equal(mapProfile(permitted, "viewer").avatarImage, row.avatar_image);
  }
  const guest = mapProfile({ ...row, registered: false, discoverable: true, connection_id: "ignored" }, "viewer");
  assert.equal(guest.profileHandle, null);
  assert.equal(guest.profileKind, "guest");
  assert.equal(guest.avatarImage, null);
  assert.equal(screenPath("publicProfile", "sara"), "/u/sara");
});
test("update versions use numeric ordering, including double-digit releases", () => {
  assert.equal(compareVersions("0.4.9", "0.4.10"), -1);
  assert.equal(compareVersions("1.0.0", "0.99.99"), 1);
  assert.equal(compareVersions("0.4.1", "0.4.1"), 0);
  for (const invalid of [undefined, "", "next", "0.4", "1.2.3-beta"]) assert.equal(compareVersions(invalid, "1.0.0"), null);
});
test("only a valid published compatibility floor requires an update", () => {
  const release = { version: "0.4.2", buildId: "test-build-42", minimumSupportedVersion: "0.4.1" };
  assert.equal(validRelease(release), true);
  assert.equal(updateRequired("0.4.0", release), true);
  assert.equal(updateRequired("0.4.1", release), false);
  assert.equal(updateRequired("0.5.0", release), false);
  assert.equal(validRelease({ ...release, minimumSupportedVersion: "0.4.3" }), false);
  for (const buildId of [null, "", "../../bad", "x".repeat(81)]) assert.equal(validRelease({ ...release, buildId }), false);
  assert.equal(updateRequired("0.4.0", { ...release, minimumSupportedVersion: "invalid" }), false);
});
test("nearby coincidences require fresh public map consent and the same distance/time window", () => {
  const now=Date.now(), user={registered:true,share_location:true,location_updated_at:new Date(now)};
  const event={status:"done",visibility:"friends",location_lat:0,location_lng:0,created_at:new Date(now)};
  assert.equal(nearbyMomentEligible(user,event,now),true);
  for(const bad of [{registered:false},{share_location:false},{banned:true},{location_updated_at:new Date(now-3600001)}]) assert.equal(nearbyMomentEligible({...user,...bad},event,now),false);
  for(const bad of [{status:"need"},{visibility:"private"},{location_lat:null},{created_at:new Date(now-300001)}]) assert.equal(nearbyMomentEligible(user,{...event,...bad},now),false);
  const peer={location_lat:0,location_lng:.02,event_at:new Date(now-60000)};
  assert.equal(nearbyMomentKind(event,peer),"together");
  assert.equal(nearbyMomentKind(event,{...peer,event_at:new Date(now-300000)}),"back-to-back");
  assert.equal(nearbyMomentKind(event,{...peer,event_at:new Date(now-300001)}),null);
  assert.equal(nearbyMomentKind(event,{...peer,location_lng:.04}),null);
});
test("anonymous coincidence payloads reveal no other person's identity or coordinates", () => {
  const peer={id:"private-user-id",name:"PRIVATE-NAME",handle:"private_handle",location_lat:35,location_lng:51};
  for(const kind of ["together","back-to-back"]) {
    const payload=mutualPayload("nearby",kind,peer), text=JSON.stringify(payload);
    assert.equal(payload.actorId,null);assert.equal(payload.route,"/nearby");
    for(const privateValue of [peer.id,peer.name,peer.handle,'location_lat','location_lng'])assert.ok(!text.includes(privateValue));
  }
  assert.equal(mutualPayload("friend","together",peer).actorId,peer.id);
});
test("both mutual inbox records queue in one transaction and every allowed device delivery is attempted", async () => {
  const user={id:"b",name:"Second"},peer={id:"a",name:"First"},event={created_at:new Date().toISOString(),location_lat:0,location_lng:0};
  let statements;
  const jobs=await queueMutualNotice("nearby","together",user,peer,event,async rows=>{statements=rows;return [[{id:"claim"}],[{id:"mine"}],[{id:"theirs"}]];});
  assert.equal(statements.length,3);assert.deepEqual(statements[0][1].slice(2,4),["a","b"]);
  assert.deepEqual(jobs.map(job=>job.userId),["b","a"]);
  assert.equal(statements[1][1][2],null);assert.equal(statements[2][1][2],null);
  assert.equal(statements[1][1][8],statements[0][1][0]);
  const seen=[];
  await notifyMutualMoments(user,event,[{kind:"together",friend:peer}],{
    findNearby:async()=>[],queue:async()=>jobs,
    deliver:async id=>{seen.push(id);if(id==="b")throw Error("one device unavailable");},
  });
  assert.deepEqual(seen,["b","a"]);
});
test("world map clusters only visible points, strips identities, handles the date line and bounds output", () => {
  const rows=[{lat:10,lng:179,status:"done",createdAt:"2026-10-18T00:00:00Z",name:"SECRET",userId:"SECRET"},{lat:10,lng:-179,status:"need",createdAt:"2026-10-18T00:00:00Z"},{lat:10,lng:0,status:"done",createdAt:"2026-10-18T00:00:00Z"}];
  const box=worldViewport(new URLSearchParams({west:"170",east:"-170",zoom:"3"}));
  const result=clusterWorldActivity(rows,box);
  assert.equal(result.total,3);assert.equal(result.inView,2);assert.ok(!JSON.stringify(result).includes("SECRET"));
  const many=clusterWorldActivity(Array.from({length:1000},(_,i)=>({...rows[0],lat:(i%30)-15,lng:Math.floor(i/30)-15})),worldViewport(new URLSearchParams({zoom:"19"})));
  assert.ok(many.activity.length<=240);assert.equal(many.limited,true);assert.equal(many.inView,1000);
  assert.equal(many.activity.reduce((sum,item)=>sum+item.count,0),1000,"Every person remains represented after coarsening");
  const lone=clusterWorldActivity([{lat:35.7,lng:51.4,status:"done",createdAt:rows[0].createdAt}],worldViewport(new URLSearchParams({zoom:"0"})));
  assert.ok(Math.abs(lone.activity[0].lat-35.7)<.002 && Math.abs(lone.activity[0].lng-51.4)<.002,"Sparse global activity stays near its approximate city");
  for(const params of [{north:"NaN"},{south:"30",north:"20"},{west:"-181"},{zoom:"100"}])assert.throws(()=>worldViewport(new URLSearchParams(params)));
});
test("map density keeps sparse characters and uses a heatmap for crowded screen positions", () => {
  const points=Array.from({length:30},(_,i)=>({id:String(i),x:100+i%6,y:100+Math.floor(i/6),count:1}));
  assert.equal(mapPresentation(points.slice(0,1),2,393,550).mode,"characters");
  assert.equal(mapPresentation(points.slice(0,5),2,393,550).mode,"characters");
  assert.equal(mapPresentation(points,12,393,550).mode,"heat");
  assert.equal(mapPresentation(points,18,393,550).mode,"characters");
  const sparse=points.map((p,i)=>({...p,x:20+(i%6)*80,y:20+Math.floor(i/6)*90}));
  assert.equal(mapPresentation(sparse,2,500,550).mode,"characters");
});
test("viewport counts use people weights and longitude wrapping without changing private coordinates", () => {
  const points=[{id:"a",x:20,y:20,count:4},{id:"b",x:200,y:100,count:3},{id:"outside",x:450,y:100,count:99}];
  const before=JSON.stringify(points),result=mapPresentation(points,14,393,550);
  assert.equal(result.count,7);assert.equal(JSON.stringify(points),before);
  assert.equal(nearestLongitude(179,-179),-181);assert.equal(nearestLongitude(-179,179),181);
});
const streakDays=(start,count)=>Array.from({length:count},(_,i)=>new Date(Date.parse(start+"T12:00:00Z")+i*86400000).toISOString().slice(0,10));
const streakAt=day=>new Date(day+"T12:00:00Z");
test("daily streaks count distinct completed days, ignore future/invalid days and award the first free freeze at three", () => {
  const first=dailyStreak(Array(10000).fill("2026-09-01"),streakAt("2026-09-01"));
  assert.equal(first.current,1);assert.equal(first.charges,0);
  const three=dailyStreak([...streakDays("2026-09-01",3),"invalid","2026-02-30","2026-09-30"],streakAt("2026-09-03"));
  assert.equal(three.current,3);assert.equal(three.charges,1);assert.equal(three.capacity,1);
  assert.equal(three.activeToday,true);
});
test("freezes wait until a day has finished, protect missed days once and cannot protect beyond the balance", () => {
  const days=streakDays("2026-09-01",3);
  assert.equal(dailyStreak(days,streakAt("2026-09-04")).charges,1);
  const protectedDay=dailyStreak(days,streakAt("2026-09-05"));
  assert.equal(protectedDay.current,3);assert.equal(protectedDay.charges,0);assert.equal(protectedDay.protectedYesterday,true);assert.equal(protectedDay.freezesUsed,1);
  assert.deepEqual(dailyStreak(days,streakAt("2026-09-05")),protectedDay);
  const broken=dailyStreak(days,streakAt("2026-09-06"));
  assert.equal(broken.current,0);assert.equal(broken.best,3);assert.equal(broken.freezesUsed,1);
});
test("a used freeze recharges after three actual consecutive active days, and repeated taps cannot refill it", () => {
  const first=streakDays("2026-09-01",3);
  for(let n=1;n<=3;n++) {
    const days=[...first,...streakDays("2026-09-05",n)],today=days.at(-1);
    const value=dailyStreak([...days,...Array(50).fill(today)],streakAt(today));
    assert.equal(value.current,3+n);assert.equal(value.charges,n===3?1:0);assert.equal(value.freezesUsed,1);
  }
});
test("a 21-day streak unlocks and grants the second free slot permanently", () => {
  const days=streakDays("2026-09-01",21),value=dailyStreak(days,streakAt("2026-09-21"));
  assert.equal(value.current,21);assert.equal(value.charges,2);assert.equal(value.capacity,2);
  const frozen=dailyStreak(days,streakAt("2026-09-24"));
  assert.equal(frozen.current,21);assert.equal(frozen.charges,0);assert.equal(frozen.freezesUsed,2);
  const broken=dailyStreak(days,streakAt("2026-09-25"));
  assert.equal(broken.current,0);assert.equal(broken.capacity,2);assert.equal(broken.best,21);
});
test("a preserved streak has no additional daily credit for frozen days and recharge requires real consecutive days", () => {
  const days=[...streakDays("2026-09-01",21),"2026-09-24","2026-09-25"];
  const value=dailyStreak(days,streakAt("2026-09-25"));
  assert.equal(value.current,23);assert.equal(value.charges,0);assert.equal(value.rechargeProgress,2);
  const recharged=dailyStreak([...days,"2026-09-26"],streakAt("2026-09-26"));
  assert.equal(recharged.charges,1);assert.equal(recharged.capacity,2);
});
test("daily streaks use Tehran midnight and retain Saturday-to-Friday week order", () => {
  const before=dailyStreak(["2026-10-18"],new Date("2026-10-17T20:29:59Z"));
  const after=dailyStreak(["2026-10-18"],new Date("2026-10-17T20:30:00Z"));
  assert.equal(before.current,0);assert.equal(after.current,1);assert.equal(after.activeToday,true);
  assert.equal(after.week[0].label,"ش");assert.equal(after.week[6].label,"ج");
  const year=dailyStreak(streakDays("2026-12-31",3),streakAt("2027-01-02"));assert.equal(year.charges,1);
});
test("streak milestones use trusted historical best, distinct artwork and exact day thresholds", () => {
  assert.deepEqual(streakMilestones.map(item=>item.days),[3,7,14,30,60,90,180,365]);
  assert.equal(new Set(streakMilestones.map(item=>item.motif)).size,streakMilestones.length);
  for (const item of streakMilestones) {
    assert.ok(!earnedStreakMilestones(item.days-1).includes(item));
    assert.ok(earnedStreakMilestones(item.days).includes(item));
    assert.equal(shareableStreakMilestone(item.days,item.days),item);
    assert.equal(shareableStreakMilestone(item.days,item.days-1),null);
  }
  assert.equal(shareableStreakMilestone("<script>",1000),null);
  assert.equal(shareableStreakMilestone(366,1000),null);
  const days=streakDays("2025-01-01",365);
  const active=dailyStreak(days,streakAt(days.at(-1)));
  const ended=dailyStreak(days,streakAt("2026-01-05"));
  assert.equal(active.best,365);assert.equal(ended.current,0);
  assert.equal(earnedStreakMilestones(ended.best).length,8);
});
test("streak page and story paths survive refresh and redact temporary milestone state in analytics", () => {
  assert.equal(screenPath("streak"),"/streak");
  assert.equal(screenPath("stories","streak"),"/stories/streak");
  assert.equal(readPage("/streak").screen,"streak");
  assert.equal(readPage("/stories/streak?milestone=60").storyKind,"streak");
  assert.equal(canonicalPath("/#/streak"),"/streak");
  assert.equal(observabilityPage("/stories/streak?milestone=60"),"/app/stories/streak");
  assert.equal(observabilityPage("/streak"),"/app/streak");
});
test("clean routes retain legacy bookmarks, invitations, OAuth results and section anchors", () => {
  for (const [before, after] of [
    ["/#/profile", "/profile"], ["/#profile", "/profile"],
    ["/u/ali#/home", "/home"], ["/#/discover", "/nearby"],
    ["/?invite=PRIVATE#/home", "/join?invite=PRIVATE"],
    ["/?group=GROUP&invite=PRIVATE", "/group?group=GROUP&invite=PRIVATE"],
    ["/?login=1#/home", "/home?login=1"],
    ["/?source=twa#/home", "/home?source=twa"],
    ["/?google=continue&invite=PRIVATE", "/join?google=continue&invite=PRIVATE"],
    ["/?adminAccess=SECRET", "/admin?adminAccess=SECRET"],
    ["/#/circle/group-id", "/circle/group-id"],
    ["/app/stories/need", "/stories/need"],
    ["/#how", "/#how"], ["/settings#social-accounts", "/settings#social-accounts"],
    ["/home#profile", "/home#profile"], ["/friends/", "/friends"],
  ]) {
    assert.equal(canonicalPath(before), after, before);
    assert.equal(canonicalPath(after), after, "idempotent: " + after);
  }
  assert.equal(readPage("/circle/old%20id").circleId, "old id");
  assert.equal(readPage("/circle/%E0").circleId, "%E0");
  assert.equal(readPage("/stories/need").storyKind, "need");
  assert.equal(readPage("/stories/invalid").storyKind, null);
  assert.equal(readPage("/u/ali").handle, "ali");
  assert.equal(screenPath("circle", "group / id"), "/circle/group%20%2F%20id");
  assert.equal(screenPath("settings"), "/settings");
});
test("stored notification links preserve group destinations and reject external or API navigation", () => {
  const origin = "https://jishoo.vercel.app";
  assert.equal(notificationPath("/#/circle/group-id", origin), "/circle/group-id");
  assert.equal(notificationPath("/friends", origin), "/friends");
  for (const value of ["https://evil.invalid/friends", "//evil.invalid", "javascript:alert(1)", "/api/app", "/.well-known/assetlinks.json"])
    assert.equal(notificationPath(value, origin), "/home");
});
test("clean route analytics preserve categories and redact handles, codes and group IDs", () => {
  for (const [url, expected] of [["/profile", "/app/profile"], ["/settings#social-accounts", "/app/settings"], ["/friends", "/app/friends"], ["/circle/PRIVATE", "/app/circle"], ["/stories/need", "/app/stories/need"], ["/join?invite=PRIVATE", "/invite"], ["/admin", null], ["/app/admin", null]])
    assert.equal(observabilityPage(url), expected, url);
});
test("observability categorizes hash routes without private identifiers or query strings", () => {
  assert.equal(observabilityPage("https://jishoo.vercel.app/?invite=PRIVATE#/home"), "/invite");
  assert.equal(observabilityPage("https://jishoo.vercel.app/#/circle/private-group-id"), "/app/circle");
  assert.equal(observabilityPage("https://jishoo.vercel.app/u/private-handle"), "/u/profile");
  assert.equal(observabilityPage("https://jishoo.vercel.app/#/stories/need"), "/app/stories/need");
  assert.equal(observabilityPage("https://jishoo.vercel.app/?adminAccess=PRIVATE#/profile"), null);
  assert.equal(observabilityPage("https://jishoo.vercel.app/#/admin"), null);
  assert.equal(observabilityPage("https://jishoo.vercel.app/api/auth/google?code=PRIVATE"), null);
  const event = redactMetricEvent({type:"vital",url:"https://jishoo.vercel.app/?invite=PRIVATE",route:"sensitive"}, "https://jishoo.vercel.app/#/home");
  assert.equal(event.url, "https://jishoo.vercel.app/invite");
  assert.equal(event.route, "/invite");
  assert.equal(redactMetricEvent({type:"pageview",url:"https://jishoo.vercel.app/app/home"},"https://jishoo.vercel.app/#/admin"),null);
});
test("invitation tree preserves direct and later generations, independent of list order", () => {
  const tree = invitationForest([
    { id: "third", invitedBy: "second" }, { id: "ali", invitedBy: null },
    { id: "second", invitedBy: "first" }, { id: "first", invitedBy: "ali" },
    { id: "sibling", invitedBy: "ali" }, { id: "orphan", invitedBy: "deleted" },
  ]);
  assert.equal(tree.nodes.get("ali").children.length, 2);
  assert.equal(tree.nodes.get("ali").descendants, 4);
  assert.equal(tree.nodes.get("second").level, 2);
  assert.equal(tree.nodes.get("third").level, 3);
  assert.deepEqual(invitationPath(tree.nodes, "third").map(node => node.id), ["ali", "first", "second", "third"]);
  assert.equal(tree.nodes.get("orphan").parentId, null);
  assert.equal(tree.roots.length, 2);
});
test("invitation tree handles inconsistent cycles and deep chains without recursive traversal", () => {
  const cyclic = invitationForest([{id:"a",invitedBy:"b"},{id:"b",invitedBy:"a"},{id:"self",invitedBy:"self"}]);
  assert.equal(cyclic.roots.length, 2);
  assert.equal([...cyclic.nodes.values()].filter(node => node.inconsistent).length, 2);
  const members = Array.from({length:10000},(_,i)=>({id:String(i),invitedBy:i ? String(i-1) : null}));
  const deep = invitationForest(members);
  assert.equal(deep.nodes.get("0").descendants, 9999);
  assert.equal(deep.nodes.get("9999").level, 9999);
});
test("invitation ancestry requires an elevated admin session", async () => {
  const { communityAction } = await import("../lib/community.js");
  const fail = (status, message, code) => { throw Object.assign(new Error(message), {status,code}); };
  for (const [user, expected] of [
    [{registered:false},401],
    [{registered:true,role:"member",session_admin_access:true},403],
    [{registered:true,role:"admin",session_admin_access:false},403],
  ]) {
    await assert.rejects(communityAction({action:"admin-invitation-tree",body:{},user,req:{method:"GET"},url:new URL("https://jishoo.vercel.app/api/app?action=admin-invitation-tree"),fail}), error => error.status === expected);
  }
});
test("sensitive admin actions require confirmation after checking admin authorization", async () => {
  const { communityAction }=await import("../lib/community.js");
  const fail=(status,message,code)=>{throw Object.assign(new Error(message),{status,code});};
  for(const [action,body] of [["admin-user",{operation:"lifetime",enabled:true}],["admin-invite",{giftLifetime:true}],["admin-invite",{giftDays:30}],["admin-invite-revoke",{code:"EXAMPLE"}],["admin-recovery",{}]]) {
    const base={action,body,req:{method:"POST"},url:new URL("https://jishoo.vercel.app/api/app"),fail};
    await assert.rejects(communityAction({...base,user:{registered:true,role:"member"}}),error=>error.status===403);
    await assert.rejects(communityAction({...base,user:{registered:true,role:"admin",session_admin_access:true}}),error=>error.status===400&&error.code==="confirmation_required");
  }
});
test("Iranian, Persian-digit and international phone representations normalize consistently", () => {
  assert.equal(normalizePhone("۰۹۱۲ ۱۲۳ ۴۵۶۷"), "+989121234567");
  assert.equal(normalizePhone("+98 912 123 4567"), "+989121234567");
  assert.equal(normalizePhone("00989121234567"), "+989121234567");
  assert.throws(() => normalizePhone("0912"));
  assert.equal(
    phoneHash(normalizePhone("09121234567")),
    phoneHash(normalizePhone("+989121234567")),
  );
});
test("phone storage is encrypted with a fresh nonce and round-trips without storing plaintext", () => {
  const a = encryptPhone("+989121234567"),
    b = encryptPhone("+989121234567");
  assert.notEqual(a, b);
  assert.equal(decryptPhone(a), "+989121234567");
  assert.ok(!a.includes("9121234567"));
});
test("pair moments distinguish simultaneous, back-to-back and unrelated check-ins", () => {
  const now = Date.now();
  assert.equal(pairKind(now, now - 60000), "together");
  assert.equal(pairKind(now, now - 60001), "back-to-back");
  assert.equal(pairKind(now, now - 300000), "back-to-back");
  assert.equal(pairKind(now, now - 300001), null);
});
test("location is reduced to an approximate grid and invalid coordinates are rejected", () => {
  const point = approximateLocation(35.70123, 51.40123);
  assert.ok(distanceKm(point, { lat: 35.70123, lng: 51.40123 }) < 0.2);
  assert.notEqual(point.lat, 35.70123);
  assert.throws(() => approximateLocation(NaN, 51));
  assert.throws(() => approximateLocation(91, 51));
});
test("social profiles permit expected links and reject unsafe protocols and wrong services", () => {
  assert.equal(
    cleanSocialLinks({ instagram: "@jishoo" }).instagram,
    "https://www.instagram.com/jishoo",
  );
  assert.throws(() => cleanSocialLinks({ website: "javascript:alert(1)" }));
  assert.throws(() =>
    cleanSocialLinks({ instagram: "https://example.com/account" }),
  );
  assert.throws(() => cleanSocialLinks({ website: "https://localhost" }));
});
test("testing grants everyone premium while normal operation respects active trials", () => {
  process.env.TESTING_MODE = "true";
  assert.equal(premium({}), true);
  process.env.TESTING_MODE = "false";
  assert.equal(premium({}), false);
  assert.equal(premium({ lifetime: true }), true);
  assert.equal(premium({ trial_until: new Date(Date.now() + 86400000) }), true);
  assert.equal(
    premium({ trial_until: new Date(Date.now() - 86400000) }),
    false,
  );
});
test("public handles have at least three ASCII characters and normalize case", () => {
  assert.equal(normalizeHandle("@Sara_42"), "sara_42");
  for (const value of [
    "al",
    "3sara",
    "a b",
    "../../ali",
    "سارا",
    "a".repeat(25),
  ])
    assert.throws(() => normalizeHandle(value));
});
test("avatar uploads accept removal and reject SVG, external URLs and oversized payloads", () => {
  assert.equal(cleanAvatarImage(null), null);
  for (const value of [
    "https://example.com/photo.jpg",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/jpeg;base64,aGVsbG8=",
    "data:image/jpeg;base64," + "A".repeat(90001),
  ])
    assert.throws(() => cleanAvatarImage(value));
});
test("Blobatar generates stable but distinct characters from Persian names", () => {
  assert.equal(blobatar("سارا"), blobatar("سارا"));
  assert.notEqual(blobatar("سارا"), blobatar("علی"));
  assert.notEqual(blobatar("مریم"), blobatar("نیما"));
});

test("push subscription validation accepts real browser key formats and rejects SSRF targets", async () => {
  const { createECDH, randomBytes } = await import("node:crypto");
  const { cleanSubscription } = await import("../lib/notifications.js");
  const ecdh = createECDH("prime256v1");
  const keys = {
    p256dh: ecdh.generateKeys().toString("base64url"),
    auth: randomBytes(16).toString("base64url"),
  };
  for (const endpoint of [
    "https://fcm.googleapis.com/fcm/send/example",
    "https://web.push.apple.com/example",
    "https://updates.push.services.mozilla.com/wpush/v2/example",
    "https://wns2-example.notify.windows.com/w/?token=example",
  ])
    assert.equal(cleanSubscription({ endpoint, keys }).endpoint, endpoint);
  for (const endpoint of [
    "https://127.0.0.1/",
    "https://fcm.googleapis.com.evil.test/",
    "https://fcm.googleapis.com:8443/",
    "http://fcm.googleapis.com/",
    "https://user@web.push.apple.com/",
    "https://web.push.apple.com/#fragment",
  ])
    assert.throws(() => cleanSubscription({ endpoint, keys }));
  assert.throws(() =>
    cleanSubscription({
      endpoint: "https://fcm.googleapis.com/",
      keys: { ...keys, p256dh: "A".repeat(87) },
    }),
  );
});
test("admin password verification is salted, timing-safe, and rejects invalid or excessive input", async () => {
  const { scryptSync } = await import("node:crypto");
  const { verifyAdminPassword } = await import("../lib/security.js");
  const salt = "ab".repeat(16),
    password = "unit-test-private-passphrase";
  const encoded = salt + ":" + scryptSync(password, salt, 64).toString("hex");
  assert.equal(await verifyAdminPassword(password, encoded), true);
  assert.equal(await verifyAdminPassword("a-wrong-passphrase", encoded), false);
  assert.equal(await verifyAdminPassword(password, "malformed"), false);
  assert.equal(await verifyAdminPassword("x".repeat(201), encoded), false);
});
test("server photo processing decodes actual JPEGs, bounds their dimensions, and strips metadata", async () => {
  const { default: sharp } = await import("sharp");
  const { sanitizeAvatar } = await import("../lib/avatar.js");
  const jpeg = await sharp({
    create: { width: 500, height: 350, channels: 3, background: "#afd8ff" },
  })
    .withMetadata({
      exif: { IFD0: { Artist: "private location and camera metadata" } },
    })
    .jpeg()
    .toBuffer();
  const output = await sanitizeAvatar(
    "data:image/jpeg;base64," + jpeg.toString("base64"),
  );
  const meta = await sharp(
    Buffer.from(output.split(",")[1], "base64"),
  ).metadata();
  assert.equal(meta.width, 320);
  assert.equal(meta.height, 320);
  assert.equal(meta.exif, undefined);
  const excessive = await sharp({
    create: { width: 2000, height: 2000, channels: 3, background: "white" },
  })
    .jpeg()
    .toBuffer();
  await assert.rejects(
    sanitizeAvatar("data:image/jpeg;base64," + excessive.toString("base64")),
  );
  const fake = Buffer.concat([
    Buffer.from([255, 216, 255]),
    Buffer.alloc(120),
    Buffer.from([255, 217]),
  ]);
  await assert.rejects(
    sanitizeAvatar("data:image/jpeg;base64," + fake.toString("base64")),
  );
});
test("service-worker updates wait for an explicit matching-build activation message", async () => {
  const { readFileSync } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const handlers = {};
  let skipped = 0, installation;
  runInNewContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), {
    self: { addEventListener: (name, fn) => (handlers[name] = fn), skipWaiting: async () => skipped++ },
    caches: { open: async () => ({ addAll: async () => {} }) },
  });
  handlers.install({ waitUntil: (promise) => { installation = promise; } });
  await installation;
  assert.equal(skipped, 0);
  handlers.message({ data: { type: "JISHOO_SKIP_WAITING", buildId: "stale-build" }, waitUntil: () => assert.fail("Wrong build activated") });
  handlers.message({ data: { type: "JISHOO_SKIP_WAITING", buildId: "__JISHOO_BUILD_ID__" }, waitUntil: (promise) => { installation = promise; } });
  await installation;
  assert.equal(skipped, 1);
});
test("service worker displays a push with no app window open and only navigates to its own origin", async () => {
  const { readFileSync } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const handlers = {},
    shown = [],
    opened = [];
  const origin = "https://jishoo.vercel.app";
  runInNewContext(
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        addEventListener: (name, fn) => (handlers[name] = fn),
        location: { origin },
        registration: {
          showNotification: async (title, options) =>
            shown.push({ title, options }),
        },
      },
      clients: {
        matchAll: async () => [],
        openWindow: async (url) => opened.push(url),
      },
      URL,
    },
  );
  let pending;
  handlers.push({
    data: {
      json: () => ({
        title: "سارا جیش کرد!",
        body: "یه خبر از رفیقت",
        tag: "checkin:sara",
        url: "/#/friends",
      }),
    },
    waitUntil: (p) => (pending = p),
  });
  await pending;
  assert.equal(shown[0].title, "سارا جیش کرد!");
  assert.equal(shown[0].options.tag, "checkin:sara");
  handlers.notificationclick({
    notification: { close() {}, data: { url: "/#/friends" } },
    waitUntil: (p) => (pending = p),
  });
  await pending;
  assert.equal(opened[0], origin + "/#/friends");
  handlers.notificationclick({
    notification: { close() {}, data: { url: "https://evil.test" } },
    waitUntil: () => assert.fail("Cross-origin notification link accepted"),
  });
});
test("an admin password elevates only the registered, active owner account", async () => {
  const { scryptSync } = await import("node:crypto");
  const { authorizeAdminPassword } = await import("../lib/security.js");
  const original = process.env.ADMIN_PASSWORD_HASH;
  const salt = "cd".repeat(16),
    password = "owner-unit-test-passphrase";
  process.env.ADMIN_PASSWORD_HASH =
    salt + ":" + scryptSync(password, salt, 64).toString("hex");
  try {
    const owner = {
      role: "admin",
      handle: "ali",
      registered: true,
      banned: false,
    };
    assert.equal(await authorizeAdminPassword(owner, password), true);
    assert.equal(
      await authorizeAdminPassword({ ...owner, role: "member" }, password),
      false,
    );
    assert.equal(
      await authorizeAdminPassword({ ...owner, handle: "sara" }, password),
      false,
    );
    assert.equal(
      await authorizeAdminPassword({ ...owner, banned: true }, password),
      false,
    );
  } finally {
    if (original === undefined) delete process.env.ADMIN_PASSWORD_HASH;
    else process.env.ADMIN_PASSWORD_HASH = original;
  }
});

test("nearby icons separate stable overlapping markers without changing approximate coordinates", async () => {
  const { markerOffsets } = await import("../src/map-markers.js");
  const people = [
    { id: "a", markerKey: "2", lat: 35.7, lng: 51.4 },
    { id: "b", markerKey: "1", lat: 35.7, lng: 51.4 },
    { id: "c", markerKey: "3", lat: 35.72, lng: 51.4 },
  ];
  const before = JSON.stringify(people),
    a = markerOffsets(people),
    b = markerOffsets([...people].reverse());
  assert.notDeepEqual(a.get("a"), a.get("b"));
  assert.deepEqual(a.get("a"), b.get("a"));
  assert.equal(a.get("c").x, 0);
  assert.equal(a.get("c").y, 0);
  assert.equal(JSON.stringify(people), before);
  assert.ok(
    markerOffsets(
      Array.from({ length: 9 }, (_, i) => ({ ...people[0], id: String(i) })),
    ).get("0").cluster,
  );
});
test("test push fans out to every account device and reports partial failures without skipping other devices", async () => {
  const { deliverToDevices } = await import("../lib/notifications.js");
  const rows = [
      { endpoint_hash: "phone" },
      { endpoint_hash: "laptop" },
      { endpoint_hash: "tablet" },
    ],
    seen = [];
  const result = await deliverToDevices(
    "member",
    rows,
    { title: "Test" },
    async (user, row) => {
      assert.equal(user, "member");
      seen.push(row.endpoint_hash);
      if (row.endpoint_hash === "laptop") throw new Error("provider failure");
      return { accepted: true };
    },
  );
  assert.deepEqual(seen, ["phone", "laptop", "tablet"]);
  assert.deepEqual(result, { devices: 3, accepted: 2, failed: 1 });
});
test("favicon has a transparent outer canvas and keeps visible mascot pixels", async () => {
  const { default: sharp } = await import("sharp");
  const { data, info } = await sharp("public/assets/favicon-transparent.png")
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  assert.equal(info.width, 64);
  assert.equal(info.height, 64);
  assert.equal(data[3], 0);
  assert.ok(data.some((value, i) => i % 4 === 3 && value > 0));
});

test("browser, Apple and install icons share the yellow character with suitable transparency and mask safety", async () => {
  const { default: sharp } = await import("sharp");
  for (const [name,size,transparent] of [
    ["favicon-v2-32.png",32,true],["favicon-v2-64.png",64,true],
    ["apple-touch-icon-v2.png",180,false],["app-icon-v2-192.png",192,false],
    ["app-icon-v2-512.png",512,false],["app-icon-v2-maskable-512.png",512,false],
  ]) {
    const {data,info}=await sharp("public/assets/"+name).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.equal(info.width,size,name); assert.equal(info.height,size,name);
    assert.equal(data[3],transparent?0:255,name);
    let yellow=0,blue=0;
    for(let i=0;i<data.length;i+=4) {
      const [r,g,b,a]=data.subarray(i,i+4);
      if(a>100 && r>180 && g>150 && b<Math.min(r,g)-25)yellow++;
      if(a>100 && b>r+20 && g>r+10 && b>130)blue++;
      if(name.includes("maskable") && Math.max(Math.abs(r-255),Math.abs(g-249),Math.abs(b-230))>8) {
        const n=i/4,x=n%size+.5-size/2,y=Math.floor(n/size)+.5-size/2;
        assert.ok(Math.hypot(x,y)<=size*.4,"Maskable artwork extends beyond Android's safe circle");
      }
    }
    assert.ok(yellow>size*size*.08,name+" lost its yellow droplet");
    assert.ok(blue<size*size*.025,name+" still contains a blue character");
  }
  const {data}=await sharp("public/assets/notification-badge-v2.png").ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(data[3],0);
  assert.ok(data.some((v,i)=>i%4===3 && v>0));
  for(let i=0;i<data.length;i+=4)if(data[i+3])assert.deepEqual([...data.subarray(i,i+3)],[255,255,255]);
});

test("Google identity verification rejects wrong audience, nonce, issuer, expiry and unverified email", async () => {
  const { generateKeyPair, exportJWK, SignJWT, createLocalJWKSet } =
    await import("jose");
  const { verifyGoogleIdentity, googleAuthorization } =
    await import("../lib/google-protocol.js");
  const { hashToken } = await import("../lib/core.js");
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey);
  jwk.kid = "qa-google";
  const keys = createLocalJWKSet({ keys: [jwk] });
  const clientId = "qa.apps.googleusercontent.com",
    nonce = "qa-random-nonce";
  async function sign(overrides = {}) {
    const now = Math.floor(Date.now() / 1000);
    return new SignJWT({
      iss: "https://accounts.google.com",
      aud: clientId,
      sub: "qa-google-identity",
      email: "qa@example.test",
      email_verified: true,
      nonce,
      iat: now,
      exp: now + 300,
      ...overrides,
    })
      .setProtectedHeader({ alg: "RS256", kid: "qa-google" })
      .sign(privateKey);
  }
  const options = {
    clientId,
    nonceHash: hashToken(nonce),
    hash: hashToken,
    keys,
  };
  assert.equal(
    (await verifyGoogleIdentity(await sign(), options)).email,
    "qa@example.test",
  );
  for (const invalid of [
    { aud: "another-client" },
    { iss: "https://evil.example" },
    { nonce: "another-nonce" },
    { exp: 1 },
    { email_verified: false },
    { azp: "another-client" },
  ])
    await assert.rejects(verifyGoogleIdentity(await sign(invalid), options));
  const url = new URL(
    googleAuthorization({
      clientId,
      redirectUri: "https://jishoo.vercel.app/api/auth/google",
      state: "qa-state",
      nonce,
      verifier: "a".repeat(50),
    }),
  );
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("scope"), "openid email");
  assert.equal(url.searchParams.has("client_secret"), false);
});
test("Google return locations stay on the app and cannot redirect to another site", async () => {
  const { safeReturnPath } = await import("../lib/google-auth.js");
  for (const path of [
    "https://evil.example",
    "//evil.example/",
    "/\\evil.example/",
    "/api/auth/google",
  ])
    assert.equal(safeReturnPath(path), "/");
  assert.equal(safeReturnPath("/?invite=QA#/friends"), "/?invite=QA#/friends");
  assert.equal(safeReturnPath("/settings#social-accounts"), "/settings#social-accounts");
  assert.equal(safeReturnPath("/join?invite=QA"), "/join?invite=QA");
});
test("phone authentication is off by default and cannot activate the demo outside testing", async () => {
  const { phoneAuthEnabled, removeGoogle } = await import("../lib/google-auth.js");
  const savedFlag = process.env.PHONE_AUTH_ENABLED, savedTesting = process.env.TESTING_MODE;
  try {
    delete process.env.PHONE_AUTH_ENABLED;
    process.env.TESTING_MODE = "true";
    assert.equal(phoneAuthEnabled(), false);
    await assert.rejects(removeGoogle({ registered: true, phone_hash: "exists" }, (_status, message) => { throw new Error(message); }), /تنها راه ورود/);
    process.env.PHONE_AUTH_ENABLED = "true";
    process.env.TESTING_MODE = "false";
    assert.equal(phoneAuthEnabled(), false);
    process.env.TESTING_MODE = "true";
    assert.equal(phoneAuthEnabled(), true);
  } finally {
    if (savedFlag === undefined) delete process.env.PHONE_AUTH_ENABLED; else process.env.PHONE_AUTH_ENABLED = savedFlag;
    if (savedTesting === undefined) delete process.env.TESTING_MODE; else process.env.TESTING_MODE = savedTesting;
  }
});
test("account linking does not offer merges into admin, banned or phone-linked accounts", async () => {
  const { prepareAccountMerge } = await import("../lib/account-merge.js");
  const source = { phone_hash: "source" };
  for (const target of [{ role: "admin" }, { role: "member", banned: true }, { role: "member", phone_hash: "other" }])
    assert.equal(await prepareAccountMerge(source, target, {}, "session"), false);
  assert.equal(await prepareAccountMerge({}, { role: "member" }, {}, "session"), false);
});
test("Persian calendar handles Nowruz and leap Esfand, with Saturday–Friday weeks", async () => {
  const { persianMonth, persianParts, weekDays, dayKey, periodTotals } = await import("../lib/calendar.js");
  const nowruz = new Date("2026-03-21T12:00:00Z");
  assert.deepEqual(persianParts(nowruz), { month: 1, day: 1, year: 1405 });
  assert.equal(persianMonth(nowruz).days.length, 31);
  assert.equal(persianMonth(new Date("2025-03-20T12:00:00Z")).days.length, 30);
  assert.equal(persianMonth(new Date("2026-03-20T12:00:00Z")).days.length, 29);
  const week = weekDays(new Date("2026-10-21T12:00:00Z"));
  assert.equal(week[0].getUTCDay(), 6);
  assert.equal(week[6].getUTCDay(), 5);
  assert.equal(dayKey(week[0]), "2026-10-17");
  assert.equal(dayKey(week[6]), "2026-10-23");
  assert.deepEqual(periodTotals([{ day: "2026-03-20", count: 4 }, { day: "2026-03-21", count: 2 }], nowruz), { week: 2, month: 2 });
});
test("Android asset links require real valid signing fingerprints", async () => {
  const { assetLinks } = await import("../lib/android.js");
  assert.deepEqual(assetLinks({}), []);
  assert.deepEqual(assetLinks({ ANDROID_SHA256_CERTIFICATES: "invalid" }), []);
  const sha = Array(32).fill("AF").join(":");
  const value = assetLinks({ ANDROID_SHA256_CERTIFICATES: sha + "," + sha });
  assert.equal(value[0].target.package_name, "app.jishoo.twa");
  assert.deepEqual(value[0].target.sha256_cert_fingerprints, [sha]);
});
test("CARTO configuration comes from the environment and retains provider attribution", async () => {
  const { mapConfig } = await import("../lib/public-config.js");
  const original = process.env.CARTO_KEY;
  try {
    process.env.CARTO_KEY = "qa key";
    const map = mapConfig();
    assert.ok(
      map.url.includes("light_nolabels/{z}/{x}/{y}{r}.png?key=qa%20key"),
    );
    assert.equal(map.attribution, "© OpenStreetMap contributors, © CARTO");
  } finally {
    if (original === undefined) delete process.env.CARTO_KEY;
    else process.env.CARTO_KEY = original;
  }
});
test("PWA offline worker never caches API data or Google callbacks", async () => {
  const { readFileSync } = await import("node:fs");
  const { runInNewContext } = await import("node:vm");
  const handlers = {},
    origin = "https://jishoo.vercel.app";
  let intercepted = 0;
  runInNewContext(
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        location: { origin },
        addEventListener: (name, fn) => (handlers[name] = fn),
      },
      URL,
    },
  );
  for (const path of [
    "/api/app?action=bootstrap",
    "/api/auth/google?code=private",
    "/.well-known/assetlinks.json",
  ])
    handlers.fetch({
      request: { method: "GET", url: origin + path, mode: "navigate" },
      respondWith: () => intercepted++,
    });
  assert.equal(intercepted, 0);
});
