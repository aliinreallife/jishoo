import test from "node:test";
import assert from "node:assert/strict";
import { resolvePromoCode } from "../lib/promo-codes.js";
import { inviteOnly } from "../lib/core.js";
import { normalizePromoCode, promoLink } from "../src/promo-link.js";
import { canonicalPath, readPage } from "../src/routing.js";

test("the launch signup window opens and closes without a background job", () => {
  const original = {
    INVITE_ONLY: process.env.INVITE_ONLY,
    OPEN_SIGNUP_UNTIL: process.env.OPEN_SIGNUP_UNTIL,
  };
  try {
    process.env.INVITE_ONLY = "true";
    delete process.env.OPEN_SIGNUP_UNTIL;
    assert.equal(inviteOnly(), true, "default policy remains invitation-only");
    process.env.OPEN_SIGNUP_UNTIL = new Date(Date.now() + 7 * 86400000).toISOString();
    assert.equal(inviteOnly(), false, "public can join during the launch week");
    process.env.OPEN_SIGNUP_UNTIL = new Date(Date.now() - 1000).toISOString();
    assert.equal(inviteOnly(), true, "invites are required again after the deadline");
    process.env.OPEN_SIGNUP_UNTIL = "bad-date";
    assert.equal(inviteOnly(), true, "bad configuration fails closed");
    process.env.INVITE_ONLY = "false";
    assert.equal(inviteOnly(), false, "ordinary open-signup override remains supported");
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("the Premium campaign link shares the existing /join entrypoint without overriding invitations", () => {
  const code = "J-A966D8A440CD";
  assert.equal(normalizePromoCode(" j-a966d8a440cd "), code);
  assert.equal(normalizePromoCode("not-a-code"), null);
  assert.equal(promoLink("https://jishoo.vercel.app", code), "https://jishoo.vercel.app/join?promo=" + code);
  assert.throws(() => promoLink("https://jishoo.vercel.app", "bad"), /Invalid promotional code/);
  assert.equal(readPage("/join?promo=" + code).screen, "home");
  assert.equal(canonicalPath("/join?invite=J-6AD6A2824D92"), "/join?invite=J-6AD6A2824D92");
});

test("the four-character promo uses the existing campaign and its redemption history", () => {
  const campaign = "J-123456789ABC";
  assert.equal(normalizePromoCode(" jsho "), "JSHO");
  assert.equal(promoLink("https://jishoo.vercel.app", "jsho"), "https://jishoo.vercel.app/join?promo=JSHO");
  assert.equal(resolvePromoCode("jsho", campaign), campaign);
  assert.equal(resolvePromoCode(campaign, campaign), campaign);
  assert.equal(resolvePromoCode("JSHO"), null);
  assert.equal(resolvePromoCode("JSHO", "JSHO"), null);
  assert.equal(resolvePromoCode("ZZZZ", campaign), null);
});
