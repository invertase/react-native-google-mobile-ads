const SPEC_ROOT = './test/specs/';

export const WDIO_SMOKE_SPECS = [
  `${SPEC_ROOT}formats.smoke.a-primary.spec.ts`,
  `${SPEC_ROOT}formats.smoke.b-secondary.spec.ts`,
  `${SPEC_ROOT}formats.smoke.c-tertiary.spec.ts`,
] as const;

export type WdioSmokeSpec = (typeof WDIO_SMOKE_SPECS)[number];

export function selectedWdioSpecs(
  env: NodeJS.ProcessEnv = process.env,
): WdioSmokeSpec[] {
  const requested = env.RNGMA_WDIO_SPEC;
  if (requested == null || requested === '') {
    return [...WDIO_SMOKE_SPECS];
  }
  if (!WDIO_SMOKE_SPECS.includes(requested as WdioSmokeSpec)) {
    throw new Error(
      `RNGMA_WDIO_SPEC must be one exact allowlisted smoke spec; received "${requested}".`,
    );
  }
  return [requested as WdioSmokeSpec];
}
