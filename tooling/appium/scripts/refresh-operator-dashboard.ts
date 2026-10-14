#!/usr/bin/env node
import {
  collectOperatorDashboardSnapshot,
  writeOperatorDashboardArtifacts,
} from '../src/operatorDashboard.ts';

const snap = collectOperatorDashboardSnapshot();
const { markdownPath, jsonPath } = writeOperatorDashboardArtifacts(snap);
console.log(`[operator-dashboard] wrote ${markdownPath}`);
console.log(`[operator-dashboard] wrote ${jsonPath}`);
console.log(
  `[operator-dashboard] android live=${snap.android.liveWorkers}/5 maxIter=${snap.android.maxIterationAcrossActive} pass=${snap.android.activePass} fail=${snap.android.activeFail}`,
);
console.log(
  `[operator-dashboard] ios live=${snap.ios.liveWorkers}/5 maxIter=${snap.ios.maxIterationAcrossActive} pass=${snap.ios.activePass} fail=${snap.ios.activeFail}`,
);
console.log(`[operator-dashboard] deviceHub=${snap.deviceHub} tip=${snap.tip}`);
