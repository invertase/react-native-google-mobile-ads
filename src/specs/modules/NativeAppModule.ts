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
 */

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';
import type { CodegenTypes } from 'react-native';

export interface Spec extends TurboModule {
  // App initialization
  initializeApp(
    options: CodegenTypes.UnsafeObject,
    appConfig: CodegenTypes.UnsafeObject,
  ): Promise<CodegenTypes.UnsafeObject>;
  setAutomaticDataCollectionEnabled(appName: string, enabled: boolean): void;
  deleteApp(appName: string): Promise<void>;

  // Events
  eventsNotifyReady(ready: boolean): void;
  eventsGetListeners(): Promise<CodegenTypes.UnsafeObject>;
  eventsPing(
    eventName: string,
    eventBody: CodegenTypes.UnsafeObject,
  ): Promise<CodegenTypes.UnsafeObject>;
  eventsAddListener(eventName: string): void;
  eventsRemoveListener(eventName: string, all: boolean): void;

  // Required for RN built-in Event Emitter
  addListener(eventName: string): void;
  removeListeners(count: number): void;

  // Meta
  metaGetAll(): Promise<CodegenTypes.UnsafeObject>;

  // JSON
  jsonGetAll(): Promise<CodegenTypes.UnsafeObject>;

  // Preferences
  preferencesSetBool(key: string, value: boolean): Promise<void>;
  preferencesSetString(key: string, value: string): Promise<void>;
  preferencesGetAll(): Promise<CodegenTypes.UnsafeObject>;
  preferencesClearAll(): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNAppModule');
