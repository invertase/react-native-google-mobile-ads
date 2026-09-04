/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { AdExpiry, AdStalenessGuidanceMillis, AdStalenessWindowSource } from '../types/AdExpiry';

export type CreateAdExpiryOptions = {
  observedAt: number | null;
  /** Publisher-configured window; when omitted, guidance defaults apply. */
  stalenessWindowMillis?: number;
  /**
   * Format family for guidance defaults. App open uses four hours; everything
   * else uses one hour. Ignored when `stalenessWindowMillis` is set.
   */
  format?: 'app_open' | 'other';
  /** Injectable clock for tests. Defaults to `Date.now`. */
  now?: () => number;
};

export type AdExpiryHandle = AdExpiry & {
  /** Clears timers and listeners. Safe to call more than once. */
  clear(): void;
};

/**
 * Resolve the applied staleness window and its source tag.
 *
 * Matches inventory-expiry Option 1: configured wins; otherwise guidance
 * defaults (4h app open / 1h other).
 */
export function resolveStalenessWindow(options: {
  stalenessWindowMillis?: number;
  format?: 'app_open' | 'other';
}): { stalenessWindowMillis: number; stalenessWindowSource: AdStalenessWindowSource } {
  if (
    typeof options.stalenessWindowMillis === 'number' &&
    Number.isFinite(options.stalenessWindowMillis) &&
    options.stalenessWindowMillis > 0
  ) {
    return {
      stalenessWindowMillis: options.stalenessWindowMillis,
      stalenessWindowSource: 'configured',
    };
  }
  if (options.format === 'app_open') {
    return {
      stalenessWindowMillis: AdStalenessGuidanceMillis.APP_OPEN,
      stalenessWindowSource: 'guidance/app-open',
    };
  }
  return {
    stalenessWindowMillis: AdStalenessGuidanceMillis.OTHER,
    stalenessWindowSource: 'guidance/other',
  };
}

/**
 * Publisher-owned staleness policy timer for held inventory.
 *
 * Used by pooled / multi-format handles (and tests). Edge semantics match
 * `AdExpiry` in the approved API reference.
 */
export function createAdExpiry(options: CreateAdExpiryOptions): AdExpiryHandle {
  const now = options.now ?? (() => Date.now());
  const { stalenessWindowMillis, stalenessWindowSource } = resolveStalenessWindow(options);
  const observedAt = options.observedAt;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cleared = false;
  let edgeFired = false;

  const isStaleByPolicy = (): boolean => {
    if (observedAt == null) {
      return false;
    }
    return now() - observedAt >= stalenessWindowMillis;
  };

  const notifyAll = () => {
    listeners.forEach(listener => {
      try {
        listener();
      } catch {
        // consumer errors must not break other listeners
      }
    });
  };

  const fireEdge = () => {
    if (cleared || edgeFired) {
      return;
    }
    edgeFired = true;
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
    notifyAll();
  };

  if (observedAt != null && !isStaleByPolicy()) {
    const remaining = observedAt + stalenessWindowMillis - now();
    timer = setTimeout(fireEdge, Math.max(0, remaining));
  }

  return {
    stalenessWindowMillis,
    stalenessWindowSource,
    isStaleByPolicy,
    onStaleByPolicy(listener: () => void): () => void {
      if (cleared) {
        return () => undefined;
      }
      listeners.add(listener);
      if (isStaleByPolicy()) {
        // Already past the window: invoke this subscriber synchronously once.
        try {
          listener();
        } catch {
          // ignore
        }
        edgeFired = true;
        if (timer != null) {
          clearTimeout(timer);
          timer = null;
        }
      }
      return () => {
        listeners.delete(listener);
      };
    },
    clear() {
      if (cleared) {
        return;
      }
      cleared = true;
      listeners.clear();
      if (timer != null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
