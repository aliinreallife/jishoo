import React from "react";
import { Blobatar } from "@blobatar/react";
import { shy, happy, love, idle } from "blobatar/expression";
import "blobatar/motion.css";

export function Character({
  person,
  name,
  size = 80,
  mood = "idle",
  animate = false,
  className = "",
}) {
  const seed = person?.avatarSeed || person?.name || name || "jishoo:guest";
  return (
    <span
      role="img"
      aria-label={person?.name ? `شخصیت ${person.name}` : "شخصیت جیشو"}
      className={`character ${className}`}
      style={{ width: size, height: size }}
    >
      <Blobatar
        name={seed}
        size={size}
        tone={0.23}
        expression={{ shy, happy, love, idle }[mood] || idle}
        animate={animate ? "hover" : undefined}
        title="شخصیت جیشو"
        aria-hidden="true"
      />
    </span>
  );
}
