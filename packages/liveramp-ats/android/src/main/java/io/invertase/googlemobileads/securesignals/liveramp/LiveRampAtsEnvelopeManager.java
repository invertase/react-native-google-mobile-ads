package io.invertase.googlemobileads.securesignals.liveramp;

import android.content.Context;
import android.util.Log;
import androidx.annotation.Nullable;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class LiveRampAtsEnvelopeManager {
  private static final String TAG = "RNGMALiveRampAts";
  private static final int IDENTIFIER_TYPE_EMAIL = 4;
  private static final int IDENTIFIER_TYPE_PHONE = 11;

  private static volatile LiveRampAtsEnvelopeManager instance;
  private final Context appContext;
  private final ExecutorService executor = Executors.newSingleThreadExecutor();

  @Nullable private String bundleId;
  private int placementId;

  @Nullable private String pendingEmail;
  @Nullable private String pendingPhone;

  private LiveRampAtsEnvelopeManager(Context context) {
    this.appContext = context.getApplicationContext();
    this.bundleId = appContext.getPackageName();
    LiveRampAtsEnvelopeStore.hydrate(appContext);
  }

  public static LiveRampAtsEnvelopeManager getInstance(Context context) {
    if (instance == null) {
      synchronized (LiveRampAtsEnvelopeManager.class) {
        if (instance == null) {
          instance = new LiveRampAtsEnvelopeManager(context);
        }
      }
    }
    return instance;
  }

  public void configure(int placementId, @Nullable String bundleId) {
    this.placementId = placementId;
    if (bundleId != null && !bundleId.isEmpty()) {
      this.bundleId = bundleId;
    }
    LiveRampAtsEnvelopeStore.saveConfig(appContext, placementId, originHeader());
    executor.execute(this::refreshIfPossible);
  }

  public void setIdentifier(@Nullable String email, @Nullable String phone) {
    pendingEmail = email;
    pendingPhone = phone;
    executor.execute(this::fetchAfterIdentifierSet);
  }

  public void clearIdentifier() {
    pendingEmail = null;
    pendingPhone = null;
    LiveRampAtsEnvelopeStore.clearEnvelopes(appContext);
  }

  @Nullable
  public LiveRampAtsEnvelopeRecord currentRecord() {
    return LiveRampAtsEnvelopeStore.getCache();
  }

  public String collectSignalSync() {
    LiveRampAtsEnvelopeRecord record = LiveRampAtsEnvelopeStore.getCache();
    if (record == null) {
      return "";
    }
    return record.signalForCollect();
  }

  private void fetchAfterIdentifierSet() {
    if (placementId <= 0) {
      Log.w(TAG, "configure() with placementId is required before setIdentifier()");
      return;
    }
    IdentifierHash hash = hashPendingIdentifier();
    if (hash == null) {
      return;
    }
    @Nullable String tc = consentCv();
    try {
      LiveRampAtsHttpClient.HttpResult result =
          LiveRampAtsHttpClient.fetchEnvelope(
              placementId, hash.identifierType, hash.hash, originHeader(), tc);
      applyHttpResult(result, /* refresh */ false);
    } catch (Exception e) {
      Log.w(TAG, "Envelope fetch failed", e);
    }
  }

  private void refreshIfPossible() {
    LiveRampAtsEnvelopeRecord cache = LiveRampAtsEnvelopeStore.getCache();
    if (cache == null || cache.envelope19 == null) {
      if (pendingEmail != null || pendingPhone != null) {
        fetchAfterIdentifierSet();
      }
      return;
    }
    if (placementId <= 0) {
      return;
    }
    @Nullable String tc = consentCv();
    try {
      LiveRampAtsHttpClient.HttpResult result =
          LiveRampAtsHttpClient.refreshEnvelope(placementId, cache.envelope19, originHeader(), tc);
      applyHttpResult(result, /* refresh */ true);
    } catch (Exception e) {
      Log.w(TAG, "Envelope refresh failed", e);
    }
  }

  private void applyHttpResult(LiveRampAtsHttpClient.HttpResult result, boolean refresh) {
    if (result.code == 204) {
      LiveRampAtsEnvelopeStore.clearEnvelopes(appContext);
      return;
    }
    if (result.code != 200) {
      return;
    }
    LiveRampAtsEnvelopeParser.ParsedEnvelopes parsed =
        LiveRampAtsEnvelopeParser.parseResponseBody(result.body);
    if (parsed == null) {
      return;
    }
    long now = System.currentTimeMillis();
    LiveRampAtsEnvelopeRecord existing = LiveRampAtsEnvelopeStore.getCache();
    long createdAt = existing != null && existing.createdAtMs > 0 ? existing.createdAtMs : now;
    LiveRampAtsEnvelopeStore.saveEnvelopes(
        appContext, parsed.envelope27, parsed.envelope19, parsed.envelope25, createdAt, now);
  }

  @Nullable
  private IdentifierHash hashPendingIdentifier() {
    if (pendingEmail != null && !pendingEmail.isEmpty()) {
      String normalized = LiveRampAtsIdentifierNormalizer.normalizeEmail(pendingEmail);
      String hash = LiveRampAtsHashing.sha256Hex(normalized);
      if (hash != null) {
        return new IdentifierHash(IDENTIFIER_TYPE_EMAIL, hash);
      }
    }
    if (pendingPhone != null && !pendingPhone.isEmpty()) {
      String normalized = LiveRampAtsIdentifierNormalizer.normalizePhone(pendingPhone);
      String hash = LiveRampAtsHashing.sha256Hex(normalized);
      if (hash != null) {
        return new IdentifierHash(IDENTIFIER_TYPE_PHONE, hash);
      }
    }
    return null;
  }

  @Nullable
  private String consentCv() {
    if (!LiveRampAtsConsentReader.gdprApplies(appContext)) {
      return null;
    }
    return LiveRampAtsConsentReader.tcString(appContext);
  }

  private String originHeader() {
    String bundle = bundleId != null ? bundleId : appContext.getPackageName();
    return String.format(Locale.US, "https://%s", bundle);
  }

  private static final class IdentifierHash {
    final int identifierType;
    final String hash;

    IdentifierHash(int identifierType, String hash) {
      this.identifierType = identifierType;
      this.hash = hash;
    }
  }
}