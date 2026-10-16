import test from "node:test";
import assert from "node:assert/strict";
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
} from "../lib/core.js";

process.env.APP_SECRET =
  "unit-tests-only-a-fixed-secret-of-at-least-32-characters";
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
  assert.equal(premium({ trial_until: new Date(Date.now() + 86400000) }), true);
  assert.equal(
    premium({ trial_until: new Date(Date.now() - 86400000) }),
    false,
  );
});
test("Blobatar generates stable but distinct characters from Persian names", () => {
  assert.equal(blobatar("سارا"), blobatar("سارا"));
  assert.notEqual(blobatar("سارا"), blobatar("علی"));
  assert.notEqual(blobatar("مریم"), blobatar("نیما"));
});
