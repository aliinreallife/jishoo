import test from "node:test";
import assert from "node:assert/strict";
import { inviteOnly } from "../lib/core.js";

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
