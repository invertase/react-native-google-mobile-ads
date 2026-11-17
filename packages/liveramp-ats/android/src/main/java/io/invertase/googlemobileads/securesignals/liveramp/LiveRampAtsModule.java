package io.invertase.googlemobileads.securesignals.liveramp;

import androidx.annotation.Nullable;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

public class LiveRampAtsModule extends ReactContextBaseJavaModule {
  public static final String NAME = "RNGMALiveRampAtsModule";

  public LiveRampAtsModule(ReactApplicationContext reactContext) {
    super(reactContext);
    LiveRampAtsEnvelopeManager.getInstance(reactContext).currentRecord();
  }

  @Override
  public String getName() {
    return NAME;
  }

  @ReactMethod
  public void configure(ReadableMap options, Promise promise) {
    if (!options.hasKey("placementId")) {
      promise.reject("EINVAL", "configure requires placementId");
      return;
    }
    int placementId = options.getInt("placementId");
    @Nullable String bundleId = options.hasKey("bundleId") ? options.getString("bundleId") : null;
    LiveRampAtsEnvelopeManager.getInstance(getReactApplicationContext()).configure(placementId, bundleId);
    promise.resolve(null);
  }

  @ReactMethod
  public void setIdentifier(ReadableMap options, Promise promise) {
    @Nullable String email = options.hasKey("email") ? options.getString("email") : null;
    @Nullable String phone = options.hasKey("phone") ? options.getString("phone") : null;
    LiveRampAtsEnvelopeManager.getInstance(getReactApplicationContext()).setIdentifier(email, phone);
    promise.resolve(null);
  }

  @ReactMethod
  public void clearIdentifier(Promise promise) {
    LiveRampAtsEnvelopeManager.getInstance(getReactApplicationContext()).clearIdentifier();
    promise.resolve(null);
  }

  @ReactMethod
  public void getEnvelope(Promise promise) {
    LiveRampAtsEnvelopeRecord record =
        LiveRampAtsEnvelopeManager.getInstance(getReactApplicationContext()).currentRecord();
    WritableMap map = Arguments.createMap();
    if (record == null) {
      map.putNull("envelope27");
      map.putNull("envelope19");
      map.putNull("envelope25");
      map.putString("signal", "");
      map.putNull("placementId");
      map.putNull("origin");
    } else {
      putNullableString(map, "envelope27", record.envelope27);
      putNullableString(map, "envelope19", record.envelope19);
      putNullableString(map, "envelope25", record.envelope25);
      map.putString("signal", record.signalForCollect());
      map.putInt("placementId", record.placementId);
      putNullableString(map, "origin", record.origin);
    }
    promise.resolve(map);
  }

  private static void putNullableString(WritableMap map, String key, @Nullable String value) {
    if (value == null) {
      map.putNull(key);
    } else {
      map.putString(key, value);
    }
  }
}