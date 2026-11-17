package io.invertase.googlemobileads.securesignals.liveramp;

import androidx.annotation.Nullable;
import java.util.Locale;
import java.util.regex.Pattern;

/** LiveRamp ATS identifier normalization (email / phone) before hashing. */
public final class LiveRampAtsIdentifierNormalizer {
  private static final Pattern NON_DIGITS = Pattern.compile("[^0-9]");
  private static final Pattern LEADING_ZEROS = Pattern.compile("^0+(?!$)");

  private LiveRampAtsIdentifierNormalizer() {}

  @Nullable
  public static String normalizeEmail(@Nullable String email) {
    if (email == null) {
      return null;
    }
    String cleaned = email.trim().toLowerCase(Locale.US);
    int at = cleaned.indexOf('@');
    if (at < 0) {
      return cleaned;
    }
    String local = cleaned.substring(0, at);
    String domain = cleaned.substring(at + 1);
    int plus = local.indexOf('+');
    if (plus >= 0) {
      local = local.substring(0, plus);
    }
    if ("gmail.com".equals(domain)) {
      local = local.replace(".", "");
    }
    return local + "@" + domain;
  }

  @Nullable
  public static String normalizePhone(@Nullable String phone) {
    if (phone == null) {
      return null;
    }
    String digits = NON_DIGITS.matcher(phone.trim()).replaceAll("");
    return LEADING_ZEROS.matcher(digits).replaceAll("");
  }
}