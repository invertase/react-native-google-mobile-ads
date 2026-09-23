package io.invertase.googlemobileads

import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class OnNativeEvent(
  surfaceId: Int,
  viewId: Int,
  private val event: WritableMap,
) : Event<OnNativeEvent>(surfaceId, viewId) {
  override fun getEventName(): String = EVENT_NAME

  override fun getCoalescingKey(): Short = 0

  override fun canCoalesce(): Boolean = false

  override fun getEventData(): WritableMap? = event

  companion object {
    const val EVENT_NAME = "topNativeEvent"
  }
}
