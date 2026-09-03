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

const warned = new Set<string>();

/**
 * Emits a development-only warning at most once per `key`.
 *
 * Keyed rather than unconditional because every call site here sits on a path
 * that runs repeatedly: a hook body runs on every render, and a pool can be
 * created per screen. An unkeyed warning would flood the log and get muted,
 * which defeats the point of warning at all.
 *
 * Silent in release builds.
 */
export function warnOnce(key: string, message: string): void {
  if (!__DEV__ || warned.has(key)) {
    return;
  }
  warned.add(key);
  // eslint-disable-next-line no-console -- a development warning is the whole point of this module
  console.warn(`[react-native-google-mobile-ads] ${message}`);
}

/** Clears the dedupe set. Test-only; not part of the public surface. */
export function resetWarnOnce(): void {
  warned.clear();
}
