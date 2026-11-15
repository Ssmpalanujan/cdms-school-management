const FORMAT = "kalvi-valai-backup";
const VERSION = 1;
const CHECKPOINTS_KEY = "srb-checkpoints";
const EXCLUDED_KEYS = new Set(["srb-user", "srb-users", CHECKPOINTS_KEY]);
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const CHECKPOINT_LIMIT = 10;

function isBackupDataKey(key) {
  return key.startsWith("srb-") && !EXCLUDED_KEYS.has(key);
}

export function collectSchoolData(storage = localStorage) {
  const data = {};
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key || !isBackupDataKey(key)) continue;
    try {
      data[key] = JSON.parse(storage.getItem(key));
    } catch (error) {
      throw new Error(`Could not read saved data for ${key}: ${error.message}`);
    }
  }
  return data;
}

export function createBackup(storage = localStorage) {
  return {
    format: FORMAT,
    version: VERSION,
    createdAt: new Date().toISOString(),
    data: collectSchoolData(storage),
  };
}

export function parseBackup(text) {
  if (new Blob([text]).size > MAX_FILE_BYTES) throw new Error("Backup files must be 20 MB or smaller.");
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
  if (!backup || backup.format !== FORMAT || backup.version !== VERSION || !backup.data || typeof backup.data !== "object" || Array.isArray(backup.data)) {
    throw new Error("This is not a supported கல்வி வலை backup file.");
  }
  const entries = Object.entries(backup.data);
  if (!entries.length) throw new Error("The backup contains no school data.");
  for (const [key, value] of entries) {
    if (!isBackupDataKey(key)) throw new Error(`The backup contains an unsupported data key: ${key}`);
    if (value === undefined) throw new Error(`The backup contains invalid data for ${key}.`);
  }
  return backup;
}

export function readCheckpoints(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(CHECKPOINTS_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    throw new Error(`Could not read saved checkpoints: ${error.message}`);
  }
}

export function createCheckpoint(reason, storage = localStorage) {
  const checkpoint = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reason: String(reason || "Manual checkpoint"),
    createdAt: new Date().toISOString(),
    data: collectSchoolData(storage),
  };
  const next = [checkpoint, ...readCheckpoints(storage)].slice(0, CHECKPOINT_LIMIT);
  try {
    storage.setItem(CHECKPOINTS_KEY, JSON.stringify(next));
  } catch (error) {
    throw new Error(`Could not save a checkpoint. Free browser storage space and try again. ${error.message}`);
  }
  return checkpoint;
}

export function restoreData(data, storage = localStorage) {
  for (const key of Object.keys(data)) {
    if (!isBackupDataKey(key)) throw new Error(`Cannot restore unsupported data key: ${key}`);
  }
  const currentKeys = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key && isBackupDataKey(key)) currentKeys.push(key);
  }
  for (const key of currentKeys) {
    if (!Object.hasOwn(data, key)) storage.removeItem(key);
  }
  try {
    for (const [key, value] of Object.entries(data)) storage.setItem(key, JSON.stringify(value));
  } catch (error) {
    throw new Error(`Could not restore the backup because browser storage is unavailable or full. ${error.message}`);
  }
}

export function downloadBackup(backup = createBackup()) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `kalvi-valai-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
