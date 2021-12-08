# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [1.0.0] (2021-12-07)


@react-native-firebase/admob has finally moved to [react-native-google-ads](https://github.com/invertase/react-native-google-ads) 🎉!
As AdMob isn't part anymore of [RNFB](https://github.com/invertase/react-native-firebase), a lot of changes where necessary to extract it completely.
Therefore keep in mind to test everything thoroughly as it's the first release.

### Features

* **config:** Add your AdMob app id's (iOS/Android) to app.json and this package will take care of injecting the required entries in your Info.plist (during `pod install` run) & AndroidManifest.xml (during gradle build time).
* **docs:** Improved documentation using the new [docs.page](https://docs.page/)
