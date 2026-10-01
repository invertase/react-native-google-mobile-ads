'use strict';

/**
 * Repro for GitHub #568: Xcode Build Phase can start the RNGoogleMobileAds
 * config script before Process Info.plist has written
 * $(BUILT_PRODUCTS_DIR)/$(INFOPLIST_PATH). Tip hardens with after_compile +
 * input_files + always_out_of_date; the script must also wait briefly.
 *
 * Production runs under Xcode (macOS + /usr/libexec/PlistBuddy). CI Jest is
 * Linux — inject RNGMA_PLIST_BUDDY with a minimal Add stub so the wait +
 * inject path is exercised without a silent no-op.
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

const PLIST_BUDDY_STUB = `#!/usr/bin/env bash
# Minimal PlistBuddy stand-in for ios_config.sh tests (Add :Key type 'value').
set -euo pipefail
if [[ "\${1:-}" != "-c" || \$# -lt 3 ]]; then
  echo "stub PlistBuddy: expected -c <cmd> <file>" >&2
  exit 2
fi
python3 - "\$2" "\$3" <<'PY'
import plistlib, re, sys

cmd, path = sys.argv[1], sys.argv[2]
match = re.match(r"Add :(\\S+)\\s+(\\S+)\\s+'(.*)'\\s*$", cmd, re.DOTALL)
if not match:
    sys.stderr.write(f"stub PlistBuddy: unsupported: {cmd!r}\\n")
    sys.exit(2)
key, typ, value = match.groups()
with open(path, "rb") as handle:
    data = plistlib.load(handle)
if typ == "bool":
    data[key] = value in ("YES", "true", "1")
elif typ == "array":
    data[key] = []
else:
    data[key] = value
with open(path, "wb") as handle:
    plistlib.dump(data, handle)
PY
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
  const binDir = path.join(root, 'bin');
  fs.mkdirSync(binDir, { recursive: true });
  const plistBuddy = path.join(binDir, 'PlistBuddy');
  fs.writeFileSync(plistBuddy, PLIST_BUDDY_STUB, { mode: 0o755 });
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
    plistBuddy,
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
      RNGMA_PLIST_BUDDY: fixture.plistBuddy,
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

    const combined = result.stdout + result.stderr;
    expect(result.status).toBe(0);
    expect(combined).toMatch(/build script finished/);
    const plistXml = fs.readFileSync(fixture.infoPlist, 'utf8');
    expect(plistXml).toMatch(
      /<key>GADApplicationIdentifier<\/key>\s*<string>ca-app-pub-568568568~568568568<\/string>/,
    );
  });
});
