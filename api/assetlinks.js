import { assetLinks } from "../lib/android.js";
export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  res.statusCode = 200;
  res.end(JSON.stringify(assetLinks()));
}
