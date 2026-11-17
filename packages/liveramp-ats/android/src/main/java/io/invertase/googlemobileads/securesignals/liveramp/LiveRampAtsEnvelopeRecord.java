package io.invertase.googlemobileads.securesignals.liveramp;

import androidx.annotation.Nullable;

/** In-memory envelope snapshot used by the RTB adapter and diagnostics API. */
public final class LiveRampAtsEnvelopeRecord {
  @Nullable public final String envelope27;
  @Nullable public final String envelope19;
  @Nullable public final String envelope25;
  public final int placementId;
  @Nullable public final String origin;
  public final long createdAtMs;
  public final long lastRefreshMs;

  public LiveRampAtsEnvelopeRecord(
      @Nullable String envelope27,
      @Nullable String envelope19,
      @Nullable String envelope25,
      int placementId,
      @Nullable String origin,
      long createdAtMs,
      long lastRefreshMs) {
    this.envelope27 = envelope27;
    this.envelope19 = envelope19;
    this.envelope25 = envelope25;
    this.placementId = placementId;
    this.origin = origin;
    this.createdAtMs = createdAtMs;
    this.lastRefreshMs = lastRefreshMs;
  }

  /** GMA secure signal priority: type 27 → type 19 → empty. */
  public String signalForCollect() {
    if (envelope27 != null && !envelope27.isEmpty()) {
      return envelope27;
    }
    if (envelope19 != null && !envelope19.isEmpty()) {
      return envelope19;
    }
    return "";
  }
}