require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'RNGMATesting'
  s.version      = package['version']
  s.summary      = package['description']
  s.homepage     = 'https://github.com/invertase/react-native-google-mobile-ads'
  s.license      = package['license']
  s.authors      = 'Invertase'

  s.platforms    = { :ios => min_ios_version_supported }
  s.source       = { :git => 'https://github.com/invertase/react-native-google-mobile-ads.git', :tag => 'main' }

  s.source_files = 'ios/**/*.{h,m,mm,cpp}'
  s.private_header_files = 'ios/**/*.h'

  install_modules_dependencies(s)
end
