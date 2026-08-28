/**
 * Messages between the side panel and the content script.
 *
 * The version is the guard against a stale content script: reloading the
 * extension leaves the previous content.js running in LinkedIn tabs that were
 * already open, and a panel that reads a profile from an older script sees
 * fields missing. The panel checks the version on PING and injects the
 * current script when it differs. Bump it whenever the response shape changes.
 */
export const PROTOCOL_VERSION = 3;

export type ProfileUpdatedMessage = {
  type: 'PROFILE_UPDATED';
  url: string;
  version: number;
  profile: import('./linkedin-parser').ParsedCandidateProfile;
  trace: string[];
};
