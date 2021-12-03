require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

google_ads_sdk_version = package['sdkVersions']['ios']['googleAds']

Pod::Spec.new do |s|
  s.name                = "RNGoogleAds"

  s.version             = package["version"]
  s.description         = package["description"]
  s.summary             = <<-DESC
                            #{package["description"]}
                          DESC
  s.homepage            = "http://invertase.io/oss/react-native-google-ads"
  s.license             = package['license']
  s.authors             = "Invertase Limited"
  s.source              = { :git => "#{package["repository"]["url"]}.git", :tag => "v#{s.version}" }
  s.social_media_url    = 'http://twitter.com/invertaseio'
  s.ios.deployment_target = "10.0"
  s.source_files        = 'ios/**/*.{h,m}'

  # React Native dependencies
  s.dependency          'React-Core'

  # Other dependencies
  s.dependency          'PersonalizedAdConsent', '~> 1.0.5'

  if defined?($RNGoogleAdsSDKVersion)
    Pod::UI.puts "#{s.name}: Using user specified Google Mobile-Ads SDK version '#{$RNGoogleAdsSDKVersion}'"
    google_ads_sdk_version = $RNGoogleAdsSDKVersion
  end

  # AdMob dependencies
  s.dependency          'Google-Mobile-Ads-SDK', google_ads_sdk_version

  if defined?($RNGoogleAdsAsStaticFramework)
    Pod::UI.puts "#{s.name}: Using overridden static_framework value of '#{$RNGoogleAdsAsStaticFramework}'"
    s.static_framework = $RNGoogleAdsAsStaticFramework
  else
    s.static_framework = false
  end
end
