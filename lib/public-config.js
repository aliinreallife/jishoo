export function mapConfig() {
  return {
    url: `https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(process.env.CARTO_KEY || "")}`,
    attribution: "© OpenStreetMap contributors, © CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  };
}
