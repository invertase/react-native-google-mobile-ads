'use strict';

/**
 * Repro for GitHub #568: Xcode Build Phase can start the RNGoogleMobileAds
 * config script before Process Info.plist has written
 * $(BUILT_PRODUCTS_DIR)/$(INFOPLIST_PATH). Tip hardens with after_compile +
 * input_files + always_out_of_date; the script must also wait briefly.
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const SCRIPT = path.resolve(__dirname, '../ios_config.sh');

const MINIMAL_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>com.example.rngma568</string>
</dict>
</plist>
`;

function setupFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'rngma-568-'));
  // ios_config walks PROJECT_DIR parents (max 2) for app.json.
  const projectDir = path.join(root, 'ios', 'App');
  fs.mkdirSync(projectDir, { recursive: true });
  fs.writeFileSync(
    path.join(root, 'app.json'),
    JSON.stringify({
      'react-native-google-mobile-ads': {
        ios_app_id: 'ca-app-pub-568568568~568568568',
      },
    }),
  );
  const built = path.join(root, 'build');
  const appBundle = path.join(built, 'App.app');
  fs.mkdirSync(appBundle, { recursive: true });
  const infoPlistRel = 'App.app/Info.plist';
  return {
    root,
    projectDir,
    built,
    infoPlistRel,
    infoPlist: path.join(built, infoPlistRel),
  };
}

function runScript(fixture, extraEnv = {}, timeoutMs = 20000) {
  return spawnSync('bash', [SCRIPT], {
    env: {
      ...process.env,
      PROJECT_DIR: fixture.projectDir,
      BUILT_PRODUCTS_DIR: fixture.built,
      INFOPLIST_PATH: fixture.infoPlistRel,
      DWARF_DSYM_FOLDER_PATH: path.join(fixture.root, 'dsyms-missing'),
      DWARF_DSYM_FILE_NAME: 'App.app.dSYM',
      ...extraEnv,
    },
    encoding: 'utf8',
    timeout: timeoutMs,
  });
}

function schedulePlistWrite(filePath, delaySec) {
  // Background shell so the write happens while spawnSync blocks in the script.
  return spawn('bash', ['-c', `sleep ${delaySec} && cat > "$1"`, 'plist-writer', filePath], {
    stdio: ['pipe', 'ignore', 'ignore'],
  });
}

describe('ios_config.sh Info.plist wait (#568)', () => {
  afterEach(() => {
    // best-effort; tmp dirs are unique per test
  });

  it('fails quickly when Info.plist never appears (wait max 0)', () => {
    const fixture = setupFixture();
    const result = runScript(fixture, { RNGMA_INFOPLIST_WAIT_MAX: '0' }, 5000);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(/unable to locate Info\.plist/);
  });

  it('succeeds when Info.plist appears shortly after script start', () => {
    const fixture = setupFixture();
    const writer = schedulePlistWrite(fixture.infoPlist, '0.6');
    writer.stdin.write(MINIMAL_PLIST);
    writer.stdin.end();

    const result = runScript(
      fixture,
      {
        // 40 * 0.2s = 8s budget — enough for the 0.6s delayed write
        RNGMA_INFOPLIST_WAIT_MAX: '40',
      },
      15000,
    );

    try {
      writer.kill('SIGTERM');
    } catch {
      // already exited
    }

    expect(result.status).toBe(0);
    expect(result.stdout + result.stderr).toMatch(/build script finished/);
    const plistBuddy = spawnSync(
      '/usr/libexec/PlistBuddy',
      ['-c', 'Print :GADApplicationIdentifier', fixture.infoPlist],
      { encoding: 'utf8' },
    );
    expect(plistBuddy.status).toBe(0);
    expect(plistBuddy.stdout.trim()).toBe('ca-app-pub-568568568~568568568');
  });
});
