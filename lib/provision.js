import { createHmac, timingSafeEqual } from "node:crypto";
import { randomToken } from "./core.js";
import { query, transaction } from "./database.js";

export async function provisionOwner(req, body, fail) {
  if (req.method !== "POST") fail(405, "درخواست معتبر نیست.");
  const purpose = body.purpose;
  if (
    !["owner", "qa-admin", "qa-member"].includes(purpose) ||
    typeof body.nonce !== "string" ||
    body.nonce.length > 100 ||
    Math.abs(Date.now() - Number(body.timestamp)) > 300000
  )
    fail(403, "دسترسی معتبر نیست.");
  const expected = createHmac("sha256", process.env.APP_SECRET)
    .update(`owner-bootstrap:${purpose}:${body.timestamp}:${body.nonce}`)
    .digest("hex");
  const given = String(req.headers["x-jishoo-setup"] || "");
  if (
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  )
    fail(403, "دسترسی معتبر نیست.");
  if (
    purpose === "owner" &&
    (await query("SELECT id FROM users WHERE role='admin' AND handle='ali'"))[0]
  )
    fail(409, "حساب مالک قبلاً ساخته شده.");
  const code = "J-" + randomToken().slice(0, 22).toUpperCase();
  const rows = await query(
    `WITH nonce AS(INSERT INTO setup_nonces(nonce) VALUES($1) ON CONFLICT DO NOTHING RETURNING nonce) INSERT INTO invites(code,max_uses,grant_admin,reserved_handle) SELECT $2,1,$3,$4 WHERE EXISTS(SELECT 1 FROM nonce) RETURNING code`,
    [
      body.nonce,
      code,
      purpose !== "qa-member",
      purpose === "owner" ? "ali" : null,
    ],
  );
  if (!rows[0]) fail(409, "درخواست قبلاً انجام شده.");
  if (purpose === "owner")
    await transaction([
      [
        "UPDATE invites SET active=FALSE WHERE reserved_handle='ali' AND code<>$1",
        [code],
      ],
      [
        "UPDATE invites SET active=FALSE WHERE code=$1",
        [process.env.BOOTSTRAP_INVITE_CODE || ""],
      ],
    ]);
  return {
    code,
    url: `${process.env.PUBLIC_APP_URL}/?invite=${code}`,
    singleUse: true,
  };
}
