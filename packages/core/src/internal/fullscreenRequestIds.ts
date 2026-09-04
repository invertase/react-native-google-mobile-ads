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

/**
 * Shared requestId space for classic MobileAd instances and polled pool ads.
 * Both land in the same native FullScreenAdModule slot maps, so ids must not
 * collide across createForAdRequest and AdPool.poll.
 */
let nextFullscreenRequestId = 0;

export function allocateFullscreenRequestId(): number {
  return nextFullscreenRequestId++;
}

/** Test-only reset. */
export function resetFullscreenRequestIdsForTests(): void {
  nextFullscreenRequestId = 0;
}
