package io.invertase.googlemobileads

internal class PoolGenerationTracker {
  private val latest = HashMap<String, Long>()
  private val active = HashSet<String>()

  fun claimStart(
    key: String,
    generation: Long,
  ): Boolean {
    if (generation <= (latest[key] ?: Long.MIN_VALUE)) {
      return false
    }
    latest[key] = generation
    active.add(key)
    return true
  }

  fun allowsCallback(
    key: String,
    generation: Long,
  ): Boolean = active.contains(key) && latest[key] == generation

  fun allowsRead(
    key: String,
    generation: Long,
  ): Boolean = allowsCallback(key, generation)

  fun releaseDestroy(
    key: String,
    generation: Long,
  ): Boolean {
    if (!allowsCallback(key, generation)) {
      return false
    }
    active.remove(key)
    return true
  }
}
