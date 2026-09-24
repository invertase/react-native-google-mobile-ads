package io.invertase.googlemobileads;

import android.app.Activity;
import android.view.View;
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.google.android.libraries.ads.mobile.sdk.banner.AdSize;
import com.google.android.libraries.ads.mobile.sdk.banner.AdView;
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAd;
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdEventCallback;
import com.google.android.libraries.ads.mobile.sdk.banner.BannerAdRequest;
import com.google.android.libraries.ads.mobile.sdk.common.AdLoadCallback;
import com.google.android.libraries.ads.mobile.sdk.common.AdValue;
import com.google.android.libraries.ads.mobile.sdk.common.LoadAdError;
import io.invertase.googlemobileads.common.ReactNativeAdView;
import io.invertase.googlemobileads.common.SharedUtils;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import org.json.JSONException;
import org.json.JSONObject;

public class ReactNativeGoogleMobileAdsBannerAdViewManager
    extends SimpleViewManager<ReactNativeAdView> {
  private static final String REACT_CLASS = "RNGoogleMobileAdsBannerView";
  private static final String EVENT_AD_LOADED = "onAdLoaded";
  private static final String EVENT_AD_IMPRESSION = "onAdImpression";
  private static final String EVENT_AD_CLICKED = "onAdClicked";
  private static final String EVENT_AD_FAILED_TO_LOAD = "onAdFailedToLoad";
  private static final String EVENT_AD_OPENED = "onAdOpened";
  private static final String EVENT_AD_CLOSED = "onAdClosed";
  private static final String EVENT_PAID = "onPaid";
  private static final String EVENT_SIZE_CHANGE = "onSizeChange";
  private static final String EVENT_APP_EVENT = "onAppEvent";
  private static final String COMMAND_RECORD_MANUAL_IMPRESSION = "recordManualImpression";
  private static final String COMMAND_LOAD = "load";

  @Nonnull
  @Override
  public String getName() {
    return REACT_CLASS;
  }

  @Nonnull
  @Override
  public ReactNativeAdView createViewInstance(@Nonnull ThemedReactContext context) {
    ReactNativeAdView view = new ReactNativeAdView(context);
    LifecycleEventListener listener =
        ReactNativeGoogleMobileAdsBannerAdHostDestroy.attach(context, () -> destroyAdView(view));
    view.setHostDestroyListener(listener);
    return view;
  }

  @Override
  public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    Map<String, Object> registration = new HashMap<>();
    registration.put("registrationName", "onNativeEvent");
    Map<String, Object> constants = new HashMap<>();
    constants.put(OnNativeEvent.EVENT_NAME, registration);
    return constants;
  }

  @Override
  public void receiveCommand(
      @NonNull ReactNativeAdView view, String commandId, @Nullable ReadableArray args) {
    super.receiveCommand(view, commandId, args);
    view.post(
        () -> {
          AdView adView = getAdView(view);
          if (adView == null) return;
          if (COMMAND_RECORD_MANUAL_IMPRESSION.equals(commandId)) {
            BannerAd ad = adView.getBannerAd();
            if (ad != null) ad.recordManualImpression();
          } else if (COMMAND_LOAD.equals(commandId)) {
            loadAd(view, adView);
          }
        });
  }

  @ReactProp(name = "unitId")
  public void setUnitId(ReactNativeAdView view, String value) {
    if (value != null && value.equals(view.getUnitId())) {
      return;
    }
    view.setUnitId(value);
    view.setPropsChanged(true);
  }

  @ReactProp(name = "request")
  public void setRequest(ReactNativeAdView view, String value) {
    try {
      JSONObject json = new JSONObject(value);
      view.setRequestOptions(SharedUtils.jsonObjectToWritableMap(json));
      view.setPropsChanged(true);
    } catch (JSONException exception) {
      exception.printStackTrace();
    }
  }

  @ReactProp(name = "sizeConfig")
  public void setSizeConfig(ReactNativeAdView view, ReadableMap config) {
    if (config == null) return;
    float maxHeight =
        config.hasKey("maxHeight") && !config.isNull("maxHeight")
            ? (float) config.getDouble("maxHeight")
            : 0;
    float width =
        config.hasKey("width") && !config.isNull("width") ? (float) config.getDouble("width") : 0;
    List<String> sizeNames = new ArrayList<>();
    if (config.hasKey("sizes") && !config.isNull("sizes")) {
      ReadableArray values = config.getArray("sizes");
      if (values != null) {
        for (int index = 0; index < values.size(); index++) {
          if (values.getType(index) == ReadableType.String) {
            sizeNames.add(values.getString(index));
          }
        }
      }
    }

    boolean requiresReload =
        ReactNativeGoogleMobileAdsBannerAdLayout.sizeConfigRequiresReload(
            view.getSizeNames(),
            view.getMaxAdHeight(),
            view.getAdWidth(),
            sizeNames,
            maxHeight,
            width);

    view.setMaxAdHeight(maxHeight);
    view.setAdWidth(width);
    view.setSizeNames(sizeNames);
    if (!sizeNames.isEmpty()) {
      NextGenMobileAdsGate.run(() -> view.post(() -> resolveSizes(view)));
    }
    if (requiresReload) {
      view.setPropsChanged(true);
    }
  }

  @ReactProp(name = "manualImpressionsEnabled")
  public void setManualImpressionsEnabled(ReactNativeAdView view, boolean value) {
    if (view.getManualImpressionsEnabled() == value && view.getSizeNames() != null) {
      return;
    }
    view.setManualImpressionsEnabled(value);
    view.setPropsChanged(true);
  }

  @Override
  public void onAfterUpdateTransaction(@NonNull ReactNativeAdView view) {
    super.onAfterUpdateTransaction(view);
    if (view.getPropsChanged()) requestAd(view);
    view.setPropsChanged(false);
  }

  @Override
  public void onDropViewInstance(@NonNull ReactNativeAdView view) {
    destroyAdView(view);
    super.onDropViewInstance(view);
  }

  /**
   * Idempotent AdView teardown for JS unmount ([onDropViewInstance]) and host Activity destroy
   * (#892 configuration-change leak when AppState stays active).
   */
  private void destroyAdView(@NonNull ReactNativeAdView view) {
    if (!view.beginAdTeardown()) {
      return;
    }
    ReactContext reactContext = (ReactContext) view.getContext();
    ReactNativeGoogleMobileAdsBannerAdHostDestroy.detach(
        reactContext, view.getHostDestroyListener());
    view.setHostDestroyListener(null);

    View child = view.getChildCount() == 0 ? null : view.getChildAt(0);
    if (child instanceof AdView) {
      ((AdView) child).destroy();
    }
    if (child != null) {
      view.removeView(child);
    }
  }

  private void requestAd(ReactNativeAdView view) {
    NextGenMobileAdsGate.run(
        () -> view.post(() -> requestAdInitialized(view)),
        failure ->
            view.post(
                () ->
                    sendEvent(
                        view,
                        EVENT_AD_FAILED_TO_LOAD,
                        ReactNativeGoogleMobileAdsCommon.buildAdErrorMap(
                            failure.getCode(), failure.getMessage(), "load"))));
  }

  private void resolveSizes(ReactNativeAdView view) {
    List<AdSize> sizes = new ArrayList<>();
    List<String> sizeNames = view.getSizeNames();
    if (sizeNames != null) {
      for (String sizeName : sizeNames) {
        sizes.add(ReactNativeGoogleMobileAdsBannerSize.getAdSize(sizeName, view));
      }
    }
    if (!sizes.isEmpty() && !sizes.contains(AdSize.FLUID)) {
      WritableMap payload = Arguments.createMap();
      payload.putDouble("width", sizes.get(0).getWidth());
      payload.putDouble("height", sizes.get(0).getHeight());
      sendEvent(view, EVENT_SIZE_CHANGE, payload);
    }
    view.setSizes(sizes);
  }

  private void requestAdInitialized(ReactNativeAdView view) {
    if (view.isAdTornDown()) {
      return;
    }
    if (view.getSizes() == null
        || view.getSizes().isEmpty()
        || view.getUnitId() == null
        || view.getRequestOptions() == null) {
      return;
    }
    AdView oldView = getAdView(view);
    if (oldView != null) {
      oldView.destroy();
      view.removeView(oldView);
    }
    Activity activity = ((ReactContext) view.getContext()).getCurrentActivity();
    if (activity == null) return;
    AdView adView = new AdView(activity);
    // FOCUS_BLOCK_DESCENDANTS alone is insufficient after creative load (#813).
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(adView);
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(view);
    view.setIsFluid(view.getSizes().contains(AdSize.FLUID));
    view.setIsCollapsible(false);
    view.addView(adView);
    loadAd(view, adView);
  }

  private void loadAd(ReactNativeAdView view, AdView adView) {
    BannerAdRequest request =
        ReactNativeGoogleMobileAdsCommon.buildBannerAdRequest(
            view.getUnitId(),
            view.getSizes(),
            view.getRequestOptions(),
            view.getManualImpressionsEnabled());
    // BannerAd.load is @Deprecated ("Use AdView.loadAd() or BannerAdPreloader instead.").
    adView.loadAd(
        request,
        new AdLoadCallback<BannerAd>() {
          @Override
          public void onAdLoaded(BannerAd ad) {
            view.post(
                () -> {
                  // Creatives / mediation can re-enable focus on the AdView after load (#813).
                  ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(adView);
                  ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(view);
                  ad.setAdEventCallback(buildEventCallback(view, ad));
                  AdSize size = ad.getAdSize();
                  boolean collapsible = ad.isCollapsible();
                  view.setIsCollapsible(collapsible);
                  int width;
                  int height;
                  boolean trackLayoutChanges =
                      ReactNativeGoogleMobileAdsBannerAdLayout.usesDynamicHeight(
                          view.getIsFluid(), collapsible);
                  if (view.getIsFluid()) {
                    width = view.getWidth();
                    height = view.getHeight();
                  } else {
                    width = size.getWidthInPixels(view.getContext());
                    height = size.getHeightInPixels(view.getContext());
                    adView.measure(width, height);
                    adView.layout(0, 0, width, height);
                  }
                  if (trackLayoutChanges) {
                    adView.addOnLayoutChangeListener(
                        (v, l, t, r, b, oldL, oldT, oldR, oldB) -> {
                          if (!ReactNativeGoogleMobileAdsBannerAdLayout.shouldEmitSizeChange(
                              oldR - oldL, oldB - oldT, r - l, b - t)) {
                            return;
                          }
                          WritableMap changed = Arguments.createMap();
                          changed.putDouble("width", PixelUtil.toDIPFromPixel(r - l));
                          changed.putDouble("height", PixelUtil.toDIPFromPixel(b - t));
                          sendEvent(view, EVENT_SIZE_CHANGE, changed);
                        });
                  }
                  WritableMap payload = Arguments.createMap();
                  payload.putDouble("width", PixelUtil.toDIPFromPixel(width));
                  payload.putDouble("height", PixelUtil.toDIPFromPixel(height));
                  WritableMap response =
                      ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(ad.getResponseInfo());
                  if (response != null) payload.putMap("responseInfo", response);
                  sendEvent(view, EVENT_AD_LOADED, payload);
                });
          }

          @Override
          public void onAdFailedToLoad(LoadAdError error) {
            view.post(
                () -> {
                  WritableMap payload = ReactNativeGoogleMobileAdsCommon.loadAdErrorToMap(error);
                  sendEvent(view, EVENT_AD_FAILED_TO_LOAD, payload);
                });
          }
        });
  }

  private BannerAdEventCallback buildEventCallback(ReactNativeAdView view, BannerAd ad) {
    return new BannerAdEventCallback() {
      @Override
      public void onAdImpression() {
        view.post(() -> sendEvent(view, EVENT_AD_IMPRESSION, null));
      }

      @Override
      public void onAdClicked() {
        view.post(() -> sendEvent(view, EVENT_AD_CLICKED, null));
      }

      @Override
      public void onAdShowedFullScreenContent() {
        view.post(() -> sendEvent(view, EVENT_AD_OPENED, null));
      }

      @Override
      public void onAdDismissedFullScreenContent() {
        view.post(() -> sendEvent(view, EVENT_AD_CLOSED, null));
      }

      @Override
      public void onAdPaid(AdValue value) {
        view.post(
            () ->
                sendEvent(
                    view,
                    EVENT_PAID,
                    ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(
                        value, ad.getResponseInfo())));
      }

      @Override
      public void onAppEvent(@NonNull String name, @Nullable String data) {
        view.post(
            () -> {
              WritableMap payload = Arguments.createMap();
              payload.putString("name", name);
              payload.putString("data", data);
              sendEvent(view, EVENT_APP_EVENT, payload);
            });
      }
    };
  }

  @Nullable
  private AdView getAdView(ViewGroup parent) {
    if (parent.getChildCount() == 0) {
      return null;
    }
    View child = parent.getChildAt(0);
    return child instanceof AdView ? (AdView) child : null;
  }

  private void sendEvent(ReactNativeAdView view, String type, @Nullable WritableMap payload) {
    WritableMap event = Arguments.createMap();
    event.putString("type", type);
    if (payload != null) event.merge(payload);
    ThemedReactContext context = (ThemedReactContext) view.getContext();
    EventDispatcher dispatcher = UIManagerHelper.getEventDispatcher(context);
    if (dispatcher != null) {
      dispatcher.dispatchEvent(
          new OnNativeEvent(UIManagerHelper.getSurfaceId(view), view.getId(), event));
    }
  }
}
