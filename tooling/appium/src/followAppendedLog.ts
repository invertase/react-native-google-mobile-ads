import { closeSync, openSync, readSync, statSync } from 'node:fs';

/**
 * Read complete lines appended to a file after this call starts.
 * A shrink (truncate or replace) resets to the start of the new file.
 * The raw bytes are not written to the parent process.
 */
export function followAppendedLog(
  filePath: string,
  onLine: (line: string) => void,
  options?: { intervalMs?: number },
): () => void {
  let offset = 0;
  let remainder = '';
  let stopped = false;
  try {
    offset = statSync(filePath).size;
  } catch {
    offset = 0;
  }

  const poll = () => {
    if (stopped) {
      return;
    }
    let size: number;
    try {
      size = statSync(filePath).size;
    } catch {
      return;
    }
    if (size < offset) {
      offset = 0;
      remainder = '';
    }
    if (size === offset) {
      return;
    }
    const length = size - offset;
    const buf = Buffer.alloc(length);
    const fd = openSync(filePath, 'r');
    try {
      readSync(fd, buf, 0, length, offset);
    } finally {
      closeSync(fd);
    }
    offset = size;
    const parts = `${remainder}${buf.toString('utf8')}`.split(/\r?\n/);
    remainder = parts.pop() ?? '';
    for (const line of parts) {
      if (line.length > 0) {
        onLine(line);
      }
    }
  };

  const timer = setInterval(poll, options?.intervalMs ?? 50);
  timer.unref?.();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
