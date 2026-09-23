package io.invertase.googlemobileads

import java.util.concurrent.atomic.AtomicBoolean

/**
 * Native-ad load settlement helpers.
 *
 * Historic hang (#870 / #755): a successful GMA callback with a missing `responseId` used
 * `?: return` and left the TurboModule promise pending forever. Load failures that never
 * reached a reject path did the same. Callers must map every terminal GMA outcome to resolve
 * or reject — never no-op.
 *
 * Separately, [AdLoader][com.google.android.gms.ads.AdLoader] was held only as a local in
 * `loadAd()`; if GC collected it before the network callback, neither success nor failure
 * fired. Hold the loader (via [LoaderRetention]) until the promise settles.
 *
 * Dual success/failure callbacks must settle the promise at most once ([OnceOnlySettle]).
 */
object ReactNativeGoogleMobileAdsNativeAdLoad {
  sealed class Outcome {
    data class Resolve(
      val responseId: String,
    ) : Outcome()

    data class Reject(
      val code: String,
      val message: String,
    ) : Outcome()
  }

  const val MISSING_RESPONSE_ID_CODE = "internal-error"
  const val MISSING_RESPONSE_ID_MESSAGE = "Failed to get a valid response ID from the loaded ad."

  /**
   * Map a loaded-ad response id to a promise outcome. Blank/null must [Outcome.Reject] — never
   * a silent skip (that is the #870 hang).
   */
  @JvmStatic
  fun outcomeForLoadedResponseId(responseId: String?): Outcome {
    val id = responseId?.trim()?.takeIf { it.isNotEmpty() }
    return if (id == null) {
      Outcome.Reject(MISSING_RESPONSE_ID_CODE, MISSING_RESPONSE_ID_MESSAGE)
    } else {
      Outcome.Resolve(id)
    }
  }

  /**
   * Strong reference for an in-flight AdLoader (or Next-Gen equivalent stand-in). Cleared only
   * after resolve/reject so GC cannot drop the SDK callback target mid-request.
   */
  class LoaderRetention {
    @Volatile
    private var loader: Any? = null

    fun retain(value: Any) {
      loader = value
    }

    fun get(): Any? = loader

    fun clear() {
      loader = null
    }

    fun isRetained(): Boolean = loader != null
  }

  /**
   * Once-only settle gate for a single load promise. First [trySettle] wins; later callbacks
   * must drop (e.g. destroy a late-loaded ad) without resolving/rejecting again.
   */
  class OnceOnlySettle {
    private val settled = AtomicBoolean(false)

    /** @return true if this caller may complete the promise */
    fun trySettle(): Boolean = settled.compareAndSet(false, true)

    fun isSettled(): Boolean = settled.get()
  }
}
