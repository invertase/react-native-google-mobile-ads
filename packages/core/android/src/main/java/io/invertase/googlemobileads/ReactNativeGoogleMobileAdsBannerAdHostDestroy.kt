package io.invertase.googlemobileads

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

import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactContext
import java.lang.ref.WeakReference

/**
 * Registers a one-shot [LifecycleEventListener] so banner AdViews are destroyed when the host
 * Activity is destroyed even if JS never calls [com.facebook.react.uimanager.ViewManager.onDropViewInstance]
 * (configuration changes keep AppState active — [#892](https://github.com/invertase/react-native-google-mobile-ads/issues/892)).
 *
 * The [ReactContext] is shared by every Activity that hosts a React surface (for example an app
 * widget configuration Activity started by the launcher), and [LifecycleEventListener.onHostDestroy]
 * fires for whichever of them is destroyed. Only the Activity the banner was created in counts:
 * another Activity's destroy must not blank a banner that is still on screen.
 */
object ReactNativeGoogleMobileAdsBannerAdHostDestroy {
  @JvmStatic
  fun attach(
    context: ReactContext,
    onHostDestroy: Runnable,
  ): LifecycleEventListener {
    val hostActivity = WeakReference(context.currentActivity)
    val listener =
      object : LifecycleEventListener {
        override fun onHostResume() {}

        override fun onHostPause() {}

        override fun onHostDestroy() {
          // Activity.isDestroyed is already true while its onDestroy (and so this callback) runs.
          val activity = hostActivity.get()
          if (activity != null && !activity.isDestroyed) {
            return
          }
          context.removeLifecycleEventListener(this)
          onHostDestroy.run()
        }
      }
    context.addLifecycleEventListener(listener)
    return listener
  }

  @JvmStatic
  fun detach(
    context: ReactContext,
    listener: LifecycleEventListener?,
  ) {
    if (listener != null) {
      context.removeLifecycleEventListener(listener)
    }
  }
}
