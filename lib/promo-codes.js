export const LAUNCH_PROMO_ALIAS = "JSHO";

export function normalizePromoCode(value) {
  const code = String(value || "").trim().toUpperCase();
  return code === LAUNCH_PROMO_ALIAS || /^J-[0-9A-F]{12}$/.test(code) ? code : null;
}

// Both spellings use the same database row and redemption history.
export function resolvePromoCode(value, launchCode) {
  const code = normalizePromoCode(value);
  if (code !== LAUNCH_PROMO_ALIAS) return code;
  const canonical = normalizePromoCode(launchCode);
  return canonical === LAUNCH_PROMO_ALIAS ? null : canonical;
}
