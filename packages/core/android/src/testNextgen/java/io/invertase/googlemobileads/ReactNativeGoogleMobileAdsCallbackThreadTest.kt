package io.invertase.googlemobileads

import android.os.Looper
import com.facebook.react.bridge.WritableMap
import io.invertase.googlemobileads.common.ReactNativeEventEmitter
import io.invertase.googlemobileads.interfaces.NativeEvent
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsCallbackThreadTest {
  @Test
  fun adEventsPostedOffThreadAreMarshalledOntoMainLooper() {
    val emitter = ReactNativeEventEmitter.getSharedInstance()
    shadowOf(Looper.getMainLooper()).idle()
    val queuedEventsField =
      ReactNativeEventEmitter::class.java.getDeclaredField("queuedEvents").apply {
        isAccessible = true
      }

    @Suppress("UNCHECKED_CAST")
    val queuedEvents = queuedEventsField.get(emitter) as List<NativeEvent>
    val queuedBefore = queuedEvents.size
    val event =
      object : NativeEvent {
        override fun getEventName(): String = "nextgen-thread-test"

        override fun getEventBody(): WritableMap? = null
      }

    val callbackThread =
      Thread {
        emitter.sendEvent(event)
      }
    callbackThread.start()
    callbackThread.join()

    assertEquals(queuedBefore, queuedEvents.size)
    shadowOf(Looper.getMainLooper()).idle()
    assertEquals(queuedBefore + 1, queuedEvents.size)
  }
}
