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
 */

import {
  adErrorFromNativeEvent,
  parseResponseInfoPayload,
  reasonFromNativeCode,
} from '../src/internal/adErrorFromNativeEvent';
import type { ResponseInfo } from '../src/types/ResponseInfo';

import loadedFixture from './fixtures/responseInfo/loaded.json';
import noFillFixture from './fixtures/responseInfo/no-fill.json';
import paidCompactFixture from './fixtures/responseInfo/paid-compact.json';

function assertResponseInfoShape(info: ResponseInfo) {
  expect(info).toHaveProperty('responseId');
  expect(info).toHaveProperty('adapterClassName');
  expect(info).toHaveProperty('loadedAdapterResponse');
  expect(Array.isArray(info.adapterResponses)).toBe(true);
  expect(info.extras).toEqual(expect.any(Object));
  for (const row of info.adapterResponses) {
    expect(row).toEqual(
      expect.objectContaining({
        adapterClassName: expect.any(String),
        latencyMillis: expect.any(Number),
        outcome: expect.stringMatching(/^(success|error)$/),
      }),
    );
    if (row.outcome === 'success') {
      expect(row.adError).toBeNull();
    } else {
      expect(row.adError).toEqual(
        expect.objectContaining({
          domain: expect.any(String),
          code: expect.any(Number),
          message: expect.any(String),
        }),
      );
    }
  }
}

describe('ResponseInfo serialization fixtures', () => {
  it('commits a loaded waterfall fixture matching the approved shape', () => {
    const info = loadedFixture as ResponseInfo;
    assertResponseInfoShape(info);
    expect(info.responseId).toBe('fixture-loaded-response');
    expect(info.loadedAdapterResponse?.outcome).toBe('success');
    expect(info.adapterResponses).toHaveLength(2);
    expect(info.adapterResponses[1].outcome).toBe('error');
    expect(info.extras.creativeId).toBe('fixture-creative');
  });

  it('commits a distinct no-fill fixture with null winner and error rows', () => {
    const info = noFillFixture as ResponseInfo;
    assertResponseInfoShape(info);
    expect(info.responseId).toBeNull();
    expect(info.adapterClassName).toBeNull();
    expect(info.loadedAdapterResponse).toBeNull();
    expect(info.adapterResponses[0].outcome).toBe('error');
    expect(info.adapterResponses[0].adError?.code).toBe(3);
  });

  it('commits a paid-compact fixture that omits adapterResponses', () => {
    const compact = paidCompactFixture as Omit<ResponseInfo, 'adapterResponses'> & {
      adapterResponses?: unknown;
    };
    expect(compact.responseId).toBe('fixture-paid-response');
    expect(compact.loadedAdapterResponse?.outcome).toBe('success');
    expect(compact.adapterResponses).toBeUndefined();
    expect(compact.extras.creativeId).toBe('fixture-creative');
  });
});

describe('adErrorFromNativeEvent / reason mapping', () => {
  it('maps no-fill codes to reason no-fill with phase load', () => {
    const error = adErrorFromNativeEvent(
      {
        code: 'no-fill',
        message: 'No fill.',
        responseInfo: noFillFixture as ResponseInfo,
      },
      'googleMobileAds',
      'load',
    );
    expect(error.reason).toBe('no-fill');
    expect(error.phase).toBe('load');
    expect(error.responseInfo?.loadedAdapterResponse).toBeNull();
    expect(error.responseInfo?.adapterResponses[0].outcome).toBe('error');
  });

  it('maps banner error-code-no-fill to distinct no-fill reason', () => {
    expect(reasonFromNativeCode('error-code-no-fill')).toBe('no-fill');
    const error = adErrorFromNativeEvent(
      { code: 'error-code-no-fill', message: 'lack of inventory' },
      'googleMobileAds',
    );
    expect(error.reason).toBe('no-fill');
    expect(error.phase).toBe('load');
  });

  it('covers remaining reasonFromNativeCode branches', () => {
    expect(reasonFromNativeCode(undefined)).toBe('unknown');
    expect(reasonFromNativeCode('mediation-no-fill')).toBe('mediation-no-fill');
    expect(reasonFromNativeCode('error-code-network-error')).toBe('network-error');
    expect(reasonFromNativeCode('application-identifier-missing')).toBe('app-id-missing');
    expect(reasonFromNativeCode('received-invalid-ad-string')).toBe('invalid-ad-string');
    expect(reasonFromNativeCode('custom-passthrough')).toBe('custom-passthrough');
  });

  it('parses Fabric responseInfoJson payloads and rejects bad JSON', () => {
    const parsed = parseResponseInfoPayload({
      responseInfoJson: JSON.stringify(loadedFixture),
    });
    expect(parsed?.responseId).toBe('fixture-loaded-response');
    expect(parseResponseInfoPayload(null)).toBeUndefined();
    expect(parseResponseInfoPayload({})).toBeUndefined();
    expect(parseResponseInfoPayload({ responseInfoJson: '' })).toBeUndefined();
    expect(parseResponseInfoPayload({ responseInfoJson: '{bad' })).toBeUndefined();
  });

  it('honors explicit reason/phase overrides on the wire event', () => {
    const error = adErrorFromNativeEvent(
      {
        code: 'internal-error',
        message: 'x',
        reason: 'timeout',
        phase: 'show',
      },
      'googleMobileAds',
      'load',
    );
    expect(error.reason).toBe('timeout');
    expect(error.phase).toBe('show');
  });

  it('does not invent SHOW_FAILED — show phase stays an ERROR enrichment', () => {
    const error = adErrorFromNativeEvent(
      { code: 'internal-error', message: 'show failed' },
      'googleMobileAds',
      'show',
    );
    expect(error.phase).toBe('show');
    expect(error.reason).toBe('internal-error');
  });
});
