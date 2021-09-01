/**
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
 */

#import "RNJSON.h"

@interface RNJSON ()
@property(nonatomic, strong) NSDictionary *admobJson;
@end

@implementation RNJSON

+ (instancetype)shared {
  static dispatch_once_t once;
  static RNJSON *sharedInstance;

  dispatch_once(&once, ^{
    sharedInstance = [[RNJSON alloc] init];
    NSString *__nullable admobJsonRaw = [[NSBundle mainBundle].infoDictionary valueForKey:@"admob_json_raw"];

    if (admobJsonRaw == nil) {
      sharedInstance.admobJson = [NSDictionary dictionary];
      return;
    }

    NSData *data = [[NSData alloc] initWithBase64EncodedString:admobJsonRaw options:0];

    if (data == nil) {
      sharedInstance.admobJson = [NSDictionary dictionary];
      return;
    }

    NSError *jsonError = nil;
    NSDictionary *dictionary = [NSJSONSerialization JSONObjectWithData:data options:0 error:&jsonError];
    if (jsonError != nil) {
      sharedInstance.admobJson = [NSDictionary dictionary];
      return;
    }

    sharedInstance.admobJson = dictionary;
  });

  return sharedInstance;
}

- (BOOL)contains:(NSString *)key {
  return [_admobJson valueForKey:key] != nil;
}

- (BOOL)getBooleanValue:(NSString *)key defaultValue:(BOOL)defaultValue {
  if ([_admobJson valueForKey:key] == nil)
    return defaultValue;
  NSNumber *boolean = [_admobJson valueForKey:key];
  return [boolean boolValue];
}

- (NSString *)getStringValue:(NSString *)key defaultValue:(NSString *)defaultValue {
  if ([_admobJson valueForKey:key] == nil)
    return defaultValue;
  NSString *string = [_admobJson valueForKey:key];
  return string;
}

- (NSDictionary *)getAll {
  return [[NSDictionary alloc] initWithDictionary:_admobJson copyItems:YES];
}

- (NSString *)getRawJSON {
  NSString *__nullable admobJsonRaw = [[NSBundle mainBundle].infoDictionary valueForKey:@"admob_json_raw"];
  if (admobJsonRaw == nil) {
    return @"{}";
  }
  
  NSData *data = [[NSData alloc] initWithBase64EncodedString:admobJsonRaw options:0];
  return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];;
}
@end
