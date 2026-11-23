import { normalizePromoCode } from "../lib/promo-codes.js";

export { normalizePromoCode };

export const promoLink = (publicUrl, value) => {
  const code = normalizePromoCode(value);
  if (!code) throw new Error("Invalid promotional code");
  const url = new URL("/join", publicUrl || "https://jishoo.vercel.app");
  url.searchParams.set("promo", code);
  return url.href;
};
