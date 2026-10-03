'use client';

import { useState } from 'react';

// Uses the exact project logo at /public/logo.png when present,
// falling back to the inline mark if the file is missing.
export default function Logo({ size = 32 }: { size?: number }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label="NextRouter logo"
        style={{ display: 'block', borderRadius: '50%' }}
      >
        <circle cx="32" cy="32" r="30" fill="#000" />
        <circle cx="32" cy="32" r="26.5" fill="none" stroke="#fff" strokeWidth="4" />
        <g stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="butt">
          <path d="M13 22.5h16.5L36 29h9" />
          <path d="M13 32h32" />
          <path d="M13 41.5h16.5L36 35h9" />
        </g>
        <polygon points="45,23.5 57,32 45,40.5" fill="#fff" />
      </svg>
    );
  }

  return (
    <img
      src="/logo.png"
      width={size}
      height={size}
      alt="NextRouter logo"
      onError={() => setMissing(true)}
      style={{ display: 'block', borderRadius: '50%', objectFit: 'cover' }}
    />
  );
}
