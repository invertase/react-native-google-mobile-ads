import { bannerEventPayload } from '../src/internal/bannerEventPayload';
import { RevenuePrecisions } from '../src/common/constants';
import type { ResponseInfo } from '../src/types/ResponseInfo';
import loadedFixture from './fixtures/responseInfo/loaded.json';
import paidCompactFixture from './fixtures/responseInfo/paid-compact.json';

describe('bannerEventPayload', () => {
  it('attaches ResponseInfo on loaded and omits it on size change', () => {
    const loaded = bannerEventPayload({
      type: 'onAdLoaded',
      width: 320,
      height: 50,
      responseInfo: loadedFixture as ResponseInfo,
    }) as { width: number; height: number; responseInfo?: ResponseInfo };
    expect(loaded.width).toBe(320);
    expect(loaded.responseInfo?.responseId).toBe('fixture-loaded-response');

    const size = bannerEventPayload({
      type: 'onSizeChange',
      width: 320,
      height: 50,
    }) as { width: number; responseInfo?: ResponseInfo };
    expect(size.width).toBe(320);
    expect(size.responseInfo).toBeUndefined();
  });

  it('maps no-fill failures and paid compact snapshots', () => {
    const failed = bannerEventPayload({
      type: 'onAdFailedToLoad',
      code: 'error-code-no-fill',
      message: 'no inventory',
      responseInfoJson: JSON.stringify({ responseId: null, adapterResponses: [], extras: {} }),
    }) as { reason: string; phase: string };
    expect(failed.reason).toBe('no-fill');
    expect(failed.phase).toBe('load');

    const paid = bannerEventPayload({
      type: 'onPaid',
      currency: 'USD',
      precision: RevenuePrecisions.PRECISE,
      value: 0.01,
      valueMicros: '10000',
      responseInfo: paidCompactFixture as never,
    }) as { currency: string; valueMicros: string | null; responseInfo?: { responseId: string } };
    expect(paid.currency).toBe('USD');
    expect(paid.valueMicros).toBe('10000');
    expect(paid.responseInfo?.responseId).toBe('fixture-paid-response');

    const paidNoMicros = bannerEventPayload({
      type: 'onPaid',
      currency: 'USD',
      precision: RevenuePrecisions.ESTIMATED,
      value: 0.01,
      valueMicros: '',
    }) as { valueMicros: string | null };
    expect(paidNoMicros.valueMicros).toBeNull();

    const paidAbsentMicros = bannerEventPayload({
      type: 'onPaid',
      currency: 'EUR',
      precision: RevenuePrecisions.UNKNOWN,
      value: 0,
    }) as { valueMicros: string | null };
    expect(paidAbsentMicros.valueMicros).toBeNull();
  });

  it('forwards app events and returns undefined for void event types', () => {
    expect(bannerEventPayload({ type: 'onAppEvent', name: 'gad', data: 'x' })).toEqual({
      name: 'gad',
      data: 'x',
    });
    expect(bannerEventPayload({ type: 'onAdOpened' })).toBeUndefined();
  });
});
