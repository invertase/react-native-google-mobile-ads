/**
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import native from './specs/NativeLiveRampAtsModule';
import type {
  LiveRampAtsConfigureOptions,
  LiveRampAtsEnvelopeDiagnostics,
  LiveRampAtsSetIdentifierOptions,
} from './specs/NativeLiveRampAtsModule';

export type ConfigureOptions = LiveRampAtsConfigureOptions;
export type SetIdentifierOptions = LiveRampAtsSetIdentifierOptions;
export type EnvelopeDiagnostics = LiveRampAtsEnvelopeDiagnostics;

export const LiveRampAts = {
  configure(options: ConfigureOptions): Promise<void> {
    return native.configure(options);
  },
  setIdentifier(options: SetIdentifierOptions): Promise<void> {
    return native.setIdentifier(options);
  },
  clearIdentifier(): Promise<void> {
    return native.clearIdentifier();
  },
  getEnvelope(): Promise<EnvelopeDiagnostics> {
    return native.getEnvelope();
  },
};