import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import {
  ANDROID_FOREIGN_FOCUS_MARKERS,
  androidCurrentFocusIsStatusBarShade,
} from '../src/androidFocus.ts';

const gallerySource = readFileSync(
  new URL('../test/helpers/gallery.ts', import.meta.url),
  'utf8',
);

describe('gallery Android host recover (shade)', () => {
  test('collapses status bar before foreign-app force-stop path', () => {
    const collapseIdx = gallerySource.indexOf('collapseAndroidStatusBarShadeIfPresent');
    const recoverIdx = gallerySource.indexOf('async function recoverAndroidTestHost');
    const foreignCallIdx = gallerySource.indexOf(
      'recoverAndroidForeignAppIfPresent',
      recoverIdx,
    );
    assert.ok(collapseIdx >= 0, 'shade collapse helper must exist');
    assert.ok(recoverIdx >= 0);
    assert.ok(foreignCallIdx > recoverIdx);
    const recoverBodyStart = gallerySource.indexOf('{', recoverIdx);
    const recoverBody = gallerySource.slice(recoverBodyStart, recoverBodyStart + 2500);
    const shadeCall = recoverBody.indexOf('collapseAndroidStatusBarShadeIfPresent');
    const foreignInLoop = recoverBody.indexOf('recoverAndroidForeignAppIfPresent');
    assert.ok(shadeCall >= 0 && shadeCall < foreignInLoop, 'shade collapse runs before foreign recover');
    const collapseStart = gallerySource.indexOf('async function collapseAndroidStatusBarShadeIfPresent');
    const collapseEnd = gallerySource.indexOf('async function recoverAndroidTestHost', collapseStart);
    const collapseSource = gallerySource.slice(collapseStart, collapseEnd);
    assert.match(collapseSource, /cmd[\s\S]*statusbar[\s\S]*collapse/);
    assert.match(collapseSource, /recover\.shade/);
  });

  test('does not treat full dumpsys package substring as foreground', () => {
    const recoverIdx = gallerySource.indexOf('async function recoverAndroidTestHost');
    const recoverEnd = gallerySource.indexOf('async function ensureExampleAppInForeground', recoverIdx);
    const recoverSource = gallerySource.slice(recoverIdx, recoverEnd);
    assert.doesNotMatch(recoverSource, /focus\.includes\(EXAMPLE_ANDROID_PACKAGE\)/);
    assert.match(recoverSource, /androidExampleAppHoldsWindowFocus\(focus, EXAMPLE_ANDROID_PACKAGE\)/);
  });

  test('waitForGalleryHome polls host recover on an interval', () => {
    const waitStart = gallerySource.indexOf('export async function waitForGalleryHome');
    const waitEnd = gallerySource.indexOf('export async function selectGallerySection', waitStart);
    const waitSource = gallerySource.slice(waitStart, waitEnd);
    assert.match(waitSource, /waitForGalleryHome\.poll/);
    assert.match(waitSource, /galleryHostRecoverIntervalMs/);
    assert.match(waitSource, /recoverAndroidTestHost\('waitForGalleryHome\.poll'\)/);
    assert.match(waitSource, /timeout: 30000/);
  });

  test('NotificationShade stays out of foreign force-stop markers', () => {
    assert.ok(!ANDROID_FOREIGN_FOCUS_MARKERS.some(marker => /NotificationShade/i.test(marker)));
    assert.equal(androidCurrentFocusIsStatusBarShade('mCurrentFocus=Window{x u0 NotificationShade}'), true);
  });
});