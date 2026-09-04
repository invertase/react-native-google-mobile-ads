import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

/**
 * Example/test-app-only TurboModule for native integration probes (Pattern C).
 * Product-neutral seed seams for later FEAT work (reparent / expiry / ResponseInfo).
 * Not part of the published `react-native-google-mobile-ads` package.
 */
export interface Spec extends TurboModule {
  /** Registration ping — returns `ok:<platform>` when the native module is linked. */
  ping(): Promise<string>;

  /**
   * Expiry probe seam: set a debug inventory TTL override in milliseconds.
   * `0` clears the override. Seed only — product pools are not wired yet.
   */
  setDebugInventoryTtlMs(ttlMs: number): Promise<boolean>;

  /**
   * Read back the debug TTL override. `-1` means unset (production policy).
   */
  getDebugInventoryTtlMs(): Promise<number>;

  /**
   * Reparent / delayed-attach probe seam: whether load-unattached-then-attach
   * is the documented classic banner path this harness expects later FEAT to exercise.
   */
  supportsDelayedBannerAttach(): Promise<boolean>;

  /**
   * ResponseInfo fixture seam: product-neutral JSON matching the approved
   * ResponseInfo / PaidResponseInfo shape. `kind`: `loaded` | `no-fill` | `paid-compact`.
   */
  getResponseInfoFixtureJson(kind: string): Promise<string>;
}

/** Resolve at call time so a cold import cannot permanently cache a null registry miss. */
export function getNativeRNGMATesting(): Spec | null {
  return TurboModuleRegistry.get<Spec>('NativeRNGMATesting');
}

export default getNativeRNGMATesting();
