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

import { getNativeModule } from './registry/nativeModule';
import { SharedEventEmitter } from './SharedEventEmitter';
import { App, Config } from '../types/Module.interface';
import { GoogleMobileAdsNativeModule } from '../types/GoogleMobileAdsNativeModule';

export class AppModule {
  _app: App;
  _nativeModule: unknown;
  _config: Config;

  static __extended__ = {};

  constructor(app: App, config: Config) {
    this._app = app;
    this._nativeModule = null;
    this._config = Object.assign({}, config);
  }

  get app() {
    return this._app;
  }

  get emitter() {
    return SharedEventEmitter;
  }

  eventNameForApp(...args: string[]) {
    return `${this.app.name}-${args.join('-')}`;
  }

  get native() {
    if (this._nativeModule) {
      return this._nativeModule as GoogleMobileAdsNativeModule;
    }
    this._nativeModule = getNativeModule(this);
    return this._nativeModule as GoogleMobileAdsNativeModule;
  }
}

// Instance of checks don't work once compiled
AppModule.__extended__ = {};
