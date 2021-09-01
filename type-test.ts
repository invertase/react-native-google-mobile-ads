/* eslint-disable no-console */
import * as admob from '@invertase/react-native-admob';

console.log(admob.AdsConsentDebugGeography.DISABLED);
console.log(admob.AdsConsentDebugGeography.EEA);
console.log(admob.AdsConsentDebugGeography.NOT_EEA);
console.log(admob.AdsConsentDebugGeography.DISABLED);
console.log(admob.AdsConsentDebugGeography.EEA);
console.log(admob.AdsConsentDebugGeography.NOT_EEA);

console.log(admob.AdsConsentStatus.NON_PERSONALIZED);
console.log(admob.AdsConsentStatus.PERSONALIZED);
console.log(admob.AdsConsentStatus.UNKNOWN);
console.log(admob.AdsConsentStatus.NON_PERSONALIZED);
console.log(admob.AdsConsentStatus.PERSONALIZED);
console.log(admob.AdsConsentStatus.UNKNOWN);

console.log(admob.MaxAdContentRating.G);
console.log(admob.MaxAdContentRating.MA);
console.log(admob.MaxAdContentRating.PG);
console.log(admob.MaxAdContentRating.T);
console.log(admob.MaxAdContentRating.G);
console.log(admob.MaxAdContentRating.MA);
console.log(admob.MaxAdContentRating.PG);
console.log(admob.MaxAdContentRating.T);

console.log(admob.AdEventType.CLICKED);
console.log(admob.AdEventType.CLOSED);
console.log(admob.AdEventType.ERROR);
console.log(admob.AdEventType.LEFT_APPLICATION);
console.log(admob.AdEventType.LOADED);
console.log(admob.AdEventType.OPENED);
console.log(admob.AdEventType.CLICKED);
console.log(admob.AdEventType.CLOSED);
console.log(admob.AdEventType.ERROR);
console.log(admob.AdEventType.LEFT_APPLICATION);
console.log(admob.AdEventType.LOADED);
console.log(admob.AdEventType.OPENED);

console.log(admob.RewardedAdEventType.LOADED);
console.log(admob.RewardedAdEventType.EARNED_REWARD);
console.log(admob.RewardedAdEventType.LOADED);
console.log(admob.RewardedAdEventType.EARNED_REWARD);

console.log(admob.BannerAdSize.BANNER);
console.log(admob.BannerAdSize.FLUID);
console.log(admob.BannerAdSize.FULL_BANNER);
console.log(admob.BannerAd);
console.log(admob.BannerAdSize.BANNER);
console.log(admob.BannerAdSize.FLUID);
console.log(admob.BannerAdSize.FULL_BANNER);

console.log(admob.TestIds.BANNER);
console.log(admob.TestIds.INTERSTITIAL);
console.log(admob.TestIds.REWARDED);
console.log(admob.TestIds.BANNER);
console.log(admob.TestIds.INTERSTITIAL);
console.log(admob.TestIds.REWARDED);

// InterstitialAd
const interstitial = admob.InterstitialAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(interstitial.adUnitId);

interstitial.load();
interstitial.show().then();
interstitial.onAdEvent((type, error, data) => {
  console.log(type);
  console.log(error && error.message);
  console.log(data && data.amount);
  console.log(data && data.type);
});

admob.AdsConsent.addTestDevices(['1234']).then();
admob.AdsConsent.getAdProviders().then(providers => {
  providers[0].companyId;
  providers[0].companyName;
  providers[0].privacyPolicyUrl;
});
admob.AdsConsent.getStatus().then(status => console.log(status));
admob.AdsConsent.requestInfoUpdate(['123']).then(info =>
  console.log(info.isRequestLocationInEeaOrUnknown),
);
admob.AdsConsent.setTagForUnderAgeOfConsent(true).then();
admob.AdsConsent.showForm({
  privacyPolicy: '123',
  withAdFree: true,
  withPersonalizedAds: true,
  withNonPersonalizedAds: true,
}).then();

// RewardedAd
const rewardedAd = admob.RewardedAd.createForAdRequest('foo', {
  keywords: ['test'],
});

console.log(rewardedAd.adUnitId);

rewardedAd.load();
rewardedAd.show().then();
rewardedAd.onAdEvent((type, error, data) => {
  console.log(type);
  console.log(error && error.message);
  console.log(data && data.amount);
  console.log(data && data.type);
});

// checks module exists at root
console.log(admob().app.name);

// checks statics exist
console.log(admob.SDK_VERSION);

// checks statics exist on defaultExport
console.log(admob.default.SDK_VERSION);

// checks firebase named export exists on module
console.log(admob.firebase.SDK_VERSION);

// test banner sizes
console.log(admob.BannerAdSize.BANNER);
console.log(admob.BannerAdSize.FULL_BANNER);
console.log(admob.BannerAdSize.LARGE_BANNER);
console.log(admob.BannerAdSize.LEADERBOARD);
console.log(admob.BannerAdSize.MEDIUM_RECTANGLE);
console.log(admob.BannerAdSize.SMART_BANNER);
