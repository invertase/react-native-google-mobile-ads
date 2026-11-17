package io.invertase.googlemobileads.securesignals.liveramp;

import android.content.Context;
import androidx.annotation.NonNull;
import com.google.android.gms.ads.VersionInfo;
import com.google.android.gms.ads.mediation.InitializationCompleteCallback;
import com.google.android.gms.ads.mediation.MediationConfiguration;
import com.google.android.gms.ads.mediation.rtb.RtbAdapter;
import com.google.android.gms.ads.mediation.rtb.RtbSignalData;
import com.google.android.gms.ads.mediation.rtb.SignalCallbacks;
import java.util.List;

/**
 * GMA Secure Signals RTB adapter — reads cached envelopes synchronously (no network).
 */
public class LiveRampAtsRtbAdapter extends RtbAdapter {

  @Override
  public void initialize(
      @NonNull Context context,
      @NonNull InitializationCompleteCallback initializationCompleteCallback,
      @NonNull List<MediationConfiguration> mediationConfigurations) {
    LiveRampAtsEnvelopeManager.getInstance(context);
    initializationCompleteCallback.onInitializationSucceeded();
  }

  @Override
  public void collectSignals(@NonNull RtbSignalData rtbSignalData, @NonNull SignalCallbacks signalCallbacks) {
    String signal =
        LiveRampAtsEnvelopeManager.getInstance(rtbSignalData.getContext()).collectSignalSync();
    signalCallbacks.onSuccess(signal != null ? signal : "");
  }

  @NonNull
  @Override
  public VersionInfo getSDKVersionInfo() {
    return envelopeApiVersion();
  }

  @NonNull
  @Override
  public VersionInfo getVersionInfo() {
    return packageVersion();
  }

  private static VersionInfo envelopeApiVersion() {
    String[] parts = BuildConfig.LR_ATS_ENVELOPE_API_VERSION.split("\\.");
    int major = parts.length > 0 ? parseInt(parts[0]) : 2;
    int minor = parts.length > 1 ? parseInt(parts[1]) : 0;
    int micro = parts.length > 2 ? parseInt(parts[2]) : 0;
    return new VersionInfo(major, minor, micro);
  }

  private static VersionInfo packageVersion() {
    String[] parts = BuildConfig.LR_ATS_PACKAGE_VERSION.split("\\.");
    int major = parts.length > 0 ? parseInt(parts[0]) : 0;
    int minor = parts.length > 1 ? parseInt(parts[1]) : 0;
    int micro = parts.length > 2 ? parseInt(parts[2]) : 0;
    return new VersionInfo(major, minor, micro);
  }

  private static int parseInt(String value) {
    try {
      return Integer.parseInt(value);
    } catch (NumberFormatException ignored) {
      return 0;
    }
  }
}