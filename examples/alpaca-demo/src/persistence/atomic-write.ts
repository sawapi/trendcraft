/**
 * Atomic JSON file writer
 *
 * Writes to a temporary file first, then renames to the target path.
 * This prevents partial/corrupt JSON if the process is interrupted.
 */

import { writeFileSync, renameSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function atomicWriteJson(filePath: string, data: unknown): void {
  mkdirSync(dirname(filePath), { recursive: true });
  const json = JSON.stringify(data, null, 2);
  const tmpPath = `${filePath}.tmp`;
  writeFileSync(tmpPath, json, "utf-8");
  renameSync(tmpPath, filePath);
}
