import { createStorage, type Storage } from "./storage.js";
import { storageConfig } from "./config.js";

let instance: Storage | undefined;

export function getStorage(): Storage {
  instance ??= createStorage(storageConfig());
  return instance;
}
