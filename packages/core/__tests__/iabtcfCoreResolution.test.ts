import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { TCModel, TCString } from '@iabtcf/core';

/**
 * Metro UnableToResolveError for `./gvl/index.js` (GitHub #789) happens when
 * `@iabtcf/core`'s ESM tree is incomplete on disk. Tip packaging is fine when
 * both CJS and MJS `model/gvl/index.js` paths exist; this canary guards that.
 */
describe('@iabtcf/core package resolution', () => {
  const requireFromHere = createRequire(__filename);
  const cjsEntry = requireFromHere.resolve('@iabtcf/core');
  const packageRoot = path.resolve(path.dirname(cjsEntry), '..', '..');

  it('exports TCModel and TCString used by AdsConsent', () => {
    expect(typeof TCModel).toBe('function');
    expect(typeof TCString.decode).toBe('function');
  });

  it('ships model/gvl/index.js on the CJS and MJS trees Metro may load', () => {
    const cjsGvl = path.join(path.dirname(cjsEntry), 'model', 'gvl', 'index.js');
    const mjsGvl = path.join(packageRoot, 'lib', 'mjs', 'model', 'gvl', 'index.js');

    expect(fs.existsSync(cjsGvl)).toBe(true);
    expect(fs.existsSync(mjsGvl)).toBe(true);
  });
});
