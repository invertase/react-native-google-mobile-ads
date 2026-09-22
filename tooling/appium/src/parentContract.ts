export const PARALLEL_PARENT_CONTRACT = 'rngma-parallel-v1';

export function isParallelParentChild(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.RNGMA_E2E_PARENT_CONTRACT === PARALLEL_PARENT_CONTRACT &&
    env.RNGMA_E2E_CODEGEN_DONE === '1'
  );
}
