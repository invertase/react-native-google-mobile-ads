# React Native Google Mobile Ads API

This reference is generated from the public TypeScript surface of
`react-native-google-mobile-ads`. Start with the
[integration documentation](https://docs.page/invertase/react-native-google-mobile-ads) for
installation, consent, testing, and complete format guides.

## Choosing an API

- Keep existing create/load/show flows for direct fullscreen ads, `<BannerAd>`, and `NativeAd`.
- Use fullscreen hook options when React should own one ad's load/show lifecycle.
- Use `AdPoolPresets` with `AdPoolProvider` / `usePooledAd`, or imperative `AdPools`, when
  inventory should be warmed and polled at show time.
- Use `useMultiFormatAd` or `MultiFormatAdRequest` when one placement can render a native or
  Google Ad Manager banner winner.
- Prefer presets over reproducing the capability matrix in application code.

## Mediation adapters

The generated reference covers the core package only. Public scoped adapter packages are
versioned with core and documented by their package READMEs:

- `@react-native-google-mobile-ads/applovin`
- `@react-native-google-mobile-ads/facebook`
- `@react-native-google-mobile-ads/inmobi`
- `@react-native-google-mobile-ads/mintegral`
- `@react-native-google-mobile-ads/moloco`
- `@react-native-google-mobile-ads/pangle`
- `@react-native-google-mobile-ads/unity`
- `@react-native-google-mobile-ads/vungle`
- `@react-native-google-mobile-ads/yandex`

The private `_template` workspace is intentionally excluded.
