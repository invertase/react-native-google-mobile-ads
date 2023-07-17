package io.invertase.googlemobileads

import com.facebook.react.bridge.WritableMap
import com.facebook.react.uimanager.events.Event

class OnNativeEvent(viewId: Int, private val event: WritableMap) : Event<OnNativeEvent>(viewId) {

    override fun getEventName(): String {
        return EVENT_NAME
    }

    override fun getCoalescingKey(): Short = 0

    override fun getEventData(): WritableMap? {
        return event
    }

    companion object {
        const val EVENT_NAME = "topNative"
    }
}