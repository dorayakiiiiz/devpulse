import React from 'react';

// Exact SVG retro illustrations from Figma design
export const AuthDecorations: React.FC = () => {
  return (
    <>
      {/* Left decoration: Retro computer with yellow heart display */}
      <svg
        aria-hidden="true"
        className="absolute left-[4%] top-[31%] hidden h-40 w-44 -rotate-6 md:block"
        viewBox="0 0 176 160"
        fill="none"
      >
        <rect
          x="27"
          y="12"
          width="122"
          height="102"
          rx="14"
          fill="#ffc5c2"
          stroke="#18181b"
          strokeWidth="3"
        />
        <rect
          x="39"
          y="25"
          width="98"
          height="72"
          rx="6"
          fill="#79a7d3"
          stroke="#18181b"
          strokeWidth="3"
        />
        <path
          d="M88 76c-18-11-27-20-27-31 0-9 11-14 18-9 4 2 7 6 9 10 2-4 5-8 9-10 8-5 18 0 18 9 0 11-9 20-27 31Z"
          fill="#ffd95a"
          stroke="#18181b"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M47 114h82l17 20c4 5 1 12-6 12H36c-7 0-10-7-6-12l17-20Z"
          fill="#f5efe3"
          stroke="#18181b"
          strokeWidth="3"
        />
        <path d="M55 132h45" stroke="#18181b" strokeWidth="3" />
        <circle cx="121" cy="132" r="4" fill="#ff6b6b" stroke="#18181b" strokeWidth="2" />
        <circle cx="134" cy="132" r="4" fill="#78d8c5" stroke="#18181b" strokeWidth="2" />
      </svg>

      {/* Right top decoration: Overlapping browser folders with shield badge */}
      <svg
        aria-hidden="true"
        className="absolute right-[5%] top-[8%] hidden h-40 w-48 rotate-3 lg:block"
        viewBox="0 0 192 160"
        fill="none"
      >
        <rect
          x="40"
          y="33"
          width="122"
          height="98"
          rx="8"
          fill="#e89b55"
          stroke="#18181b"
          strokeWidth="3"
        />
        <path d="M40 54h122" stroke="#18181b" strokeWidth="3" />
        <circle cx="52" cy="44" r="4" fill="#ff6b6b" stroke="#18181b" />
        <circle cx="64" cy="44" r="4" fill="#ffd95a" stroke="#18181b" />
        <circle cx="76" cy="44" r="4" fill="#78d8c5" stroke="#18181b" />
        <rect
          x="12"
          y="9"
          width="118"
          height="91"
          rx="8"
          fill="#f5efe3"
          stroke="#18181b"
          strokeWidth="3"
        />
        <path d="M12 30h118" stroke="#18181b" strokeWidth="3" />
        <circle cx="24" cy="19" r="4" fill="#ff6b6b" stroke="#18181b" />
        <circle cx="36" cy="19" r="4" fill="#ffd95a" stroke="#18181b" />
        <circle cx="48" cy="19" r="4" fill="#78d8c5" stroke="#18181b" />
        <circle cx="70" cy="62" r="23" fill="#79a7d3" stroke="#18181b" strokeWidth="3" />
        <path
          d="M55 52c7-7 13-8 20-5l4 7 9 5-4 13-12 8-13-6-7-11 3-11Z"
          fill="#ffd95a"
          stroke="#18181b"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>

      {/* Right bottom decoration: Retro card with rocket taking off */}
      <svg
        aria-hidden="true"
        className="absolute bottom-[5%] right-[4%] hidden h-52 w-52 -rotate-3 md:block"
        viewBox="0 0 208 208"
        fill="none"
      >
        <rect
          x="20"
          y="18"
          width="168"
          height="170"
          rx="10"
          fill="#b8a1d9"
          stroke="#18181b"
          strokeWidth="3"
        />
        <path d="M20 42h168" stroke="#18181b" strokeWidth="3" />
        <circle cx="34" cy="30" r="4" fill="#ff6b6b" stroke="#18181b" />
        <circle cx="47" cy="30" r="4" fill="#ffd95a" stroke="#18181b" />
        <circle cx="60" cy="30" r="4" fill="#78d8c5" stroke="#18181b" />
        <path
          d="M115 64c-17 7-34 25-40 44l25 25c19-6 37-23 44-40l4-28-33-1Z"
          fill="#f5efe3"
          stroke="#18181b"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="m100 133-22 19 2-26-20-5 15-13 25 25Z"
          fill="#ff6b6b"
          stroke="#18181b"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path d="m115 64 33 1-9 19-24-20Z" fill="#79a7d3" stroke="#18181b" strokeWidth="3" />
        <circle cx="118" cy="92" r="9" fill="#78d8c5" stroke="#18181b" strokeWidth="3" />
        <path
          d="M66 142c-8 4-13 11-14 20 10-1 17-5 21-13"
          stroke="#e89b55"
          strokeWidth="7"
          strokeLinecap="round"
        />
      </svg>
    </>
  );
};
