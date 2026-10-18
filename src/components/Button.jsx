import React from "react";
export default function Button({ children, secondary, lilac, className = "", ...props }) {
  return (
    <button
      className={`button ${secondary ? "button-secondary" : lilac ? "button-lilac" : "button-primary"} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
