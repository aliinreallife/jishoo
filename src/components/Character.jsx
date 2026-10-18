import React, { memo } from "react";
import { Blobatar } from "@blobatar/react";
import { useGaze } from "@blobatar/react/gaze";
import { shy, happy, love, idle } from "blobatar/expression";
import "blobatar/motion.css";
import "blobatar/gaze.css";

function MovingAvatar({ animate, ...props }) {
  const { ref } = useGaze({ travel: 2.2, lookAt: animate ? "pointer" : null });
  return <Blobatar {...props} ref={ref} animate={animate ? "always" : undefined} />;
}

export const Avatar = memo(function Avatar({
  person,
  name,
  size = 80,
  mood = "idle",
  animate = true,
  className = "",
}) {
  const seed = person?.avatarSeed || person?.name || name || "jishoo:guest";
  return (
    <span
      role="img"
      aria-label={person?.name ? `شخصیت ${person.name}` : "شخصیت جیشو"}
      className={`character profile-avatar-image ${className}`}
      style={{ width: size, height: size }}
    >
      {person?.avatarImage ? (
        <img src={person.avatarImage} className="uploaded-avatar" alt="" />
      ) : (
        <MovingAvatar
          name={seed}
          size={size}
          tone={0.23}
          expression={{ shy, happy, love, idle }[mood] || idle}
          animate={animate}
          title="شخصیت جیشو"
          aria-hidden="true"
        />
      )}
    </span>
  );
});
