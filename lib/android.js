export function assetLinks(env = process.env) {
  const packageName = env.ANDROID_PACKAGE_ID || "app.jishoo.twa";
  if (!/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)+$/.test(packageName))
    return [];
  const fingerprints = String(env.ANDROID_SHA256_CERTIFICATES || "")
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^([A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(s));
  if (!fingerprints.length) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: packageName,
        sha256_cert_fingerprints: [...new Set(fingerprints)],
      },
    },
  ];
}
