import { describe, expect, it } from 'vitest';
import { CHANNELS, channelMeta } from './channelMeta';

describe('channelMeta', () => {
  it('covers all seven channels', () => {
    expect(CHANNELS.map((c) => c.value)).toEqual([
      'li_message', 'li_inmail', 'li_connect', 'email', 'call', 'meeting', 'note',
    ]);
  });

  it('labels each channel without repeating the word LinkedIn three times', () => {
    expect(channelMeta('li_message').label).toBe('Message');
    expect(channelMeta('li_inmail').label).toBe('InMail');
    expect(channelMeta('li_connect').label).toBe('Connect');
  });

  it('marks the three LinkedIn channels as capturable by the extension', () => {
    expect(CHANNELS.filter((c) => c.capturable).map((c) => c.value)).toEqual([
      'li_message', 'li_inmail', 'li_connect',
    ]);
  });

  it('treats note as internal-only, never outreach', () => {
    expect(channelMeta('note').internalOnly).toBe(true);
    expect(channelMeta('call').internalOnly).toBe(false);
  });

  it('falls back to note for an unknown channel rather than throwing', () => {
    expect(channelMeta('carrier_pigeon').label).toBe('Note');
  });
});
