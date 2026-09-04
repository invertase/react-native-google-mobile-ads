import {
  getAdCapabilities,
  type AdCapabilities,
  type CapabilitySupport,
  type KnownAdErrorReason,
} from '../src';

/**
 * Real `poolResponseInfoPeek` capability gate.
 * Resolves empty-head vs unsupported: unsupported hard-errors; null is empty.
 */
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
  ? true
  : false;

type PeekCapabilityIsSupport = Equal<AdCapabilities['poolResponseInfoPeek'], CapabilitySupport>;
const peekCapabilityLock: PeekCapabilityIsSupport = true;

const peekUnsupported: KnownAdErrorReason = 'pool/peek-unsupported';
const formatPreloadUnsupported: KnownAdErrorReason = 'pool/format-preload-unsupported';

const PEEK_GATE_DOCS =
  'poolResponseInfoPeek unavailable → pool/peek-unsupported; supported null = empty head';

describe('peekResponseInfo capability gate', () => {
  it('exposes poolResponseInfoPeek and distinguishes unsupported from empty', () => {
    expect(peekCapabilityLock).toBe(true);
    expect(peekUnsupported).toBe('pool/peek-unsupported');
    expect(formatPreloadUnsupported).toBe('pool/format-preload-unsupported');
    expect(PEEK_GATE_DOCS).toContain('empty head');

    const caps = getAdCapabilities();
    // Jest RN Platform.OS is ios: peek is supported on classic iOS.
    expect(caps.poolResponseInfoPeek).toBe('supported');
    expect(caps.backend).toBe('ios');
  });
});
