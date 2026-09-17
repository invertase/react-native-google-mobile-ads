import React from 'react';
import { act, render } from '@testing-library/react-native';

import { AdFormat, AdPoolPresets, AdPoolProvider, AdPools, useAdPool } from '../src';
import { destroyAllAdPools } from '../src/internal/adPoolRegistry';

/**
 * AdPoolProvider owns pools but renders children through a Fragment: it is not
 * a context provider, so registry churn (a pool registering or being
 * destroyed) must not re-render the subtree. Consumers subscribe individually
 * through useAdPool / usePooledAd, which must still see 'absent' -> 'ready'.
 */
describe('AdPoolProvider render isolation', () => {
  afterEach(() => {
    // Registry notify updates mounted hooks; keep teardown inside act (F3).
    act(() => {
      destroyAllAdPools();
    });
    jest.restoreAllMocks();
  });

  it('does not subscribe to the registry when no child uses a pool hook', async () => {
    const subscribeSpy = jest.spyOn(
      require('../src/internal/adPoolRegistry'),
      'subscribeAdPoolRegistry',
    );
    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'provider-no-subscribe', {
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
    expect(AdPools.get(config.poolId)).not.toBeNull();

    expect(subscribeSpy).not.toHaveBeenCalled();
  });

  it('does not re-render a pool-free child when pools register or are destroyed', async () => {
    let renders = 0;
    let commits = 0;
    function Passive() {
      renders += 1;
      return null;
    }

    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'provider-render-isolation', {
      bufferSize: 1,
    });
    render(
      <React.Profiler
        id="ad-pool-provider"
        onRender={() => {
          commits += 1;
        }}
      >
        <AdPoolProvider pools={[config]}>
          <Passive />
        </AdPoolProvider>
      </React.Profiler>,
    );
    const mountRenders = renders;
    const mountCommits = commits;
    expect(mountRenders).toBeGreaterThan(0);
    expect(mountCommits).toBeGreaterThan(0);

    // Provider-owned create resolves and registers.
    await act(async () => {
      await Promise.resolve();
    });
    expect(AdPools.get(config.poolId)).not.toBeNull();
    expect(renders).toBe(mountRenders);
    // The provider re-rendering on registry churn would commit here even when
    // the stable children element lets React bail out of the subtree.
    expect(commits).toBe(mountCommits);

    // An unrelated pool registering is registry churn too.
    await act(async () => {
      await AdPools.create(AdPoolPresets.fullscreen(AdFormat.REWARDED, 'provider-render-other'));
    });
    expect(renders).toBe(mountRenders);
    expect(commits).toBe(mountCommits);

    act(() => {
      destroyAllAdPools();
    });
    expect(renders).toBe(mountRenders);
    expect(commits).toBe(mountCommits);
  });

  it('still moves a useAdPool child from absent to ready without re-rendering its sibling', async () => {
    const statuses: string[] = [];
    let siblingRenders = 0;

    const config = AdPoolPresets.fullscreen(AdFormat.INTERSTITIAL, 'provider-consumer-ready', {
      bufferSize: 1,
    });

    function Consumer() {
      statuses.push(useAdPool(config.poolId).status);
      return null;
    }
    function Passive() {
      siblingRenders += 1;
      return null;
    }

    render(
      <AdPoolProvider pools={[config]}>
        <Consumer />
        <Passive />
      </AdPoolProvider>,
    );
    expect(statuses[0]).toBe('absent');
    const afterMount = siblingRenders;

    await act(async () => {
      await Promise.resolve();
    });
    expect(statuses[statuses.length - 1]).toBe('ready');
    expect(siblingRenders).toBe(afterMount);
  });
});
