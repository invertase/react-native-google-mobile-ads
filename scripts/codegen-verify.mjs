#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedTrees = [
  'packages/core/android/generated',
  'packages/core/ios/generated',
];

function output(execute, args) {
  return execute('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

export function verifyCodegen(execute = execFileSync) {
  const tracked = output(execute, [
    'ls-files',
    '-z',
    '--',
    ...generatedTrees,
  ])
    .split('\0')
    .filter(Boolean);
  const missingTrees = generatedTrees.filter(
    tree => !tracked.some(file => file.startsWith(`${tree}/`)),
  );
  if (missingTrees.length > 0) {
    throw new Error(
      [
        'Committed Codegen verification requires both generated trees in the git index.',
        `Missing tracked files under: ${missingTrees.join(', ')}`,
        'Stage the complete generated trees, then rerun yarn codegen:verify.',
      ].join('\n'),
    );
  }

  execute(process.execPath, ['./scripts/codegen-package.mjs', 'all'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  execute(
    'git',
    ['diff', '--exit-code', '--', ...generatedTrees],
    { cwd: repoRoot, stdio: 'inherit' },
  );
  const untracked = output(execute, [
    'ls-files',
    '--others',
    '--exclude-standard',
    '-z',
    '--',
    ...generatedTrees,
  ])
    .split('\0')
    .filter(Boolean);
  if (untracked.length > 0) {
    throw new Error(
      `Generated Codegen trees contain untracked files:\n${untracked.join('\n')}`,
    );
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    verifyCodegen();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode =
      typeof error === 'object' &&
      error !== null &&
      'status' in error &&
      typeof error.status === 'number'
        ? error.status
        : 1;
  }
}
