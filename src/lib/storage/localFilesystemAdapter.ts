import { writeFile, unlink, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import type { PhotoStorageProvider, StoredPhoto } from "./PhotoStorageProvider";

// DEVELOPMENT-ONLY ADAPTER. See DECISIONS.md D13:
// - Writes to `public/uploads/evidence/`, served by Next.js as static files.
// - Does NOT survive most production redeploys (ephemeral filesystems).
// - NOT safe for more than one server instance (no shared storage).
// - Does NOT strip EXIF metadata.
// Before any real user uploads a real photo, replace this with an
// S3-compatible adapter (Supabase Storage is a natural fit given the
// project's existing Supabase Postgres instance) implementing the same
// PhotoStorageProvider interface — nothing else in the codebase needs to
// change.

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "evidence");

function sanitizeExtension(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const allowed = [".jpg", ".jpeg", ".png", ".webp"];
  return allowed.includes(ext) ? ext : ".jpg";
}

export class LocalFilesystemPhotoStorage implements PhotoStorageProvider {
  async upload(params: { buffer: Buffer; filename: string; mimeType: string }): Promise<StoredPhoto> {
    await mkdir(UPLOAD_DIR, { recursive: true });

    const ext = sanitizeExtension(params.filename);
    const key = `${randomUUID()}${ext}`;
    const fullPath = path.join(UPLOAD_DIR, key);

    await writeFile(fullPath, params.buffer);

    return {
      storageKey: key,
      url: `/uploads/evidence/${key}`,
    };
  }

  async delete(storageKey: string): Promise<void> {
    const fullPath = path.join(UPLOAD_DIR, storageKey);
    await unlink(fullPath).catch(() => undefined); // graceful failure — file may already be gone
  }
}

export const photoStorage: PhotoStorageProvider = new LocalFilesystemPhotoStorage();
