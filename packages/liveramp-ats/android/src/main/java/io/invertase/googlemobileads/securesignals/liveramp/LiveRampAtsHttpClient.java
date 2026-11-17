package io.invertase.googlemobileads.securesignals.liveramp;

import android.util.Log;
import androidx.annotation.Nullable;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Minimal GET client for LiveRamp Envelope API v2 (background thread only). */
public final class LiveRampAtsHttpClient {
  private static final String TAG = "RNGMALiveRampAts";
  private static final String BASE = "https://api.rlcdn.com/api/identity/v2/envelope";
  private static final String REFRESH = "https://api.rlcdn.com/api/identity/v2/envelope/refresh";

  public static class HttpResult {
    public final int code;
    @Nullable public final String body;

    public HttpResult(int code, @Nullable String body) {
      this.code = code;
      this.body = body;
    }
  }

  private LiveRampAtsHttpClient() {}

  public static HttpResult fetchEnvelope(
      int placementId,
      int identifierType,
      String identifierHash,
      String originHeader,
      @Nullable String tcString)
      throws IOException {
    StringBuilder url =
        new StringBuilder(BASE)
            .append("?pid=")
            .append(placementId)
            .append("&it=")
            .append(identifierType)
            .append("&iv=")
            .append(urlEncode(identifierHash))
            .append("&atype=2");
    if (tcString != null && !tcString.isEmpty()) {
      url.append("&ct=4&cv=").append(urlEncode(tcString));
    }
    return get(url.toString(), originHeader);
  }

  public static HttpResult refreshEnvelope(
      int placementId,
      @Nullable String envelope19,
      String originHeader,
      @Nullable String tcString)
      throws IOException {
    if (envelope19 == null || envelope19.isEmpty()) {
      return new HttpResult(-1, null);
    }
    StringBuilder url =
        new StringBuilder(REFRESH)
            .append("?pid=")
            .append(placementId)
            .append("&it=19&iv=")
            .append(urlEncode(envelope19))
            .append("&atype=2");
    if (tcString != null && !tcString.isEmpty()) {
      url.append("&ct=4&cv=").append(urlEncode(tcString));
    }
    return get(url.toString(), originHeader);
  }

  private static HttpResult get(String url, String originHeader) throws IOException {
    HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
    connection.setRequestMethod("GET");
    connection.setRequestProperty("Origin", originHeader);
    connection.setRequestProperty("Accept", "application/json");
    connection.setConnectTimeout(15000);
    connection.setReadTimeout(15000);
    int code = connection.getResponseCode();
    InputStream stream = code >= 400 ? connection.getErrorStream() : connection.getInputStream();
    String body = readBody(stream);
    if (code == 401 || code == 400) {
      Log.w(TAG, "Envelope API " + code + " for Origin " + originHeader);
    }
    return new HttpResult(code, body);
  }

  @Nullable
  private static String readBody(@Nullable InputStream stream) throws IOException {
    if (stream == null) {
      return null;
    }
    StringBuilder builder = new StringBuilder();
    try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
      String line;
      while ((line = reader.readLine()) != null) {
        builder.append(line);
      }
    }
    String text = builder.toString();
    return text.isEmpty() ? null : text;
  }

  private static String urlEncode(String value) {
    try {
      return URLEncoder.encode(value, StandardCharsets.UTF_8.name());
    } catch (Exception e) {
      return value;
    }
  }
}