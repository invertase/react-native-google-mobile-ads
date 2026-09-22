package io.invertase.googlemobileads

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class NextGenBackendSmokeTest {
  @Test
  fun reportsSelectedBackend() {
    assertEquals("android-nextgen", ReactNativeGoogleMobileAds.backend)
  }

  @Test
  fun packageFailsFastUntilBackendIsImplemented() {
    val error =
      assertThrows(UnsupportedOperationException::class.java) {
        ReactNativeGoogleMobileAdsPackage.failNotImplemented()
      }
    assertEquals(ReactNativeGoogleMobileAdsPackage.NOT_IMPLEMENTED_MESSAGE, error.message)
  }
}
