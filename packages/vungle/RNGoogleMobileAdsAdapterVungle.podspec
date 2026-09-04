require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
gam_adapter = package['gamAdapter']
mediation_pod = gam_adapter['iosPod']
mediation_version = package['sdkVersions']['ios']['googleMobileAdsMediation']

Pod::Spec.new do |s|
  s.name         = "RNGoogleMobileAdsAdapterVungle"
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
  # Liftoff Monetize mediation adapter requires iOS 13.0+ (guide prerequisites + CocoaPods podspec).
  # https://developers.google.com/ad-manager/mobile-ads-sdk/ios/mediation/liftoff-monetize
  s.platforms    = { :ios => "13.0" }
  s.source_files = "ios/**/*.{h,m,mm,swift}"

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end

  # Google-published Liftoff Monetize (Vungle) GAM mediation adapter.
  # https://developers.google.com/ad-manager/mobile-ads-sdk/ios/mediation/liftoff-monetize
  # https://cocoapods.org/pods/GoogleMobileAdsMediationVungle
  s.dependency mediation_pod, mediation_version
end
