/**
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

export { LiveRampAts } from './LiveRampAts';
export type { ConfigureOptions, EnvelopeDiagnostics, SetIdentifierOptions } from './LiveRampAts';

export type NativeSecureSignalsAdapterClassName = {
  android: string;
  ios: string;
};

/** Secure Signals provider slug for documentation. */
export const secureSignalsProvider = 'liveramp-ats' as const;

/**
 * Stable GMA RTB adapter class names for Ad Manager Secure Signals configuration.
 */
export const nativeSecureSignalsAdapterClassName: NativeSecureSignalsAdapterClassName = {
  android: 'io.invertase.googlemobileads.securesignals.liveramp.LiveRampAtsRtbAdapter',
  ios: 'RNGMALiveRampAtsRtbAdapter',
};