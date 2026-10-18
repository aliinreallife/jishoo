import L from "leaflet";
import { nearestLongitude, activityWeight } from "./map-presentation";

// A small weighted density canvas. Color stays soft enough to read the basemap.
export const CuteHeatLayer = L.Layer.extend({
  initialize(points) { this.points = points; },
  onAdd(map) {
    this._map = map;
    this.canvas = L.DomUtil.create("canvas", "jishoo-heatmap-layer");
    this.canvas.setAttribute("aria-hidden", "true");
    map.getPane("overlayPane").append(this.canvas);
    map.on("moveend resize", this.draw, this);
    map.on("zoomstart", this.hide, this);
    this.draw();
  },
  onRemove(map) {
    map.off("moveend resize", this.draw, this);
    map.off("zoomstart", this.hide, this);
    this.canvas.remove();
  },
  hide() { this.canvas.style.opacity = "0"; },
  draw() {
    const map = this._map, size = map.getSize(), scale = Math.min(window.devicePixelRatio || 1, 1.5);
    if (!size.x || !size.y) return;
    L.DomUtil.setPosition(this.canvas, map.containerPointToLayerPoint([0, 0]));
    this.canvas.width = Math.round(size.x * scale); this.canvas.height = Math.round(size.y * scale);
    this.canvas.style.width = `${size.x}px`; this.canvas.style.height = `${size.y}px`;
    const context = this.canvas.getContext("2d", { willReadFrequently: true });
    context.scale(scale, scale);
    this.points.forEach((point) => {
      const at = map.latLngToContainerPoint([point.lat, nearestLongitude(point.lng, map.getCenter().lng)]);
      const weight = activityWeight(point), radius = 32 + Math.min(36, Math.sqrt(weight) * 6);
      if (at.x < -radius || at.y < -radius || at.x > size.x + radius || at.y > size.y + radius) return;
      const gradient = context.createRadialGradient(at.x, at.y, 0, at.x, at.y, radius);
      gradient.addColorStop(0, `rgba(0,0,0,${Math.min(.68, .2 + Math.log2(weight + 1) * .085)})`);
      gradient.addColorStop(.3, "rgba(0,0,0,.13)"); gradient.addColorStop(1, "rgba(0,0,0,0)");
      context.fillStyle = gradient; context.fillRect(at.x - radius, at.y - radius, radius * 2, radius * 2);
    });
    const image = context.getImageData(0, 0, this.canvas.width, this.canvas.height), pixels = image.data;
    for (let index = 0; index < pixels.length; index += 4) {
      const alpha = pixels[index + 3];
      if (alpha < 4) { pixels[index + 3] = 0; continue; }
      const intensity = Math.min(1, alpha / 180);
      const start = intensity < .5 ? [255, 225, 140] : [246, 188, 189];
      const end = intensity < .5 ? [246, 188, 189] : [171, 143, 221];
      const mix = intensity < .5 ? intensity * 2 : (intensity - .5) * 2;
      pixels[index] = start[0] + (end[0] - start[0]) * mix;
      pixels[index + 1] = start[1] + (end[1] - start[1]) * mix;
      pixels[index + 2] = start[2] + (end[2] - start[2]) * mix;
      pixels[index + 3] = Math.min(170, alpha * .95);
    }
    context.putImageData(image, 0, 0); this.canvas.style.opacity = "1";
  },
});
