import { TestDeviceIds } from '../src';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

type EmulatorLiteralLock = Equal<(typeof TestDeviceIds)['EMULATOR'], 'EMULATOR'>;
const emulatorLiteralLock: EmulatorLiteralLock = true;

describe('TestDeviceIds', () => {
  it('exports EMULATOR as the classic-Android convenience string literal', () => {
    expect(TestDeviceIds.EMULATOR).toBe('EMULATOR');
    expect(emulatorLiteralLock).toBe(true);
    expect(Object.keys(TestDeviceIds)).toEqual(['EMULATOR']);
  });
});
