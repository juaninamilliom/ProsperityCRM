export interface ChannelMeta {
  value: string;
  label: string;
  /** True for the three LinkedIn channels: the extension can log these at the
   *  moment you send them, which is the only way this log stays honest. */
  capturable: boolean;
  /** A note records a thought, not contact. It must never count as outreach. */
  internalOnly: boolean;
}

export const CHANNELS: ChannelMeta[] = [
  { value: 'li_message', label: 'Message', capturable: true, internalOnly: false },
  { value: 'li_inmail', label: 'InMail', capturable: true, internalOnly: false },
  { value: 'li_connect', label: 'Connect', capturable: true, internalOnly: false },
  { value: 'email', label: 'Email', capturable: false, internalOnly: false },
  { value: 'call', label: 'Call', capturable: false, internalOnly: false },
  { value: 'meeting', label: 'Meeting', capturable: false, internalOnly: false },
  { value: 'note', label: 'Note', capturable: false, internalOnly: true },
];

const FALLBACK = CHANNELS[CHANNELS.length - 1];

export function channelMeta(channel: string): ChannelMeta {
  return CHANNELS.find((entry) => entry.value === channel) ?? FALLBACK;
}
