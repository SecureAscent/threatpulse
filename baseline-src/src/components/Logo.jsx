import React from "react";

export default function Logo({ size = 32, className = "" }) {
  const teal = "#0e93b8";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ThreatPulse Logo"
      className={className}
    >
      <path
        d="M32 4L8 14v18c0 13 10.5 24 24 28 13.5-4 24-15 24-28V14L32 4z"
        fill={teal}
        fillOpacity="0.15"
        stroke={teal}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <polyline
        points="14,34 22,34 26,24 30,44 34,28 38,38 42,34 50,34"
        stroke={teal}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}