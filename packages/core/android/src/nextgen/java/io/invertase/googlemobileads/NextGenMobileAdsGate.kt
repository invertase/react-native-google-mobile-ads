package io.invertase.googlemobileads

import android.util.Log
import com.google.android.libraries.ads.mobile.sdk.MobileAds
import java.util.function.Consumer

/**
 * Serializes all Next-Gen SDK access behind explicit initialization.
 *
 * Unlike the classic SDK, Next-Gen does not self-initialize. Calls made while JavaScript's
 * initialize promise is pending are queued and replayed after the initialization callback.
 */
object NextGenMobileAdsGate {
  data class Failure(
    val code: String,
    val message: String,
  )

  private data class PendingAction(
    val action: () -> Unit,
    val onFailure: (Failure) -> Unit,
  )

  private val lock = Any()
  private val pending = ArrayDeque<PendingAction>()

  @Volatile
  private var initializationCompleted = false

  private var initializationFailure: Failure? = null

  fun runWhenInitialized(
    onFailure: (Failure) -> Unit = ::logFailure,
    action: () -> Unit,
  ) {
    val pendingAction = PendingAction(action, onFailure)
    if (initializationCompleted || MobileAds.isInitialized) {
      execute(pendingAction)
      return
    }
    var runImmediately = false
    var failure: Failure? = null
    synchronized(lock) {
      if (initializationCompleted || MobileAds.isInitialized) {
        runImmediately = true
      } else {
        failure = initializationFailure
        if (failure == null) {
          pending.addLast(pendingAction)
        }
      }
    }
    if (runImmediately) {
      execute(pendingAction)
    } else {
      failure?.let { notifyFailure(pendingAction, it) }
    }
  }

  @JvmStatic
  fun run(action: Runnable) {
    runWhenInitialized(action = action::run)
  }

  @JvmStatic
  fun run(
    action: Runnable,
    onFailure: Consumer<Failure>,
  ) {
    runWhenInitialized(onFailure = onFailure::accept, action = action::run)
  }

  fun markInitialized() {
    val actions =
      synchronized(lock) {
        if (initializationFailure != null) {
          return
        }
        initializationCompleted = true
        val copy = pending.toList()
        pending.clear()
        copy
      }
    actions.forEach(::execute)
  }

  fun markInitializationFailed(
    code: String,
    message: String,
  ) {
    val failure = Failure(code, message)
    val actions =
      synchronized(lock) {
        if (initializationCompleted || initializationFailure != null) {
          return
        }
        initializationFailure = failure
        val copy = pending.toList()
        pending.clear()
        copy
      }
    actions.forEach { notifyFailure(it, failure) }
  }

  internal fun pendingActionCount(): Int = synchronized(lock) { pending.size }

  internal fun resetForTests() {
    synchronized(lock) {
      pending.clear()
      initializationCompleted = false
      initializationFailure = null
    }
  }

  private fun execute(pendingAction: PendingAction) {
    try {
      pendingAction.action()
    } catch (exception: Exception) {
      notifyFailure(
        pendingAction,
        Failure("internal-error", exception.message ?: exception.toString()),
      )
    }
  }

  private fun notifyFailure(
    pendingAction: PendingAction,
    failure: Failure,
  ) {
    try {
      pendingAction.onFailure(failure)
    } catch (exception: Exception) {
      Log.e(TAG, "Next-Gen initialization failure callback threw", exception)
    }
  }

  private fun logFailure(failure: Failure) {
    Log.e(TAG, "Next-Gen SDK work rejected: ${failure.code}: ${failure.message}")
  }

  private const val TAG = "RNGoogleMobileAds"
}
