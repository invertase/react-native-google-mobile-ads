#!/bin/bash
set -e

echo "You should run this from directory where you have cloned the react-native-google-mobile-ads repo"
echo "You should only do this when your git working set is completely clean (e.g., git reset --hard)"
echo "You must have already run \`yarn\` in the repository so \`npx react-native\` will work"
echo "This scaffolding refresh has been tested on macOS, if you use it on linux, it might not work"

# Copy the important files out temporarily
if [ -d TEMP ]; then
  echo "TEMP directory already exists - we use that to store files while refreshing."
  exit 1
else
  echo "Saving files to TEMP while refreshing scaffolding..."
  mkdir TEMP

  # Copy all the config elements
  cp RNGoogleMobileAdsExample/metro.config.js TEMP/  # This is customized to handle symbolic links
  cp RNGoogleMobileAdsExample/.mocharc.js TEMP/      # Custom mocha settings
  cp RNGoogleMobileAdsExample/.detoxrc.json TEMP/    # Custom detox settings
  cp RNGoogleMobileAdsExample/app.json TEMP/         # Our custom configuration settings / mobile ads app id etc
  cp RNGoogleMobileAdsExample/App.tsx TEMP/          # Our sample app
  cp -r RNGoogleMobileAdsExample/patches TEMP/       # Our patches

  # Our Android DetoxTest integration itself is obviously custom
  mkdir -p TEMP/android/app/src/androidTest/java/com/rngooglemobileadsexample
  cp RNGoogleMobileAdsExample/android/app/src/androidTest/java/com/rngooglemobileadsexample/DetoxTest.java TEMP/android/app/src/androidTest/java/com/rngooglemobileadsexample/

  # Our e2e tests themselves are obviously custom
  mkdir -p TEMP/e2e
  cp -r RNGoogleMobileAdsExample/e2e/* TEMP/e2e/
fi

# Purge the old sample
\rm -fr RNGoogleMobileAdsExample

# Make the new RNGoogleMobileAdsExample
npm_config_yes=true npx @react-native-community/cli init RNGoogleMobileAdsExample --skip-install --skip-git-init
pushd RNGoogleMobileAdsExample
rm -rf .ruby-version Gemfile Gemfile.lock _ruby-version _bundle .bundle
yarn add 'link:../'
yarn add detox mocha jest-circus jest-environment-node @babel/preset-env typescript patch-package --dev
#yarn add 'link:../../jet/'
yarn add https://github.com/invertase/jet#@mikehardy/jet-next --dev

# Java build tweak - or gradle runs out of memory during the build
# echo "Increasing memory available to gradle for android java build"
# echo "org.gradle.jvmargs=-Xmx2048m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8" >> android/gradle.properties

# Detox + Android
echo "Integrating Detox for Android (maven repo, dependency, build config items)"
sed -i -e $'s/dependencies {/dependencies {\\\n        classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion"/' android/build.gradle
rm -f android/build.gradle??
sed -i -e $'s/dependencies {/dependencies {\\\n    androidTestImplementation(project(path: ":detox"))/' android/app/build.gradle
sed -i -e $'s/defaultConfig {/defaultConfig {\\\n        testBuildType System.getProperty("testBuildType", "debug")\\\n        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"\\\n        missingDimensionStrategy "detox", "full"/' android/app/build.gradle
rm -f android/app/build.gradle??
sed -i -e $'s/rootProject.name = \'RNGoogleMobileAdsExample\'/rootProject.name = \'RNGoogleMobileAdsExample\'\\\ninclude \':detox\'\\\nproject(\':detox\').projectDir = new File(rootProject.projectDir, \'..\/node_modules\/detox\/android\/detox\')/' android/settings.gradle
rm -f android/settings.gradle??

# React-native builds on iOS are very noisy with warnings in other packages that drown our warnings out. Reduce warnings to just our packages.
sed -i -e $'s/# https/# quiet non-module warnings - only interested in google-mobile-ads warnings\\\n    installer.pods_project.targets.each do |target|\\\n      if !target.name.include? "react-native-google-mobile-ads"\\\n        target.build_configurations.each do |config|\\\n          config.build_settings["GCC_WARN_INHIBIT_ALL_WARNINGS"] = "YES"\\\n        end\\\n      end\\\n    end\\\n\\\n    # https/' ios/Podfile
rm -f ios/Podfile??

# We want to easily test normal android release build setup, which is with proguard on
sed -i -e $'s/def enableProguardInReleaseBuilds = false/def enableProguardInReleaseBuilds = true/' android/app/build.gradle
rm -f android/app/build.gradle??
sed -i -e $'s/proguardFiles/proguardFile "${rootProject.projectDir}\/..\/node_modules\/detox\/android\/detox\/proguard-rules-app.pro"\\\n            proguardFiles/' android/app/build.gradle
rm -f android/app/build.gradle??

# Use ccache get much faster compiles...
sed -i -e $'s/# :ccache_enabled/:ccache_enabled/' ios/Podfile
rm -f ios/Podfile??

# Copy the important files back in
popd
echo "Copying Google Mobile Ads customized example files into refreshed RNGoogleMobileAdsExample..."
cp -frv TEMP/.detox* RNGoogleMobileAdsExample/
cp -frv TEMP/.mocha* RNGoogleMobileAdsExample/
rm -f RNGoogleMobileAdsExample/App.js
cp -frv TEMP/* RNGoogleMobileAdsExample/
# Clean up after ourselves
\rm -fr TEMP

# Final install commands

pushd RNGoogleMobileAdsExample

# Set ourselves up to run patch-package on post-install
npm_config_yes=true npx json -I -f package.json -e 'this.scripts.postinstallDev = "yarn patch-package"'
yarn patch-package

# run pod install after installing our module
npm_config_yes=true npx pod-install