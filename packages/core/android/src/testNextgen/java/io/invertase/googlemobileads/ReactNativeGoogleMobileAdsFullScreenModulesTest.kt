package io.invertase.googlemobileads

import android.os.Bundle
import com.facebook.react.bridge.JavaOnlyArray
import com.facebook.react.bridge.JavaOnlyMap
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.google.android.libraries.ads.mobile.sdk.common.Ad
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback
import com.google.android.libraries.ads.mobile.sdk.common.AdRequest
import com.google.android.libraries.ads.mobile.sdk.common.AdValue
import com.google.android.libraries.ads.mobile.sdk.common.PrecisionType
import com.google.android.libraries.ads.mobile.sdk.common.ResponseInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35])
class ReactNativeGoogleMobileAdsFullScreenModulesTest {
  private val packageUnderTest = ReactNativeGoogleMobileAdsPackage()

  @Test
  fun packageDescribesEveryFullScreenModule() {
    assertModule<ReactNativeGoogleMobileAdsAppOpenModule>(
      ReactNativeGoogleMobileAdsAppOpenModule.NAME,
    )
    assertModule<ReactNativeGoogleMobileAdsInterstitialModule>(
      ReactNativeGoogleMobileAdsInterstitialModule.NAME,
    )
    assertModule<ReactNativeGoogleMobileAdsRewardedModule>(
      ReactNativeGoogleMobileAdsRewardedModule.NAME,
    )
    assertModule<ReactNativeGoogleMobileAdsRewardedInterstitialModule>(
      ReactNativeGoogleMobileAdsRewardedInterstitialModule.NAME,
    )
  }

  @Test
  fun fullScreenModulesExposeClassicMethodNamesAndEventChannels() {
    assertModuleSurface(
      ReactNativeGoogleMobileAdsAppOpenModule(null),
      "appOpen",
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_APP_OPEN,
    )
    assertModuleSurface(
      ReactNativeGoogleMobileAdsInterstitialModule(null),
      "interstitial",
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_INTERSTITIAL,
    )
    assertModuleSurface(
      ReactNativeGoogleMobileAdsRewardedModule(null),
      "rewarded",
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED,
    )
    assertModuleSurface(
      ReactNativeGoogleMobileAdsRewardedInterstitialModule(null),
      "rewardedInterstitial",
      ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_REWARDED_INTERSTITIAL,
    )
  }

  @Test
  fun loadedAndPaidEventsCarryResponseInfo() {
    val module = CapturingFullScreenModule()
    val ad = fakeAd()

    module.sendLoadedEvent(7, "unit-id", ad)
    val loaded = module.events.single()
    assertEquals(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_LOADED, loaded.type)
    val loadedResponse =
      loaded.data
        ?.getMap("responseInfo")
        ?.toHashMap()
        .orEmpty()
    assertEquals("response-id", loadedResponse["responseId"])
    assertTrue(loadedResponse.containsKey("adapterResponses"))

    module.events.clear()
    module.sendPaidEvent(
      7,
      "unit-id",
      ad,
      AdValue(PrecisionType.PRECISE, 1_500_000, "USD"),
    )
    val paid = module.events.single()
    assertEquals(ReactNativeGoogleMobileAdsEvent.GOOGLE_MOBILE_ADS_EVENT_PAID, paid.type)
    val paidMap = paid.data?.toHashMap().orEmpty()
    val paidResponse =
      paid.data
        ?.getMap("responseInfo")
        ?.toHashMap()
        .orEmpty()
    assertEquals("response-id", paidResponse["responseId"])
    assertFalse(paidResponse.containsKey("adapterResponses"))
    assertEquals("USD", paidMap["currency"])
    assertEquals("1500000", paidMap["valueMicros"])
  }

  @Test
  fun pooledAdoptionDoesNotEmitLoadedEvent() {
    val module = CapturingFullScreenModule()

    module.adoptPolledAd(11, "unit-id", fakeAd())

    assertTrue(module.events.isEmpty())
  }

  private inline fun <reified T> assertModule(name: String) {
    val info = packageUnderTest.getReactModuleInfoProvider().getReactModuleInfos()[name]
    assertNotNull(info)
    assertEquals(name, info?.className)
    assertTrue(info?.name == name)
  }

  private fun assertModuleSurface(
    module: ReactNativeGoogleMobileAdsFullScreenAdModule<*>,
    methodPrefix: String,
    eventName: String,
  ) {
    assertEquals(eventName, module.getAdEventName())
    listOf("Load", "Show", "Destroy").forEach { suffix ->
      val method =
        module.javaClass.methods.single {
          it.name == "$methodPrefix$suffix"
        }
      assertNotNull(method.getAnnotation(ReactMethod::class.java))
    }
  }

  private fun fakeAd(): Ad {
    val responseInfo =
      ResponseInfo(
        "adapter.class",
        "response-id",
        Bundle(),
        null,
        emptyList(),
      )
    return Proxy.newProxyInstance(
      Ad::class.java.classLoader,
      arrayOf(Ad::class.java),
    ) { proxy, method, args ->
      when (method.name) {
        "getPlacementId" -> 0L
        "setPlacementId", "destroy" -> null
        "getAdUnitId" -> "unit-id"
        "getResponseInfo" -> responseInfo
        "toString" -> "FakeAd"
        "hashCode" -> System.identityHashCode(proxy)
        "equals" -> proxy === args?.firstOrNull()
        else -> null
      }
    } as Ad
  }

  private data class CapturedEvent(
    val type: String,
    val data: WritableMap?,
  )

  private class CapturingFullScreenModule : ReactNativeGoogleMobileAdsFullScreenAdModule<Ad>(null, "test") {
    val events = mutableListOf<CapturedEvent>()

    override fun getAdEventName(): String = "test-event"

    override fun loadAd(
      adRequest: AdRequest,
      adLoadCallback: AdLoadCallback<Ad>,
    ) = Unit

    override fun sendAdEvent(
      type: String,
      requestId: Int,
      adUnitId: String,
      error: WritableMap?,
      data: WritableMap?,
    ) {
      events += CapturedEvent(type, data)
    }

    override fun responseInfoMap(responseInfo: ResponseInfo): WritableMap =
      JavaOnlyMap.of(
        "responseId",
        responseInfo.responseId,
        "adapterClassName",
        responseInfo.adapterClassName,
        "adapterResponses",
        JavaOnlyArray(),
      )

    override fun createEventMap(): WritableMap = JavaOnlyMap()

    override fun paidEventPayload(
      value: AdValue,
      responseInfo: ResponseInfo,
    ): WritableMap =
      JavaOnlyMap.of(
        "currency",
        value.currencyCode,
        "precision",
        3.0,
        "value",
        value.valueMicros * 1e-6,
        "valueMicros",
        value.valueMicros.toString(),
        "responseInfo",
        JavaOnlyMap.of(
          "responseId",
          responseInfo.responseId,
          "adapterClassName",
          responseInfo.adapterClassName,
        ),
      )
  }
}
