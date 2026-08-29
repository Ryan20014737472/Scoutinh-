/**
 * Offline-first persistence for the scouting app.
 *
 * The public methods intentionally return promises: IndexedDB is asynchronous,
 * and keeping the same contract for the localStorage fallback avoids an
 * environment-specific API in the rest of the application.
 */
import * as seedData from "../data/seed.js";
import { calculateRecord, normalizeScoutingRecord } from "./scoring.js";

export const DATABASE_NAME = "ftc-scouting-v2";
export const DATABASE_VERSION = 1;
export const STORE_NAME = "state";
export const STATE_KEY = "application";
export const FALLBACK_STORAGE_KEY =
  seedData.STORAGE_KEY || "ftc-scouting:state:v1";

let databasePromise = null;
let memoryState = null;
let storageBackend = "uninitialized";
let operationQueue = Promise.resolve();

const KNOWN_ARRAY_KEYS = [
  "seasonConfigs",
  "events",
  "scouts",
  "teams",
  "matches",
  "matchTeams",
  "scoutingRecords",
  "favorites",
  "watchlist",
  "notes",
  "syncQueue",
];

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Creates a serializable clone without leaking callers a mutable state ref. */
export function cloneState(value) {
  if (value === undefined) return undefined;
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(value);
    } catch {
      // JSON is deliberately the fallback because app state is JSON-safe.
    }
  }
  return JSON.parse(JSON.stringify(value));
}

function createInitialState() {
  if (typeof seedData.createSeedState === "function") {
    return cloneState(seedData.createSeedState());
  }
  if (seedData.DEFAULT_STATE) return cloneState(seedData.DEFAULT_STATE);

  // This only exists to keep storage safe while an embedding app supplies its
  // own seed data. The FTC app ships a richer seed in ../data/seed.js.
  return {
    schemaVersion: 1,
    seasonConfigs: [],
    events: [],
    scouts: [],
    teams: [],
    matches: [],
    scoutingRecords: [],
    favorites: [],
    watchlist: [],
    notes: [],
    syncQueue: [],
    settings: {
      currentScoutId: null,
      ratingWeights: {},
      activeEventId: null,
    },
  };
}

/**
 * Merges an older saved state with the current seed shape without dropping
 * unknown keys. This lets the UI evolve while old offline data remains usable.
 */
export function normalizeState(candidate) {
  const initial = createInitialState();
  if (!isObject(candidate)) return initial;

  const incoming = cloneState(candidate);
  const normalized = { ...initial, ...incoming };

  for (const key of KNOWN_ARRAY_KEYS) {
    const defaultValue = Array.isArray(initial[key]) ? initial[key] : [];
    normalized[key] = Array.isArray(incoming[key])
      ? incoming[key]
      : cloneState(defaultValue);
  }

  // Preserve common nested configuration defaults while honouring stored user
  // choices. These keys may be absent in older saved versions.
  for (const key of ["settings", "ui", "metadata", "meta"]) {
    if (isObject(initial[key]) || isObject(incoming[key])) {
      normalized[key] = {
        ...(isObject(initial[key]) ? initial[key] : {}),
        ...(isObject(incoming[key]) ? incoming[key] : {}),
      };
    }
  }

  if (!isObject(normalized.settings)) {
    normalized.settings = {
      currentScoutId: null,
      ratingWeights: {},
      activeEventId: null,
    };
  }

  normalized.settings = {
    currentScoutId: null,
    ratingWeights: {},
    activeEventId: null,
    ...normalized.settings,
  };

  return normalized;
}

function getLocalStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

function canUseIndexedDb() {
  try {
    return typeof globalThis.indexedDB !== "undefined";
  } catch {
    return false;
  }
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed"));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    transaction.onerror = () => reject(transaction.error || new Error("IndexedDB transaction failed"));
  });
}

function openDatabase() {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error("IndexedDB is unavailable"));
  }

  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    let request;
    try {
      request = globalThis.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(error);
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another tab"));
  });

  // A rejected cached promise would make a temporary browser error permanent.
  databasePromise.catch(() => {
    databasePromise = null;
  });
  return databasePromise;
}

async function readIndexedDb() {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readonly");
  const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
  return requestResult(request);
}

async function writeIndexedDb(state) {
  const database = await openDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put(state, STATE_KEY);
  await transactionComplete(transaction);
}

function readLocalStorage() {
  const local = getLocalStorage();
  if (!local) return undefined;
  try {
    const raw = local.getItem(FALLBACK_STORAGE_KEY);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeLocalStorage(state) {
  const local = getLocalStorage();
  if (!local) return false;
  try {
    local.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

async function persistState(state) {
  const normalized = normalizeState(state);
  const snapshot = cloneState(normalized);

  if (canUseIndexedDb()) {
    try {
      await writeIndexedDb(snapshot);
      storageBackend = "indexeddb";
      memoryState = cloneState(snapshot);
      return cloneState(snapshot);
    } catch {
      // localStorage is intentionally tried below. It is a useful contingency
      // during private browsing or when IndexedDB quota is denied.
    }
  }

  if (writeLocalStorage(snapshot)) {
    storageBackend = "localstorage";
    memoryState = cloneState(snapshot);
    return cloneState(snapshot);
  }

  // Tests, SSR, and very restrictive browser modes still get a safe session
  // store instead of losing an in-progress scouting record.
  storageBackend = "memory";
  memoryState = cloneState(snapshot);
  return cloneState(snapshot);
}

async function readPersistedState() {
  if (canUseIndexedDb()) {
    try {
      const value = await readIndexedDb();
      if (value !== undefined && value !== null) {
        storageBackend = "indexeddb";
        return value;
      }
    } catch {
      // Continue to the local fallback.
    }
  }

  const fallback = readLocalStorage();
  if (fallback !== undefined) {
    storageBackend = "localstorage";
    return fallback;
  }

  if (memoryState) {
    storageBackend = "memory";
    return memoryState;
  }

  return undefined;
}

/** Loads persisted state, creating and persisting the seed on first use. */
export async function getState() {
  const saved = await readPersistedState();
  if (saved !== undefined) {
    const normalized = normalizeState(saved);
    memoryState = cloneState(normalized);
    return cloneState(normalized);
  }

  return persistState(createInitialState());
}

/** Alias used by UI code; getState remains the canonical storage API. */
export const loadState = getState;

function enqueue(operation) {
  const result = operationQueue.then(operation);
  // Keep later writes alive even if a caller handles an earlier failure badly.
  operationQueue = result.catch(() => undefined);
  return result;
}

/** Saves a complete application snapshot. Prefer updateState for small edits. */
export function saveState(nextState) {
  return enqueue(() => persistState(nextState));
}

/** Alias for code that describes persistence rather than storage. */
export const persistStateSnapshot = saveState;

/**
 * Atomically reads, updates, and persists state within this tab.
 * The mutator may mutate its provided draft or return a replacement object.
 */
export function updateState(mutator) {
  return enqueue(async () => {
    const current = await getState();
    const draft = cloneState(current);
    const candidate =
      typeof mutator === "function" ? await mutator(draft) : mutator;
    const next = candidate === undefined ? draft : candidate;
    return persistState(next);
  });
}

/** Restores a fresh, empty scouting workspace. */
export function resetState({ preserveSettings = false } = {}) {
  return enqueue(async () => {
    const fresh = createInitialState();
    if (preserveSettings) {
      const current = await getState();
      fresh.settings = {
        ...(fresh.settings || {}),
        ...(current.settings || {}),
      };
    }
    return persistState(fresh);
  });
}

/** Returns the active persistence layer for an offline/status badge. */
export function getStorageInfo() {
  return {
    backend: storageBackend,
    persistent: storageBackend === "indexeddb" || storageBackend === "localstorage",
    databaseName: DATABASE_NAME,
    fallbackKey: FALLBACK_STORAGE_KEY,
  };
}

function getConfiguredActions(seasonConfig) {
  if (!seasonConfig) return [];
  if (Array.isArray(seasonConfig.actions)) return seasonConfig.actions;
  if (isObject(seasonConfig.actions)) {
    return Object.values(seasonConfig.actions).flatMap((value) =>
      Array.isArray(value) ? value : [],
    );
  }
  if (isObject(seasonConfig.phases)) {
    return Object.values(seasonConfig.phases).flatMap((phase) =>
      Array.isArray(phase?.actions) ? phase.actions : [],
    );
  }
  return [];
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Makes an editable, JSON-safe scouting draft from a season configuration. */
export function createDraft(context = {}, seasonConfig) {
  const now = new Date().toISOString();
  const actions = {};
  // Status is sparse by design. When a scout only changes a counter, scoring
  // infers success from its positive value; an explicit status still overrides
  // that inference for the Success / Failure / Did-not-attempt controls.
  const actionStatus = {};

  for (const action of getConfiguredActions(seasonConfig)) {
    if (!action?.id) continue;
    const type = String(action.inputType || action.type || "counter").toLowerCase();
    if (type === "boolean" || type === "yesno") actions[action.id] = false;
    else if (type === "select" || type === "choice") actions[action.id] = "";
    else actions[action.id] = 0;
  }

  return {
    id: makeId("draft"),
    eventId: context.eventId ?? null,
    matchId: context.matchId ?? null,
    teamId: context.teamId ?? null,
    scoutId: context.scoutId ?? null,
    seasonId: context.seasonId ?? seasonConfig?.id ?? null,
    alliance: context.alliance ?? null,
    position: context.position ?? null,
    actions,
    actionStatus,
    robot: {
      brokeDown: false,
      stalled: false,
      mechanicalIssue: false,
      electricalIssue: false,
      programmingIssue: false,
      connectionIssue: false,
      defense: "none",
      penaltyObserved: false,
      exceptionalPerformance: false,
    },
    notes: "",
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

function clampActionValue(value, action) {
  const type = String(action?.inputType || action?.type || "counter").toLowerCase();
  if (type === "boolean" || type === "yesno") {
    if (typeof value === "string") {
      if (["false", "0", "no", "não"].includes(value.trim().toLowerCase())) return false;
      if (["true", "1", "yes", "sim"].includes(value.trim().toLowerCase())) return true;
    }
    return Boolean(value);
  }
  if (type === "select" || type === "choice") return value ?? null;
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
  const max = Number(action?.max);
  return Number.isFinite(max) && max >= 0 ? Math.min(safe, max) : safe;
}

/** Validates a draft's configured actions without discarding scout notes. */
export function normalizeDraft(draft, seasonConfig) {
  const base = createDraft(draft || {}, seasonConfig);
  const incoming = isObject(draft) ? cloneState(draft) : {};
  const actions = { ...base.actions, ...(isObject(incoming.actions) ? incoming.actions : {}) };
  const actionStatus = {
    ...base.actionStatus,
    ...(isObject(incoming.actionStatus) ? incoming.actionStatus : {}),
  };

  for (const action of getConfiguredActions(seasonConfig)) {
    if (!action?.id) continue;
    actions[action.id] = clampActionValue(actions[action.id], action);
    if (actionStatus[action.id] !== undefined && actionStatus[action.id] !== null && actionStatus[action.id] !== "") {
      const status = String(actionStatus[action.id]).toLowerCase();
      actionStatus[action.id] = ["success", "failure", "not_attempted"].includes(status)
        ? status
        : "not_attempted";
    } else {
      delete actionStatus[action.id];
    }
  }

  return {
    ...base,
    ...incoming,
    actions,
    actionStatus,
    robot: { ...base.robot, ...(isObject(incoming.robot) ? incoming.robot : {}) },
    notes: typeof incoming.notes === "string" ? incoming.notes.trim().slice(0, 2000) : "",
    updatedAt: new Date().toISOString(),
  };
}

function sameScoutingTarget(left, right) {
  return (
    left?.eventId === right?.eventId &&
    left?.matchId === right?.matchId &&
    left?.teamId === right?.teamId
  );
}

/**
 * Calculates and persists a completed record. Duplicate match/team records are
 * rejected by default, preventing two scouts from silently overwriting data.
 */
export async function submitRecord(record, seasonConfig, { replace = false } = {}) {
  const draft = normalizeDraft(record, seasonConfig);
  const missingIdentity = ["eventId", "matchId", "teamId", "scoutId", "seasonId"]
    .filter((key) => draft[key] === null || draft[key] === undefined || String(draft[key]).trim() === "");
  if (missingIdentity.length) {
    const error = new Error(`Registro de scouting incompleto: ${missingIdentity.join(", ")}.`);
    error.code = "INVALID_SCOUTING_RECORD";
    throw error;
  }
  const scored = calculateRecord(draft, seasonConfig);
  const normalizedRecord = normalizeScoutingRecord(draft, seasonConfig);
  let savedRecord;

  await updateState((state) => {
    const records = Array.isArray(state.scoutingRecords) ? state.scoutingRecords : [];
    const targetIndex = records.findIndex((item) => sameScoutingTarget(item, draft));
    if (targetIndex >= 0 && !replace) {
      const error = new Error("Já existe um scouting para este time nesta partida.");
      error.code = "DUPLICATE_SCOUTING_RECORD";
      throw error;
    }

    savedRecord = {
      ...draft,
      ...normalizedRecord,
      score: normalizedRecord.score || {
        auto: scored.auto,
        teleop: scored.teleop,
        endgame: scored.endgame,
        total: scored.total,
      },
      calculatedScore: normalizedRecord.calculatedScore || scored,
      id: draft.id?.startsWith("draft-") ? makeId("record") : draft.id || makeId("record"),
      status: "submitted",
      savedAt: new Date().toISOString(),
    };
    state.scoutingRecords = [...records];
    if (targetIndex >= 0) state.scoutingRecords[targetIndex] = savedRecord;
    else state.scoutingRecords.push(savedRecord);
    return state;
  });

  return cloneState(savedRecord);
}

export default {
  getState,
  loadState,
  saveState,
  updateState,
  resetState,
  getStorageInfo,
  createDraft,
  normalizeDraft,
  submitRecord,
};
