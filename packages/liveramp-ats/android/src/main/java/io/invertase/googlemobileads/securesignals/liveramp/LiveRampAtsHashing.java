package io.invertase.googlemobileads.securesignals.liveramp;

import androidx.annotation.Nullable;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;

/** SHA-256 hashing for ATS `iv` parameters (lowercase hex). */
public final class LiveRampAtsHashing {
  private LiveRampAtsHashing() {}

  @Nullable
  public static String sha256Hex(@Nullable String value) {
    if (value == null || value.isEmpty()) {
      return null;
    }
    try {
      MessageDigest digest = MessageDigest.getInstance("SHA-256");
      byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
      StringBuilder hex = new StringBuilder(hashed.length * 2);
      for (byte b : hashed) {
        hex.append(String.format(Locale.US, "%02x", b));
      }
      return hex.toString();
    } catch (NoSuchAlgorithmException e) {
      return null;
    }
  }
}