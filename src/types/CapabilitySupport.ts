/** `emulated` = library-implemented, not SDK-provided. Distinct from `degraded`. */
export type CapabilitySupport =
  | 'supported'
  | 'emulated'
  | 'degraded'
  | 'experimental'
  | 'unavailable';
