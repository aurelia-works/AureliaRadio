/** 16px line icons, 1.5px stroke, drawn for this app. */
type P = { size?: number };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const SidebarIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.25" />
    <path d="M6 2.75v10.5M3.5 5.5h0.5M3.5 7.5h0.5" />
  </svg>
);

export const SlidersIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6" />
    <circle cx="10" cy="4.5" r="1.5" />
    <circle cx="6" cy="11.5" r="1.5" />
  </svg>
);

export const SwapIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M3 5.5h9.5L10 3M13 10.5H3.5L6 13" />
  </svg>
);

export const MicIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <rect x="5.75" y="1.75" width="4.5" height="8" rx="2.25" />
    <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.25" />
  </svg>
);

export const CloseIcon = ({ size = 16 }: P) => (
  <svg {...base(size)}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </svg>
);

export const CheckIcon = ({ size = 12 }: P) => (
  <svg {...base(size)}>
    <path d="M3.5 8.5l3 3 6-7" />
  </svg>
);
