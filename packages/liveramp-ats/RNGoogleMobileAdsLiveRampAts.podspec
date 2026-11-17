require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
secure_signals = package['secureSignals']

Pod::Spec.new do |s|
  s.name         = "RNGoogleMobileAdsLiveRampAts"
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
  s.platforms    = { :ios => "12.0" }
  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.resources    = "ios/PrivacyInfo.xcprivacy"

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end

  s.dependency "react-native-google-mobile-ads"
  s.pod_target_xcconfig = {
    "GCC_PREPROCESSOR_DEFINITIONS" => "LR_ATS_PACKAGE_VERSION=@\"#{package['version']}\" LR_ATS_ENVELOPE_API_VERSION=@\"#{secure_signals['envelopeApiVersion']}\""
  }
end