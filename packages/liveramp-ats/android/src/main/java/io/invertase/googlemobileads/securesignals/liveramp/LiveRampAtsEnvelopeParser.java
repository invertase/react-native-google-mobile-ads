package io.invertase.googlemobileads.securesignals.liveramp;

import androidx.annotation.Nullable;
import org.json.JSONArray;
import org.json.JSONObject;

/** Parses LiveRamp Envelope API v2 JSON payloads. */
public final class LiveRampAtsEnvelopeParser {
  private LiveRampAtsEnvelopeParser() {}

  public static class ParsedEnvelopes {
    @Nullable public String envelope27;
    @Nullable public String envelope19;
    @Nullable public String envelope25;
  }

  @Nullable
  public static ParsedEnvelopes parseResponseBody(@Nullable String body) {
    if (body == null || body.trim().isEmpty()) {
      return null;
    }
    try {
      JSONObject root = new JSONObject(body);
      if (!root.has("envelopes")) {
        return null;
      }
      JSONArray envelopes = root.getJSONArray("envelopes");
      ParsedEnvelopes parsed = new ParsedEnvelopes();
      for (int i = 0; i < envelopes.length(); i++) {
        JSONObject item = envelopes.getJSONObject(i);
        int type = item.optInt("type", -1);
        String value = item.optString("value", null);
        if (value == null || value.isEmpty()) {
          continue;
        }
        switch (type) {
          case 27:
            parsed.envelope27 = value;
            break;
          case 19:
            parsed.envelope19 = value;
            break;
          case 25:
            parsed.envelope25 = value;
            break;
          default:
            break;
        }
      }
      return parsed;
    } catch (Exception ignored) {
      return null;
    }
  }
}