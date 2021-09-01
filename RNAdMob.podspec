require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

admob_sdk_version = package['sdkVersions']['ios']['admob']

Pod::Spec.new do |s|
  s.name                = "RNAdMob"

  s.version             = package["version"]
  s.description         = package["description"]
  s.summary             = <<-DESC
                            A well tested feature rich AdMob implementation for React Native, supporting iOS & Android.
                          DESC
  s.homepage            = "http://invertase.io/oss/react-native-admob"
  s.license             = package['license']
  s.authors             = "Invertase Limited"
  s.source              = { :git => "https://github.com/invertase/react-native-admob.git", :tag => "v#{s.version}" }
  s.social_media_url    = 'http://twitter.com/invertaseio'
  s.ios.deployment_target = "10.0"
  s.source_files        = 'ios/**/*.{h,m}'

  # React Native dependencies
  s.dependency          'React-Core'

  # Other dependencies
  s.dependency          'PersonalizedAdConsent', '~> 1.0.5'

  if defined?($RNAdMobSDKVersion)
    Pod::UI.puts "#{s.name}: Using user specified Google Mobile-Ads SDK version '#{$RNAdMobSDKVersion}'"
    admob_sdk_version = $RNAdMobSDKVersion
  end

  # AdMob dependencies
  s.dependency          'Google-Mobile-Ads-SDK', admob_sdk_version

  if defined?($RNAdMobAsStaticFramework)
    Pod::UI.puts "#{s.name}: Using overridden static_framework value of '#{$RNAdMobAsStaticFramework}'"
    s.static_framework = $RNAdMobAsStaticFramework
  else
    s.static_framework = false
  end
end
