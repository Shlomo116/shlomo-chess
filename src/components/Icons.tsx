type P = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconArrow = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M19 12H5M11 18l-6-6 6-6" />
  </svg>
);

export const IconChevronStart = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <path d="M18 6l-6 6 6 6M7 5v14" />
  </svg>
);
export const IconChevronEnd = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l6 6-6 6M17 5v14" />
  </svg>
);
export const IconPrev = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
export const IconNext = ({ size = 17 }: P) => (
  <svg {...base(size)}>
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export const IconSoundOn = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" />
  </svg>
);
export const IconSoundOff = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M11 5L6 9H2v6h4l5 4V5z" />
    <path d="M22 9l-6 6M16 9l6 6" />
  </svg>
);

export const IconFlip = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M21 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v3M3 16v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
    <path d="M7 12l5-4 5 4M17 12l-5 4-5-4" opacity="0.55" />
  </svg>
);

export const IconCopy = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <rect x="9" y="9" width="12" height="12" rx="2.5" />
    <path d="M5 15V5a2 2 0 012-2h8" />
  </svg>
);

export const IconCheck = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

export const IconShare = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" />
    <path d="M12 15V3M8 7l4-4 4 4" />
  </svg>
);

export const IconSend = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M21 3L10.5 13.5M21 3l-6.6 18-3.9-7.5L3 9.6 21 3z" />
  </svg>
);

export const IconFlag = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M5 22V4M5 4h11l-1.6 3.5L16 11H5" />
  </svg>
);

export const IconHandshake = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M8 13l2.5 2.5a1.8 1.8 0 002.6 0L20 9l-4-4-2 1.5" />
    <path d="M4 9l4-4 3 2.5" />
    <path d="M4 9l4 4M11 18l1.5 1.5" />
  </svg>
);

export const IconRestart = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </svg>
);

export const IconDownload = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M12 3v12M8 11l4 4 4-4M4 20h16" />
  </svg>
);

export const IconUsers = ({ size = 26 }: P) => (
  <svg {...base(size)}>
    <path d="M16 20v-1.6a4 4 0 00-4-4H6a4 4 0 00-4 4V20" />
    <circle cx="9" cy="7.5" r="3.4" />
    <path d="M22 20v-1.6a4 4 0 00-3-3.87M16.5 4.2a4 4 0 010 7.1" />
  </svg>
);

export const IconCpu = ({ size = 26 }: P) => (
  <svg {...base(size)}>
    <rect x="6" y="6" width="12" height="12" rx="2.5" />
    <path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3" />
  </svg>
);

export const IconBoard = ({ size = 26 }: P) => (
  <svg {...base(size)}>
    <rect x="3" y="3" width="18" height="18" rx="2.5" />
    <path d="M3 9h18M3 15h18M9 3v18M15 3v18" opacity="0.55" />
  </svg>
);

export const IconClose = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);

export const IconExit = ({ size = 18 }: P) => (
  <svg {...base(size)}>
    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
    <path d="M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const IconLink = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />
  </svg>
);
