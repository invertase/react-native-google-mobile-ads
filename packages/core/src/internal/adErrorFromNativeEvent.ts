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

import type { AdError, AdErrorReason } from '../types/AdError';
import type { ResponseInfo } from '../types/ResponseInfo';
import { NativeError } from './NativeError';

type NativeErrorEvent = {
  code: string;
  message: string;
  responseInfo?: ResponseInfo | null;
  responseInfoJson?: string;
  reason?: string;
  phase?: 'load' | 'show';
};

/**
 * Map legacy wire `code` values onto the v17 `reason` vocabulary.
 * Banner Android historically emitted `error-code-no-fill`; fullscreen emits `no-fill`.
 */
export function reasonFromNativeCode(code: string | undefined): AdErrorReason {
  if (!code) {
    return 'unknown';
  }
  if (code === 'no-fill' || code === 'error-code-no-fill') {
    return 'no-fill';
  }
  if (code === 'mediation-no-fill') {
    return 'mediation-no-fill';
  }
  if (code.startsWith('error-code-')) {
    return code.slice('error-code-'.length) as AdErrorReason;
  }
  // iOS historically used application-identifier-missing / received-invalid-ad-string.
  if (code === 'application-identifier-missing') {
    return 'app-id-missing';
  }
  if (code === 'received-invalid-ad-string') {
    return 'invalid-ad-string';
  }
  return code as AdErrorReason;
}

export function parseResponseInfoPayload<T = ResponseInfo>(
  source:
    | {
        responseInfo?: T | null;
        responseInfoJson?: string | null;
      }
    | null
    | undefined,
): T | undefined {
  if (!source) {
    return undefined;
  }
  if (source.responseInfo && typeof source.responseInfo === 'object') {
    return source.responseInfo;
  }
  if (typeof source.responseInfoJson === 'string' && source.responseInfoJson.length > 0) {
    try {
      return JSON.parse(source.responseInfoJson) as T;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Build `Error & AdErrorPayload` from a native error event.
 * Load-path defaults `phase: 'load'` so no-fill is distinct from show failures
 * (no `SHOW_FAILED` event — show failures use ERROR with phase show when wired).
 */
export function adErrorFromNativeEvent(
  errorEvent: NativeErrorEvent,
  namespace: string,
  phase: 'load' | 'show' = 'load',
): AdError {
  const responseInfo = parseResponseInfoPayload(errorEvent);
  const error = NativeError.fromEvent(
    { code: errorEvent.code, message: errorEvent.message },
    namespace,
  ) as AdError;
  error.reason = (errorEvent.reason as AdErrorReason) || reasonFromNativeCode(errorEvent.code);
  error.phase = errorEvent.phase || phase;
  if (responseInfo) {
    error.responseInfo = responseInfo;
  }
  return error;
}
