import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  JS_LOAD_FAILURE_UI_SNIPPETS,
  jsLoadFailureFromText,
} from '../src/jsLoadFailure.ts';

describe('jsLoadFailureFromText', () => {
  test('detects development-server redbox copy', () => {
    const message = jsLoadFailureFromText(
      '<hierarchy><node text="Could not connect to development server"/></hierarchy>',
    );
    assert.match(message ?? '', /Could not connect to development server/);
  });

  test('detects unable-to-load-script copy', () => {
    const message = jsLoadFailureFromText(
      'ReactNativeJS: Unable to load script from Metro',
    );
    assert.match(message ?? '', /Unable to load script/);
  });

  test('ignores healthy gallery chrome', () => {
    assert.equal(
      jsLoadFailureFromText(
        'gma.gallery.root All Formats Banner Interstitial Rewarded',
      ),
      undefined,
    );
  });

  test('exports UI snippets for selector probes', () => {
    assert.equal(JS_LOAD_FAILURE_UI_SNIPPETS.length >= 3, true);
  });
});
