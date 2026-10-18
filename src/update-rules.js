const versionPattern = /^\d+\.\d+\.\d+$/;

export function compareVersions(left, right) {
  if (!versionPattern.test(left) || !versionPattern.test(right)) return null;
  const a = left.split(".").map(Number), b = right.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
  }
  return 0;
}

export function validRelease(value) {
  return Boolean(value && versionPattern.test(value.version) &&
    typeof value.buildId === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value.buildId) &&
    compareVersions(value.minimumSupportedVersion, value.version) !== null &&
    compareVersions(value.minimumSupportedVersion, value.version) <= 0);
}

export function updateRequired(currentVersion, release) {
  return validRelease(release) && compareVersions(currentVersion, release.minimumSupportedVersion) === -1;
}
