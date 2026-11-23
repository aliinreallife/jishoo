// Promo links share the existing /join entrypoint, but are not invitations.
export const normalizePromoCode = (value) => {
  const code = String(value || "").trim().toUpperCase();
  return /^J-[0-9A-F]{12}$/.test(code) ? code : null;
};

export const promoLink = (publicUrl, value) => {
  const code = normalizePromoCode(value);
  if (!code) throw new Error("Invalid promotional code");
  const url = new URL("/join", publicUrl || "https://jishoo.vercel.app");
  url.searchParams.set("promo", code);
  return url.href;
};
