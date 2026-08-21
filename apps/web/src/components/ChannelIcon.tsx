/** Stroke icons on a 24px grid, matching the rest of the app. Never emoji. */
export function ChannelIcon({ channel, size = 13 }: { channel: string; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  if (channel === 'email') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="M3 7l9 6 9-6" />
      </svg>
    );
  }
  if (channel === 'call') {
    return (
      <svg {...common}>
        <path d="M5 3h4l2 5-2.5 1.5a12 12 0 006 6L16 13l5 2v4a2 2 0 01-2.2 2A17 17 0 013 5.2 2 2 0 015 3z" />
      </svg>
    );
  }
  if (channel === 'meeting') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 11h18" />
      </svg>
    );
  }
  if (channel === 'note') {
    return (
      <svg {...common}>
        <path d="M5 3h9l5 5v13H5z" />
        <path d="M14 3v5h5" />
      </svg>
    );
  }
  // The three LinkedIn channels share the conversation glyph.
  return (
    <svg {...common}>
      <path d="M21 11.5a8.4 8.4 0 01-9 8.4L3 21l1.1-3.4A8.4 8.4 0 1121 11.5z" />
    </svg>
  );
}
