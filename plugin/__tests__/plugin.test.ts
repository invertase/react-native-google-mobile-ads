import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import util from 'util';

const execAsync = util.promisify(exec);

describe('Expo Config Plugin Tests', () => {
  const fixturesPath = path.join(__dirname, 'fixtures');
  const testAppPath = path.join(__dirname, 'build');
  const infoPlistPath = path.join(testAppPath, 'ios', 'example', 'Info.plist');
  const androidManifestPath = path.join(
    testAppPath,
    'android',
    'app',
    'src',
    'main',
    'AndroidManifest.xml',
  );

  beforeEach(async () => {
    await fs.rm(testAppPath, { recursive: true, force: true });
    await fs.mkdir(testAppPath);
    await fs.copyFile(path.join(fixturesPath, 'app.json'), path.join(testAppPath, 'app.json'));
    await fs.copyFile(
      path.join(fixturesPath, 'package.json'),
      path.join(testAppPath, 'package.json'),
    );
  });

  it('Technically requires no parameters', async () => {
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);
  });

  it('Warns about missing androidAppId', async () => {
    await fs.copyFile(
      path.join(fixturesPath, 'app-without-params.json'),
      path.join(testAppPath, 'app.json'),
    );

    const { stderr } = await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);
    expect(stderr).toMatch(/No 'androidAppId' was provided/);
  });

  it('Warns about missing iosAppId', async () => {
    await fs.copyFile(
      path.join(fixturesPath, 'app-without-params.json'),
      path.join(testAppPath, 'app.json'),
    );

    const { stderr } = await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);
    expect(stderr).toMatch(/No 'iosAppId' was provided/);
  });

  it('Optimizes initialization on Android by default', async () => {
    await fs.copyFile(
      path.join(fixturesPath, 'app-without-params.json'),
      path.join(testAppPath, 'app.json'),
    );

    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const androidManifest = await fs.readFile(androidManifestPath, 'utf8');
    expect(androidManifest).toContain(
      '<meta-data android:name="com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION" android:value="true" tools:replace="android:value"/>',
    );
  });

  it('Optimizes ad loading on Android by default', async () => {
    await fs.copyFile(
      path.join(fixturesPath, 'app-without-params.json'),
      path.join(testAppPath, 'app.json'),
    );

    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const androidManifest = await fs.readFile(androidManifestPath, 'utf8');
    expect(androidManifest).toContain(
      '<meta-data android:name="com.google.android.gms.ads.flag.OPTIMIZE_AD_LOADING" android:value="true" tools:replace="android:value"/>',
    );
  });

  it('Should modify AndroidManifest.xml', async () => {
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const androidManifest = await fs.readFile(androidManifestPath, 'utf8');
    expect(androidManifest).toMatchSnapshot();
  });

  it('Should modify Info.plist', async () => {
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const infoPlist = await fs.readFile(infoPlistPath, 'utf8');
    expect(infoPlist).toMatchSnapshot();
  });
});
