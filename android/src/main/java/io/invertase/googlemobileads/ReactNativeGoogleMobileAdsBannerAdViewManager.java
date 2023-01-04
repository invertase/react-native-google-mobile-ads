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

import android.view.ViewGroup;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.PixelUtil;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.facebook.react.views.view.ReactViewGroup;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.AdView;
import com.google.android.gms.ads.BaseAdView;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.admanager.AdManagerAdView;
import com.google.android.gms.ads.admanager.AppEventListener;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import javax.annotation.Nonnull;
import javax.annotation.Nullable;

public class ReactNativeGoogleMobileAdsBannerAdViewManager
    extends SimpleViewManager<ReactViewGroup> {
  private static final String REACT_CLASS = "RNGoogleMobileAdsBannerView";
  private final String EVENT_AD_LOADED = "onAdLoaded";
  private final String EVENT_AD_FAILED_TO_LOAD = "onAdFailedToLoad";
  private final String EVENT_AD_OPENED = "onAdOpened";
  private final String EVENT_AD_CLOSED = "onAdClosed";
  private final String EVENT_SIZE_CHANGE = "onSizeChange";
  private final String EVENT_APP_EVENT = "onAppEvent";
  private final int COMMAND_ID_RECORD_MANUAL_IMPRESSION = 1;

  private final HashMap<Integer, AdRequest> requestMap = new HashMap<>();
  private final HashMap<Integer, List<AdSize>> sizesMap = new HashMap<>();
  private final HashMap<Integer, String> unitIdMap = new HashMap<>();
  private final HashMap<Integer, Boolean> manualImpressionsEnabledMap = new HashMap<>();
  private final HashMap<Integer, Boolean> propsChangedMap = new HashMap<>();
  private final HashMap<Integer, Boolean> isFluidMap = new HashMap<>();

  @Nonnull
  @Override
  public String getName() {
    return REACT_CLASS;
  }

  @Nonnull
  @Override
  public ReactViewGroup createViewInstance(@Nonnull ThemedReactContext themedReactContext) {
    return new ReactViewGroup(themedReactContext);
  }

  @Override
  public void onDropViewInstance(@NonNull ReactViewGroup reactViewGroup) {
    super.onDropViewInstance(reactViewGroup);

    requestMap.remove(reactViewGroup.getId());
    sizesMap.remove(reactViewGroup.getId());
    unitIdMap.remove(reactViewGroup.getId());
    manualImpressionsEnabledMap.remove(reactViewGroup.getId());
    propsChangedMap.remove(reactViewGroup.getId());
    isFluidMap.remove(reactViewGroup.getId());
  }

  @Override
  public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
    MapBuilder.Builder<String, Object> builder = MapBuilder.builder();
    builder.put("onNativeEvent", MapBuilder.of("registrationName", "onNativeEvent"));
    return builder.build();
  }

  @Nullable
  @Override
  public Map<String, Integer> getCommandsMap() {
    return MapBuilder.of("recordManualImpression", COMMAND_ID_RECORD_MANUAL_IMPRESSION);
  }

  @Override
  public void receiveCommand(
      @NonNull ReactViewGroup reactViewGroup, String commandId, @Nullable ReadableArray args) {
    super.receiveCommand(reactViewGroup, commandId, args);
    int commandIdInt = Integer.parseInt(commandId);

    if (commandIdInt == COMMAND_ID_RECORD_MANUAL_IMPRESSION) {
      BaseAdView adView = getAdView(reactViewGroup);
      if (adView instanceof AdManagerAdView) {
        ((AdManagerAdView) adView).recordManualImpression();
      }
    }
  }

  @ReactProp(name = "unitId")
  public void setUnitId(ReactViewGroup reactViewGroup, String value) {
    unitIdMap.put(reactViewGroup.getId(), value);
    propsChangedMap.put(reactViewGroup.getId(), true);
  }

  @ReactProp(name = "request")
  public void setRequest(ReactViewGroup reactViewGroup, ReadableMap value) {
    requestMap.put(reactViewGroup.getId(), ReactNativeGoogleMobileAdsCommon.buildAdRequest(value));
    propsChangedMap.put(reactViewGroup.getId(), true);
  }

  @ReactProp(name = "sizes")
  public void setSizes(ReactViewGroup reactViewGroup, ReadableArray value) {
    List<AdSize> sizeList = new ArrayList<>();
    for (Object size : value.toArrayList()) {
      if (size instanceof String) {
        String sizeString = (String) size;
        sizeList.add(ReactNativeGoogleMobileAdsCommon.getAdSize(sizeString, reactViewGroup));
      }
    }

    if (sizeList.size() > 0) {
      AdSize adSize = sizeList.get(0);
      WritableMap payload = Arguments.createMap();
      payload.putDouble("width", adSize.getWidth());
      payload.putDouble("height", adSize.getHeight());
      sendEvent(reactViewGroup, EVENT_SIZE_CHANGE, payload);
    }

    sizesMap.put(reactViewGroup.getId(), sizeList);
    propsChangedMap.put(reactViewGroup.getId(), true);
  }

  @ReactProp(name = "manualImpressionsEnabled")
  public void setManualImpressionsEnabled(ReactViewGroup reactViewGroup, boolean value) {
    manualImpressionsEnabledMap.put(reactViewGroup.getId(), value);
    propsChangedMap.put(reactViewGroup.getId(), true);
  }

  @Override
  public void onAfterUpdateTransaction(@NonNull ReactViewGroup reactViewGroup) {
    super.onAfterUpdateTransaction(reactViewGroup);
    if (Boolean.TRUE.equals(propsChangedMap.get(reactViewGroup.getId()))) {
      requestAd(reactViewGroup);
    }
    propsChangedMap.put(reactViewGroup.getId(), false);
  }

  private BaseAdView initAdView(ReactViewGroup reactViewGroup) {
    BaseAdView oldAdView = getAdView(reactViewGroup);
    if (oldAdView != null) {
      reactViewGroup.removeView(oldAdView);
      oldAdView.setAdListener(new AdListener() {
        @Override
        public void onAdClosed() {
          super.onAdClosed();
        }

        @Override
        public void onAdFailedToLoad(@NonNull LoadAdError loadAdError) {
          super.onAdFailedToLoad(loadAdError);
        }

        @Override
        public void onAdOpened() {
          super.onAdOpened();
        }

        @Override
        public void onAdLoaded() {
          super.onAdLoaded();
        }

        @Override
        public void onAdClicked() {
          super.onAdClicked();
        }

        @Override
        public void onAdImpression() {
          super.onAdImpression();
        }
      });
      if (oldAdView instanceof AdManagerAdView) {
        ((AdManagerAdView) oldAdView).setAppEventListener(
          new AppEventListener() {
            @Override
            public void onAppEvent(@NonNull String name, @Nullable String data) {
              // empty to clear previous listeners
            }
          });
      }
      oldAdView.destroy();
    }
    BaseAdView adView;
    if (ReactNativeGoogleMobileAdsCommon.isAdManagerUnit(unitIdMap.get(reactViewGroup.getId()))) {
      adView = new AdManagerAdView(reactViewGroup.getContext());
    } else {
      adView = new AdView(reactViewGroup.getContext());
    }
    adView.setDescendantFocusability(ViewGroup.FOCUS_BLOCK_DESCENDANTS);
    adView.setAdListener(
        new AdListener() {
          @Override
          public void onAdLoaded() {
            AdSize adSize = adView.getAdSize();
            int left, top, width, height;
            if (Boolean.TRUE.equals(isFluidMap.get(reactViewGroup.getId()))) {
              // TODO size=FLUID is still not working
              left = 0;
              top = 0;
              width = reactViewGroup.getWidth();
              height = reactViewGroup.getHeight();
            } else {
              left = adView.getLeft();
              top = adView.getTop();
              width = adSize.getWidthInPixels(reactViewGroup.getContext());
              height = adSize.getHeightInPixels(reactViewGroup.getContext());
            }
            adView.measure(width, height);
            adView.layout(left, top, left + width, top + height);

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
  private BaseAdView getAdView(ReactViewGroup reactViewGroup) {
    return (BaseAdView) reactViewGroup.getChildAt(0);
  }

  private void requestAd(ReactViewGroup reactViewGroup) {
    String unitId = unitIdMap.get(reactViewGroup.getId());
    List<AdSize> sizes = sizesMap.get(reactViewGroup.getId());
    AdRequest request = requestMap.get(reactViewGroup.getId());
    Boolean manualImpressionsEnabled = manualImpressionsEnabledMap.get(reactViewGroup.getId());

    if (sizes == null || unitId == null || request == null || manualImpressionsEnabled == null) {
      return;
    }

    BaseAdView adView = initAdView(reactViewGroup);
    adView.setAdUnitId(unitId);

    isFluidMap.put(reactViewGroup.getId(), false);
    if (adView instanceof AdManagerAdView) {
      if (sizes.contains(AdSize.FLUID)) {
        isFluidMap.put(reactViewGroup.getId(), true);
        ((AdManagerAdView) adView).setAdSizes(AdSize.FLUID);
      } else {
        ((AdManagerAdView) adView).setAdSizes(sizes.toArray(new AdSize[0]));
      }
      if (manualImpressionsEnabled) {
        ((AdManagerAdView) adView).setManualImpressionsEnabled(true);
      }
    } else {
      adView.setAdSize(sizes.get(0));
    }

    adView.loadAd(request);
  }

  private void sendEvent(ReactViewGroup reactViewGroup, String type, WritableMap payload) {
    WritableMap event = Arguments.createMap();
    event.putString("type", type);

    if (payload != null) {
      event.merge(payload);
    }

    ((ThemedReactContext) reactViewGroup.getContext())
        .getJSModule(RCTEventEmitter.class)
        .receiveEvent(reactViewGroup.getId(), "onNativeEvent", event);
  }
}
