/*
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this library except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *
 *
 *
 * The definitions in this document are copied from IAB's global vendor list.
 *
 *   https://vendor-list.consensu.org/v2/vendor-list.json
 *   https://github.com/InteractiveAdvertisingBureau/GDPR-Transparency-and-Consent-Framework
 *
 */

export enum AdsConsentPurposes {
  /**
   * Cookies, device identifiers, or other information can be stored or
   * accessed on your device for the purposes presented to you.
   *
   * Vendors can:
   *   - Store and access information on the device such as cookies
   *     and device identifiers presented to a user.
   */
  STORE_AND_ACCESS_INFORMATION_ON_DEVICE = 1,

  /**
   * Ads can be shown to you based on the content you’re viewing,
   * the app you’re using, your approximate location, or your device type.
   *
   * To do basic ad selection vendors can:
   *  - Use real-time information about the context in which the ad will be shown,
   *    to show the ad, including information about the content and the device, such as:
   *    device type and capabilities, user agent, URL, IP address
   *  - Use a user’s non-precise geolocation data
   *  - Control the frequency of ads shown to a user.
   *  - Sequence the order in which ads are shown to a user.
   *  - Prevent an ad from serving in an unsuitable editorial (brand-unsafe) context
   *
   * Vendors cannot:
   *  - Create a personalised ads profile using this information for the selection of
   *    future ads without a separate legal basis to create a personalised ads profile.
   *  - N.B. Non-precise means only an approximate location involving at least a radius
   *    of 500 meters is permitted.
   */
  SELECT_BASIC_ADS = 2,

  /**
   * A profile can be built about you and your interests to show you personalised ads
   * that are relevant to you.
   *
   * To create a personalised ads profile vendors can:
   *   - Collect information about a user, including a user's activity, interests,
   *     demographic information, or location, to create or edit a user profile for use
   *     in personalised advertising.
   *   - Combine this information with other information previously collected,
   *     including from across websites and apps, to create or edit a user profile
   *     for use in personalised advertising.
   */
  CREATE_A_PERSONALISED_ADS_PROFILE = 3,

  /**
   * Personalised ads can be shown to you based on a profile about you.
   *
   * To select personalised ads vendors can:
   *   - Select personalised ads based on a user profile or other historical user data,
   *     including a user’s prior activity, interests, visits to sites or apps, location,
   *     or demographic information.
   */
  SELECT_PERSONALISED_ADS = 4,

  /**
   * A profile can be built about you and your interests to show you personalised content
   * that is relevant to you.
   *
   * To create a personalised content profile vendors can:
   *   - Collect information about a user, including a user's activity, interests, visits to
   *     sites or apps, demographic information, or location, to create or edit a user profile
   *     for personalising content.
   *   - Combine this information with other information previously collected,
   *     including from across websites and apps, to create or edit a user profile for use
   *     in personalising content.
   */
  CREATE_A_PERSONALISED_CONTENT_PROFILE = 5,

  /**
   * Personalised content can be shown to you based on a profile about you.
   *
   * To select personalised content vendors can:
   *   - Select personalised content based on a user profile or other historical user data,
   *     including a user’s prior activity, interests, visits to sites or apps, location,
   *     or demographic information.
   */
  SELECT_PERSONALISED_CONTENT = 6,

  /**
   * The performance and effectiveness of ads that you see or interact with can be measured.
   *
   * To measure ad performance vendors can:
   *   - Measure whether and how ads were delivered to and interacted with by a user
   *   - Provide reporting about ads including their effectiveness and performance
   *   - Provide reporting about users who interacted with ads using data observed during
   *     the course of the user's interaction with that ad
   *   - Provide reporting to publishers about the ads displayed on their property
   *   - Measure whether an ad is serving in a suitable editorial environment (brand-safe) context
   *   - Determine the percentage of the ad that had the opportunity to be seen and
   *     the duration of that opportunity
   *   - Combine this information with other information previously collected,
   *     including from across websites and apps
   *
   * Vendors cannot:
   *   - Apply panel- or similarly-derived audience insights data to ad measurement data
   *     without a Legal Basis to apply market research to generate audience insights (Purpose 9)
   */
  MEASURE_AD_PERFORMANCE = 7,

  /**
   * The performance and effectiveness of content that you see or interact with can be measured.
   *
   * To measure content performance vendors can:
   *   - Measure and report on how content was delivered to and interacted with by users.
   *   - Provide reporting, using directly measurable or known information, about users who
   *     interacted with the content
   *   - Combine this information with other information previously collected,
   *     including from across websites and apps.
   *
   * Vendors cannot:
   *   - Measure whether and how ads (including native ads) were delivered to and
   *     interacted with by a user.
   *   - Apply panel- or similarly derived audience insights data to ad measurement
   *     data without a Legal Basis to apply market research to generate audience insights (Purpose 9)
   */
  MEASURE_CONTENT_PERFORMANCE = 8,

  /**
   * Market research can be used to learn more about the audiences who visit sites/apps and view ads.
   *
   * To apply market research to generate audience insights vendors can:
   *   - Provide aggregate reporting to advertisers or their representatives about
   *     the audiences reached by their ads, through panel-based and similarly derived insights.
   *   - Provide aggregate reporting to publishers about the audiences that were served or
   *     interacted with content and/or ads on their property by applying
   *     panel-based and similarly derived insights.
   *   - Associate offline data with an online user for the purposes of
   *     market research to generate audience insights if vendors have declared to match and
   *     combine offline data sources (Feature 1)
   *   - Combine this information with other information previously collected including from
   *     across websites and apps.
   *
   * Vendors cannot:
   *   - Measure the performance and effectiveness of ads that a specific user was served or
   *     interacted with, without a Legal Basis to measure ad performance.
   *   - Measure which content a specific user was served and how they interacted with it,
   *     without a Legal Basis to measure content performance.
   */
  APPLY_MARKET_RESEARCH_TO_GENERATE_AUDIENCE_INSIGHTS = 9,

  /**
   * Your data can be used to improve existing systems and software,
   * and to develop new products
   *
   * To develop new products and improve products vendors can:
   *   - Use information to improve their existing products with new features and
   *     to develop new products
   *   - Create new models and algorithms through machine learning
   *
   * Vendors cannot:
   *   - Conduct any other data processing operation allowed under
   *     a different purpose under this purpose
   */
  DEVELOP_AND_IMPROVE_PRODUCTS = 10,
}
