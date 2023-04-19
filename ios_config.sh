#!/usr/bin/env bash
#
# Copyright (c) 2016-present Invertase Limited & Contributors
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this library except in compliance with the License.
# You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
set -e

_MAX_LOOKUPS=2;
_SEARCH_RESULT=''
_RN_ROOT_EXISTS=''
_CURRENT_LOOKUPS=1
_PROJECT_ABBREVIATION="RNGoogleMobileAds"
_JSON_ROOT="'react-native-google-mobile-ads'"
_JSON_FILE_NAME='app.json'
_JSON_OUTPUT_BASE64='e30=' # { }
_CURRENT_SEARCH_DIR=${PROJECT_DIR}
_PLIST_BUDDY=/usr/libexec/PlistBuddy
_TARGET_PLIST="${BUILT_PRODUCTS_DIR}/${INFOPLIST_PATH}"
_DSYM_PLIST="${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}/Contents/Info.plist"

# plist arrays
_PLIST_ENTRY_KEYS=()
_PLIST_ENTRY_TYPES=()
_PLIST_ENTRY_VALUES=()

function setPlistValue {
  echo "info:      setting plist entry '$1' of type '$2' in file '$4'"
  ${_PLIST_BUDDY} -c "Add :$1 $2 '$3'" $4 || echo "info:      '$1' already exists"
}

function getJsonKeyValue () {
  if [[ ${_RN_ROOT_EXISTS} ]]; then
    ruby -KU -e "require 'rubygems';require 'json'; output=JSON.parse('$1'); puts output[$_JSON_ROOT]['$2']"
  else
    echo ""
  fi;
}

function jsonBoolToYesNo () {
  if [[ $1 == "false" ]]; then
    echo "NO"
  elif [[ $1 == "true" ]]; then
    echo "YES"
  else echo "NO"
  fi
}

echo "info: -> ${_PROJECT_ABBREVIATION} build script started"
echo "info: 1) Locating ${_JSON_FILE_NAME} file:"

if [[ -z ${_CURRENT_SEARCH_DIR} ]]; then
  _CURRENT_SEARCH_DIR=$(pwd)
fi;

while true; do
  _CURRENT_SEARCH_DIR=$(dirname "$_CURRENT_SEARCH_DIR")
  if [[ "$_CURRENT_SEARCH_DIR" == "/" ]] || [[ ${_CURRENT_LOOKUPS} -gt ${_MAX_LOOKUPS} ]]; then break; fi;
  echo "info:      ($_CURRENT_LOOKUPS of $_MAX_LOOKUPS) Searching in '$_CURRENT_SEARCH_DIR' for a ${_JSON_FILE_NAME} file."
  _SEARCH_RESULT=$(find "$_CURRENT_SEARCH_DIR" -maxdepth 2 -name ${_JSON_FILE_NAME} -print | /usr/bin/head -n 1)
  if [[ ${_SEARCH_RESULT} ]]; then
    echo "info:      ${_JSON_FILE_NAME} found at $_SEARCH_RESULT"
    break;
  fi;
  _CURRENT_LOOKUPS=$((_CURRENT_LOOKUPS+1))
done

if [[ ${_SEARCH_RESULT} ]]; then
  _JSON_OUTPUT_RAW=$(cat "${_SEARCH_RESULT}")
  _RN_ROOT_EXISTS=$(ruby -KU -e "require 'rubygems';require 'json'; output=JSON.parse('$_JSON_OUTPUT_RAW'); puts output[$_JSON_ROOT]" || echo '')

  if [[ ${_RN_ROOT_EXISTS} ]]; then
    if ! python3 --version >/dev/null 2>&1; then echo "python3 not found, app.json file processing error." && exit 1; fi
    _JSON_OUTPUT_BASE64=$(python3 -c 'import json,sys,base64;print(base64.b64encode(bytes(json.dumps(json.loads(open('"'${_SEARCH_RESULT}'"', '"'rb'"').read())['${_JSON_ROOT}']), '"'utf-8'"')).decode())' || echo "e30=")
  fi

  _PLIST_ENTRY_KEYS+=("google_mobile_ads_json_raw")
  _PLIST_ENTRY_TYPES+=("string")
  _PLIST_ENTRY_VALUES+=("$_JSON_OUTPUT_BASE64")

  # config.delay_app_measurement_init
  _DELAY_APP_MEASUREMENT=$(getJsonKeyValue "$_JSON_OUTPUT_RAW" "delay_app_measurement_init")
  if [[ $_DELAY_APP_MEASUREMENT == "true" ]]; then
    _PLIST_ENTRY_KEYS+=("GADDelayAppMeasurementInit")
    _PLIST_ENTRY_TYPES+=("bool")
    _PLIST_ENTRY_VALUES+=("YES")
  fi

  # config.ios_app_id
  _IOS_APP_ID=$(getJsonKeyValue "$_JSON_OUTPUT_RAW" "ios_app_id")
  if [[ $_IOS_APP_ID ]]; then
    _PLIST_ENTRY_KEYS+=("GADApplicationIdentifier")
    _PLIST_ENTRY_TYPES+=("string")
    _PLIST_ENTRY_VALUES+=("$_IOS_APP_ID")
  fi

  # config.sk_ad_network_items
  _SK_AD_NETWORK_ITEMS=$(getJsonKeyValue "$_JSON_OUTPUT_RAW" "sk_ad_network_items")
  if [[ $_SK_AD_NETWORK_ITEMS ]]; then
    _PLIST_ENTRY_KEYS+=("SKAdNetworkItems")
    _PLIST_ENTRY_TYPES+=("array")
    _PLIST_ENTRY_VALUES+=("")

    oldifs=$IFS
    IFS="
"
    array=($(echo "$_SK_AD_NETWORK_ITEMS"))
    IFS=$oldifs
    for i in "${!array[@]}"; do
      _PLIST_ENTRY_KEYS+=("SKAdNetworkItems:$i:SKAdNetworkIdentifier")
      _PLIST_ENTRY_TYPES+=("string")
      _PLIST_ENTRY_VALUES+=("${array[i]}")  
    done
  fi

    # config.user_tracking_usage_description
  _USER_TRACKING_USAGE_DESCRIPTION=$(getJsonKeyValue "$_JSON_OUTPUT_RAW" "user_tracking_usage_description")
  if [[ $_USER_TRACKING_USAGE_DESCRIPTION ]]; then
    _PLIST_ENTRY_KEYS+=("NSUserTrackingUsageDescription")
    _PLIST_ENTRY_TYPES+=("string")
    _PLIST_ENTRY_VALUES+=("$_USER_TRACKING_USAGE_DESCRIPTION")
  fi
else
  _PLIST_ENTRY_KEYS+=("google_mobile_ads_json_raw")
  _PLIST_ENTRY_TYPES+=("string")
  _PLIST_ENTRY_VALUES+=("$_JSON_OUTPUT_BASE64")
  echo "warning:   A ${_JSON_FILE_NAME} file was not found, whilst this file is optional it is recommended to include it to auto-configure services."
fi;

echo "info: 2) Injecting Info.plist entries: "

# Log out the keys we're adding
for i in "${!_PLIST_ENTRY_KEYS[@]}"; do
  echo "    ->  $i) ${_PLIST_ENTRY_KEYS[$i]}" "${_PLIST_ENTRY_TYPES[$i]}" "${_PLIST_ENTRY_VALUES[$i]}"
done

if ! [[ -f "${_TARGET_PLIST}" ]]; then
  echo "error: unable to locate Info.plist to set properties. App will crash without GADApplicationIdentifier set."
  exit 1
fi

if ! [[ $_IOS_APP_ID ]]; then
  echo "error: ios_app_id key not found in react-native-google-mobile-ads key in app.json. App will crash without it."
  exit 1
fi

for plist in "${_TARGET_PLIST}" "${_DSYM_PLIST}" ; do
  if [[ -f "${plist}" ]]; then

    # paths with spaces break the call to setPlistValue. temporarily modify
    # the shell internal field separator variable (IFS), which normally
    # includes spaces, to consist only of line breaks
    oldifs=$IFS
    IFS="
"

    for i in "${!_PLIST_ENTRY_KEYS[@]}"; do
      setPlistValue "${_PLIST_ENTRY_KEYS[$i]}" "${_PLIST_ENTRY_TYPES[$i]}" "${_PLIST_ENTRY_VALUES[$i]}" "${plist}"
    done

    # restore the original internal field separator value
    IFS=$oldifs
  else
    echo "warning:   A Info.plist build output file was not found (${plist})"
  fi
done

echo "info: <- ${_PROJECT_ABBREVIATION} build script finished"
