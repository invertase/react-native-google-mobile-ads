package io.invertase.googlemobileads

import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.Promise
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsPreInitializationTest {
  private lateinit var module: ReactNativeGoogleMobileAdsModule

  @Before
  fun setUp() {
    NextGenMobileAdsGate.resetForTests()
    module = ReactNativeGoogleMobileAdsModule(BridgeReactContext(RuntimeEnvironment.getApplication()))
  }

  @After
  fun tearDown() {
    NextGenMobileAdsGate.resetForTests()
  }

  @Test
  fun constantsAreSafeBeforeInitialization() {
    assertEquals("1.4.0", module.constants["sdkVersion"])
    assertEquals("android-next-gen", module.constants["backend"])
  }

  @Test
  fun settersQueueBeforeInitializationInsteadOfTouchingSdk() {
    module.setAppVolume(0.4f)
    module.setAppMuted(true)
    module.setRequestConfiguration(JavaOnlyMap(), noOpPromise())

    assertEquals(3, NextGenMobileAdsGate.pendingActionCount())
  }

  @Test
  fun initializationCallbackPermanentlyOpensGate() {
    var firstRan = false
    var laterRan = false
    NextGenMobileAdsGate.runWhenInitialized { firstRan = true }

    NextGenMobileAdsGate.markInitialized()
    NextGenMobileAdsGate.runWhenInitialized { laterRan = true }

    assertEquals(true, firstRan)
    assertEquals(true, laterRan)
    assertEquals(0, NextGenMobileAdsGate.pendingActionCount())
  }

  @Test
  fun throwingQueuedActionDoesNotStrandLaterWork() {
    var rejected = false
    var laterRan = false
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = { rejected = it.code == "internal-error" },
    ) {
      error("queued failure")
    }
    NextGenMobileAdsGate.runWhenInitialized { laterRan = true }

    NextGenMobileAdsGate.markInitialized()

    assertEquals(true, rejected)
    assertEquals(true, laterRan)
    assertEquals(0, NextGenMobileAdsGate.pendingActionCount())
  }

  @Test
  fun initializationFailureRejectsQueuedAndFutureWork() {
    val failures = mutableListOf<NextGenMobileAdsGate.Failure>()
    var actionRan = false
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = failures::add,
    ) {
      actionRan = true
    }

    NextGenMobileAdsGate.markInitializationFailed("app-id-missing", "missing")
    NextGenMobileAdsGate.runWhenInitialized(
      onFailure = failures::add,
    ) {
      actionRan = true
    }

    assertEquals(false, actionRan)
    assertEquals(2, failures.size)
    assertEquals(listOf("app-id-missing", "app-id-missing"), failures.map { it.code })
    assertEquals(0, NextGenMobileAdsGate.pendingActionCount())
  }

  private fun noOpPromise(): Promise =
    Proxy.newProxyInstance(
      Promise::class.java.classLoader,
      arrayOf(Promise::class.java),
    ) { _, _, _ -> null } as Promise
}
