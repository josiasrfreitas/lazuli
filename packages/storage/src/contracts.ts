/** Provider-independent server-side file operations. Authorization belongs to the caller. */
export type StoredFileReference = { bucket: string; key: string };
export type StoredFile = { bytes: Uint8Array; contentType: string };
export type Storage = {
  put(file: StoredFile & { key: string }): Promise<StoredFileReference>;
  read(file: StoredFileReference): Promise<StoredFile>;
  remove(file: StoredFileReference): Promise<void>;
};
