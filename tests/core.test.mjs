import test from "node:test";
import assert from "node:assert/strict";
import { invitationForest, invitationPath } from "../src/invitation-tree.js";
import { observabilityPage, redactMetricEvent } from "../src/observability.js";
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
