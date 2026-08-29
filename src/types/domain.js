/**
 * Shared, serialisable domain definitions for FTC Scout Arena.
 *
 * This module intentionally does not know about storage or the UI. Keeping the
 * vocabulary and small validation helpers here makes it safe to reuse in
 * services, pages and import/export code without coupling those layers.
 */

export const APP_SCHEMA_VERSION = 1;
export const STORAGE_KEY = "ftc-scout-arena.state.v1";

/** @typedef {"auto"|"teleop"|"endgame"} MatchPhase */
/** @typedef {"counter"|"boolean"|"select"} ActionInputType */
/** @typedef {"not_started"|"in_progress"|"complete"|"incomplete"} MatchStatus */
/** @typedef {"red"|"blue"} Alliance */

export const PHASES = Object.freeze(["auto", "teleop", "endgame"]);
export const PHASE_LABELS = Object.freeze({
  auto: "Autonomous",
  teleop: "TeleOp",
  endgame: "Endgame",
});

export const ALLIANCES = Object.freeze(["red", "blue"]);
export const ALLIANCE_LABELS = Object.freeze({
  red: "Aliança Vermelha",
  blue: "Aliança Azul",
});

export const ALLIANCE_SHORT_LABELS = Object.freeze({ red: "Vermelha", blue: "Azul" });

export const MATCH_STATUSES = Object.freeze([
  "not_started",
  "in_progress",
  "complete",
  "incomplete",
]);

export const MATCH_STATUS_LABELS = Object.freeze({
  not_started: "Não iniciada",
  in_progress: "Em andamento",
  complete: "Completa",
  incomplete: "Incompleta",
});

export const ACTION_INPUT_TYPES = Object.freeze(["counter", "boolean", "select"]);
export const ACTION_INPUT_TYPE_LABELS = Object.freeze({
  counter: "Contador",
  boolean: "Sim / não",
  select: "Seleção",
});

export const RECORD_STATUSES = Object.freeze(["draft", "submitted", "synced"]);
export const RECORD_STATUS_LABELS = Object.freeze({
  draft: "Rascunho",
  submitted: "Salvo localmente",
  synced: "Sincronizado",
});

export const EVENT_TYPES = Object.freeze([
  "Qualifier",
  "League Tournament",
  "Regional",
  "Championship",
  "Practice",
]);

export const WATCHLIST_CATEGORIES = Object.freeze([
  "alliance_pick",
  "high_priority",
  "watch_again",
  "defense",
  "partner",
]);

export const WATCHLIST_CATEGORY_LABELS = Object.freeze({
  alliance_pick: "Possível escolha de aliança",
  high_priority: "Alta prioridade",
  watch_again: "Observar novamente",
  defense: "Defesa",
  partner: "Parceiro interessante",
});

export const DEFENSE_LEVELS = Object.freeze(["none", "medium", "strong"]);
export const DEFENSE_LEVEL_LABELS = Object.freeze({
  none: "Sem defesa",
  medium: "Defesa média",
  strong: "Defesa forte",
});

export const ROBOT_BOOLEAN_FLAGS = Object.freeze([
  "brokeDown",
  "stalled",
  "mechanicalIssue",
  "electricalIssue",
  "programmingIssue",
  "connectionIssue",
  "penaltyObserved",
  "exceptionalPerformance",
]);

export const ROBOT_FLAG_LABELS = Object.freeze({
  brokeDown: "Robô quebrou",
  stalled: "Robô ficou parado",
  mechanicalIssue: "Problema mecânico",
  electricalIssue: "Problema elétrico",
  programmingIssue: "Problema de programação",
  connectionIssue: "Problema de conexão",
  penaltyObserved: "Penalidade observada",
  exceptionalPerformance: "Desempenho excepcional",
});

/**
 * Values are percentage points. Negative categories deduct from the scouting
 * rating, so screens can expose every requested rating lever consistently.
 */
export const DEFAULT_RATING_WEIGHTS = Object.freeze({
  averageScore: 30,
  auto: 16,
  teleop: 21,
  endgame: 14,
  consistency: 8,
  cycles: 7,
  failures: -3,
  penalties: -1,
});

export const RATING_WEIGHT_LABELS = Object.freeze({
  averageScore: "Pontuação média",
  auto: "Autonomous",
  teleop: "TeleOp",
  endgame: "Endgame",
  consistency: "Consistência",
  cycles: "Ciclos",
  failures: "Falhas",
  penalties: "Penalidades",
});

export const DEFAULT_ROBOT_STATE = Object.freeze({
  brokeDown: false,
  stalled: false,
  mechanicalIssue: false,
  electricalIssue: false,
  programmingIssue: false,
  connectionIssue: false,
  defense: "none",
  penaltyObserved: false,
  exceptionalPerformance: false,
});

const JSON_CLONE = (value) => JSON.parse(JSON.stringify(value));

/** Return a JSON-safe copy, suitable for a new editable record. */
export function cloneJson(value) {
  return value === undefined ? undefined : JSON_CLONE(value);
}

/** Guard against NaN, Infinity and values passed through form controls. */
export function toFiniteNumber(value, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** Clamp a numeric value while safely handling bad bounds and invalid input. */
export function clampNumber(value, min = 0, max = Number.POSITIVE_INFINITY) {
  const lower = toFiniteNumber(min, 0);
  const upper = Math.max(lower, toFiniteNumber(max, Number.POSITIVE_INFINITY));
  return Math.min(upper, Math.max(lower, toFiniteNumber(value, lower)));
}

/** Convert a form value to a non-negative integer, optionally bounded. */
export function toNonNegativeInteger(value, max = Number.POSITIVE_INFINITY) {
  return Math.floor(clampNumber(value, 0, max));
}

export function isKnownPhase(value) {
  return PHASES.includes(value);
}

export function isKnownAlliance(value) {
  return ALLIANCES.includes(value);
}

export function isKnownMatchStatus(value) {
  return MATCH_STATUSES.includes(value);
}

export function isKnownActionInputType(value) {
  return ACTION_INPUT_TYPES.includes(value);
}

export function isKnownDefenseLevel(value) {
  return DEFENSE_LEVELS.includes(value);
}

export function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/** Stable, human-readable identifiers are expected by local storage and CSV exports. */
export function isValidId(value) {
  return isNonEmptyString(value) && /^[a-z0-9][a-z0-9:_-]*$/i.test(value.trim());
}

/** Create an editable robot condition payload without leaking shared references. */
export function createRobotState(overrides = {}) {
  const robot = { ...DEFAULT_ROBOT_STATE };
  for (const key of ROBOT_BOOLEAN_FLAGS) {
    if (key in overrides) robot[key] = Boolean(overrides[key]);
  }
  if (isKnownDefenseLevel(overrides.defense)) robot.defense = overrides.defense;
  return robot;
}

/**
 * @param {{ inputType?: ActionInputType, max?: number, options?: Array<{value: string}> }} action
 * @param {unknown} value
 * @returns {number|boolean|string}
 */
export function normalizeActionValue(action, value) {
  const inputType = action?.inputType || "counter";
  if (inputType === "boolean") return Boolean(value);
  if (inputType === "select") {
    const validValues = Array.isArray(action?.options)
      ? action.options.map((option) => option?.value)
      : [];
    return validValues.includes(value) ? value : (validValues[0] ?? "");
  }
  return toNonNegativeInteger(value, toFiniteNumber(action?.max, Number.POSITIVE_INFINITY));
}

/**
 * Returns all configured actions as a flat list. It accepts both the app's
 * grouped form (`actions.auto`) and an imported flat action array.
 */
export function getSeasonActions(seasonConfig) {
  if (Array.isArray(seasonConfig?.actions)) return seasonConfig.actions.slice();
  if (!seasonConfig?.actions || typeof seasonConfig.actions !== "object") return [];
  return PHASES.flatMap((phase) => Array.isArray(seasonConfig.actions[phase])
    ? seasonConfig.actions[phase]
    : []);
}

/** Return a grouped empty action payload generated from the season configuration. */
export function createEmptyActions(seasonConfig) {
  return getSeasonActions(seasonConfig).reduce((values, action) => {
    if (!isValidId(action?.id)) return values;
    values[action.id] = normalizeActionValue(action, undefined);
    return values;
  }, {});
}

/** Find one action by id in either supported season configuration shape. */
export function findSeasonAction(seasonConfig, actionId) {
  return getSeasonActions(seasonConfig).find((action) => action?.id === actionId) ?? null;
}

/**
 * Validate a dynamic season configuration without enforcing a particular FTC
 * game. The result is deliberately presentation-ready for settings forms.
 */
export function validateSeasonConfig(config) {
  const errors = [];
  if (!isValidId(config?.id)) errors.push("A configuração da temporada precisa de um id válido.");
  if (!isNonEmptyString(config?.name)) errors.push("Informe o nome da temporada.");

  const actionIds = new Set();
  const actions = getSeasonActions(config);
  if (actions.length === 0) errors.push("Cadastre ao menos uma ação de scouting.");

  for (const action of actions) {
    const prefix = action?.label || action?.id || "Ação";
    if (!isValidId(action?.id)) errors.push(`${prefix}: id inválido.`);
    else if (actionIds.has(action.id)) errors.push(`${prefix}: id de ação duplicado.`);
    else actionIds.add(action.id);

    if (!isKnownPhase(action?.phase)) errors.push(`${prefix}: fase inválida.`);
    if (!isNonEmptyString(action?.label)) errors.push(`${action?.id || "Ação"}: informe um rótulo.`);
    if (!isKnownActionInputType(action?.inputType)) errors.push(`${prefix}: tipo de entrada inválido.`);
    if (!Number.isFinite(Number(action?.points))) errors.push(`${prefix}: pontuação inválida.`);
    if (action?.inputType === "counter" && (!Number.isFinite(Number(action?.max)) || Number(action.max) < 0)) {
      errors.push(`${prefix}: limite inválido.`);
    }
    if (action?.inputType === "select" && (!Array.isArray(action?.options) || action.options.length === 0)) {
      errors.push(`${prefix}: informe opções de seleção.`);
    }
  }
  return { valid: errors.length === 0, errors };
}

/** Validate the required identity and numeric fields for a scouting record. */
export function validateScoutingRecord(record, seasonConfig) {
  const errors = [];
  for (const key of ["id", "eventId", "matchId", "teamId", "scoutId", "seasonId"]) {
    if (!isValidId(record?.[key])) errors.push(`Registro: ${key} inválido.`);
  }
  if (!record?.actions || typeof record.actions !== "object" || Array.isArray(record.actions)) {
    errors.push("Registro: ações inválidas.");
  }
  const score = record?.score;
  for (const key of ["auto", "teleop", "endgame", "total"]) {
    if (!Number.isFinite(Number(score?.[key])) || Number(score[key]) < 0) {
      errors.push(`Registro: pontuação ${key} inválida.`);
    }
  }
  if (record?.robot && !isKnownDefenseLevel(record.robot.defense)) {
    errors.push("Registro: nível de defesa inválido.");
  }

  if (seasonConfig && record?.actions && typeof record.actions === "object") {
    for (const action of getSeasonActions(seasonConfig)) {
      if (!(action.id in record.actions)) continue;
      const normalized = normalizeActionValue(action, record.actions[action.id]);
      if (normalized !== record.actions[action.id]) {
        errors.push(`Registro: valor inválido para ${action.label || action.id}.`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Thin state shape guard for safely deciding whether persisted local data can be
 * hydrated. It avoids migrations; services remain responsible for migrating
 * older schema versions when needed.
 */
export function isValidAppState(state) {
  if (!state || typeof state !== "object" || Array.isArray(state)) return false;
  if (state.schemaVersion !== APP_SCHEMA_VERSION) return false;
  const collections = [
    "seasonConfigs",
    "events",
    "scouts",
    "teams",
    "matches",
    "scoutingRecords",
    "favorites",
    "watchlist",
    "notes",
  ];
  return collections.every((key) => Array.isArray(state[key]))
    && Boolean(state.settings && typeof state.settings === "object");
}
