/**
 * Sample React Native App — format gallery for manual QA and Appium smoke.
 * https://github.com/facebook/react-native
 *
 * @format
 */

/* eslint-disable no-console, @typescript-eslint/no-explicit-any */

import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Button,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import { AppiumTestIds } from './src/appiumTestIds';
import { getNativeRNGMATesting } from '@invertase/rngma-testing';
import MobileAds, {
  AdEventType,
  AdFormat,
  AdPoolProvider,
  AdPoolPresets,
  AdPools,
  AdsConsent,
  AdsConsentDebugGeography,
  AppOpenAd,
  BannerAd,
  BannerAdSize,
  GAMAdEventType,
  GAMBannerAd,
  GAMBannerAdSize,
  GAMInterstitialAd,
  InterstitialAd,
  type MobileAd,
  MultiFormatAdPresets,
  MultiFormatAdRequest,
  MultiFormatBannerAdView,
  NativeAd,
  NativeAdEventType,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  NativeMediaView,
  type PaidEvent,
  RevenuePrecisions,
  RewardedAd,
  RewardedAdEventType,
  RewardedInterstitialAd,
  TestIds,
  getAdCapabilities,
  useAdPool,
  useAppOpenAd,
  useInterstitialAd,
  useMultiFormatAd,
  usePooledAd,
  useRewardedAd,
  useRewardedInterstitialAd,
  type MultiFormatAdHandle,
  type MultiFormatBannerAdHandle,
} from 'react-native-google-mobile-ads';

type GallerySection = 'all' | 'formats' | 'hooks' | 'pools' | 'debug';

type GalleryEntry = {
  id: string;
  title: string;
  section: Exclude<GallerySection, 'all'>;
  render: () => React.ReactNode;
};

const REQUEST_OUTCOME_PENDING = 'Request outcome: pending';
const REQUEST_OUTCOME_LOADED = 'Request outcome: loaded';
const REQUEST_OUTCOME_NO_FILL = 'Request outcome: no-fill';
const REQUEST_OUTCOME_ERROR = 'Request error:';

type RequestState = {
  requestId: number;
  attempt: number;
  outcome: string;
};

let nextRequestId = 0;

function freshRequestState(attempt: number): RequestState {
  nextRequestId += 1;
  return {
    requestId: nextRequestId,
    attempt,
    outcome: REQUEST_OUTCOME_PENDING,
  };
}

type RequestError = Error & {
  code?: string;
  reason?: string;
};

function requestErrorOutcome(error: unknown): string {
  const requestError = error as RequestError;
  if (requestError.reason === 'no-fill') {
    return REQUEST_OUTCOME_NO_FILL;
  }
  const reason = requestError.reason ?? requestError.code ?? 'unknown';
  const message = requestError.message ?? String(error);
  return `${REQUEST_OUTCOME_ERROR} ${reason}: ${message}`;
}

function requestOutcomeLabel(state: RequestState): string {
  return `Request id: ${state.requestId}; Request attempt: ${state.attempt}; ${state.outcome}`;
}

type ShowLifecyclePhase = 'idle' | 'opened' | 'closed';
type UtilityLifecyclePhase = 'idle' | 'opened' | 'closed';

function showLifecycleLabel(phase: ShowLifecyclePhase): string {
  return `Show lifecycle: ${phase}`;
}

function utilityLifecycleLabel(phase: UtilityLifecyclePhase): string {
  return `Utility lifecycle: ${phase}`;
}

const POOL_PROVIDER_INTERSTITIAL_ID = 'appium-gallery-pool-interstitial-provider';

const GAM_MULTI_FORMAT_CONFIG = {
  adUnitId: TestIds.GAM_NATIVE,
  requestOptions: MultiFormatAdPresets.nativeOrBanner([BannerAdSize.MEDIUM_RECTANGLE]),
};

function multiFormatWinnerLabel(handle: MultiFormatAdHandle | undefined): string | null {
  if (!handle) {
    return null;
  }
  return handle.format === AdFormat.NATIVE ? 'native' : 'banner';
}

function MultiFormatWinnerRender(props: {
  formatId: string;
  renderedTestId: string;
  handle: MultiFormatAdHandle | null;
}) {
  if (!props.handle) {
    return null;
  }
  if (props.handle.format === AdFormat.NATIVE) {
    const nativeAd = props.handle.ad;
    return (
      <NativeAdView nativeAd={nativeAd} testID={props.renderedTestId}>
        <View style={{ padding: 16, gap: 8 }}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{nativeAd.headline}</Text>
          </NativeAsset>
        </View>
      </NativeAdView>
    );
  }
  const bannerHandle = props.handle as MultiFormatBannerAdHandle;
  return (
    <MultiFormatBannerAdView handle={bannerHandle} testID={props.renderedTestId} />
  );
}

function poolOutcomeLabel(fields: {
  poolStatus: string;
  pooledStatus: string;
  available: boolean;
  observedCount: number;
  showPhase: ShowLifecyclePhase;
  extra?: string;
}): string {
  const parts = [
    `poolStatus=${fields.poolStatus}`,
    `pooledStatus=${fields.pooledStatus}`,
    `available=${fields.available}`,
    `observed=${fields.observedCount}`,
    showLifecycleLabel(fields.showPhase),
  ];
  if (fields.extra) {
    parts.push(fields.extra);
  }
  return parts.join('; ');
}

function hookLifecycleLabel(fields: {
  status: string;
  impression: boolean;
  clicked: boolean;
  earnedReward?: boolean;
}): string {
  const parts = [
    `status=${fields.status}`,
    `impression=${fields.impression}`,
    `clicked=${fields.clicked}`,
  ];
  if (fields.earnedReward !== undefined) {
    parts.push(`earned=${fields.earnedReward}`);
  }
  return `Hook lifecycle: ${parts.join('; ')}`;
}

const GALLERY_SECTION_CHIPS: Array<{ id: GallerySection; title: string }> = [
  { id: 'all', title: 'All' },
  { id: 'formats', title: 'Formats' },
  { id: 'hooks', title: 'Hooks' },
  { id: 'pools', title: 'Pools' },
  { id: 'debug', title: 'Debug' },
];

function bannerVariantKey(
  bannerAdSize: BannerAdSize | string,
  maxHeight?: number,
  width?: number,
): string {
  return bannerAdSize
    .split('_')
    .map(s => s.toLowerCase().charAt(0).toUpperCase() + s.toLowerCase().slice(1))
    .join('')
    .concat(maxHeight ? `MaxHeight${maxHeight}` : '')
    .concat(width ? `Width${width}` : '');
}

function gamSizesKey(sizes: (keyof typeof GAMBannerAdSize)[]): string {
  return sizes
    .map(size =>
      size
        .split('_')
        .map((s: string) => s.toLowerCase().charAt(0).toUpperCase() + s.toLowerCase().slice(1))
        .join(''),
    )
    .join('_');
}

/** Dump Istanbul (when instrumented) + native Emma/LLVM buffers via react-native-coverage. */
function invokeCoverageFlush(): void {
  try {
    // Pattern C: published package TurboModule — do not copy RNFB flush sources.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { flush } = require('react-native-coverage') as { flush: () => void };
    flush();
    console.log('[native-coverage] flush invoked');
  } catch (error) {
    console.warn('[native-coverage] flush failed', error);
  }
}

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bannerMenuOpen, setBannerMenuOpen] = useState(false);
  const [section, setSection] = useState<GallerySection>('all');
  const entries = useMemo(() => buildGalleryEntries(), []);

  const bannerEntries = entries.filter(e => e.id.startsWith('gma.format.banner.'));
  const primaryEntries = entries.filter(e => !e.id.startsWith('gma.format.banner.'));
  const showBanners = section === 'all' || section === 'formats';
  const visiblePrimary =
    section === 'all' ? primaryEntries : primaryEntries.filter(e => e.section === section);
  const selected = entries.find(e => e.id === selectedId) ?? null;

  return (
    <View style={styles.container} testID={AppiumTestIds.root}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        style={{
          marginTop: safeAreaInsets.top,
          marginBottom: safeAreaInsets.bottom,
          marginLeft: safeAreaInsets.left,
          marginRight: safeAreaInsets.right,
        }}
        testID={AppiumTestIds.gallery}
      >
        {selected ? (
          <View>
            <View style={styles.testSpacing}>
              <Text style={styles.heading}>{selected.title}</Text>
              <Button
                title="Back to gallery"
                testID={AppiumTestIds.galleryBack}
                onPress={() => setSelectedId(null)}
              />
            </View>
            {selected.render()}
          </View>
        ) : (
          <View style={styles.testSpacing}>
            <Text style={styles.heading}>GMA format gallery</Text>
            <Text style={styles.subheading}>
              Manual QA and Appium smoke — Google demo / TestIds only (no mediation).
            </Text>
            <View style={styles.sectionChipRow}>
              {GALLERY_SECTION_CHIPS.map(chip => (
                <View key={chip.id} style={styles.sectionChip}>
                  <Button
                    title={section === chip.id ? `• ${chip.title}` : chip.title}
                    testID={AppiumTestIds.section[chip.id]}
                    onPress={() => {
                      setSection(chip.id);
                      setBannerMenuOpen(false);
                    }}
                  />
                </View>
              ))}
            </View>
            {showBanners ? (
              <View style={styles.galleryRow}>
                <Button
                  title={bannerMenuOpen ? 'Hide banner sizes' : 'Banner sizes'}
                  testID={AppiumTestIds.openFormat(AppiumTestIds.format.banner)}
                  onPress={() => setBannerMenuOpen(open => !open)}
                />
              </View>
            ) : null}
            {showBanners && bannerMenuOpen
              ? bannerEntries.map(entry => (
                  <View key={entry.id} style={styles.galleryRow}>
                    <Button
                      title={entry.title}
                      testID={AppiumTestIds.openFormat(entry.id)}
                      onPress={() => setSelectedId(entry.id)}
                    />
                  </View>
                ))
              : null}
            {visiblePrimary.map(entry => (
              <View key={entry.id} style={styles.galleryRow}>
                <Button
                  title={entry.title}
                  testID={AppiumTestIds.openFormat(entry.id)}
                  onPress={() => setSelectedId(entry.id)}
                />
              </View>
            ))}
            {/* Bottom of home list so Appium scrollIntoView does not park early smoke targets on the gesture-nav edge.
                Extra top margin separates the last format opener (e.g. RWI Hook in Hooks) from Flush so
                coordinate/element taps do not land on the teardown control. */}
            <View style={[styles.galleryRow, styles.flushCoverageRow]}>
              <Button
                title="Flush coverage"
                testID={AppiumTestIds.flushCoverage}
                onPress={invokeCoverageFlush}
              />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const appOpen = AppOpenAd.createForAdRequest(TestIds.APP_OPEN, {
  requestNonPersonalizedAdsOnly: true,
});

const interstitial = InterstitialAd.createForAdRequest(TestIds.INTERSTITIAL);
const rewarded = RewardedAd.createForAdRequest(TestIds.REWARDED, {
  requestNonPersonalizedAdsOnly: true,
  keywords: ['fashion', 'clothing'],
});
const rewardedInterstitial = RewardedInterstitialAd.createForAdRequest(
  TestIds.REWARDED_INTERSTITIAL,
  {
    requestNonPersonalizedAdsOnly: true,
    keywords: ['fashion', 'clothing'],
  },
);
const gamInterstitial = GAMInterstitialAd.createForAdRequest(TestIds.GAM_INTERSTITIAL);

function LoadableAdControls(props: { mobileAd: MobileAd; type: string; formatId: string }) {
  const [requestState, setRequestState] = useState<RequestState>({
    requestId: 0,
    attempt: 0,
    outcome: REQUEST_OUTCOME_PENDING,
  });
  const [showPhase, setShowPhase] = useState<ShowLifecyclePhase>('idle');

  useEffect(() => {
    const adListener = props.mobileAd.addAdEventsListener(({ type, payload }) => {
      console.log(`${Platform.OS} ${props.type} ad event: ${type}`);
      if (type === AdEventType.PAID) {
        console.log(payload);
      }
      if (type === AdEventType.ERROR) {
        setRequestState(current => ({ ...current, outcome: requestErrorOutcome(payload) }));
        console.log(`${Platform.OS} ${props.type} error: ${(payload as Error)?.message}`);
      }
      if (type === AdEventType.LOADED || type === RewardedAdEventType.LOADED) {
        setRequestState(current => ({ ...current, outcome: REQUEST_OUTCOME_LOADED }));
      }
      if (type === AdEventType.OPENED) {
        setShowPhase('opened');
      }
      if (type === AdEventType.CLOSED) {
        setShowPhase('closed');
      }
    });
    return () => adListener();
  }, [props.mobileAd, props.type]);

  return (
    <View style={styles.testSpacing} testID={props.formatId}>
      <Button
        title={`Load ${props.type} Ad`}
        testID={AppiumTestIds.action.load(props.formatId)}
        onPress={() => {
          try {
            setShowPhase('idle');
            setRequestState(current => freshRequestState(current.attempt + 1));
            props.mobileAd.load();
          } catch (e) {
            setRequestState(current => ({ ...current, outcome: requestErrorOutcome(e) }));
            console.log(`${Platform.OS} ${props.type} load error: ${e}`);
          }
        }}
      />
      <Text testID={AppiumTestIds.action.loaded(props.formatId)}>
        {requestOutcomeLabel(requestState)}
      </Text>
      <Text testID={AppiumTestIds.action.lifecycle(props.formatId)}>
        {showLifecycleLabel(showPhase)}
      </Text>
      <Button
        title={`Show ${props.type} Ad`}
        testID={AppiumTestIds.action.show(props.formatId)}
        onPress={() => {
          try {
            props.mobileAd.show();
          } catch (e) {
            console.log(`${Platform.OS} ${props.type} show error: ${e}`);
          }
        }}
      />
    </View>
  );
}

function BannerFormat(props: {
  bannerAdSize: BannerAdSize | string;
  maxHeight?: number;
  width?: number;
}) {
  const bannerRef = useRef<BannerAd>(null);
  const [requestState, setRequestState] = useState<RequestState>(() => freshRequestState(1));
  const variantKey = bannerVariantKey(props.bannerAdSize, props.maxHeight, props.width);
  const formatId = AppiumTestIds.bannerVariant(variantKey);

  return (
    <View style={styles.testSpacing} testID={formatId}>
      <View testID={AppiumTestIds.action.rendered(formatId)} collapsable={false}>
        <BannerAd
          ref={bannerRef}
          unitId={
            String(props.bannerAdSize).includes('ADAPTIVE_BANNER')
              ? TestIds.ADAPTIVE_BANNER
              : TestIds.BANNER
          }
          size={props.bannerAdSize}
          maxHeight={props.maxHeight}
          width={props.width}
          onAdLoaded={() => {
            setRequestState(current => ({ ...current, outcome: REQUEST_OUTCOME_LOADED }));
          }}
          onAdFailedToLoad={error => {
            setRequestState(current => ({ ...current, outcome: requestErrorOutcome(error) }));
          }}
          onPaid={(event: PaidEvent) => {
            console.log(
              `Paid: ${event.value} ${event.currency} (precision ${
                RevenuePrecisions[event.precision]
              }})`,
            );
          }}
        />
      </View>
      <Text testID={AppiumTestIds.action.loaded(formatId)}>
        {requestOutcomeLabel(requestState)}
      </Text>
      <Button
        title="reload"
        testID={AppiumTestIds.action.reload(formatId)}
        onPress={() => {
          setRequestState(current => freshRequestState(current.attempt + 1));
          bannerRef.current?.load();
        }}
      />
    </View>
  );
}

function CollapsibleBannerFormat() {
  const formatId = AppiumTestIds.format.collapsibleBanner;
  const [requestState, setRequestState] = useState<RequestState>(() => freshRequestState(1));

  return (
    <View style={styles.testSpacing} testID={formatId}>
      <View testID={AppiumTestIds.action.rendered(formatId)} collapsable={false}>
        <BannerAd
          unitId={TestIds.ADAPTIVE_BANNER}
          size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{
            networkExtras: {
              collapsible: 'top',
            },
          }}
          onAdLoaded={() => {
            setRequestState(current => ({ ...current, outcome: REQUEST_OUTCOME_LOADED }));
          }}
          onAdFailedToLoad={error => {
            setRequestState(current => ({ ...current, outcome: requestErrorOutcome(error) }));
          }}
        />
      </View>
      <Text testID={AppiumTestIds.action.loaded(formatId)}>
        {requestOutcomeLabel(requestState)}
      </Text>
    </View>
  );
}

function NativeComponent() {
  const [nativeAd, setNativeAd] = useState<NativeAd>();
  const [requestState, setRequestState] = useState<RequestState>(() => freshRequestState(1));

  useEffect(() => {
    // Generic native ads use AdMob's system-defined native test unit. GAM_NATIVE
    // also serves a custom native format that this SDK does not request.
    NativeAd.createForAdRequest(TestIds.NATIVE, {
      aspectRatio: NativeMediaAspectRatio.LANDSCAPE,
    })
      .then(ad => {
        setNativeAd(ad);
        setRequestState(current => ({ ...current, outcome: REQUEST_OUTCOME_LOADED }));
      })
      .catch(error => {
        setRequestState(current => ({ ...current, outcome: requestErrorOutcome(error) }));
        console.error(error);
      });
  }, []);

  useEffect(() => {
    if (!nativeAd) {
      return;
    }
    nativeAd.addAdEventListener(NativeAdEventType.IMPRESSION, () => {
      console.debug('Native ad impression');
    });
    nativeAd.addAdEventListener(NativeAdEventType.CLICKED, () => {
      console.debug('Native ad clicked');
    });
    nativeAd.addAdEventListener(NativeAdEventType.PAID, payload => {
      console.debug('Paid', payload);
    });
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_PLAYED, () => {
      console.debug('Native ad video played');
    });
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_PAUSED, () => {
      console.debug('Native ad video paused');
    });
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_ENDED, () => {
      console.debug('Native ad video ended');
    });
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_MUTED, () => {
      console.debug('Native ad video muted');
    });
    nativeAd.addAdEventListener(NativeAdEventType.VIDEO_UNMUTED, () => {
      console.debug('Native ad video unmuted');
    });
    return () => nativeAd.destroy();
  }, [nativeAd]);

  if (!nativeAd) {
    return (
      <View>
        <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.native)}>
          {requestOutcomeLabel(requestState)}
        </Text>
        <Text testID={AppiumTestIds.format.native}>Loading native ad…</Text>
      </View>
    );
  }

  return (
    <View>
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.native)}>
        {requestOutcomeLabel(requestState)}
      </Text>
      <Text testID={AppiumTestIds.format.native}>Native ad</Text>
      <NativeAdView
        nativeAd={nativeAd}
        testID={AppiumTestIds.action.rendered(AppiumTestIds.format.native)}
      >
        <View style={{ padding: 16, gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {nativeAd.icon && (
              <NativeAsset assetType={NativeAssetType.ICON}>
                <Image source={{ uri: nativeAd.icon.url }} width={24} height={24} />
              </NativeAsset>
            )}
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{nativeAd.headline}</Text>
            </NativeAsset>
            <Text
              style={{
                backgroundColor: '#FBBC04',
                color: 'white',
                paddingHorizontal: 2,
                paddingVertical: 1,
                fontWeight: 'bold',
                fontSize: 12,
                borderRadius: 4,
              }}
            >
              AD
            </Text>
          </View>
          {nativeAd.advertiser && (
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text>{nativeAd.advertiser}</Text>
            </NativeAsset>
          )}
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text>{nativeAd.body}</Text>
          </NativeAsset>
        </View>
        <NativeMediaView />
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <Text
            style={{
              color: 'white',
              fontWeight: 'bold',
              backgroundColor: '#4285F4',
              paddingHorizontal: 16,
              paddingVertical: 12,
            }}
          >
            {nativeAd.callToAction}
          </Text>
        </NativeAsset>
      </NativeAdView>
    </View>
  );
}

function ConsentFormat() {
  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.consent}>
      <Button
        title="Show Consent Form"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.consent)}
        onPress={async () => {
          const consentInfo = await AdsConsent.requestInfoUpdate({
            debugGeography: AdsConsentDebugGeography.EEA,
            testDeviceIdentifiers: [],
          });

          if (consentInfo.isConsentFormAvailable) {
            await AdsConsent.showForm();

            const choices = await AdsConsent.getUserChoices();

            console.log(JSON.stringify(choices, null, 2));
          }
        }}
      />

      <Text>
        This test case will not work with the test App ID. You must configure your real App ID in
        app.json and the Consent Form in AdMob/Ad Manager. If you are running this test on a device
        instead of an emulator and if you are currently not located in EEA, you have to add your
        Device ID to the testDeviceIdentifiers of this test case as well.
      </Text>
    </View>
  );
}

function InterstitialHookFormat() {
  const { show, error, status, clicked, impression, revenue } = useInterstitialAd({
    adUnitId: TestIds.INTERSTITIAL,
  });
  useEffect(() => {
    if (status === 'error' || status === 'no-fill') {
      console.log(`${Platform.OS} interstitial hook error: ${error.message}`);
    }
  }, [error, status]);
  useEffect(() => {
    console.log(
      `${Platform.OS} interstitial hook state - status/clicked/impression: ${status}/${clicked}/${impression}`,
    );
  }, [clicked, impression, status]);

  if (revenue) {
    console.log('Revenue', revenue);
  }

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.interstitialHook}>
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.interstitialHook)}>
        Status: {status}
      </Text>
      <Text testID={AppiumTestIds.action.lifecycle(AppiumTestIds.format.interstitialHook)}>
        {hookLifecycleLabel({ status, impression, clicked })}
      </Text>
      <Text>Error? {error ? error.message : 'false'}</Text>
      <Button
        title="Show Interstitial"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.interstitialHook)}
        disabled={status !== 'loaded'}
        onPress={() => {
          show();
        }}
      />
    </View>
  );
}

function RewardedHookFormat() {
  const { load, show, status, error, reward, earnedReward, clicked, impression } = useRewardedAd({
    adUnitId: TestIds.REWARDED,
  });
  useEffect(() => {
    if (status === 'error' || status === 'no-fill') {
      console.log(`${Platform.OS} rewarded hook error: ${error.message}`);
    }
  }, [error, status]);
  useEffect(() => {
    if (reward !== null) {
      console.log(`${Platform.OS} rewarded hook reward: ${JSON.stringify(reward)}`);
    }
  }, [reward]);
  useEffect(() => {
    console.log(
      `${Platform.OS} rewarded hook state - status/earned/clicked/impression: ${status}/${earnedReward}/${clicked}/${impression}`,
    );
  }, [clicked, earnedReward, impression, status]);

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.rewardedHook}>
      <Button
        title="Load Rewarded"
        testID={AppiumTestIds.action.load(AppiumTestIds.format.rewardedHook)}
        onPress={() => {
          load();
        }}
      />
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.rewardedHook)}>
        Status: {status}
      </Text>
      <Text testID={AppiumTestIds.action.lifecycle(AppiumTestIds.format.rewardedHook)}>
        {hookLifecycleLabel({ status, impression, clicked, earnedReward })}
      </Text>
      <Text>Error? {error ? error.message : 'false'}</Text>
      <Button
        title="Show Rewarded"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.rewardedHook)}
        disabled={status !== 'loaded'}
        onPress={() => {
          show();
        }}
      />
    </View>
  );
}

function RewardedInterstitialHookFormat() {
  const { load, show, status, error, reward, earnedReward, clicked, impression } =
    useRewardedInterstitialAd({
      adUnitId: TestIds.REWARDED_INTERSTITIAL,
    });
  useEffect(() => {
    if (status === 'error' || status === 'no-fill') {
      console.log(`${Platform.OS} rewarded interstitial hook error: ${error.message}`);
    }
  }, [error, status]);
  useEffect(() => {
    if (reward !== null) {
      console.log(`${Platform.OS} rewarded interstitial hook reward: ${JSON.stringify(reward)}`);
    }
  }, [reward]);
  useEffect(() => {
    console.log(
      `${Platform.OS} rewarded interstitial hook state - status/earned/clicked/impression: ${status}/${earnedReward}/${clicked}/${impression}`,
    );
  }, [clicked, earnedReward, impression, status]);

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.rewardedInterstitialHook}>
      <Button
        title="Load Rewarded Interstitial"
        testID={AppiumTestIds.action.load(AppiumTestIds.format.rewardedInterstitialHook)}
        onPress={() => {
          load();
        }}
      />
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.rewardedInterstitialHook)}>
        Status: {status}
      </Text>
      <Text testID={AppiumTestIds.action.lifecycle(AppiumTestIds.format.rewardedInterstitialHook)}>
        {hookLifecycleLabel({ status, impression, clicked, earnedReward })}
      </Text>
      <Text>Error? {error ? error.message : 'false'}</Text>
      <Button
        title="Show Rewarded Interstitial"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.rewardedInterstitialHook)}
        disabled={status !== 'loaded'}
        onPress={() => {
          show();
        }}
      />
    </View>
  );
}

function PooledInterstitialProviderInner() {
  const pool = useAdPool(POOL_PROVIDER_INTERSTITIAL_ID);
  const pooled = usePooledAd(POOL_PROVIDER_INTERSTITIAL_ID);
  const [showPhase, setShowPhase] = useState<ShowLifecyclePhase>('idle');
  const showListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      showListenerRef.current?.();
      showListenerRef.current = null;
    };
  }, []);

  return (
    <View>
      <Text
        testID={AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialProvider)}
      >
        {poolOutcomeLabel({
          poolStatus: pool.status,
          pooledStatus: pooled.status,
          available: pooled.available,
          observedCount: pooled.observedCount,
          showPhase,
        })}
      </Text>
      <Text testID={AppiumTestIds.action.lifecycle(AppiumTestIds.format.poolInterstitialProvider)}>
        {showLifecycleLabel(showPhase)}
      </Text>
      <Button
        title="Poll pooled interstitial"
        testID={AppiumTestIds.action.load(AppiumTestIds.format.poolInterstitialProvider)}
        onPress={() => {
          void pooled.poll();
        }}
      />
      <Button
        title="Show pooled interstitial"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.poolInterstitialProvider)}
        disabled={pooled.status !== 'filled' || pooled.ad == null}
        onPress={() => {
          const ad = pooled.ad;
          if (ad == null || !('show' in ad)) {
            return;
          }
          setShowPhase('idle');
          showListenerRef.current?.();
          showListenerRef.current = ad.addAdEventsListener(({ type }) => {
            if (type === AdEventType.OPENED) {
              setShowPhase('opened');
            }
            if (type === AdEventType.CLOSED) {
              setShowPhase('closed');
            }
          });
          void ad.show();
        }}
      />
      <Button
        title="Release pooled ad"
        testID={AppiumTestIds.action.reload(AppiumTestIds.format.poolInterstitialProvider)}
        disabled={pooled.ad == null}
        onPress={() => {
          pooled.release();
        }}
      />
    </View>
  );
}

function PooledInterstitialProviderFormat() {
  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.poolInterstitialProvider}>
      <AdPoolProvider
        pools={[
          AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, TestIds.INTERSTITIAL, {
            poolId: POOL_PROVIDER_INTERSTITIAL_ID,
            bufferSize: 1,
          }),
        ]}
      >
        <PooledInterstitialProviderInner />
      </AdPoolProvider>
    </View>
  );
}

function PooledInterstitialImperativeFormat() {
  const [poolId, setPoolId] = useState<string | null>(null);
  const lookupPoolId = poolId ?? 'appium-imperative-pool-absent';
  const pool = useAdPool(lookupPoolId);
  const pooled = usePooledAd(lookupPoolId);
  const [showPhase, setShowPhase] = useState<ShowLifecyclePhase>('idle');
  const showListenerRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      showListenerRef.current?.();
      showListenerRef.current = null;
    };
  }, []);

  const registryHit = poolId != null && AdPools.get(poolId) != null;

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.poolInterstitialImperative}>
      <Text
        testID={AppiumTestIds.action.loaded(AppiumTestIds.format.poolInterstitialImperative)}
      >
        {poolId
          ? poolOutcomeLabel({
              poolStatus: pool.status,
              pooledStatus: pooled.status,
              available: pooled.available,
              observedCount: pooled.observedCount,
              showPhase,
              extra: `registry=${registryHit}`,
            })
          : 'poolStatus=absent; pooledStatus=idle; available=false; observed=0; Show lifecycle: idle'}
      </Text>
      <Text testID={AppiumTestIds.action.lifecycle(AppiumTestIds.format.poolInterstitialImperative)}>
        {showLifecycleLabel(showPhase)}
      </Text>
      <Button
        title="Create interstitial pool"
        testID={AppiumTestIds.action.load(AppiumTestIds.format.poolInterstitialImperative)}
        onPress={() => {
          void (async () => {
            const id = `appium-imperative-pool-${Date.now()}`;
            await AdPools.create(
              AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, TestIds.INTERSTITIAL, {
                poolId: id,
                bufferSize: 1,
              }),
            );
            setPoolId(id);
          })();
        }}
      />
      <Button
        title="Destroy all pools"
        onPress={() => {
          AdPools.destroyAll();
          setPoolId(null);
          setShowPhase('idle');
        }}
      />
      <Button
        title="Poll imperative pool"
        testID={AppiumTestIds.action.reload(AppiumTestIds.format.poolInterstitialImperative)}
        disabled={poolId == null}
        onPress={() => {
          void pooled.poll();
        }}
      />
      <Button
        title="Show imperative pool"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.poolInterstitialImperative)}
        disabled={pooled.status !== 'filled' || pooled.ad == null}
        onPress={() => {
          const ad = pooled.ad;
          if (ad == null || !('show' in ad)) {
            return;
          }
          setShowPhase('idle');
          showListenerRef.current?.();
          showListenerRef.current = ad.addAdEventsListener(({ type }) => {
            if (type === AdEventType.OPENED) {
              setShowPhase('opened');
            }
            if (type === AdEventType.CLOSED) {
              setShowPhase('closed');
            }
          });
          void ad.show();
        }}
      />
    </View>
  );
}

function MultiFormatRequestFormat() {
  const formatId = AppiumTestIds.format.multiFormatRequest;
  const renderedTestId = AppiumTestIds.action.rendered(formatId);
  const requestRef = useRef<MultiFormatAdRequest | null>(null);
  const winnerHandleRef = useRef<MultiFormatAdHandle | null>(null);
  const [requestState, setRequestState] = useState<RequestState>(() => freshRequestState(0));
  const [winnerHandle, setWinnerHandle] = useState<MultiFormatAdHandle | null>(null);

  useEffect(() => {
    return () => {
      requestRef.current?.destroy();
      requestRef.current = null;
      winnerHandleRef.current?.destroy();
      winnerHandleRef.current = null;
    };
  }, []);

  const runLoad = async (attempt: number) => {
    setRequestState(freshRequestState(attempt));
    winnerHandleRef.current?.destroy();
    winnerHandleRef.current = null;
    setWinnerHandle(null);
    requestRef.current?.destroy();
    const request = MultiFormatAdRequest.create(GAM_MULTI_FORMAT_CONFIG);
    requestRef.current = request;
    try {
      const result = await request.load();
      if (result.ads.length > 0 && result.errors.length === 0) {
        const handle = result.ads[0]!;
        const winner = multiFormatWinnerLabel(handle);
        winnerHandleRef.current = handle;
        setWinnerHandle(handle);
        setRequestState(current => ({
          ...current,
          outcome: winner
            ? `${REQUEST_OUTCOME_LOADED}; winner=${winner}`
            : REQUEST_OUTCOME_LOADED,
        }));
        return;
      }
      if (result.errors.length > 0) {
        setRequestState(current => ({
          ...current,
          outcome: requestErrorOutcome(result.errors[0]),
        }));
        return;
      }
      setRequestState(current => ({ ...current, outcome: REQUEST_OUTCOME_NO_FILL }));
    } catch (error) {
      setRequestState(current => ({ ...current, outcome: requestErrorOutcome(error) }));
    }
  };

  return (
    <View style={styles.testSpacing} testID={formatId}>
      <Button
        title="Load GAM multi-format"
        testID={AppiumTestIds.action.load(formatId)}
        onPress={() => {
          void runLoad(requestState.attempt + 1);
        }}
      />
      <Text testID={AppiumTestIds.action.loaded(formatId)}>{requestOutcomeLabel(requestState)}</Text>
      <MultiFormatWinnerRender
        formatId={formatId}
        renderedTestId={renderedTestId}
        handle={winnerHandle}
      />
    </View>
  );
}

function MultiFormatHookFormat() {
  const formatId = AppiumTestIds.format.multiFormatHook;
  const renderedTestId = AppiumTestIds.action.rendered(formatId);
  const [requestState, setRequestState] = useState<RequestState>(() => freshRequestState(1));
  const multi = useMultiFormatAd({
    ...GAM_MULTI_FORMAT_CONFIG,
    autoLoad: true,
  });

  useEffect(() => {
    if (multi.status === 'idle' || multi.status === 'loading') {
      return;
    }
    if (multi.status === 'loaded' || multi.status === 'loaded-partial') {
      const handle = multi.ads[0];
      const winner = multiFormatWinnerLabel(handle);
      setRequestState(current => ({
        ...current,
        outcome: winner
          ? `${REQUEST_OUTCOME_LOADED}; winner=${winner}`
          : REQUEST_OUTCOME_LOADED,
      }));
      return;
    }
    if (multi.status === 'no-fill') {
      setRequestState(current => ({ ...current, outcome: REQUEST_OUTCOME_NO_FILL }));
      return;
    }
    if (multi.status === 'error') {
      setRequestState(current => ({
        ...current,
        outcome: requestErrorOutcome(multi.errors[0]),
      }));
    }
  }, [multi.status, multi.ads, multi.errors]);

  const winnerHandle =
    multi.status === 'loaded' || multi.status === 'loaded-partial' ? multi.ads[0] ?? null : null;

  return (
    <View style={styles.testSpacing} testID={formatId}>
      <Text testID={AppiumTestIds.action.loaded(formatId)}>{requestOutcomeLabel(requestState)}</Text>
      <Text>Hook status: {multi.status}</Text>
      <MultiFormatWinnerRender
        formatId={formatId}
        renderedTestId={renderedTestId}
        handle={winnerHandle}
      />
    </View>
  );
}

function PoolCapabilityGatesFormat() {
  const caps = getAdCapabilities();
  const [gateNote, setGateNote] = useState('gates=idle');

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.poolCapabilityGates}>
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.poolCapabilityGates)}>
        {`peekCapability=${AdPools.getCapabilities().poolResponseInfoPeek}; rwiPreload=${getAdCapabilities().fullscreenPreloadFormats.rewardedInterstitial}; backend=${caps.backend}; ${gateNote}`}
      </Text>
      <Button
        title="Probe SDK peek"
        testID={AppiumTestIds.action.load(AppiumTestIds.format.poolCapabilityGates)}
        onPress={() => {
          void (async () => {
            try {
              setGateNote('peek=running');
              if (Platform.OS === 'android') {
                await MobileAds().initialize();
              }
              const pool = await AdPools.create(
                AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, TestIds.INTERSTITIAL, {
                  poolId: `appium-peek-gate-${Date.now()}`,
                  bufferSize: 1,
                }),
              );
              const poll = await pool.poll();
              if (poll.status !== 'filled') {
                throw new Error(`peek gate expected filled poll, received ${poll.status}`);
              }
              try {
                await pool.peekResponseInfo();
                setGateNote('peek=ok');
              } catch (error) {
                const reason = (error as RequestError).reason ?? String(error);
                if (reason === 'pool/peek-unsupported') {
                  setGateNote(`peek=structured-unsupported reason=${reason}`);
                } else {
                  throw error;
                }
              } finally {
                pool.destroy();
              }
            } catch (error) {
              setGateNote(`peek=error: ${String(error)}`);
            }
          })();
        }}
      />
    </View>
  );
}

function PoolRwiPreloadGateFormat() {
  const [gateNote, setGateNote] = useState('rwi=idle');

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.poolRwiPreloadGate}>
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.poolRwiPreloadGate)}>
        {`rwiPreload=${getAdCapabilities().fullscreenPreloadFormats.rewardedInterstitial}; ${gateNote}`}
      </Text>
      <Button
        title="Probe RWI preload pool"
        testID={AppiumTestIds.action.load(AppiumTestIds.format.poolRwiPreloadGate)}
        onPress={() => {
          void (async () => {
            try {
              setGateNote('rwi=running');
              const pool = await AdPools.create(
                AdPoolPresets.fullscreen(
                  AdFormat.REWARDED_INTERSTITIAL,
                  TestIds.REWARDED_INTERSTITIAL,
                  {
                    poolId: `appium-rwi-gate-${Date.now()}`,
                    bufferSize: 1,
                  },
                ),
              );
              setGateNote(`rwi=created poolId=${pool.poolId}`);
              pool.destroy();
            } catch (error) {
              const reason = (error as RequestError).reason ?? String(error);
              if (reason === 'pool/format-preload-unsupported') {
                setGateNote(`rwi=structured-unsupported reason=${reason}`);
              } else {
                setGateNote(`rwi=error: ${String(error)}`);
              }
            }
          })();
        }}
      />
    </View>
  );
}

function AppOpenHookFormat() {
  const { load, show, error, status, clicked, impression } = useAppOpenAd({
    adUnitId: TestIds.APP_OPEN,
  });
  useEffect(() => {
    if (status === 'error' || status === 'no-fill') {
      console.log(`${Platform.OS} app open hook error: ${error.message}`);
    }
  }, [error, status]);
  useEffect(() => {
    console.log(
      `${Platform.OS} app open hook state - status/clicked/impression: ${status}/${clicked}/${impression}`,
    );
  }, [clicked, impression, status]);

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.appOpenHook}>
      <Button
        title="Load App Open"
        testID={AppiumTestIds.action.load(AppiumTestIds.format.appOpenHook)}
        onPress={() => {
          load();
        }}
      />
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.appOpenHook)}>
        Status: {status}
      </Text>
      <Text testID={AppiumTestIds.action.lifecycle(AppiumTestIds.format.appOpenHook)}>
        {hookLifecycleLabel({ status, impression, clicked })}
      </Text>
      <Text>Error? {error ? error.message : 'false'}</Text>
      <Button
        title="Show App Open"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.appOpenHook)}
        disabled={status !== 'loaded'}
        onPress={() => {
          show();
        }}
      />
    </View>
  );
}

function AdInspectorFormat() {
  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.adInspector}>
      <Button
        title="Show Ad Inspector"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.adInspector)}
        onPress={() => {
          MobileAds().openAdInspector();
        }}
      />
    </View>
  );
}

function GAMBannerFormat(props: {
  unitId: string;
  sizes: (keyof typeof GAMBannerAdSize)[];
}) {
  const bannerRef = useRef<GAMBannerAd>(null);
  const formatId = AppiumTestIds.gamBannerVariant(gamSizesKey(props.sizes));
  const [requestState, setRequestState] = useState<RequestState>(() => freshRequestState(1));

  return (
    <View style={styles.testSpacing} testID={formatId}>
      <View testID={AppiumTestIds.action.rendered(formatId)} collapsable={false}>
        <GAMBannerAd
          ref={bannerRef}
          unitId={props.unitId}
          sizes={props.sizes}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          manualImpressionsEnabled={true}
          onAdLoaded={() => {
            setRequestState(current => ({ ...current, outcome: REQUEST_OUTCOME_LOADED }));
          }}
          onAdFailedToLoad={(error: Error) => {
            setRequestState(current => ({ ...current, outcome: requestErrorOutcome(error) }));
            console.log(`${Platform.OS} GAM banner error: ${error.message}`);
          }}
        />
      </View>
      <Text testID={AppiumTestIds.action.loaded(formatId)}>
        {requestOutcomeLabel(requestState)}
      </Text>
      <Button
        title="recordManualImpression"
        testID={AppiumTestIds.action.recordImpression(formatId)}
        onPress={() => {
          bannerRef.current?.recordManualImpression();
        }}
      />
    </View>
  );
}

function GAMInterstitialFormat() {
  const formatId = AppiumTestIds.format.gamInterstitial;
  const [requestState, setRequestState] = useState<RequestState>({
    requestId: 0,
    attempt: 0,
    outcome: REQUEST_OUTCOME_PENDING,
  });
  const [showPhase, setShowPhase] = useState<ShowLifecyclePhase>('idle');

  useEffect(() => {
    const adListener = gamInterstitial.addAdEventsListener(({ type, payload }) => {
      console.log(`${Platform.OS} GAM interstitial ad event: ${type}`);
      if (type === AdEventType.ERROR) {
        setRequestState(current => ({ ...current, outcome: requestErrorOutcome(payload) }));
        console.log(`${Platform.OS} GAM interstitial error: ${(payload as Error).message}`);
      }
      if (type === AdEventType.LOADED) {
        setRequestState(current => ({ ...current, outcome: REQUEST_OUTCOME_LOADED }));
      }
      if (type === AdEventType.OPENED) {
        setShowPhase('opened');
      }
      if (type === AdEventType.CLOSED) {
        setShowPhase('closed');
      }
      if (type === GAMAdEventType.APP_EVENT) {
        console.log(`${Platform.OS} GAM interstitial app event: ${JSON.stringify(payload)}`);
      }
    });
    return () => adListener();
  }, []);

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.gamInterstitial}>
      <Button
        title="Load GAM Interstitial"
        testID={AppiumTestIds.action.load(AppiumTestIds.format.gamInterstitial)}
        onPress={() => {
          try {
            setShowPhase('idle');
            setRequestState(current => freshRequestState(current.attempt + 1));
            gamInterstitial.load();
          } catch (e) {
            setRequestState(current => ({ ...current, outcome: requestErrorOutcome(e) }));
            console.log(`${Platform.OS} GAM Interstitial load error: ${e}`);
          }
        }}
      />
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.gamInterstitial)}>
        {requestOutcomeLabel(requestState)}
      </Text>
      <Text testID={AppiumTestIds.action.lifecycle(AppiumTestIds.format.gamInterstitial)}>
        {showLifecycleLabel(showPhase)}
      </Text>
      <Button
        title="Show GAM Interstitial"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.gamInterstitial)}
        onPress={() => {
          gamInterstitial.show();
        }}
      />
    </View>
  );
}

function DebugMenuFormat() {
  useEffect(() => {
    // Android requires SDK initialization before opening the Debug Menu
    if (Platform.OS === 'android') {
      MobileAds().initialize().catch(console.error);
    }
  }, []);

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.debugMenu}>
      <Button
        title="Show Ad Debug Menu"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.debugMenu)}
        onPress={() => {
          MobileAds().openDebugMenu(TestIds.BANNER);
        }}
      />
    </View>
  );
}

function FlushCoverageFormat() {
  const [status, setStatus] = useState('idle');

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.flushCoverage}>
      <Text style={styles.subheading}>
        Calls react-native-coverage flush() (Istanbul dump when instrumented, then Emma/LLVM).
      </Text>
      <Text testID={AppiumTestIds.action.loaded(AppiumTestIds.format.flushCoverage)}>
        Status: {status}
      </Text>
      <Button
        title="Flush coverage now"
        testID={AppiumTestIds.action.show(AppiumTestIds.format.flushCoverage)}
        onPress={() => {
          try {
            invokeCoverageFlush();
            setStatus('flushed');
          } catch (error) {
            setStatus(`error: ${String(error)}`);
          }
        }}
      />
    </View>
  );
}

/** Pattern C: exercise NativeRNGMATesting seed probes (ping / TTL / attach / ResponseInfo fixtures). */
function NativeRNGMATestingFormat() {
  const [status, setStatus] = useState('idle');

  return (
    <View style={styles.testSpacing} testID={AppiumTestIds.format.nativeRngmaTesting}>
      <Text style={styles.subheading}>
        Example-only TurboModule probes (reparent / expiry / ResponseInfo seams). Not product code.
      </Text>
      {/* accessible + accessibilityLabel: Android Appium reads content-desc; Pressable (not
          RN Button) so show testID is a real clickable resource-id. */}
      <Text
        testID={AppiumTestIds.action.loaded(AppiumTestIds.format.nativeRngmaTesting)}
        accessible
        accessibilityLabel={status}
      >
        Status: {status}
      </Text>
      <Pressable
        testID={AppiumTestIds.action.show(AppiumTestIds.format.nativeRngmaTesting)}
        accessibilityRole="button"
        accessibilityLabel="Run NativeRNGMATesting probes"
        onPress={() => {
          void (async () => {
            try {
              setStatus('running');
              const NativeRNGMATesting = getNativeRNGMATesting();
              if (NativeRNGMATesting == null) {
                setStatus('error: module not linked');
                return;
              }
              const ping = await NativeRNGMATesting.ping();
              await NativeRNGMATesting.setDebugInventoryTtlMs(60_000);
              const ttl = await NativeRNGMATesting.getDebugInventoryTtlMs();
              await NativeRNGMATesting.setDebugInventoryTtlMs(0);
              const cleared = await NativeRNGMATesting.getDebugInventoryTtlMs();
              const attach = await NativeRNGMATesting.supportsDelayedBannerAttach();
              const loaded = await NativeRNGMATesting.getResponseInfoFixtureJson('loaded');
              const noFill = await NativeRNGMATesting.getResponseInfoFixtureJson('no-fill');
              const paid = await NativeRNGMATesting.getResponseInfoFixtureJson('paid-compact');
              // Fold P-expiry (TTL seam) + P-reparent-and (delayed attach) into gallery status.
              setStatus(
                `ok ping=${ping} ttl=${ttl} cleared=${cleared} attach=${attach} fixtures=${[
                    loaded,
                    noFill,
                    paid,
                  ]
                    .map(j => JSON.parse(j).responseId ?? 'null')
                    .join(',')}`,
              );
            } catch (error) {
              setStatus(`error: ${String(error)}`);
            }
          })();
        }}
        style={styles.probePressable}
      >
        <Text>Run NativeRNGMATesting probes</Text>
      </Pressable>
    </View>
  );
}

function buildGalleryEntries(): GalleryEntry[] {
  const entries: GalleryEntry[] = [];

  Object.keys(BannerAdSize).forEach(bannerAdSize => {
    const size = bannerAdSize as BannerAdSize;
    if (bannerAdSize === 'INLINE_ADAPTIVE_BANNER') {
      const max100 = bannerVariantKey(size, 100);
      entries.push({
        id: AppiumTestIds.bannerVariant(max100),
        title: `Banner ${max100}`,
        section: 'formats',
        render: () => <BannerFormat bannerAdSize={size} maxHeight={100} />,
      });
      const max200 = bannerVariantKey(size, 200, 200);
      entries.push({
        id: AppiumTestIds.bannerVariant(max200),
        title: `Banner ${max200}`,
        section: 'formats',
        render: () => <BannerFormat bannerAdSize={size} maxHeight={200} width={200} />,
      });
    }
    const key = bannerVariantKey(size);
    entries.push({
      id: AppiumTestIds.bannerVariant(key),
      title: `Banner ${key}`,
      section: 'formats',
      render: () => <BannerFormat bannerAdSize={size} />,
    });
  });

  entries.push({
    id: AppiumTestIds.format.collapsibleBanner,
    title: 'Collapsible Banner',
    section: 'formats',
    render: () => <CollapsibleBannerFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.gamInterstitial,
    title: 'GAM Interstitial',
    section: 'formats',
    render: () => <GAMInterstitialFormat />,
  });
  const gamAnchoredKey = gamSizesKey([BannerAdSize.ANCHORED_ADAPTIVE_BANNER]);
  entries.push({
    id: AppiumTestIds.gamBannerVariant(gamAnchoredKey),
    title: `GAM Banner ${gamAnchoredKey}`,
    section: 'formats',
    render: () => (
      <GAMBannerFormat
        unitId={TestIds.GAM_BANNER}
        sizes={[BannerAdSize.ANCHORED_ADAPTIVE_BANNER]}
      />
    ),
  });
  const gamFluidKey = gamSizesKey(['FLUID']);
  entries.push({
    id: AppiumTestIds.gamBannerVariant(gamFluidKey),
    title: `GAM Banner ${gamFluidKey}`,
    section: 'formats',
    render: () => <GAMBannerFormat unitId={TestIds.GAM_BANNER} sizes={['FLUID']} />,
  });
  entries.push({
    id: AppiumTestIds.format.appOpen,
    title: 'App Open',
    section: 'formats',
    render: () => (
      <LoadableAdControls mobileAd={appOpen} type="App Open" formatId={AppiumTestIds.format.appOpen} />
    ),
  });
  entries.push({
    id: AppiumTestIds.format.interstitial,
    title: 'Interstitial',
    section: 'formats',
    render: () => (
      <LoadableAdControls
        mobileAd={interstitial}
        type="Interstitial"
        formatId={AppiumTestIds.format.interstitial}
      />
    ),
  });
  entries.push({
    id: AppiumTestIds.format.rewarded,
    title: 'Rewarded',
    section: 'formats',
    render: () => (
      <LoadableAdControls
        mobileAd={rewarded}
        type="Rewarded"
        formatId={AppiumTestIds.format.rewarded}
      />
    ),
  });
  entries.push({
    id: AppiumTestIds.format.rewardedInterstitial,
    title: 'Rewarded Interstitial',
    section: 'formats',
    render: () => (
      <LoadableAdControls
        mobileAd={rewardedInterstitial}
        type="Rewarded Interstitial"
        formatId={AppiumTestIds.format.rewardedInterstitial}
      />
    ),
  });
  entries.push({
    id: AppiumTestIds.format.native,
    title: 'Native',
    section: 'formats',
    render: () => <NativeComponent />,
  });
  entries.push({
    id: AppiumTestIds.format.multiFormatRequest,
    title: 'Multi-Format Request',
    section: 'formats',
    render: () => <MultiFormatRequestFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.adInspector,
    title: 'Ad Inspector',
    section: 'debug',
    render: () => <AdInspectorFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.consent,
    title: 'Consent',
    section: 'debug',
    render: () => <ConsentFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.appOpenHook,
    title: 'App Open Hook',
    section: 'hooks',
    render: () => <AppOpenHookFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.rewardedHook,
    title: 'RWD Hook',
    section: 'hooks',
    render: () => <RewardedHookFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.interstitialHook,
    title: 'INT Hook',
    section: 'hooks',
    render: () => <InterstitialHookFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.rewardedInterstitialHook,
    title: 'RWI Hook',
    section: 'hooks',
    render: () => <RewardedInterstitialHookFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.multiFormatHook,
    title: 'Multi-Format Hook',
    section: 'hooks',
    render: () => <MultiFormatHookFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.poolInterstitialProvider,
    title: 'Pool INT Provider',
    section: 'pools',
    render: () => <PooledInterstitialProviderFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.poolInterstitialImperative,
    title: 'Pool INT Imperative',
    section: 'pools',
    render: () => <PooledInterstitialImperativeFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.poolCapabilityGates,
    title: 'Pool Capability Gates',
    section: 'pools',
    render: () => <PoolCapabilityGatesFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.poolRwiPreloadGate,
    title: 'Pool RWI Preload Gate',
    section: 'pools',
    render: () => <PoolRwiPreloadGateFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.debugMenu,
    title: 'Debug Menu',
    section: 'debug',
    render: () => <DebugMenuFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.flushCoverage,
    title: 'Flush Coverage',
    section: 'debug',
    render: () => <FlushCoverageFormat />,
  });
  entries.push({
    id: AppiumTestIds.format.nativeRngmaTesting,
    title: 'NativeRNGMATesting',
    section: 'debug',
    render: () => <NativeRNGMATestingFormat />,
  });

  return entries;
}

const styles = StyleSheet.create({
  testSpacing: {
    margin: 10,
    padding: 10,
  },
  galleryRow: {
    marginVertical: 4,
  },
  flushCoverageRow: {
    marginTop: 28,
  },
  sectionChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  sectionChip: {
    marginRight: 4,
    marginBottom: 4,
  },
  heading: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  subheading: {
    marginBottom: 12,
  },
  probePressable: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
});

export default App;
