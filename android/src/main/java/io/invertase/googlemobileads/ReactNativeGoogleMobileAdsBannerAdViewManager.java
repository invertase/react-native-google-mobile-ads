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
import android.view.ViewGroup;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.ReadableType;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerHelper;
import com.facebook.react.uimanager.ViewManagerDelegate;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.EventDispatcher;
import com.facebook.react.viewmanagers.RNGoogleMobileAdsBannerViewManagerInterface;
import com.facebook.react.viewmanagers.RNGoogleMobileAdsBannerViewManagerDelegate;
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
import java.util.List;
import java.util.Map;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;
import org.json.JSONException;
import org.json.JSONObject;

public class ReactNativeGoogleMobileAdsBannerAdViewManager
    extends SimpleViewManager<ReactNativeAdView> implements RNGoogleMobileAdsBannerViewManagerInterface<ReactNativeAdView> {
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
  private final ViewManagerDelegate<ReactNativeAdView> delegate  = new RNGoogleMobileAdsBannerViewManagerDelegate<>(this);
  @Nonnull
  @Override
  public String getName() {
    return REACT_CLASS;
  }

  @androidx.annotation.Nullable
  @Override
  protected ViewManagerDelegate<ReactNativeAdView> getDelegate() {
    return delegate;
  }

  @Nonnull
  @Override
  public ReactNativeAdView createViewInstance(@Nonnull ThemedReactContext themedReactContext) {
    return new ReactNativeAdView(themedReactContext);
  }

  @Override
  public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    MapBuilder.Builder<String, Object> builder = MapBuilder.builder();
    builder.put(OnNativeEvent.EVENT_NAME, MapBuilder.of("registrationName", "onNativeEvent"));
    return builder.build();
  }

  @ReactProp(name = "unitId")
  public void setUnitId(ReactNativeAdView reactViewGroup, String value) {
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
      // Handle maxHeight
      if (sizeConfig.hasKey("maxHeight") && !sizeConfig.isNull("maxHeight")) {
        float maxHeight = (float) sizeConfig.getDouble("maxHeight");
        reactViewGroup.setMaxAdHeight(maxHeight);
      } else {
        reactViewGroup.setMaxAdHeight(0);
      }

      // Handle width
      if (sizeConfig.hasKey("width") && !sizeConfig.isNull("width")) {
        float width = (float) sizeConfig.getDouble("width");
        reactViewGroup.setAdWidth(width);
      } else {
        reactViewGroup.setAdWidth(0);
      }
      // Handle the sizes array
      if (sizeConfig.hasKey("sizes") && !sizeConfig.isNull("sizes")) {
        ReadableArray sizesArray = sizeConfig.getArray("sizes");
        if (sizesArray != null) {
          // Process the sizes array and convert to AdSize objects
          List<AdSize> sizeList = new ArrayList<>();
          for (int i = 0; i < sizesArray.size(); i++) {
            if (sizesArray.getType(i) == ReadableType.String) {
              String sizeString = sizesArray.getString(i);
              AdSize adSize =
                  ReactNativeGoogleMobileAdsCommon.getAdSize(sizeString, reactViewGroup);
              sizeList.add(adSize);
            }
          }

          // Update the view with sizes and trigger size change event if needed
          if (sizeList.size() > 0 && !sizeList.contains(AdSize.FLUID)) {
            AdSize adSize = sizeList.get(0);
            WritableMap payload = Arguments.createMap();
            payload.putDouble("width", adSize.getWidth());
            payload.putDouble("height", adSize.getHeight());
            sendEvent(reactViewGroup, EVENT_SIZE_CHANGE, payload);
          }

          reactViewGroup.setSizes(sizeList);
        }
      }

      reactViewGroup.setPropsChanged(true);
    }
  }

  @ReactProp(name = "manualImpressionsEnabled")
  public void setManualImpressionsEnabled(ReactNativeAdView reactViewGroup, boolean value) {
    reactViewGroup.setManualImpressionsEnabled(value);
    reactViewGroup.setPropsChanged(true);
  }

  @Override
  public void recordManualImpression(ReactNativeAdView view) {
    BaseAdView adView = getAdView(view);
    if (adView instanceof AdManagerAdView) {
      ((AdManagerAdView) adView).recordManualImpression();
    }
  }

  @Override
  public void load(ReactNativeAdView view) {
    BaseAdView adView = getAdView(view);
    AdRequest request = view.getRequest();
    if(adView !=null) {
      adView.loadAd(request);
    }
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
    BaseAdView adView = getAdView(reactViewGroup);
    if (adView != null) {
      adView.setAdListener(null);
      if (adView instanceof AdManagerAdView) {
        ((AdManagerAdView) adView).setAppEventListener(null);
      }
      adView.destroy();
      reactViewGroup.removeView(adView);
    }
    super.onDropViewInstance(reactViewGroup);
  }

  private BaseAdView initAdView(ReactNativeAdView reactViewGroup) {
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

    adView.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
    adView.setOnPaidEventListener(
        new OnPaidEventListener() {
          @Override
          public void onPaidEvent(AdValue adValue) {
            WritableMap payload = Arguments.createMap();
            payload.putDouble("value", 1e-6 * adValue.getValueMicros());
            payload.putDouble("precision", adValue.getPrecisionType());
            payload.putString("currency", adValue.getCurrencyCode());
            sendEvent(reactViewGroup, EVENT_PAID, payload);
          }
        });
    adView.setAdListener(
        new AdListener() {
          @Override
          public void onAdLoaded() {
            AdSize adSize = adView.getAdSize();
            int width, height;
            if (reactViewGroup.getIsFluid()) {
              width = reactViewGroup.getWidth();
              height = reactViewGroup.getHeight();

              adView.addOnLayoutChangeListener(
                  (v, left, top, right, bottom, oldLeft, oldTop, oldRight, oldBottom) -> {
                    WritableMap payload = Arguments.createMap();
                    payload.putDouble("width", PixelUtil.toDIPFromPixel(right - left));
                    payload.putDouble("height", PixelUtil.toDIPFromPixel(bottom - top));
                    sendEvent(reactViewGroup, EVENT_SIZE_CHANGE, payload);
                  });
            } else {
              int left = adView.getLeft();
              int top = adView.getTop();
              width = adSize.getWidthInPixels(reactViewGroup.getContext());
              height = adSize.getHeightInPixels(reactViewGroup.getContext());

              adView.measure(width, height);
              adView.layout(left, top, left + width, top + height);
            }

            WritableMap payload = Arguments.createMap();
            payload.putDouble("width", PixelUtil.toDIPFromPixel(width));
            payload.putDouble("height", PixelUtil.toDIPFromPixel(height));

            sendEvent(reactViewGroup, EVENT_AD_LOADED, payload);
          }

          @Override
          public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
            int errorCode = loadAdError.getCode();
            WritableMap payload = ReactNativeGoogleMobileAdsCommon.errorCodeToMap(errorCode);
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
    return (BaseAdView) reactViewGroup.getChildAt(0);
  }

  private void requestAd(ReactNativeAdView reactViewGroup) {
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
    EventDispatcher eventDispatcher =
        UIManagerHelper.getEventDispatcherForReactTag(themedReactContext, reactViewGroup.getId());
    if (eventDispatcher != null) {
      eventDispatcher.dispatchEvent(new OnNativeEvent(reactViewGroup.getId(), event));
    }
  }
}
