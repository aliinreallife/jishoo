import React from "react";
const assets = `${import.meta.env.BASE_URL}assets/`;

export function Mascot({
  mood = "shy",
  size = 120,
  animate = false,
  className = "",
}) {
  return (
    <span
      className={`character mascot-character ${animate ? "mascot-alive" : ""} ${className}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        mood === "happy" ? "قطره‌ی خوشحال جیشو" : "قطره‌ی خجالتی جیشو"
      }
    >
      <img
        src={assets + (mood === "happy" ? "happy-drop.webp" : "shy-drop.webp")}
        alt=""
      />
    </span>
  );
}
export function PairArt({ kind = "together", size = 280, className = "" }) {
  return (
    <span
      className={`pair-art ${className}`}
      style={{ width: size, height: size * 0.75 }}
      role="img"
      aria-label={
        kind === "back-to-back"
          ? "دو قطره‌ی آبی و بنفش، پشت سر هم"
          : "دو قطره‌ی آبی و زرد، با هم"
      }
    >
      <img
        src={
          assets +
          (kind === "back-to-back"
            ? "back-to-back-drops.webp"
            : "together-drops.webp")
        }
        alt=""
      />
    </span>
  );
}
