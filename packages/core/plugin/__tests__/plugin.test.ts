import { exec } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import util from 'util';

const execAsync = util.promisify(exec);

jest.setTimeout(15000);

describe.each(['app.json', 'app.config.js', 'app.config.ts'])('Expo Config Plugin Tests', expoConfigFileName => {
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
  const androidGradlePropertiesPath = path.join(testAppPath, 'android', 'gradle.properties');

  beforeEach(async () => {
    await fs.rm(testAppPath, { recursive: true, force: true });
    await fs.mkdir(testAppPath);
    await fs.copyFile(
      path.join(fixturesPath, expoConfigFileName),
      path.join(testAppPath, expoConfigFileName),
    );
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
      path.join(fixturesPath, "without-params", expoConfigFileName),
      path.join(testAppPath, expoConfigFileName),
    );

    const { stderr } = await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);
    expect(stderr).toMatch(/No 'androidAppId' was provided/);
  });

  it('Warns about missing iosAppId', async () => {
    await fs.copyFile(
      path.join(fixturesPath, "without-params", expoConfigFileName),
      path.join(testAppPath, expoConfigFileName),
    );

    const { stderr } = await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);
    expect(stderr).toMatch(/No 'iosAppId' was provided/);
  });

  it('Leaves the Android SDK backend unset when omitted', async () => {
    await fs.copyFile(
      path.join(fixturesPath, "without-params", expoConfigFileName),
      path.join(testAppPath, expoConfigFileName),
    );

    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const gradleProperties = await fs.readFile(androidGradlePropertiesPath, 'utf8');
    expect(gradleProperties).not.toContain('RNGMA_ANDROID_BACKEND');
  });

  it('Optimizes initialization on Android by default', async () => {
    await fs.copyFile(
      path.join(fixturesPath, "without-params", expoConfigFileName),
      path.join(testAppPath, expoConfigFileName),
    );

    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const androidManifest = await fs.readFile(androidManifestPath, 'utf8');
    expect(androidManifest).toContain(
      '<meta-data android:name="com.google.android.gms.ads.flag.OPTIMIZE_INITIALIZATION" android:value="true" tools:replace="android:value"/>',
    );
  });

  it('Selects the requested Android SDK backend', async () => {
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const gradleProperties = await fs.readFile(androidGradlePropertiesPath, 'utf8');
    expect(gradleProperties).toContain('RNGMA_ANDROID_BACKEND=nextgen');
  });

  it('Rejects an unsupported Android SDK backend', async () => {
    if (expoConfigFileName !== 'app.json') return;

    const configPath = path.join(testAppPath, expoConfigFileName);
    const config = await fs.readFile(configPath, 'utf8');
    await fs.writeFile(configPath, config.replace('"nextgen"', '"unsupported"'));

    await expect(execAsync(`yarn expo prebuild --no-install ${testAppPath}`)).rejects.toThrow(
      /Expected "classic", "legacy", or "nextgen"/,
    );
  });

  it('Optimizes ad loading on Android by default', async () => {
    await fs.copyFile(
      path.join(fixturesPath, "without-params", expoConfigFileName),
      path.join(testAppPath, expoConfigFileName),
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

  it('Should modify AndroidManifest.xml idempotently', async () => {
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const androidManifest = await fs.readFile(androidManifestPath, 'utf8');
    expect(androidManifest).toMatchSnapshot();
  });

  it('Should modify Info.plist', async () => {
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const infoPlist = await fs.readFile(infoPlistPath, 'utf8');
    expect(infoPlist).toMatchSnapshot();
  });

  it('Should modify Info.plist idempotently', async () => {
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);
    await execAsync(`yarn expo prebuild --no-install ${testAppPath}`);

    const infoPlist = await fs.readFile(infoPlistPath, 'utf8');
    expect(infoPlist).toMatchSnapshot();
  });
});
