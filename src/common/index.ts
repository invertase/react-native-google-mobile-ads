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

export * from './validate';
import { isUndefined } from './validate';

export function hasOwnProperty(target: unknown, property: PropertyKey) {
  return Object.hasOwnProperty.call(target, property);
}

export function isPropertySet(target: unknown, property: PropertyKey) {
  return (
    hasOwnProperty(target, property) &&
    !isUndefined((target as Record<PropertyKey, unknown>)[property])
  );
}
