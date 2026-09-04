require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
gam_adapter = package['gamAdapter']
mediation_pod = gam_adapter['iosPod']
mediation_version = package['sdkVersions']['ios']['googleMobileAdsMediation']

Pod::Spec.new do |s|
  s.name         = "RNGoogleMobileAdsAdapterYandex"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.description  = package["description"]
  s.homepage     = "https://github.com/invertase/react-native-google-mobile-ads"
  s.license      = package["license"]
  s.authors      = "Invertase Limited"
  s.source       = {
    :git => "#{package["repository"]["url"]}.git",
    :tag => "v#{s.version}"
  }
  # Yandex AdMob adapters require iOS 13.0+ (CocoaPods podspec platforms.ios).
  # https://ads.yandex.com/helpcenter/en/dev/ios/admob-third
  # https://cocoapods.org/pods/YandexMobileAdsAdMobAdapters
  s.platforms    = { :ios => "13.0" }
  s.source_files = "ios/**/*.{h,m,mm,swift}"

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end

  # Yandex-published AdMob custom-event adapters (Google does not publish
  # GoogleMobileAdsMediationYandex). Not GoogleYandexMobileAdsAdapters (Yandex-as-host).
  # https://ads.yandex.com/helpcenter/en/dev/ios/admob-third
  # https://cocoapods.org/pods/YandexMobileAdsAdMobAdapters
  s.dependency mediation_pod, mediation_version
end
