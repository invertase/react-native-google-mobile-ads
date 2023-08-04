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
  s.source_files        = "ios/**/*.{h,m,mm,swift}"
  s.weak_frameworks     = "AppTrackingTransparency"

  # Use install_modules_dependencies helper to install the dependencies if React Native version >=0.71.0.
  # See https://github.com/facebook/react-native/blob/febf6b7f33fdb4904669f99d795eba4c0f95d7bf/scripts/cocoapods/new_architecture.rb#L79.
  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"

    # Don't install the dependencies when we run `pod install` in the old architecture.
    if ENV['RCT_NEW_ARCH_ENABLED'] == '1' then
      s.compiler_flags = folly_compiler_flags + " -DRCT_NEW_ARCH_ENABLED=1"
      s.pod_target_xcconfig    = {
          "HEADER_SEARCH_PATHS" => "\"$(PODS_ROOT)/boost\"",
          "OTHER_CPLUSPLUSFLAGS" => "-DFOLLY_NO_CONFIG -DFOLLY_MOBILE=1 -DFOLLY_USE_LIBCPP=1",
          "CLANG_CXX_LANGUAGE_STANDARD" => "c++17"
      }
      s.dependency "React-Codegen"
      s.dependency "RCT-Folly"
      s.dependency "RCTRequired"
      s.dependency "RCTTypeSafety"
      s.dependency "ReactCommon/turbomodule/core"
    end
  end

  # Other dependencies
  if defined?($RNGoogleUmpSDKVersion)
    Pod::UI.puts "#{s.name}: Using user specified Google UMP SDK version '#{$RNGoogleUmpSDKVersion}'"
    google_ump_sdk_version = $RNGoogleUmpSDKVersion
  end

  if !ENV['MAC_CATALYST']
  s.dependency          'GoogleUserMessagingPlatform', google_ump_sdk_version
  end

  if defined?($RNGoogleMobileAdsSDKVersion)
    Pod::UI.puts "#{s.name}: Using user specified Google Mobile-Ads SDK version '#{$RNGoogleMobileAdsSDKVersion}'"
    google_mobile_ads_sdk_version = $RNGoogleMobileAdsSDKVersion
  end

  # AdMob dependencies
  if !ENV['MAC_CATALYST']
  s.dependency          'Google-Mobile-Ads-SDK', google_mobile_ads_sdk_version
  end

  if defined?($RNGoogleMobileAdsAsStaticFramework)
    Pod::UI.puts "#{s.name}: Using overridden static_framework value of '#{$RNGoogleMobileAdsAsStaticFramework}'"
    s.static_framework = $RNGoogleMobileAdsAsStaticFramework
  else
    s.static_framework = false
  end
end
