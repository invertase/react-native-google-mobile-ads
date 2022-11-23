package io.invertase.googlemobileads;

import android.content.Context;
import android.view.View;
import android.widget.FrameLayout;

import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.UIManagerModule;
import com.facebook.react.views.view.ReactViewGroup;
import com.google.android.gms.ads.AdSize;
import com.google.android.gms.ads.BaseAdView;

public class LayoutWrapper extends FrameLayout {
  private BaseAdView contentView;

  public LayoutWrapper(Context context) {
    super(context);
  }

  @Override
  public void requestLayout() {
    super.requestLayout();
    post(measureAndLayout);
  }

  private final Runnable measureAndLayout = () -> {

    BaseAdView adView = getContentView();

    if(adView != null) {
      AdSize adSize = adView.getAdSize();
      int left = adView.getLeft();
      int top = adView.getTop();
      int width = adSize.getWidthInPixels(getContext());
      int height = adSize.getHeightInPixels(getContext());

      measure(
        MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY));
      layout(left, top, left + width, top + height);
    } else {
      measure(
        MeasureSpec.makeMeasureSpec(getWidth(), MeasureSpec.EXACTLY),
        MeasureSpec.makeMeasureSpec(getHeight(), MeasureSpec.EXACTLY));
      layout(getLeft(), getTop(), getRight(), getBottom());
    }
  };


  public void setContentView(BaseAdView view) {
    contentView = view;
    addView(contentView);
  }

  public BaseAdView getContentView() {
    return contentView;
  }

}
