package io.invertase.googlemobileads.securesignals.liveramp;

import android.content.Context;
import android.content.SharedPreferences;
import androidx.annotation.Nullable;
import androidx.annotation.VisibleForTesting;

/** Persists envelopes and config; mirrors state into the in-memory cache. */
public final class LiveRampAtsEnvelopeStore {
  private static final String PREFS = "rngma_liveramp_ats";
  private static final String KEY_ENVELOPE_27 = "envelope27";
  private static final String KEY_ENVELOPE_19 = "envelope19";
  private static final String KEY_ENVELOPE_25 = "envelope25";
  private static final String KEY_PID = "placementId";
  private static final String KEY_ORIGIN = "origin";
  private static final String KEY_CREATED_AT = "createdAtMs";
  private static final String KEY_LAST_REFRESH = "lastRefreshMs";

  private static volatile LiveRampAtsEnvelopeRecord cache;

  private LiveRampAtsEnvelopeStore() {}

  public static void hydrate(Context context) {
    SharedPreferences prefs = prefs(context);
    cache =
        new LiveRampAtsEnvelopeRecord(
            nullIfEmpty(prefs.getString(KEY_ENVELOPE_27, null)),
            nullIfEmpty(prefs.getString(KEY_ENVELOPE_19, null)),
            nullIfEmpty(prefs.getString(KEY_ENVELOPE_25, null)),
            prefs.getInt(KEY_PID, 0),
            nullIfEmpty(prefs.getString(KEY_ORIGIN, null)),
            prefs.getLong(KEY_CREATED_AT, 0L),
            prefs.getLong(KEY_LAST_REFRESH, 0L));
  }

  @Nullable
  public static LiveRampAtsEnvelopeRecord getCache() {
    return cache;
  }

  public static void clearEnvelopes(Context context) {
    SharedPreferences.Editor editor = prefs(context).edit();
    editor.remove(KEY_ENVELOPE_27);
    editor.remove(KEY_ENVELOPE_19);
    editor.remove(KEY_ENVELOPE_25);
    editor.remove(KEY_CREATED_AT);
    editor.remove(KEY_LAST_REFRESH);
    editor.apply();
    hydrate(context);
  }

  public static void saveConfig(Context context, int placementId, String originHeader) {
    SharedPreferences.Editor editor = prefs(context).edit();
    editor.putInt(KEY_PID, placementId);
    editor.putString(KEY_ORIGIN, originHeader);
    editor.apply();
    hydrate(context);
  }

  public static void saveEnvelopes(
      Context context,
      @Nullable String envelope27,
      @Nullable String envelope19,
      @Nullable String envelope25,
      long createdAtMs,
      long refreshMs) {
    SharedPreferences.Editor editor = prefs(context).edit();
    putNullable(editor, KEY_ENVELOPE_27, envelope27);
    putNullable(editor, KEY_ENVELOPE_19, envelope19);
    putNullable(editor, KEY_ENVELOPE_25, envelope25);
    editor.putLong(KEY_CREATED_AT, createdAtMs);
    editor.putLong(KEY_LAST_REFRESH, refreshMs);
    editor.apply();
    hydrate(context);
  }

  @Nullable
  private static String nullIfEmpty(@Nullable String value) {
    if (value == null || value.isEmpty()) {
      return null;
    }
    return value;
  }

  private static void putNullable(SharedPreferences.Editor editor, String key, @Nullable String value) {
    if (value == null) {
      editor.remove(key);
    } else {
      editor.putString(key, value);
    }
  }

  private static SharedPreferences prefs(Context context) {
    return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  @VisibleForTesting
  static void setCacheForTesting(@Nullable LiveRampAtsEnvelopeRecord record) {
    cache = record;
  }
}