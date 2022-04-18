require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

google_mobile_ads_sdk_version = package['sdkVersions']['ios']['googleMobileAds']
google_ump_sdk_version = package['sdkVersions']['ios']['googleUmp']

Pod::Spec.new do |s|
  s.name                = "RNGoogleMobileAds"

  s.version             = package["version"]
  s.description         = package["description"]
  s.summary             = <<-DESC
                            #{package["description"]}
                          DESC
  s.homepage            = "http://invertase.io/oss/react-native-google-mobile-ads"
  s.license             = package['license']
  s.authors             = "Invertase Limited"
  s.source              = { :git => "#{package["repository"]["url"]}.git", :tag => "v#{s.version}" }
  s.social_media_url    = 'http://twitter.com/invertaseio'
  s.ios.deployment_target = "10.0"
  s.source_files        = 'ios/**/*.{h,m}'
  s.weak_frameworks     = "AppTrackingTransparency"

  # React Native dependencies
  s.dependency          'React-Core'

  # Other dependencies
  if defined?($RNGoogleUmpSDKVersion)
    Pod::UI.puts "#{s.name}: Using user specified Google UMP SDK version '#{$RNGoogleUmpSDKVersion}'"
    google_ump_sdk_version = $RNGoogleUmpSDKVersion
  end

  s.dependency          'GoogleUserMessagingPlatform', google_ump_sdk_version

  if defined?($RNGoogleMobileAdsSDKVersion)
    Pod::UI.puts "#{s.name}: Using user specified Google Mobile-Ads SDK version '#{$RNGoogleMobileAdsSDKVersion}'"
    google_mobile_ads_sdk_version = $RNGoogleMobileAdsSDKVersion
  end

  # AdMob dependencies
  s.dependency          'Google-Mobile-Ads-SDK', google_mobile_ads_sdk_version

  if defined?($RNGoogleMobileAdsAsStaticFramework)
    Pod::UI.puts "#{s.name}: Using overridden static_framework value of '#{$RNGoogleMobileAdsAsStaticFramework}'"
    s.static_framework = $RNGoogleMobileAdsAsStaticFramework
  else
    s.static_framework = false
  end
end
