package io.invertase.googlemobileads.securesignals.liveramp;

import android.content.Context;
import android.content.SharedPreferences;
import android.preference.PreferenceManager;
import androidx.annotation.Nullable;

/**
 * Reads IAB TCF keys written by UMP / CMPs directly from default SharedPreferences storage.
 */
public final class LiveRampAtsConsentReader {
  static final String KEY_GDPR_APPLIES = "IABTCF_gdprApplies";
  static final String KEY_TC_STRING = "IABTCF_TCString";

  private LiveRampAtsConsentReader() {}

  public static boolean gdprApplies(Context context) {
  SharedPreferences defaultPrefs = PreferenceManager.getDefaultSharedPreferences(context);
    int gdpr = readGdprFlag(defaultPrefs);
    if (gdpr >= 0) {
      return gdpr == 1;
    }
    SharedPreferences prefs = context.getSharedPreferences(context.getPackageName() + "_preferences", Context.MODE_PRIVATE);
    gdpr = readGdprFlag(prefs);
    return gdpr == 1;
  }

  private static int readGdprFlag(SharedPreferences prefs) {
    if (!prefs.contains(KEY_GDPR_APPLIES)) {
      return -1;
    }
    try {
      return prefs.getInt(KEY_GDPR_APPLIES, -1);
    } catch (ClassCastException ignored) {
      String raw = prefs.getString(KEY_GDPR_APPLIES, null);
      if (raw == null) {
        return -1;
      }
      return "1".equals(raw) ? 1 : 0;
    }
  }

  @Nullable
  public static String tcString(Context context) {
    SharedPreferences defaultPrefs = PreferenceManager.getDefaultSharedPreferences(context);
    String fromDefault = defaultPrefs.getString(KEY_TC_STRING, null);
    if (fromDefault != null && !fromDefault.isEmpty()) {
      return fromDefault;
    }
    SharedPreferences prefs = context.getSharedPreferences(context.getPackageName() + "_preferences", Context.MODE_PRIVATE);
    return prefs.getString(KEY_TC_STRING, null);
  }
}