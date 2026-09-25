import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  androidFocusedForeignApps,
  androidFocusedSystemDialog,
  androidFocusLines,
  focusIncludesAndroidForeignApp,
} from '../src/androidFocus.ts';
import { EXAMPLE_ANDROID_PACKAGE } from '../src/formats.ts';

/** `dumpsys window displays` excerpt: app focused, Play Store task alive in the background. */
const APP_FOCUSED_PLAY_STORE_BACKGROUND = `WINDOW MANAGER DISPLAY CONTENTS (dumpsys window displays)
  Display: mDisplayId=0 rootTasks=3
    Task display areas in top down Z order:
      TaskDisplayArea DefaultTaskDisplayArea
        mPreferredTopFocusableRootTask=Task{a1b2c3 #42 type=standard A=10123:com.microsoft.reacttestapp}
        mLastFocusedRootTask=Task{a1b2c3 #42 type=standard A=10123:com.microsoft.reacttestapp}
        Application tokens in top down Z order:
          * Task{a1b2c3 #42 type=standard A=10123:com.microsoft.reacttestapp U=0 visible=true}
            * ActivityRecord{d4e5f6 u0 com.microsoft.reacttestapp/.MainActivity t42}
          * Task{0f9e8d #37 type=standard A=10087:com.android.vending U=0 visible=false}
            * ActivityRecord{7a6b5c u0 com.android.vending/com.google.android.finsky.activities.MainActivity t37}
  mCurrentFocus=Window{112233 u0 com.microsoft.reacttestapp/com.microsoft.reacttestapp.MainActivity}
  mFocusedApp=ActivityRecord{d4e5f6 u0 com.microsoft.reacttestapp/.MainActivity t42}
`;

const PLAY_STORE_FOCUSED = `WINDOW MANAGER DISPLAY CONTENTS (dumpsys window displays)
  Display: mDisplayId=0 rootTasks=3
        Application tokens in top down Z order:
          * Task{0f9e8d #37 type=standard A=10087:com.android.vending U=0 visible=true}
            * ActivityRecord{7a6b5c u0 com.android.vending/com.google.android.finsky.activities.MainActivity t37}
          * Task{a1b2c3 #42 type=standard A=10123:com.microsoft.reacttestapp U=0 visible=false}
  mCurrentFocus=Window{445566 u0 com.android.vending/com.google.android.finsky.activities.MainActivity}
  mFocusedApp=ActivityRecord{7a6b5c u0 com.android.vending/com.google.android.finsky.activities.MainActivity t37}
`;

const CHROME_BACKGROUND_APP_FOCUSED = `  * Task{778899 #40 type=standard A=10099:com.android.chrome U=0 visible=false}
  mCurrentFocus=Window{112233 u0 com.microsoft.reacttestapp/com.microsoft.reacttestapp.MainActivity}
  mFocusedApp=ActivityRecord{d4e5f6 u0 com.microsoft.reacttestapp/.MainActivity t42}
`;

const ANR_FOCUSED = `  * Task{a1b2c3 #42 type=standard A=10123:com.microsoft.reacttestapp U=0 visible=true}
  mCurrentFocus=Window{998877 u0 Application Not Responding: com.microsoft.reacttestapp}
  mFocusedApp=ActivityRecord{d4e5f6 u0 com.microsoft.reacttestapp/.MainActivity t42}
`;

const APP_ERROR_FOCUSED = `  mCurrentFocus=Window{998878 u0 Application Error: com.microsoft.reacttestapp}
  mFocusedApp=ActivityRecord{d4e5f6 u0 com.microsoft.reacttestapp/.MainActivity t42}
`;

describe('android focus lines', () => {
  test('keeps only mCurrentFocus / mFocusedApp lines', () => {
    const lines = androidFocusLines(APP_FOCUSED_PLAY_STORE_BACKGROUND).split('\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0]!, /^mCurrentFocus=Window\{112233 /);
    assert.match(lines[1]!, /^mFocusedApp=ActivityRecord\{d4e5f6 /);
    assert.ok(!lines.join('\n').includes('com.android.vending'));
  });

  test('returns empty for a dump without focus lines', () => {
    assert.equal(androidFocusLines('Task{0f9e8d A=10087:com.android.vending}'), '');
  });
});

describe('android foreign-app focus', () => {
  test('background Play Store task with the app focused is not foreign', () => {
    assert.ok(APP_FOCUSED_PLAY_STORE_BACKGROUND.includes('com.android.vending'));
    assert.deepEqual(androidFocusedForeignApps(APP_FOCUSED_PLAY_STORE_BACKGROUND), []);
    assert.equal(focusIncludesAndroidForeignApp(APP_FOCUSED_PLAY_STORE_BACKGROUND), false);
  });

  test('background Chrome task with the app focused is not foreign', () => {
    assert.equal(focusIncludesAndroidForeignApp(CHROME_BACKGROUND_APP_FOCUSED), false);
  });

  test('focused Play Store is foreign', () => {
    assert.equal(focusIncludesAndroidForeignApp(PLAY_STORE_FOCUSED), true);
    assert.deepEqual(androidFocusedForeignApps(PLAY_STORE_FOCUSED), [
      'com.android.vending',
      'com.google.android.finsky',
    ]);
  });
});

describe('android system dialog focus', () => {
  test('ANR dialog is detected even though its title contains the app package', () => {
    assert.ok(androidFocusLines(ANR_FOCUSED).includes(EXAMPLE_ANDROID_PACKAGE));
    assert.equal(androidFocusedSystemDialog(ANR_FOCUSED), 'anr');
    assert.equal(focusIncludesAndroidForeignApp(ANR_FOCUSED), false);
  });

  test('application error dialog is detected', () => {
    assert.equal(androidFocusedSystemDialog(APP_ERROR_FOCUSED), 'app-error');
  });

  test('app or foreign focus is not a system dialog', () => {
    assert.equal(androidFocusedSystemDialog(APP_FOCUSED_PLAY_STORE_BACKGROUND), null);
    assert.equal(androidFocusedSystemDialog(PLAY_STORE_FOCUSED), null);
  });
});
