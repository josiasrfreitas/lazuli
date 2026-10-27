import { createStorage } from "./storage.js";
import type { Storage } from "./contracts.js";
import { storageConfig } from "./config.js";

let instance: Storage | undefined;

export function getStorage(): Storage {
  instance ??= createStorage(storageConfig());
  return instance;
}
