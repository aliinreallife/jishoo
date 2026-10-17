import { initialize } from "../../lib/database.js";
import { finishGoogle } from "../../lib/google-auth.js";
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  const origin = process.env.PUBLIC_APP_URL || "https://jishoo.vercel.app";
  let path = "/",
    outcome = "error";
  try {
    if (req.method !== "GET") throw new Error("invalid_method");
    await initialize();
    const url = new URL(req.url, origin);
    const cookie = String(req.headers.cookie || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("jishoo_session="))
      ?.slice(15);
    const result = await finishGoogle({
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
      error: url.searchParams.get("error"),
      cookie,
    });
    path = result.path;
    outcome = result.outcome;
    if (result.token)
      res.setHeader(
        "Set-Cookie",
        `jishoo_session=${result.token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=7776000; Secure`,
      );
  } catch (error) {
    console.warn("[jishoo-google]", error.code || error.name);
  }
  const target = new URL(path, origin);
  target.searchParams.set("google", outcome);
  res.statusCode = 303;
  res.setHeader("Location", target.href);
  res.end();
}
