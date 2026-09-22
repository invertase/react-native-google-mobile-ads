import { SMOKE_SHARDS, type ShardId } from './sessionShards.ts';

const SPEC_ROOT = './test/specs/';

type FormatsSmokeSpec = `${typeof SPEC_ROOT}formats.smoke.${string}.spec.ts`;

export const WDIO_NEXTGEN_FAIL_FAST_SPEC = `${SPEC_ROOT}nextgen.fail-fast.spec.ts` as const;

export type WdioSmokeSpec = FormatsSmokeSpec | typeof WDIO_NEXTGEN_FAIL_FAST_SPEC;

/** One spec file per derived shard, named by that shard's generated id. */
export function smokeSpecPath(id: ShardId): FormatsSmokeSpec {
  return `${SPEC_ROOT}formats.smoke.${id}.spec.ts`;
}

export const WDIO_SMOKE_SPECS: readonly FormatsSmokeSpec[] = SMOKE_SHARDS.map(shard =>
  smokeSpecPath(shard.id),
);

export function selectedWdioSpecs(
  env: NodeJS.ProcessEnv = process.env,
): WdioSmokeSpec[] {
  const requested = env.RNGMA_WDIO_SPEC;
  if (requested == null || requested === '') {
    return [...WDIO_SMOKE_SPECS];
  }
  if (
    ![...WDIO_SMOKE_SPECS, WDIO_NEXTGEN_FAIL_FAST_SPEC].includes(
      requested as WdioSmokeSpec,
    )
  ) {
    throw new Error(
      `RNGMA_WDIO_SPEC must be one exact allowlisted smoke spec; received "${requested}".`,
    );
  }
  return [requested as WdioSmokeSpec];
}
