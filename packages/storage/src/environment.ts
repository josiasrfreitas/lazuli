import { readStorageEnvironment } from "./env.js";
import { createStorage, type Storage } from "./storage.js";

let instance: Storage | undefined;

export function getStorage(): Storage {
  instance ??= createStorage(readStorageEnvironment());
  return instance;
}
