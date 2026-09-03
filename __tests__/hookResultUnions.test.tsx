import React from 'react';
import { act, render } from '@testing-library/react-native';

import {
  AdFormat,
  useMultiFormatAd,
  usePooledAd,
  type AdPoolProviderProps,
  type UseAdPoolResult,
  type UseAdPoolStatus,
  type UseMultiFormatAdResult,
  type UseMultiFormatAdStatus,
  type UsePooledAdResult,
  type UsePooledAdStatus,
} from '../src';

// Compile-time locks live in type-test.ts (`yarn tsc:compile`):
// UsePooledAdStatus ↔ UsePooledAdResult['status'], UseMultiFormatAdStatus ↔
// UseMultiFormatAdResult['status'], poll-only words ∉ multi, load-only ∉ pooled.
// Importing these from the public barrel fails the build if the hook result exports are removed.
type BarrelHookTypesAlive = [
  AdPoolProviderProps['pools'],
  UseAdPoolResult['status'],
  UseAdPoolStatus,
  UseMultiFormatAdResult['status'],
  UseMultiFormatAdStatus,
  UsePooledAdResult['status'],
  UsePooledAdStatus,
];
const barrelHookTypesAlive: BarrelHookTypesAlive = [
  [],
  'absent',
  'absent',
  'idle',
  'idle',
  'idle',
  'idle',
];
void barrelHookTypesAlive;

describe('hook result status unions', () => {
  it('returns idle stub arms with null / empty inventory fields', async () => {
    let pooled: ReturnType<typeof usePooledAd> | undefined;
    let multi: ReturnType<typeof useMultiFormatAd> | undefined;
    function Probe() {
      pooled = usePooledAd('display-pool');
      multi = useMultiFormatAd({
        adUnitId: 'unit',
        requestOptions: { formats: [AdFormat.BANNER] },
        autoLoad: false,
      });
      return null;
    }

    render(<Probe />);
    expect(pooled!.status).toBe('idle');
    expect(pooled!.ad).toBeNull();
    expect(pooled!.error).toBeNull();
    expect(pooled!.available).toBe(false);
    expect(multi!.status).toBe('idle');
    expect(multi!.ads).toEqual([]);
    expect(multi!.errors).toEqual([]);

    await expect(pooled!.poll()).resolves.toEqual({ status: 'empty' });
    expect(pooled!.release()).toBeNull();
    await act(async () => {
      await expect(multi!.load()).resolves.toEqual({
        status: 'no-fill',
        ads: [],
        errors: [],
        responseInfo: null,
      });
    });
    expect(multi!.status).toBe('no-fill');
    act(() => {
      expect(multi!.release()).toEqual([]);
    });
  });
});
