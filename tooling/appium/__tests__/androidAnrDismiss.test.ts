import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  anrDialogButtonTapPoints,
  dismissAndroidAnrDialogsViaAdb,
  parseAnrDialogRegionFromAccessibility,
  windowDumpShowsAnr,
} from '../src/androidAnrDismiss.ts';

const A11Y = `
A11yWindow[AccessibilityWindowInfo[title=Process system isn't responding, displayId=0, id=17, taskId=-1, type=TYPE_SYSTEM, layer=0, region=SkRegion((28,1030,1052,1536)), bounds=Rect(28, 1030 - 1052, 1536), focused=true, active=true]]
`;

const WINDOW_ANR = `
  mCurrentFocus=Window{fbfaa23 u0 Application Not Responding: system}
  mFocusedApp=ActivityRecord{131506842 u0 com.microsoft.reacttestapp/.component.ComponentActivity t98}
`;

const WINDOW_CLEAR = `
  mCurrentFocus=Window{abc u0 com.microsoft.reacttestapp/com.microsoft.reacttestapp.MainActivity}
  mFocusedApp=ActivityRecord{d4e5f6 u0 com.microsoft.reacttestapp/.MainActivity t42}
`;

describe('androidAnrDismiss', () => {
  test('parses accessibility SkRegion for isn\'t responding dialogs', () => {
    assert.deepEqual(parseAnrDialogRegionFromAccessibility(A11Y), {
      left: 28,
      top: 1030,
      right: 1052,
      bottom: 1536,
    });
  });

  test('button tap points prefer the lower dialog band', () => {
    const points = anrDialogButtonTapPoints({
      left: 28,
      top: 1030,
      right: 1052,
      bottom: 1536,
    });
    assert.equal(points[0]!.y, Math.round(1030 + ((1536 - 1030) * 4) / 5));
    assert.ok(points[0]!.x < points[1]!.x);
  });

  test('windowDumpShowsAnr matches focused Application Not Responding', () => {
    assert.equal(windowDumpShowsAnr(WINDOW_ANR), true);
    assert.equal(windowDumpShowsAnr(WINDOW_CLEAR), false);
  });

  test('dismissAndroidAnrDialogsViaAdb taps then clears', () => {
    const calls: string[][] = [];
    let round = 0;
    const result = dismissAndroidAnrDialogsViaAdb('emulator-5558', {
      sleepMs: () => undefined,
      execFile: (_bin, args) => {
        calls.push(args);
        const shell = args.find(a => a.includes('dumpsys')) ?? '';
        if (shell.includes('dumpsys window') || args.includes('window')) {
          round += 1;
          return round === 1 ? WINDOW_ANR : WINDOW_CLEAR;
        }
        if (shell.includes('accessibility') || args.includes('accessibility')) {
          return A11Y;
        }
        return '';
      },
    });
    assert.equal(result.cleared, true);
    assert.ok(result.tapped >= 1);
    assert.ok(
      calls.some(args => args.includes('input') && args.includes('tap')),
      'must issue adb input tap',
    );
  });
});
