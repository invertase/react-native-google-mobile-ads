#!/bin/bash
set -e

echo "You should run this from directory where you have cloned the react-native-admob repo"
echo "You should only do this when your git working set is completely clean (e.g., git reset --hard)"
echo "You must have already run \`yarn\` in the repository so \`npx react-native\` will work"
echo "This scaffolding refresh has been tested on macOS, if you use it on linux, it might not work"

# Copy the important files out temporarily
if [ -d TEMP ]; then
  echo "TEMP directory already exists - we use that to store files while refreshing."
  exit 1
else
  echo "Saving files to TEMP while refreshing scaffolding..."
  #cp example/App.js TEMP/
  #cp example/admob.json TEMP/
fi

# Purge the old sample
\rm -fr example

# Make the new example
npx react-native init example
pushd example
#yarn add github:@invertase/react-native-admob

# run pod install after installing our module
cd ios && pod install && cd ..


# Java build tweak - or gradle runs out of memory during the build
echo "Increasing memory available to gradle for android java build"
echo "org.gradle.jvmargs=-Xmx2048m -XX:MaxPermSize=512m -XX:+HeapDumpOnOutOfMemoryError -Dfile.encoding=UTF-8" >> android/gradle.properties

# Copy the important files back in
popd
echo "Copying admob example files into refreshed example..."
#cp -frv TEMP/* example/

# Clean up after ourselves
\rm -fr TEMP