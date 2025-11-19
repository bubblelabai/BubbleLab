import React from 'react';

export const PearlIcon = ({
  className = 'w-4 h-4',
}: {
  className?: string;
}) => {
  // Generate unique IDs to prevent conflicts when multiple icons are rendered
  const idSuffix = React.useId().replace(/:/g, '');
  const gradientId = `pearl-gradient-${idSuffix}`;
  const glowId = `pearl-glow-${idSuffix}`;
  const strokeId = `pearl-stroke-${idSuffix}`;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Outer soft glow for atmosphere */}
      <circle cx="12" cy="12" r="10" fill={`url(#${glowId})`} />

      {/* Main Sphere Body */}
      <circle cx="12" cy="12" r="9" fill={`url(#${gradientId})`} />

      {/* Subtle rim stroke for definition */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={`url(#${strokeId})`}
        strokeWidth="0.5"
        strokeOpacity="0.4"
      />

      <defs>
        {/* Main body gradient: Light top-left to dark bottom-right */}
        <radialGradient
          id={gradientId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(9 9) rotate(45) scale(16)"
        >
          <stop offset="0" stopColor="#E9D5FF" /> {/* Highlight */}
          <stop offset="0.25" stopColor="#C084FC" />
          <stop offset="0.6" stopColor="#9333EA" /> {/* Main Purple */}
          <stop offset="1" stopColor="#4C1D95" /> {/* Shadow */}
        </radialGradient>

        {/* Soft outer glow */}
        <radialGradient
          id={glowId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(12 12) rotate(90) scale(10)"
        >
          <stop offset="0.8" stopColor="#A855F7" stopOpacity="0" />
          <stop offset="1" stopColor="#A855F7" stopOpacity="0.3" />
        </radialGradient>

        {/* Rim light stroke */}
        <linearGradient
          id={strokeId}
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="white" stopOpacity="0.8" />
          <stop offset="0.5" stopColor="white" stopOpacity="0.1" />
          <stop offset="1" stopColor="#581C87" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
};
