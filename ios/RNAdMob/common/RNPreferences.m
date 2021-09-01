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

#import "RNPreferences.h"

@interface RNPreferences ()
@property(nonatomic, strong) NSUserDefaults *userDefaults;
@end

static NSString *const RNDomainIdentifier = @"io.invertase.common";

@implementation RNPreferences

static RNPreferences *sharedInstance;

+ (void)load {
  sharedInstance = [[RNPreferences alloc] init];
}

- (instancetype)init {
  self = [super init];

  if (self) {
    _userDefaults = [[NSUserDefaults alloc] initWithSuiteName:RNDomainIdentifier];
  }

  return self;
}

- (BOOL)contains:(NSString *)key {
  return [_userDefaults objectForKey:key] != nil;
}

- (BOOL)getBooleanValue:(NSString *)key defaultValue:(BOOL)defaultValue {
  if ([_userDefaults objectForKey:key] == nil) return defaultValue;
  return [_userDefaults boolForKey:key];
}

- (void)setBooleanValue:(NSString *)key boolValue:(BOOL)boolValue {
  [_userDefaults setBool:boolValue forKey:key];
  [_userDefaults synchronize];
}

- (void)setIntegerValue:(NSString *)key integerValue:(NSInteger *)integerValue {
  [_userDefaults setInteger:(NSInteger)integerValue forKey:key];
  [_userDefaults synchronize];
}

- (NSInteger *)getIntegerValue:(NSString *)key defaultValue:(NSInteger *)defaultValue {
  if ([_userDefaults objectForKey:key] == nil) return defaultValue;
  return (NSInteger *)[_userDefaults integerForKey:key];
}

- (NSString *)getStringValue:(NSString *)key defaultValue:(NSString *)defaultValue {
  if ([_userDefaults objectForKey:key] == nil) return defaultValue;
  return [_userDefaults stringForKey:key];
}

- (void)setStringValue:(NSString *)key stringValue:(NSString *)stringValue {
  [_userDefaults setValue:stringValue forKey:key];
  [_userDefaults synchronize];
}

- (NSDictionary *)getAll {
  return [_userDefaults dictionaryRepresentation];
}

- (void)clearAll {
  [_userDefaults removePersistentDomainForName:RNDomainIdentifier];
}

- (void)remove:(NSString *)key {
  [_userDefaults removeObjectForKey:key];
}

+ (RNPreferences *)shared {
  return sharedInstance;
}

@end
