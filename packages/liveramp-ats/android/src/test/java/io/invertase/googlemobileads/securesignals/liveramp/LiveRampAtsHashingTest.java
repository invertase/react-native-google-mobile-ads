package io.invertase.googlemobileads.securesignals.liveramp;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class LiveRampAtsHashingTest {
  @Test
  public void sha256Hex_knownVector() {
    assertEquals(
        "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514",
        LiveRampAtsHashing.sha256Hex("user@example.com"));
  }
}