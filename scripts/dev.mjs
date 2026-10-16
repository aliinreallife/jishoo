import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
import { spawn } from "node:child_process";
import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";

const caFile =
  process.env.SSL_CERT_FILE ||
  process.env.NODE_EXTRA_CA_CERTS ||
  "/etc/ssl/certs/ca-certificates.crt";
let ca = rootCertificates;
if (caFile) {
  try {
    ca = [...ca, readFileSync(caFile, "utf8")];
  } catch {}
}
if (
  process.env.HTTPS_PROXY ||
  process.env.https_proxy ||
  process.env.HTTP_PROXY ||
  process.env.http_proxy
)
  setGlobalDispatcher(
    new EnvHttpProxyAgent({ requestTls: { ca }, proxyTls: { ca } }),
  );
try {
  process.loadEnvFile(".env.local");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const remote = process.env.JISHOO_API_PROXY;
if (!remote && !process.env.DATABASE_URL && process.env.VERCEL_TOKEN) {
  const response = await fetch(
    "https://api.vercel.com/v3/env/pull/prj_iwtH2cbVnsK0lVAldHVOC1RR7tE1?target=development&teamId=team_yBAhttkbFYf94EWHi16YePGi",
    { headers: { Authorization: "Bearer " + process.env.VERCEL_TOKEN } },
  );
  if (response.ok) {
    const result = await response.json();
    for (const key of [
      "DATABASE_URL",
      "APP_SECRET",
      "TESTING_MODE",
      "INVITE_ONLY",
      "PUBLIC_APP_URL",
      "BOOTSTRAP_INVITE_CODE",
    ])
      if (result.env[key]) process.env[key] = result.env[key];
    console.log(
      "Loaded Jishoo server configuration securely; values are not logged.",
    );
  } else
    throw new Error(
      "Cannot load development server configuration: HTTP " + response.status,
    );
}
const { default: handler } = await import("../api/app.js");
const server = createServer(async (req, res) => {
  try {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (
        bytes >
        (new URL(req.url, "http://localhost").searchParams.get("action") ===
        "avatar"
          ? 100000
          : 16000)
      ) {
        res.statusCode = 413;
        res.end("Request too large");
        return;
      }
      chunks.push(chunk);
    }
    const raw = Buffer.concat(chunks);
    if (remote) {
      const target = new URL(req.url, remote);
      const headers = {};
      for (const key of ["cookie", "content-type", "accept"])
        if (req.headers[key]) headers[key] = req.headers[key];
      if (req.method === "POST") headers.origin = new URL(remote).origin;
      const response = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === "POST" ? raw : undefined,
      });
      res.statusCode = response.status;
      res.setHeader(
        "Content-Type",
        response.headers.get("content-type") || "application/json",
      );
      res.setHeader("Cache-Control", "no-store");
      const cookies = response.headers.getSetCookie();
      if (cookies.length)
        res.setHeader(
          "Set-Cookie",
          cookies.map((value) => value.replace(/;\s*Secure/gi, "")),
        );
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    req.body = raw.length ? JSON.parse(raw.toString()) : {};
    await handler(req, res);
  } catch (error) {
    console.error("Development API request failed:", error.code || error.name);
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "ارتباط با سرور توسعه برقرار نشد." }));
  }
});
server.listen(3001, "127.0.0.1", () =>
  console.log(
    remote
      ? "Development API forwards to the explicitly selected Vercel backend."
      : "Jishoo development API ready on port 3001.",
  ),
);
const vite = spawn(
  process.execPath,
  ["node_modules/vite/bin/vite.js", ...process.argv.slice(2)],
  { stdio: "inherit", env: process.env },
);
const stop = () => {
  vite.kill("SIGTERM");
  server.close(() => process.exit(0));
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", (code) => server.close(() => process.exit(code || 0)));
