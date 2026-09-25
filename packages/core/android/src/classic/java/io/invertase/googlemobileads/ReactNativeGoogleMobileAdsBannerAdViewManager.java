package io.invertase.googlemobileads;

/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

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
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdValue;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.BaseAdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.OnPaidEventListener;
import com.google.android.gms.ads.admanager.AdManagerAdView;
import com.google.android.gms.ads.admanager.AppEventListener;
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
  private final String EVENT_AD_LOADED = "onAdLoaded";
  private final String EVENT_AD_IMPRESSION = "onAdImpression";
  private final String EVENT_AD_CLICKED = "onAdClicked";
  private final String EVENT_AD_FAILED_TO_LOAD = "onAdFailedToLoad";
  private final String EVENT_AD_OPENED = "onAdOpened";
  private final String EVENT_AD_CLOSED = "onAdClosed";
  private final String EVENT_PAID = "onPaid";
  private final String EVENT_SIZE_CHANGE = "onSizeChange";
  private final String EVENT_APP_EVENT = "onAppEvent";
  private final String COMMAND_ID_RECORD_MANUAL_IMPRESSION = "recordManualImpression";
  private final String COMMAND_ID_LOAD = "load";

  @Nonnull
  @Override
  public String getName() {
    return REACT_CLASS;
  }

  @Nonnull
  @Override
  public ReactNativeAdView createViewInstance(@Nonnull ThemedReactContext themedReactContext) {
    ReactNativeAdView view = new ReactNativeAdView(themedReactContext);
    LifecycleEventListener listener =
        ReactNativeGoogleMobileAdsBannerAdHostDestroy.attach(
            themedReactContext, () -> destroyAdView(view));
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
      @NonNull ReactNativeAdView reactViewGroup, String commandId, @Nullable ReadableArray args) {
    super.receiveCommand(reactViewGroup, commandId, args);

    if (commandId.equals(COMMAND_ID_RECORD_MANUAL_IMPRESSION)) {
      BaseAdView adView = getAdView(reactViewGroup);
      if (adView instanceof AdManagerAdView) {
        ((AdManagerAdView) adView).recordManualImpression();
      }
    } else if (commandId.equals(COMMAND_ID_LOAD)) {
      BaseAdView adView = getAdView(reactViewGroup);
      AdRequest request = reactViewGroup.getRequest();
      adView.loadAd(request);
    }
  }

  @ReactProp(name = "unitId")
  public void setUnitId(ReactNativeAdView reactViewGroup, String value) {
    if (value != null && value.equals(reactViewGroup.getUnitId())) {
      return;
    }
    reactViewGroup.setUnitId(value);
    reactViewGroup.setPropsChanged(true);
  }

  @ReactProp(name = "request")
  public void setRequest(ReactNativeAdView reactViewGroup, String value) {
    try {
      JSONObject jsonObject = new JSONObject(value);
      WritableMap writableMap = SharedUtils.jsonObjectToWritableMap(jsonObject);
      reactViewGroup.setRequest(ReactNativeGoogleMobileAdsCommon.buildAdRequest(writableMap));
      reactViewGroup.setPropsChanged(true);
    } catch (JSONException e) {
      e.printStackTrace();
    }
  }

  @ReactProp(name = "sizeConfig")
  public void setSizeConfig(ReactNativeAdView reactViewGroup, ReadableMap sizeConfig) {
    if (sizeConfig != null) {
      float maxHeight = 0;
      float width = 0;
      // Handle maxHeight
      if (sizeConfig.hasKey("maxHeight") && !sizeConfig.isNull("maxHeight")) {
        maxHeight = (float) sizeConfig.getDouble("maxHeight");
      }

      // Handle width
      if (sizeConfig.hasKey("width") && !sizeConfig.isNull("width")) {
        width = (float) sizeConfig.getDouble("width");
      }

      List<String> sizeNames = new ArrayList<>();
      // Handle the sizes array
      if (sizeConfig.hasKey("sizes") && !sizeConfig.isNull("sizes")) {
        ReadableArray sizesArray = sizeConfig.getArray("sizes");
        if (sizesArray != null) {
          for (int i = 0; i < sizesArray.size(); i++) {
            if (sizesArray.getType(i) == ReadableType.String) {
              sizeNames.add(sizesArray.getString(i));
            }
          }
        }
      }

      boolean requiresReload =
          ReactNativeGoogleMobileAdsBannerAdLayout.sizeConfigRequiresReload(
              reactViewGroup.getSizeNames(),
              reactViewGroup.getMaxAdHeight(),
              reactViewGroup.getAdWidth(),
              sizeNames,
              maxHeight,
              width);

      reactViewGroup.setMaxAdHeight(maxHeight);
      reactViewGroup.setAdWidth(width);
      reactViewGroup.setSizeNames(sizeNames);

      if (!sizeNames.isEmpty()) {
        List<AdSize> sizeList = new ArrayList<>();
        for (String sizeString : sizeNames) {
          AdSize adSize = ReactNativeGoogleMobileAdsCommon.getAdSize(sizeString, reactViewGroup);
          sizeList.add(adSize);
        }

        // Update the view with sizes and trigger size change event if needed
        if (!sizeList.isEmpty() && !sizeList.contains(AdSize.FLUID) && requiresReload) {
          AdSize adSize = sizeList.get(0);
          WritableMap payload = Arguments.createMap();
          payload.putDouble("width", adSize.getWidth());
          payload.putDouble("height", adSize.getHeight());
          sendEvent(reactViewGroup, EVENT_SIZE_CHANGE, payload);
        }

        reactViewGroup.setSizes(sizeList);
      }

      if (requiresReload) {
        reactViewGroup.setPropsChanged(true);
      }
    }
  }

  @ReactProp(name = "manualImpressionsEnabled")
  public void setManualImpressionsEnabled(ReactNativeAdView reactViewGroup, boolean value) {
    if (reactViewGroup.getManualImpressionsEnabled() == value
        && reactViewGroup.getSizeNames() != null) {
      return;
    }
    reactViewGroup.setManualImpressionsEnabled(value);
    reactViewGroup.setPropsChanged(true);
  }

  @Override
  public void onAfterUpdateTransaction(@NonNull ReactNativeAdView reactViewGroup) {
    super.onAfterUpdateTransaction(reactViewGroup);
    if (reactViewGroup.getPropsChanged()) {
      requestAd(reactViewGroup);
    }
    reactViewGroup.setPropsChanged(false);
  }

  @Override
  public void onDropViewInstance(@NonNull ReactNativeAdView reactViewGroup) {
    destroyAdView(reactViewGroup);
    super.onDropViewInstance(reactViewGroup);
  }

  /**
   * Idempotent AdView teardown for JS unmount ([onDropViewInstance]) and host Activity destroy
   * (#892 configuration-change leak when AppState stays active).
   */
  private void destroyAdView(@NonNull ReactNativeAdView reactViewGroup) {
    if (!reactViewGroup.beginAdTeardown()) {
      return;
    }
    ReactContext reactContext = (ReactContext) reactViewGroup.getContext();
    ReactNativeGoogleMobileAdsBannerAdHostDestroy.detach(
        reactContext, reactViewGroup.getHostDestroyListener());
    reactViewGroup.setHostDestroyListener(null);

    BaseAdView adView = getAdView(reactViewGroup);
    if (adView != null) {
      adView.setAdListener(null);
      if (adView instanceof AdManagerAdView) {
        ((AdManagerAdView) adView).setAppEventListener(null);
      }
      adView.destroy();
      reactViewGroup.removeView(adView);
    } else if (reactViewGroup.getChildCount() > 0) {
      reactViewGroup.removeViewAt(0);
    }
  }

  private BaseAdView initAdView(ReactNativeAdView reactViewGroup) {
    if (reactViewGroup.isAdTornDown()) {
      return null;
    }
    BaseAdView oldAdView = getAdView(reactViewGroup);
    if (oldAdView != null) {
      oldAdView.setAdListener(null);
      if (oldAdView instanceof AdManagerAdView) {
        ((AdManagerAdView) oldAdView).setAppEventListener(null);
      }
      oldAdView.destroy();
      reactViewGroup.removeView(oldAdView);
    }

    // For optimal mediation performance ad objects should be initialized with
    // activity, rather than just context:
    // https://developers.google.com/admob/android/mediation#initialize_your_ad_object_with_an_activity_instance
    Activity currentActivity = ((ReactContext) reactViewGroup.getContext()).getCurrentActivity();
    if (currentActivity == null) return null;

    BaseAdView adView =
        ReactNativeGoogleMobileAdsCommon.isAdManagerUnit(reactViewGroup.getUnitId())
            ? new AdManagerAdView(currentActivity)
            : new AdView(currentActivity);

    // FOCUS_BLOCK_DESCENDANTS alone is insufficient after creative load (#813).
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(adView);
    ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(reactViewGroup);
    adView.setOnPaidEventListener(
        new OnPaidEventListener() {
          @Override
          public void onPaidEvent(AdValue adValue) {
            WritableMap payload =
                ReactNativeGoogleMobileAdsResponseInfo.paidEventPayload(
                    adValue, adView.getResponseInfo());
            sendEvent(reactViewGroup, EVENT_PAID, payload);
          }
        });
    adView.setAdListener(
        new AdListener() {
          @Override
          public void onAdLoaded() {
            // Creatives / mediation can re-enable focus on the AdView after load (#813).
            ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(adView);
            ReactNativeGoogleMobileAdsBannerAdFocus.blockHardwareBackFocus(reactViewGroup);
            AdSize adSize = adView.getAdSize();
            boolean collapsible = adView.isCollapsible();
            reactViewGroup.setIsCollapsible(collapsible);
            int width, height;
            boolean trackLayoutChanges =
                ReactNativeGoogleMobileAdsBannerAdLayout.usesDynamicHeight(
                    reactViewGroup.getIsFluid(), collapsible);
            if (reactViewGroup.getIsFluid()) {
              width = reactViewGroup.getWidth();
              height = reactViewGroup.getHeight();
            } else {
              int left = adView.getLeft();
              int top = adView.getTop();
              width = adSize.getWidthInPixels(reactViewGroup.getContext());
              height = adSize.getHeightInPixels(reactViewGroup.getContext());

              adView.measure(width, height);
              adView.layout(left, top, left + width, top + height);
            }

            if (trackLayoutChanges) {
              adView.addOnLayoutChangeListener(
                  (v, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
                    if (!ReactNativeGoogleMobileAdsBannerAdLayout.shouldEmitSizeChange(
                        oldRight - oldLeft, oldBottom - oldTop, right - left, bottom - top)) {
                      return;
                    }
                    WritableMap sizePayload = Arguments.createMap();
                    sizePayload.putDouble("width", PixelUtil.toDIPFromPixel(right - left));
                    sizePayload.putDouble("height", PixelUtil.toDIPFromPixel(bottom - top));
                    sendEvent(reactViewGroup, EVENT_SIZE_CHANGE, sizePayload);
                  });
            }

            WritableMap payload = Arguments.createMap();
            payload.putDouble("width", PixelUtil.toDIPFromPixel(width));
            payload.putDouble("height", PixelUtil.toDIPFromPixel(height));
            WritableMap responseInfo =
                ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(adView.getResponseInfo());
            if (responseInfo != null) {
              payload.putMap("responseInfo", responseInfo);
            }

            sendEvent(reactViewGroup, EVENT_AD_LOADED, payload);
            // Hybrid image+video creatives need a resume kick once presentable (#711).
            reactViewGroup.refreshBannerPresentation();
          }

          @Override
          public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
            int errorCode = loadAdError.getCode();
            WritableMap payload = ReactNativeGoogleMobileAdsCommon.errorCodeToMap(errorCode);
            WritableMap responseInfo =
                ReactNativeGoogleMobileAdsResponseInfo.toWritableMap(loadAdError.getResponseInfo());
            if (responseInfo != null) {
              payload.putMap("responseInfo", responseInfo);
            }
            sendEvent(reactViewGroup, EVENT_AD_FAILED_TO_LOAD, payload);
          }

          @Override
          public void onAdOpened() {
            sendEvent(reactViewGroup, EVENT_AD_OPENED, null);
          }

          @Override
          public void onAdClosed() {
            sendEvent(reactViewGroup, EVENT_AD_CLOSED, null);
          }

          @Override
          public void onAdImpression() {
            sendEvent(reactViewGroup, EVENT_AD_IMPRESSION, null);
          }

          @Override
          public void onAdClicked() {
            sendEvent(reactViewGroup, EVENT_AD_CLICKED, null);
          }
        });
    if (adView instanceof AdManagerAdView) {
      ((AdManagerAdView) adView)
          .setAppEventListener(
              new AppEventListener() {
                @Override
                public void onAppEvent(@NonNull String name, @Nullable String data) {
                  WritableMap payload = Arguments.createMap();
                  payload.putString("name", name);
                  payload.putString("data", data);
                  sendEvent(reactViewGroup, EVENT_APP_EVENT, payload);
                }
              });
    }
    reactViewGroup.addView(adView);
    return adView;
  }

  @Nullable
  private BaseAdView getAdView(ViewGroup reactViewGroup) {
    if (reactViewGroup.getChildCount() == 0) {
      return null;
    }
    View child = reactViewGroup.getChildAt(0);
    return child instanceof BaseAdView ? (BaseAdView) child : null;
  }

  private void requestAd(ReactNativeAdView reactViewGroup) {
    if (reactViewGroup.isAdTornDown()) {
      return;
    }
    String unitId = reactViewGroup.getUnitId();
    List<AdSize> sizes = reactViewGroup.getSizes();
    AdRequest request = reactViewGroup.getRequest();
    Boolean manualImpressionsEnabled = reactViewGroup.getManualImpressionsEnabled();

    if (sizes == null || unitId == null || request == null || manualImpressionsEnabled == null) {
      return;
    }

    BaseAdView adView = initAdView(reactViewGroup);
    if (adView != null) {
      adView.setAdUnitId(unitId);
      reactViewGroup.setIsFluid(false);
      reactViewGroup.setIsCollapsible(false);
      if (adView instanceof AdManagerAdView) {
        if (sizes.contains(AdSize.FLUID)) {
          reactViewGroup.setIsFluid(true);
        }
        ((AdManagerAdView) adView).setAdSizes(sizes.toArray(new AdSize[0]));

        if (manualImpressionsEnabled) {
          ((AdManagerAdView) adView).setManualImpressionsEnabled(true);
        }
      } else {
        adView.setAdSize(sizes.get(0));
      }

      adView.loadAd(request);
    }
  }

  private void sendEvent(ReactNativeAdView reactViewGroup, String type, WritableMap payload) {
    WritableMap event = Arguments.createMap();
    event.putString("type", type);

    if (payload != null) {
      event.merge(payload);
    }

    ThemedReactContext themedReactContext = ((ThemedReactContext) reactViewGroup.getContext());
    EventDispatcher eventDispatcher = UIManagerHelper.getEventDispatcher(themedReactContext);
    if (eventDispatcher != null) {
      eventDispatcher.dispatchEvent(
          new OnNativeEvent(
              UIManagerHelper.getSurfaceId(reactViewGroup), reactViewGroup.getId(), event));
    }
  }
}
