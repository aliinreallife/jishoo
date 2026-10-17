import { createRemoteJWKSet, jwtVerify } from "jose";
import { createHash } from "node:crypto";
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
  { timeoutDuration: 5000 },
);
export const pkceChallenge = (value) =>
  createHash("sha256").update(value).digest("base64url");
export function googleAuthorization({
  clientId,
  redirectUri,
  state,
  nonce,
  verifier,
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email",
    state,
    nonce,
    code_challenge: pkceChallenge(verifier),
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return url.href;
}
export async function verifyGoogleIdentity(
  token,
  { clientId, nonceHash, hash, keys = googleKeys },
) {
  const { payload } = await jwtVerify(token, keys, {
    algorithms: ["RS256"],
    audience: clientId,
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    maxTokenAge: "10m",
    clockTolerance: 10,
  });
  if (
    typeof payload.sub !== "string" ||
    payload.sub.length > 255 ||
    !payload.sub ||
    (payload.azp && payload.azp !== clientId) ||
    payload.email_verified !== true ||
    typeof payload.email !== "string" ||
    payload.email.length > 254 ||
    !/^\S+@\S+\.\S+$/.test(payload.email) ||
    typeof payload.nonce !== "string" ||
    hash(payload.nonce) !== nonceHash
  )
    throw new Error("google_identity_invalid");
  return { subject: payload.sub, email: payload.email.toLowerCase() };
}
