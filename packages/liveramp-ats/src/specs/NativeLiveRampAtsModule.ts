/**
 * Copyright (c) 2016-present Invertase Limited & Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type LiveRampAtsConfigureOptions = {
  placementId: number;
  bundleId?: string;
};

export type LiveRampAtsSetIdentifierOptions = {
  email?: string;
  phone?: string;
};

export type LiveRampAtsEnvelopeDiagnostics = {
  envelope27: string | null;
  envelope19: string | null;
  envelope25: string | null;
  signal: string;
  placementId: number | null;
  origin: string | null;
};

export interface Spec extends TurboModule {
  configure(options: LiveRampAtsConfigureOptions): Promise<void>;
  setIdentifier(options: LiveRampAtsSetIdentifierOptions): Promise<void>;
  clearIdentifier(): Promise<void>;
  getEnvelope(): Promise<LiveRampAtsEnvelopeDiagnostics>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('RNGMALiveRampAtsModule');