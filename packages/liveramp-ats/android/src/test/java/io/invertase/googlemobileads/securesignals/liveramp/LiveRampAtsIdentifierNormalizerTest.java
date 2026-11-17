package io.invertase.googlemobileads.securesignals.liveramp;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import org.junit.Test;

public class LiveRampAtsIdentifierNormalizerTest {
  @Test
  public void normalizeEmail_stripsTagAndLowercases() {
    assertEquals("user@example.com", LiveRampAtsIdentifierNormalizer.normalizeEmail("User+tag@Example.com"));
  }

  @Test
  public void normalizeEmail_gmailStripsDots() {
    assertEquals("user@gmail.com", LiveRampAtsIdentifierNormalizer.normalizeEmail("u.s.e.r@gmail.com"));
  }

  @Test
  public void normalizePhone_stripsFormatting() {
    assertEquals("15551234567", LiveRampAtsIdentifierNormalizer.normalizePhone("+1 (555) 123-4567"));
  }

  @Test
  public void normalizeEmail_null() {
    assertNull(LiveRampAtsIdentifierNormalizer.normalizeEmail(null));
  }
}