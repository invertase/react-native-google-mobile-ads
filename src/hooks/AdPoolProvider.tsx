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

import * as React from 'react';

import type { AdPoolConfig } from '../types/AdPool';

export type AdPoolProviderProps = {
  /**
   * Pool configs to own for the provider lifetime (typically from
   * AdPoolPresets).
   *
   * Reconciled by `poolId`, not by array identity: the provider creates pools
   * for ids that appear, destroys pools for ids that disappear, and leaves
   * existing pools untouched when only the array identity changed. A forgotten
   * `useMemo` therefore cannot tear down and recreate native pools every
   * render. `useMemo` is an optimization here, never a correctness
   * requirement.
   *
   * Reusing a `poolId` with a different config replaces that pool, because the
   * id is the identity.
   */
  pools: AdPoolConfig[];
  children: React.ReactNode;
};

/**
 * Declarative pool ownership. Creates pools for the configs it is given and
 * destroys them on unmount, reconciling by `poolId` on every render rather
 * than by array identity.
 *
 * Stub: passes children through until native pool wiring lands.
 */
export function AdPoolProvider(props: AdPoolProviderProps): React.ReactElement {
  const { children } = props;
  return React.createElement(React.Fragment, null, children);
}
