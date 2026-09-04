require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
gam_adapter = package['gamAdapter']
mediation_pod = gam_adapter['iosPod']
mediation_version = package['sdkVersions']['ios']['googleMobileAdsMediation']

Pod::Spec.new do |s|
  # When instantiating: rename file + s.name to RNGoogleMobileAdsAdapter<Network>
  # e.g. RNGoogleMobileAdsAdapterApplovin.podspec / RNGoogleMobileAdsAdapterApplovin
  s.name         = "RNGoogleMobileAdsAdapterTemplate"
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

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end

  # Google-published GAM mediation adapter pod. Replace __IOS_MEDIATION_POD__ /
  # __IOS_MEDIATION_VERSION__ when instantiating. Core ships Google-Mobile-Ads-SDK.
  if mediation_pod && !mediation_pod.include?("__") &&
     mediation_version && !mediation_version.include?("__")
    s.dependency mediation_pod, mediation_version
  else
    Pod::UI.puts "#{s.name}: placeholder mediation pod/version — replace tokens before app use (A-0 template)."
  end
end
