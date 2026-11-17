package io.invertase.googlemobileads.securesignals.liveramp;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;

import org.junit.Test;

public class LiveRampAtsEnvelopeParserTest {
  @Test
  public void parseResponseBody_multiTypeFixture() {
    String body =
        "{\"envelopes\":[{\"type\":19,\"source\":\"envelopeLiveramp\","
            + "\"value\":\"fixture_envelope_type_19_redacted\",\"err\":null},"
            + "{\"type\":25,\"source\":\"pairIds\",\"value\":\"fixture_envelope_type_25_redacted\",\"err\":null},"
            + "{\"type\":27,\"source\":\"envelopeLiverampRTB\",\"value\":\"fixture_envelope_type_27_redacted\",\"err\":null}]}";
    LiveRampAtsEnvelopeParser.ParsedEnvelopes parsed = LiveRampAtsEnvelopeParser.parseResponseBody(body);
    assertNotNull(parsed);
    assertEquals("fixture_envelope_type_27_redacted", parsed.envelope27);
    assertEquals("fixture_envelope_type_19_redacted", parsed.envelope19);
    assertEquals("fixture_envelope_type_25_redacted", parsed.envelope25);
  }

  @Test
  public void signalPriority_prefersType27() {
    LiveRampAtsEnvelopeRecord record =
        new LiveRampAtsEnvelopeRecord("z27", "z19", "z25", 1, "https://com.app", 0, 0);
    assertEquals("z27", record.signalForCollect());
  }

  @Test
  public void signalPriority_fallsBackToType19() {
    LiveRampAtsEnvelopeRecord record =
        new LiveRampAtsEnvelopeRecord(null, "z19", "z25", 1, "https://com.app", 0, 0);
    assertEquals("z19", record.signalForCollect());
  }

  @Test
  public void signalPriority_emptyWhenMissing() {
    LiveRampAtsEnvelopeRecord record = new LiveRampAtsEnvelopeRecord(null, null, null, 1, null, 0, 0);
    assertEquals("", record.signalForCollect());
  }
}