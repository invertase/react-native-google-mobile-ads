import React from 'react';
import { act, render } from '@testing-library/react-native';

import { AdFormat, AdPoolPresets, AdPoolProvider, AdPools } from '../src';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';

/**
 * `enabled` gates future AdPools.create calls from AdPoolProvider (consent /
 * init gate). Flipping false must not tear down existing pools; flipping true
 * resumes creates. Omitted `enabled` defaults to true.
 */
describe('AdPoolProvider enabled gate', () => {
  afterEach(() => {
    act(() => {
      destroyAllAdPools();
    });
    jest.restoreAllMocks();
  });

  it('suppresses create when enabled is false', async () => {
    const createSpy = jest.spyOn(AdPools, 'create');
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'provider-enabled-false', {
      bufferSize: 1,
    });

    render(
      <AdPoolProvider pools={[config]} enabled={false}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(createSpy).not.toHaveBeenCalled();
    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('keeps existing pools when enabled flips to false', async () => {
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'provider-enabled-survive', {
      bufferSize: 1,
    });

    const { rerender } = render(
      <AdPoolProvider pools={[config]} enabled={true}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    const pool = AdPools.get(config.poolId);
    expect(pool).not.toBeNull();

    rerender(
      <AdPoolProvider pools={[config]} enabled={false}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(AdPools.get(config.poolId)).toBe(pool);
  });

  it('destroys removed pool ids while enabled is false', async () => {
    const config = AdPoolPresets.fullscreen(
      AdFormat.INTERSTITIAL,
      'provider-enabled-destroy-while-false',
      {
        bufferSize: 1,
      },
    );

    const { rerender } = render(
      <AdPoolProvider pools={[config]} enabled={true}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(AdPools.get(config.poolId)).not.toBeNull();

    rerender(
      <AdPoolProvider pools={[config]} enabled={false}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(AdPools.get(config.poolId)).not.toBeNull();

    rerender(
      <AdPoolProvider pools={[]} enabled={false}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(AdPools.get(config.poolId)).toBeNull();
  });

  it('resumes create when enabled flips from false to true', async () => {
    const createSpy = jest.spyOn(AdPools, 'create');
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'provider-enabled-resume', {
      bufferSize: 1,
    });

    const { rerender } = render(
      <AdPoolProvider pools={[config]} enabled={false}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(createSpy).not.toHaveBeenCalled();
    expect(AdPools.get(config.poolId)).toBeNull();

    rerender(
      <AdPoolProvider pools={[config]} enabled={true}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(createSpy).toHaveBeenCalled();
    expect(AdPools.get(config.poolId)).not.toBeNull();
  });

  it('does not recreate surviving pools when enabled flips false then true', async () => {
    const createSpy = jest.spyOn(AdPools, 'create');
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'provider-enabled-no-recreate', {
      bufferSize: 1,
    });

    const { rerender } = render(
      <AdPoolProvider pools={[config]} enabled={true}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    const pool = AdPools.get(config.poolId);
    expect(pool).not.toBeNull();
    const createsAfterMount = createSpy.mock.calls.length;

    rerender(
      <AdPoolProvider pools={[config]} enabled={false}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(AdPools.get(config.poolId)).toBe(pool);

    rerender(
      <AdPoolProvider pools={[config]} enabled={true}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(createSpy.mock.calls.length).toBe(createsAfterMount);
    expect(AdPools.get(config.poolId)).toBe(pool);
  });

  it('defaults enabled to true when omitted', async () => {
    const createSpy = jest.spyOn(AdPools, 'create');
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'provider-enabled-default', {
      bufferSize: 1,
    });

    render(
      <AdPoolProvider pools={[config]}>
        <React.Fragment />
      </AdPoolProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });

    expect(createSpy).toHaveBeenCalled();
    expect(AdPools.get(config.poolId)).not.toBeNull();
  });
});
