import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  classifyFormatOpenObservation,
  formatOpenDiagnosisMessage,
  type FormatOpenObservation,
} from '../src/formatOpenDiagnostics.ts';

describe('formatOpenDiagnostics', () => {
  test('classifies container visible as open', () => {
    assert.equal(
      classifyFormatOpenObservation({
        galleryHome: false,
        backVisible: true,
        containerVisible: true,
      }),
      'open',
    );
  });

  test('classifies JS load failure as js-dead before other signals', () => {
    assert.equal(
      classifyFormatOpenObservation({
        galleryHome: true,
        backVisible: false,
        containerVisible: false,
        jsLoadFailure: 'Android JS load failure visible before gallery-ready: Unable to load script',
      }),
      'js-dead',
    );
  });

  test('classifies still-home as tap-miss', () => {
    assert.equal(
      classifyFormatOpenObservation({
        galleryHome: true,
        backVisible: false,
        containerVisible: false,
      }),
      'tap-miss',
    );
  });

  test('classifies back-without-container as navigation-stuck (Fluid CI shape)', () => {
    // Classic run: titleTap fired, gallery.back displayed, Fluid container never mounted.
    assert.equal(
      classifyFormatOpenObservation({
        galleryHome: false,
        backVisible: true,
        containerVisible: false,
      }),
      'navigation-stuck',
    );
  });

  test('classifies empty observation as unknown', () => {
    assert.equal(
      classifyFormatOpenObservation({
        galleryHome: false,
        backVisible: false,
        containerVisible: false,
      }),
      'unknown',
    );
  });

  test('formatOpenDiagnosisMessage embeds diagnosis fields', () => {
    const observation: FormatOpenObservation = {
      galleryHome: false,
      backVisible: true,
      containerVisible: false,
    };
    const message = formatOpenDiagnosisMessage(
      'gma.format.gam-banner.Fluid',
      'navigation-stuck',
      observation,
    );
    assert.match(message, /gma\.format\.gam-banner\.Fluid/);
    assert.match(message, /diagnosis=navigation-stuck/);
    assert.match(message, /backVisible=true/);
    assert.match(message, /containerVisible=false/);
  });
});
