import { query, transaction } from "./database.js";
import { hashToken, randomToken, encryptPhone, decryptPhone } from "./core.js";
import { rateLimit } from "./security.js";
import { inviteOnly, normalizeCode } from "./core.js";
import { prepareAccountMerge, pendingAccountMerge } from "./account-merge.js";
import {
  googleAuthorization,
  verifyGoogleIdentity,
} from "./google-protocol.js";
export const googleReady = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
// Phone authentication stays off until explicitly enabled for a trusted demo.
// A real SMS verifier must replace the demo before enabling it outside testing.
export const phoneAuthEnabled = () =>
  process.env.TESTING_MODE === "true" && process.env.PHONE_AUTH_ENABLED === "true";
export const googleRedirect = () =>
  new URL(
    "/api/auth/google",
    process.env.PUBLIC_APP_URL || "https://jishoo.vercel.app",
  ).href;
export function safeReturnPath(value) {
  const base = process.env.PUBLIC_APP_URL || "https://jishoo.vercel.app";
  if (
    typeof value !== "string" ||
    value.length > 2000 ||
    !value.startsWith("/") ||
    value.startsWith("//")
  )
    return "/";
  const url = new URL(value, base);
  if (url.origin !== new URL(base).origin || url.pathname.startsWith("/api/"))
    return "/";
  return url.pathname + url.search + url.hash;
}
export async function authMethods(user, sessionHash) {
  const [linked, pending, merge] = await Promise.all([
    user.registered
      ? query(
          "SELECT email_cipher FROM auth_identities WHERE user_id=$1 AND provider='google'",
          [user.id],
        )
      : [],
    sessionHash
      ? query(
          "SELECT email_cipher FROM pending_google WHERE session_hash=$1 AND expires_at>NOW()",
          [sessionHash],
        )
      : [],
    pendingAccountMerge(user, sessionHash),
  ]);
  return {
    googleEnabled: googleReady(),
    phoneLoginEnabled: phoneAuthEnabled(),
    pendingMerge: merge,
    googleConnected: Boolean(linked[0]),
    googleEmail: linked[0] ? decryptPhone(linked[0].email_cipher) : null,
    pendingGoogle: pending[0] ? decryptPhone(pending[0].email_cipher) : null,
    phoneConnected: Boolean(user.phone_hash),
    phoneNumber: user.registered && user.phone_cipher ? decryptPhone(user.phone_cipher) : null,
    phoneMasked: user.phone_cipher
      ? "•••• " + decryptPhone(user.phone_cipher).slice(-4)
      : null,
  };
}
export async function startGoogle({ body, user, auth, fail }) {
  if (!googleReady()) fail(503, "ورود گوگل هنوز آماده نشده.");
  const intent = ["link", "signup"].includes(body.intent) ? body.intent : "login";
  if (intent === "link" && !user.registered) fail(401, "اول وارد حسابت شو.");
  if (intent === "link" && user.role === "admin" && !user.session_admin_access)
    fail(
      403,
      "برای اتصال گوگل به حساب مدیر، اول ورود خصوصی مدیریت رو کامل کن.",
    );
  if (!(await rateLimit("google-start:" + user.id, 8, 600)))
    fail(429, "چند دقیقه بعد دوباره امتحان کن.");
  let returnPath = safeReturnPath(body.returnTo);
  if (intent === "signup" && inviteOnly()) {
    const code = normalizeCode(body.inviteCode);
    const invite = code && (await query("SELECT code FROM invites WHERE code=$1 AND active AND (max_uses IS NULL OR uses<max_uses)", [code]))[0];
    if (!invite) fail(403, "اول یه دعوت معتبر وارد کن؛ بعد با گوگل ادامه بده.", "invite_required");
    const destination = new URL(returnPath, process.env.PUBLIC_APP_URL || "https://jishoo.vercel.app");
    destination.searchParams.set("invite", code);
    returnPath = destination.pathname + destination.search + destination.hash;
  }
  await query("DELETE FROM account_merge_proofs WHERE session_hash=$1", [auth.tokenHash]);
  const state = randomToken(),
    nonce = randomToken(),
    verifier = randomToken() + randomToken();
  await query("DELETE FROM oauth_states WHERE expires_at<NOW()");
  await query(
    "INSERT INTO oauth_states(state_hash,session_hash,user_id,intent,nonce_hash,verifier,return_path,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,NOW()+INTERVAL '10 minutes')",
    [
      hashToken(state),
      auth.tokenHash,
      user.id,
      intent,
      hashToken(nonce),
      encryptPhone(verifier),
      returnPath,
    ],
  );
  return {
    url: googleAuthorization({
      clientId: process.env.GOOGLE_CLIENT_ID,
      redirectUri: googleRedirect(),
      state,
      nonce,
      verifier,
    }),
  };
}
export async function claimPendingGoogle(userId, sessionHash) {
  const owned = await query(
    "SELECT a.subject FROM auth_identities a JOIN pending_google p ON p.session_hash=$1 WHERE a.provider='google' AND a.user_id=$2 AND a.subject<>p.subject",
    [sessionHash, userId],
  );
  if (owned[0]) return false;
  const result = await transaction([
    ["SELECT id FROM users WHERE id=$1 FOR UPDATE", [userId]],
    [
      "WITH proof AS (DELETE FROM pending_google WHERE session_hash=$1 AND expires_at>NOW() RETURNING *) INSERT INTO auth_identities(provider,subject,user_id,email_cipher) SELECT 'google',subject,$2,email_cipher FROM proof ON CONFLICT(provider,subject) DO UPDATE SET email_cipher=EXCLUDED.email_cipher WHERE auth_identities.user_id=$2 RETURNING user_id",
      [sessionHash, userId],
    ],
  ]);
  return Boolean(result[1][0]);
}
export async function removeGoogle(user, fail) {
  if (!phoneAuthEnabled())
    fail(409, "گوگل تنها راه ورود فعاله؛ فعلاً نمی‌تونی اتصالش رو برداری.");
  if (!user.registered || !user.phone_hash)
    fail(400, "برای قطع گوگل، اول یه شماره به حسابت وصل کن.");
  if (user.role === "admin" && !user.session_admin_access)
    fail(403, "اول ورود خصوصی مدیریت رو کامل کن.");
  await query(
    "DELETE FROM auth_identities WHERE provider='google' AND user_id=$1",
    [user.id],
  );
  return { ok: true };
}
export async function finishGoogle({ code, state, cookie, error }) {
  if (typeof state !== "string" || state.length > 200 || !cookie)
    throw new Error("google_state_invalid");
  const sessionHash = hashToken(cookie);
  const rows = await query(
    "DELETE FROM oauth_states WHERE state_hash=$1 AND session_hash=$2 AND expires_at>NOW() RETURNING *",
    [hashToken(state), sessionHash],
  );
  const attempt = rows[0];
  if (!attempt) throw new Error("google_state_invalid");
  const failPath = attempt.return_path;
  if (error) return { path: failPath, outcome: "cancelled" };
  if (typeof code !== "string" || code.length > 3000)
    throw new Error("google_code_invalid");
  const session = await query(
    "SELECT u.*,s.admin_access AS session_admin_access FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.user_id=$2 AND s.expires_at>NOW()",
    [sessionHash, attempt.user_id],
  );
  const user = session[0];
  if (!user || user.banned) throw new Error("google_session_invalid");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: googleRedirect(),
      grant_type: "authorization_code",
      code_verifier: decryptPhone(attempt.verifier),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("google_exchange_failed");
  const tokens = await response.json();
  const identity = await verifyGoogleIdentity(tokens.id_token, {
    clientId: process.env.GOOGLE_CLIENT_ID,
    nonceHash: attempt.nonce_hash,
    hash: hashToken,
  });
  const existing = (
    await query(
      "SELECT u.* FROM auth_identities a JOIN users u ON u.id=a.user_id WHERE a.provider='google' AND a.subject=$1",
      [identity.subject],
    )
  )[0];
  if (attempt.intent === "link") {
    if (
      !user.registered ||
      (user.role === "admin" && !user.session_admin_access)
    )
      throw new Error("google_link_forbidden");
    if (existing && existing.id !== user.id)
      return {
        path: failPath,
        outcome: await prepareAccountMerge(user, existing, identity, sessionHash)
          ? "merge_required" : "conflict",
      };
    const owned = (
      await query(
        "SELECT subject FROM auth_identities WHERE provider='google' AND user_id=$1",
        [user.id],
      )
    )[0];
    if (owned && owned.subject !== identity.subject)
      return { path: failPath, outcome: "conflict" };
    await query(
      "INSERT INTO auth_identities(provider,subject,user_id,email_cipher) VALUES('google',$1,$2,$3) ON CONFLICT(provider,subject) DO UPDATE SET email_cipher=EXCLUDED.email_cipher WHERE auth_identities.user_id=EXCLUDED.user_id",
      [identity.subject, user.id, encryptPhone(identity.email)],
    );
    return { path: failPath, outcome: "linked" };
  }
  if (existing) {
    if (existing.banned) throw new Error("google_account_suspended");
    const token = randomToken();
    await transaction([
      [
        "INSERT INTO sessions(token_hash,user_id,expires_at,admin_access) VALUES($1,$2,NOW()+INTERVAL '90 days',FALSE)",
        [hashToken(token), existing.id],
      ],
      [
        "UPDATE checkins SET user_id=$1 WHERE user_id=$2 AND $1<>$2 AND $3=FALSE",
        [existing.id, user.id, user.registered],
      ],
      ["DELETE FROM sessions WHERE token_hash=$1", [sessionHash]],
    ]);
    return { path: failPath, outcome: "login", token };
  }
  if (attempt.intent !== "signup" && inviteOnly())
    return { path: failPath, outcome: "invite_required" };
  await query(
    "INSERT INTO pending_google(session_hash,subject,email_cipher,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes') ON CONFLICT(session_hash) DO UPDATE SET subject=EXCLUDED.subject,email_cipher=EXCLUDED.email_cipher,expires_at=EXCLUDED.expires_at",
    [sessionHash, identity.subject, encryptPhone(identity.email)],
  );
  return { path: failPath, outcome: "continue" };
}
