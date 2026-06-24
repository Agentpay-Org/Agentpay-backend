import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

export interface Store<V> {
  /** Return the value for a key, if present. */
  get(key: string): V | undefined;
  /** Persist a value under a key. */
  set(key: string, value: V): void;
  /** Remove a key and return whether it existed. */
  delete(key: string): boolean;
  /** Iterate every key/value pair in insertion order. */
  entries(): IterableIterator<[string, V]>;
  /** Iterate key/value pairs whose key starts with the supplied prefix. */
  scanByPrefix(prefix: string): IterableIterator<[string, V]>;
  /** Remove all entries. */
  clear(): void;
  /** Flush any buffered state to durable storage. */
  flush(): void;
}

type Flushable = { flush(): void };

const flushables: Flushable[] = [];

export class InMemoryStore<V> implements Store<V> {
  protected readonly data = new Map<string, V>();

  get(key: string) {
    return this.data.get(key);
  }

  set(key: string, value: V) {
    this.data.set(key, value);
  }

  delete(key: string) {
    return this.data.delete(key);
  }

  entries() {
    return this.data.entries();
  }

  *scanByPrefix(prefix: string) {
    for (const [key, value] of this.data.entries()) {
      if (key.startsWith(prefix)) yield [key, value] as [string, V];
    }
  }

  clear() {
    this.data.clear();
  }

  flush() {
    // In-memory stores have nothing to flush.
  }
}

type FilePayload<V> = {
  version: 1;
  entries: [string, V][];
};

const safeStoreName = /^[A-Za-z0-9._-]+$/;

const resolveStorageDir = (rawDir: string) => {
  const base = process.cwd();
  const resolved = path.resolve(base, rawDir);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("STORAGE_PATH must stay inside the project directory");
  }
  return resolved;
};

export class JsonFileStore<V> extends InMemoryStore<V> {
  private dirty = false;
  private readonly filePath: string;
  private readonly dirPath: string;

  constructor(storeName: string, storageDir: string) {
    super();
    if (!safeStoreName.test(storeName)) {
      throw new Error(`invalid store name: ${storeName}`);
    }
    this.dirPath = resolveStorageDir(storageDir);
    this.filePath = path.join(this.dirPath, `${storeName}.json`);
    this.load();
  }

  override set(key: string, value: V) {
    super.set(key, value);
    this.dirty = true;
    this.flush();
  }

  override delete(key: string) {
    const deleted = super.delete(key);
    if (deleted) {
      this.dirty = true;
      this.flush();
    }
    return deleted;
  }

  override clear() {
    super.clear();
    this.dirty = true;
    this.flush();
  }

  override flush() {
    if (!this.dirty) return;
    mkdirSync(this.dirPath, { recursive: true });
    const payload: FilePayload<V> = {
      version: 1,
      entries: Array.from(this.entries()),
    };
    const tempPath = `${this.filePath}.tmp`;
    writeFileSync(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    renameSync(tempPath, this.filePath);
    this.dirty = false;
  }

  private load() {
    if (!existsSync(this.filePath)) return;
    const raw = readFileSync(this.filePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<FilePayload<V>>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) {
      throw new Error(`invalid storage file format: ${this.filePath}`);
    }
    for (const [key, value] of parsed.entries) {
      if (typeof key !== "string") {
        throw new Error(`invalid storage key in ${this.filePath}`);
      }
      this.data.set(key, value);
    }
  }
}

export class StoreMap<V> extends Map<string, V> {
  constructor(private readonly backend: Store<V>) {
    super();
    for (const [key, value] of backend.entries()) {
      super.set(key, value);
    }
  }

  override set(key: string, value: V) {
    super.set(key, value);
    this.backend.set(key, value);
    return this;
  }

  override delete(key: string) {
    const deleted = super.delete(key);
    const backendDeleted = this.backend.delete(key);
    return deleted || backendDeleted;
  }

  override clear() {
    super.clear();
    this.backend.clear();
  }

  scanByPrefix(prefix: string) {
    return this.backend.scanByPrefix(prefix);
  }

  flush() {
    this.backend.flush();
  }
}

export class StoreSet extends Set<string> {
  constructor(private readonly backend: Store<boolean>) {
    super();
    for (const [key, enabled] of backend.entries()) {
      if (enabled) super.add(key);
    }
  }

  override add(value: string) {
    super.add(value);
    this.backend.set(value, true);
    return this;
  }

  override delete(value: string) {
    const deleted = super.delete(value);
    const backendDeleted = this.backend.delete(value);
    return deleted || backendDeleted;
  }

  override clear() {
    super.clear();
    this.backend.clear();
  }

  flush() {
    this.backend.flush();
  }
}

const createBackend = <V>(storeName: string): Store<V> => {
  const driver = (process.env.STORAGE_DRIVER ?? "memory").toLowerCase();
  if (driver === "memory") return new InMemoryStore<V>();
  if (driver === "file") {
    return new JsonFileStore<V>(
      storeName,
      process.env.STORAGE_PATH ?? ".agentpay-store"
    );
  }
  throw new Error("STORAGE_DRIVER must be either memory or file");
};

export const createStoreMap = <V>(storeName: string) => {
  const store = new StoreMap<V>(createBackend<V>(storeName));
  flushables.push(store);
  return store;
};

export const createStoreSet = (storeName: string) => {
  const store = new StoreSet(createBackend<boolean>(storeName));
  flushables.push(store);
  return store;
};

export const flushStores = () => {
  for (const store of flushables) store.flush();
};
