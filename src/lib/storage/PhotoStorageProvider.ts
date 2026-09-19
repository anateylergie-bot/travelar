// Spec Section 152: external service dependency pattern — interface first,
// local adapter for dev, config-driven selection, graceful failure,
// documented gap. See DECISIONS.md D13 for what's NOT done yet (EXIF
// stripping, durable/multi-instance storage).

export interface StoredPhoto {
  storageKey: string;
  url: string;
}

export interface PhotoStorageProvider {
  upload(params: { buffer: Buffer; filename: string; mimeType: string }): Promise<StoredPhoto>;
  delete(storageKey: string): Promise<void>;
}
