import * as path from 'path';
import { promises as fs } from 'fs';

// Where uploaded files live on disk. Set UPLOAD_DIR in .env to put them
// somewhere else (e.g. a bigger / backed-up disk on the server). Default is
// an "uploads" folder next to package.json — git-ignored, and outside
// public/, so files are never served without a login check.
//
// NOTE: the database backup (pg_dump) does NOT include these files.
// Back this folder up as well.
export function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'));
}

// One folder per job: <root>/jobs/<leadId>/
export function jobUploadDir(leadId: string): string {
  return path.join(uploadRoot(), 'jobs', leadId);
}

// Delete a job's whole folder (job deleted). Never throws — a missing
// folder just means the job had no files.
export async function removeJobUploads(leadId: string): Promise<void> {
  await fs.rm(jobUploadDir(leadId), { recursive: true, force: true }).catch(() => undefined);
}
