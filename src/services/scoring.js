/**
 * Scoring helpers for a configurable FTC season.
 *
 * These functions deliberately do not know about a particular FTC game.  The
 * scouting form is generated from the season configuration, and this module
 * uses that same configuration to validate values and calculate the score.
 */

export const DEFAULT_PHASES = Object.freeze(['auto', 'teleop', 'endgame']);
export const PHASES = DEFAULT_PHASES;

export const ACTION_STATUSES = Object.freeze({
  SUCCESS: 'success',
  FAILURE: 'failure',
  NOT_ATTEMPTED: 'not_attempted',
});

const PHASE_ALIASES = Object.freeze({
  auto: 'auto',
  autonomous: 'auto',
  auton: 'auto',
  teleop: 'teleop',
  tele_op: 'teleop',
  tele: 'teleop',
  driver: 'teleop',
  endgame: 'endgame',
  end_game: 'endgame',
  end: 'endgame',
});

const STATUS_ALIASES = Object.freeze({
  success: ACTION_STATUSES.SUCCESS,
  successful: ACTION_STATUSES.SUCCESS,
  succeeded: ACTION_STATUSES.SUCCESS,
  complete: ACTION_STATUSES.SUCCESS,
  completed: ACTION_STATUSES.SUCCESS,
  yes: ACTION_STATUSES.SUCCESS,
  true: ACTION_STATUSES.SUCCESS,
  falha: ACTION_STATUSES.FAILURE,
  failure: ACTION_STATUSES.FAILURE,
  failed: ACTION_STATUSES.FAILURE,
  fail: ACTION_STATUSES.FAILURE,
  no: ACTION_STATUSES.FAILURE,
  false: ACTION_STATUSES.FAILURE,
  nao_tentou: ACTION_STATUSES.NOT_ATTEMPTED,
  'não_tentou': ACTION_STATUSES.NOT_ATTEMPTED,
  not_attempted: ACTION_STATUSES.NOT_ATTEMPTED,
  notattempted: ACTION_STATUSES.NOT_ATTEMPTED,
  skipped: ACTION_STATUSES.NOT_ATTEMPTED,
  none: ACTION_STATUSES.NOT_ATTEMPTED,
});

const INPUT_TYPE_ALIASES = Object.freeze({
  counter: 'counter',
  count: 'counter',
  number: 'counter',
  numeric: 'counter',
  quantity: 'counter',
  boolean: 'boolean',
  bool: 'boolean',
  toggle: 'boolean',
  binary: 'boolean',
  yesno: 'boolean',
  select: 'select',
  choice: 'select',
  enum: 'select',
  option: 'select',
  status: 'status',
  outcome: 'status',
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asFiniteNumber(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  return fallback;
}

function finiteOrUndefined(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const number = asFiniteNumber(value, Number.NaN);
  return Number.isFinite(number) ? number : undefined;
}

function slug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

/** Converts common phase names to the canonical auto / teleop / endgame keys. */
export function normalizePhase(phase, fallback = 'teleop') {
  const key = slug(phase);
  return PHASE_ALIASES[key] || (DEFAULT_PHASES.includes(key) ? key : fallback);
}

/** Converts form labels and booleans into a consistent action outcome. */
export function normalizeActionStatus(status, fallback = ACTION_STATUSES.SUCCESS) {
  if (status === null || status === undefined || status === '') return fallback;
  if (typeof status === 'boolean') {
    return status ? ACTION_STATUSES.SUCCESS : ACTION_STATUSES.FAILURE;
  }
  const key = slug(status);
  return STATUS_ALIASES[key] || fallback;
}

function normalizeInputType(inputType) {
  return INPUT_TYPE_ALIASES[slug(inputType)] || 'counter';
}

function optionFromEntry(entry, index) {
  if (isPlainObject(entry)) {
    const value = firstDefined(entry.value, entry.id, entry.key, entry.label, index);
    return {
      ...entry,
      id: String(firstDefined(entry.id, value, index)),
      value,
      label: String(firstDefined(entry.label, entry.name, value)),
      points: asFiniteNumber(firstDefined(entry.points, entry.pointValue, entry.score), 0),
    };
  }

  return {
    id: String(entry),
    value: entry,
    label: String(entry),
    points: 0,
  };
}

function normalizeOptions(options) {
  if (Array.isArray(options)) return options.map(optionFromEntry);
  if (!isPlainObject(options)) return [];

  return Object.entries(options).map(([value, entry], index) => {
    if (isPlainObject(entry)) return optionFromEntry({ value, ...entry }, index);
    if (typeof entry === 'number') return optionFromEntry({ value, label: value, points: entry }, index);
    return optionFromEntry({ value, label: entry ?? value }, index);
  });
}

function collectActions(source) {
  if (Array.isArray(source)) return source.map((action, index) => ({ action, index, phase: action?.phase }));
  if (!isPlainObject(source)) return [];

  const grouped = [];
  for (const [key, value] of Object.entries(source)) {
    const phase = normalizePhase(key, null);
    if (Array.isArray(value)) {
      value.forEach((action, index) => grouped.push({ action, index, phase }));
      continue;
    }
    if (isPlainObject(value) && Array.isArray(value.actions)) {
      value.actions.forEach((action, index) => grouped.push({ action, index, phase }));
      continue;
    }
    // A map keyed by action id is also accepted.
    if (isPlainObject(value) && (value.id || value.label || value.inputType || value.type)) {
      grouped.push({ action: { id: key, ...value }, index: grouped.length, phase: value.phase });
    }
  }

  // A flat object keyed by action id has no phase-group keys.
  if (grouped.length === 0) {
    Object.entries(source).forEach(([id, action], index) => {
      if (isPlainObject(action)) grouped.push({ action: { id, ...action }, index, phase: action.phase });
    });
  }
  return grouped;
}

/**
 * Makes an action safe and predictable for rendering and scoring.
 * Accepted input types are counter, boolean, select and status.
 */
export function normalizeActionDefinition(action = {}, index = 0, fallbackPhase = 'teleop') {
  const inputType = normalizeInputType(firstDefined(action.inputType, action.type, action.controlType));
  const phase = normalizePhase(firstDefined(action.phase, fallbackPhase));
  const generatedId = slug(firstDefined(action.label, action.name, `action_${index + 1}`)) || `action_${index + 1}`;
  const rawPoints = firstDefined(action.points, action.pointValue, action.score, action.value);
  const options = normalizeOptions(firstDefined(action.options, action.values, action.choices));
  const min = finiteOrUndefined(firstDefined(action.min, action.minimum, action.minCount));
  const max = finiteOrUndefined(firstDefined(action.max, action.limit, action.maxCount, action.maximum));

  return {
    ...action,
    id: String(firstDefined(action.id, action.actionId, action.key, generatedId)),
    phase,
    label: String(firstDefined(action.label, action.name, action.id, generatedId)),
    inputType,
    // Preserve object maps for rules such as { success: 10, failure: 0 }.
    points: isPlainObject(rawPoints) ? { ...rawPoints } : asFiniteNumber(rawPoints, 0),
    min: min ?? (inputType === 'counter' ? 0 : undefined),
    max,
    options,
    countsTowardCycles: Boolean(firstDefined(action.countsTowardCycles, action.isCycle, false)),
    allowDecimal: Boolean(action.allowDecimal),
    allowNegative: Boolean(action.allowNegative),
    required: Boolean(action.required),
    allowedStatuses: Array.isArray(action.allowedStatuses)
      ? action.allowedStatuses.map((status) => normalizeActionStatus(status))
      : undefined,
  };
}

/**
 * Normalizes several practical season-config shapes into actions grouped by
 * phase.  The returned actionList/actionMap are conveniences for services;
 * the original custom config fields are retained.
 */
export function normalizeSeasonConfig(config = {}) {
  const source = config || {};
  const actionSource = firstDefined(source.actions, source.scoutingActions, source.actionDefinitions, source.phases, {});
  const grouped = { auto: [], teleop: [], endgame: [] };
  const seenIds = new Set();

  collectActions(actionSource).forEach(({ action, index, phase }) => {
    if (!isPlainObject(action)) return;
    const normalized = normalizeActionDefinition(action, index, phase || action.phase || 'teleop');
    // Duplicated IDs make a form ambiguous.  Retain both rules with stable IDs
    // instead of silently losing a field.
    if (seenIds.has(normalized.id)) normalized.id = `${normalized.id}_${index + 1}`;
    seenIds.add(normalized.id);
    grouped[normalized.phase].push(normalized);
  });

  const actionList = DEFAULT_PHASES.flatMap((phase) => grouped[phase]);
  const actionMap = Object.fromEntries(actionList.map((action) => [action.id, action]));

  return {
    ...source,
    id: firstDefined(source.id, source.seasonId, source.key, 'season'),
    name: firstDefined(source.name, source.seasonName, source.gameName, 'Temporada'),
    actions: grouped,
    actionList,
    actionMap,
  };
}

export function getSeasonActions(config = {}, phase) {
  const normalized = normalizeSeasonConfig(config);
  if (phase === undefined || phase === null) return normalized.actionList;
  return normalized.actions[normalizePhase(phase)] || [];
}

function inferStatusFromPrimitive(value, inputType) {
  if (value === null || value === undefined || value === '') return ACTION_STATUSES.NOT_ATTEMPTED;
  // A fresh mobile draft starts boolean fields at false. A real failure is
  // represented by the explicit action-status control, so false alone means
  // “not attempted” rather than silently creating a failure record.
  if (typeof value === 'boolean') return value ? ACTION_STATUSES.SUCCESS : ACTION_STATUSES.NOT_ATTEMPTED;
  if (inputType === 'counter') return asFiniteNumber(value, 0) > 0 ? ACTION_STATUSES.SUCCESS : ACTION_STATUSES.NOT_ATTEMPTED;
  return ACTION_STATUSES.SUCCESS;
}

/**
 * Turns a primitive or `{ value, status }` form value into one canonical
 * representation without discarding the original input.
 */
export function normalizeActionValue(rawValue, action = {}) {
  const normalizedAction = normalizeActionDefinition(action);
  let value = rawValue;
  let explicitStatus;
  let attempted;

  if (isPlainObject(rawValue)) {
    value = firstDefined(
      rawValue.value,
      rawValue.count,
      rawValue.quantity,
      rawValue.amount,
      rawValue.selected,
      rawValue.option,
      rawValue.choice,
    );
    explicitStatus = firstDefined(rawValue.status, rawValue.outcome, rawValue.result);
    attempted = rawValue.attempted;
    if (value === undefined && hasOwn(rawValue, 'success')) value = rawValue.success;
    if (explicitStatus === undefined && hasOwn(rawValue, 'success')) explicitStatus = rawValue.success;
  }

  if (normalizedAction.inputType === 'counter') {
    const parsed = finiteOrUndefined(value);
    value = parsed === undefined ? value : parsed;
  } else if (normalizedAction.inputType === 'boolean') {
    if (typeof value === 'string') {
      const status = normalizeActionStatus(value, null);
      if (status) value = status === ACTION_STATUSES.SUCCESS;
    }
    if (value === 1 || value === '1') value = true;
    if (value === 0 || value === '0') value = false;
  }

  const status = attempted === false
    ? ACTION_STATUSES.NOT_ATTEMPTED
    : normalizeActionStatus(explicitStatus, inferStatusFromPrimitive(value, normalizedAction.inputType));

  return {
    raw: rawValue,
    value,
    quantity: normalizedAction.inputType === 'counter' && Number.isFinite(value) ? value : undefined,
    status,
    attempted: status !== ACTION_STATUSES.NOT_ATTEMPTED,
  };
}

function optionMatches(option, value) {
  return [option.value, option.id, option.label].some((candidate) => String(candidate) === String(value));
}

function getActionStatusPoints(action, status) {
  const map = firstDefined(
    action.statusPoints,
    action.pointsByStatus,
    action.scoreByStatus,
    isPlainObject(action.points) ? action.points : undefined,
  );
  if (!isPlainObject(map)) return undefined;

  const matchingEntry = Object.entries(map).find(([key]) => normalizeActionStatus(key, key) === status);
  return matchingEntry ? asFiniteNumber(matchingEntry[1], undefined) : undefined;
}

function pointsPerUnit(action) {
  return asFiniteNumber(
    firstDefined(
      typeof action.points === 'number' ? action.points : undefined,
      action.pointValue,
      action.pointsPerUnit,
      action.score,
    ),
    0,
  );
}

/** Returns a detailed validation result instead of throwing on bad scout input. */
export function validateActionValue(action, rawValue) {
  const normalizedAction = normalizeActionDefinition(action);
  const normalized = normalizeActionValue(rawValue, normalizedAction);
  const errors = [];
  const { value, status } = normalized;

  if (normalizedAction.allowedStatuses && !normalizedAction.allowedStatuses.includes(status)) {
    errors.push(`Status inválido para ${normalizedAction.label}.`);
  }

  if (normalizedAction.inputType === 'counter') {
    if (value === null || value === undefined || value === '') {
      if (normalizedAction.required) errors.push(`${normalizedAction.label} é obrigatório.`);
    } else if (!Number.isFinite(value)) {
      errors.push(`${normalizedAction.label} precisa ser um número válido.`);
    } else {
      if (!normalizedAction.allowNegative && value < 0) errors.push(`${normalizedAction.label} não pode ser negativo.`);
      if (!normalizedAction.allowDecimal && !Number.isInteger(value)) errors.push(`${normalizedAction.label} precisa ser um número inteiro.`);
      if (normalizedAction.min !== undefined && value < normalizedAction.min) errors.push(`${normalizedAction.label} é menor que o mínimo permitido.`);
      if (normalizedAction.max !== undefined && value > normalizedAction.max) errors.push(`${normalizedAction.label} excede o limite de ${normalizedAction.max}.`);
    }
  }

  if (normalizedAction.inputType === 'boolean' && value !== undefined && value !== null && typeof value !== 'boolean') {
    errors.push(`${normalizedAction.label} precisa ser sim ou não.`);
  }

  if (normalizedAction.inputType === 'select' && normalized.attempted) {
    if (value === undefined || value === null || value === '') {
      if (normalizedAction.required) errors.push(`${normalizedAction.label} é obrigatório.`);
    } else if (normalizedAction.options.length > 0 && !normalizedAction.options.some((option) => optionMatches(option, value))) {
      errors.push(`${normalizedAction.label} tem uma opção inválida.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    action: normalizedAction,
    normalizedValue: normalized,
  };
}

/** True/false convenience wrapper for form components. */
export function isActionValueValid(action, rawValue) {
  return validateActionValue(action, rawValue).valid;
}

/** Calculates one action and retains validation details for a confirmation UI. */
export function calculateActionScore(action, rawValue) {
  const validation = validateActionValue(action, rawValue);
  const { action: normalizedAction, normalizedValue, valid, errors } = validation;
  const { value, status } = normalizedValue;
  let points = 0;
  let selectedOption;

  if (valid && status !== ACTION_STATUSES.NOT_ATTEMPTED) {
    const statusPoints = getActionStatusPoints(normalizedAction, status);

    if (normalizedAction.inputType === 'select') {
      selectedOption = normalizedAction.options.find((option) => optionMatches(option, value));
      if (status === ACTION_STATUSES.SUCCESS && selectedOption) points = selectedOption.points;
      else if (statusPoints !== undefined) points = statusPoints;
    } else if (normalizedAction.inputType === 'counter') {
      if (status === ACTION_STATUSES.SUCCESS) points = asFiniteNumber(value, 0) * pointsPerUnit(normalizedAction);
      else if (statusPoints !== undefined) points = statusPoints;
    } else if (normalizedAction.inputType === 'boolean') {
      // In the mobile flow, the status buttons are the source of truth and a
      // draft may retain its initial `false` value after “Sucesso” is tapped.
      if (status === ACTION_STATUSES.SUCCESS) points = statusPoints ?? pointsPerUnit(normalizedAction);
      else if (statusPoints !== undefined) points = statusPoints;
    } else if (normalizedAction.inputType === 'status') {
      points = statusPoints ?? (status === ACTION_STATUSES.SUCCESS ? pointsPerUnit(normalizedAction) : 0);
    }
  }

  // A season can intentionally configure a negative deduction, but an invalid
  // numeric input must never leak NaN into a saved record.
  points = Number.isFinite(points) ? points : 0;

  return {
    id: normalizedAction.id,
    phase: normalizedAction.phase,
    label: normalizedAction.label,
    inputType: normalizedAction.inputType,
    status,
    value,
    quantity: normalizedValue.quantity,
    option: selectedOption,
    points,
    valid,
    errors,
    normalizedValue,
  };
}

function isActionDefinition(value) {
  return isPlainObject(value) && Boolean(value.id || value.label || value.inputType || value.type);
}

function flattenActionValues(value) {
  if (Array.isArray(value)) {
    return Object.fromEntries(value
      .filter((entry) => isPlainObject(entry))
      .map((entry) => [String(firstDefined(entry.actionId, entry.id, entry.key)), firstDefined(entry.value, entry)]));
  }
  if (!isPlainObject(value)) return {};

  const flattened = {};
  for (const [key, entry] of Object.entries(value)) {
    const phase = normalizePhase(key, null);
    if (phase && isPlainObject(entry)) {
      Object.assign(flattened, flattenActionValues(entry));
    } else {
      flattened[key] = entry;
    }
  }
  return flattened;
}

function actionValueFor(action, values) {
  if (!isPlainObject(values)) return undefined;
  if (hasOwn(values, action.id)) return values[action.id];
  const matchingKey = Object.keys(values).find((key) => slug(key) === slug(action.id));
  return matchingKey ? values[matchingKey] : undefined;
}

function phaseArguments(phaseOrActions, values, config) {
  if (typeof phaseOrActions === 'string') {
    const normalizedConfig = normalizeSeasonConfig(config);
    const phase = normalizePhase(phaseOrActions);
    return { phase, actions: normalizedConfig.actions[phase], values: flattenActionValues(values) };
  }

  if (Array.isArray(phaseOrActions)) {
    const actions = phaseOrActions.map((action, index) => normalizeActionDefinition(action, index));
    return { phase: actions[0]?.phase || 'teleop', actions, values: flattenActionValues(values) };
  }

  if (isPlainObject(phaseOrActions) && Array.isArray(phaseOrActions.actions)) {
    const phase = normalizePhase(phaseOrActions.phase, 'teleop');
    return {
      phase,
      actions: phaseOrActions.actions.map((action, index) => normalizeActionDefinition(action, index, phase)),
      values: flattenActionValues(values),
    };
  }

  const normalizedConfig = normalizeSeasonConfig(config || phaseOrActions || {});
  return { phase: 'teleop', actions: normalizedConfig.actions.teleop, values: flattenActionValues(values) };
}

/**
 * Scores a single phase. It accepts either `(phase, values, seasonConfig)` or
 * `(actions, values)` so UI components can work with a single action group.
 */
export function calculatePhaseScore(phaseOrActions, values = {}, config = {}) {
  const { phase, actions, values: actionValues } = phaseArguments(phaseOrActions, values, config);
  const actionScores = actions.map((action) => calculateActionScore(action, actionValueFor(action, actionValues)));
  const total = actionScores.reduce((sum, action) => sum + action.points, 0);
  const errors = actionScores.flatMap((action) => action.errors.map((message) => ({ actionId: action.id, message })));

  return {
    phase,
    total: Number.isFinite(total) ? total : 0,
    points: Number.isFinite(total) ? total : 0,
    actionScores,
    actions: actionScores,
    valid: errors.length === 0,
    errors,
  };
}

function recordActions(record) {
  const actions = flattenActionValues(firstDefined(record?.actions, record?.scoutingActions, record?.actionValues, {}));
  const statuses = flattenActionValues(firstDefined(record?.actionStatus, record?.actionStatuses, record?.statuses, {}));

  // The live scouting draft keeps values and outcome buttons in separate maps
  // for faster touch interaction. Combine them here so both draft and saved
  // record shapes use the exact same scoring path.
  for (const [actionId, status] of Object.entries(statuses)) {
    if (isPlainObject(actions[actionId])) {
      actions[actionId] = { ...actions[actionId], status: firstDefined(actions[actionId].status, status) };
    } else {
      actions[actionId] = { value: actions[actionId], status };
    }
  }
  return actions;
}

/**
 * Calculates all phase totals from a scouting record or a raw action-value
 * object. Existing record scores are intentionally ignored: this is the
 * authoritative recalculation used before save/export.
 */
export function calculateScoutingScore(recordOrActions = {}, config = {}) {
  const normalizedConfig = normalizeSeasonConfig(config);
  const values = recordActions(
    isPlainObject(recordOrActions) && (recordOrActions.actions || recordOrActions.scoutingActions || recordOrActions.actionValues)
      ? recordOrActions
      : { actions: recordOrActions },
  );
  const phases = Object.fromEntries(
    DEFAULT_PHASES.map((phase) => [phase, calculatePhaseScore(phase, values, normalizedConfig)]),
  );
  const auto = phases.auto.total;
  const teleop = phases.teleop.total;
  const endgame = phases.endgame.total;
  const total = auto + teleop + endgame;
  const actionScores = DEFAULT_PHASES.flatMap((phase) => phases[phase].actionScores);
  const errors = DEFAULT_PHASES.flatMap((phase) => phases[phase].errors.map((error) => ({ phase, ...error })));
  const quantityFor = (actionScore) => (
    actionScore.inputType === 'counter'
      ? Math.max(0, asFiniteNumber(actionScore.quantity, 0))
      : actionScore.status === ACTION_STATUSES.SUCCESS ? 1 : 0
  );
  const cycles = actionScores
    .filter((actionScore) => normalizedConfig.actionMap[actionScore.id]?.countsTowardCycles)
    .reduce((sum, actionScore) => sum + quantityFor(actionScore), 0);
  const failures = actionScores
    .filter((actionScore) => normalizedConfig.actionMap[actionScore.id]?.countsAsFailure)
    .reduce((sum, actionScore) => sum + quantityFor(actionScore), 0);

  return {
    auto,
    autonomous: auto,
    teleop,
    endgame,
    total: Number.isFinite(total) ? total : 0,
    cycles,
    failures,
    phases,
    phaseScores: { auto, teleop, endgame },
    actionScores,
    valid: errors.length === 0,
    errors,
  };
}

/** Backwards-friendly short name used by the data service. */
export const calculateRecord = calculateScoutingScore;

function serializableActionValue(normalized) {
  const shouldKeepStatus = isPlainObject(normalized.raw)
    || normalized.status !== ACTION_STATUSES.SUCCESS
    || normalized.value === undefined;
  if (!shouldKeepStatus) return normalized.value;
  return {
    value: normalized.value,
    status: normalized.status,
    attempted: normalized.attempted,
  };
}

/**
 * Produces a safe record ready for local persistence. It preserves unknown
 * fields (notes, robot observations, IDs) and attaches a fresh score plus a
 * validation result. Invalid values are retained for correction but never
 * produce a NaN or negative counter score.
 */
export function normalizeScoutingRecord(record = {}, config = {}) {
  const normalizedConfig = normalizeSeasonConfig(config);
  const inputActions = recordActions(record);
  const actions = { ...inputActions };
  const normalizedActions = {};

  normalizedConfig.actionList.forEach((action) => {
    const raw = actionValueFor(action, inputActions);
    const normalized = normalizeActionValue(raw, action);
    normalizedActions[action.id] = normalized;
    if (raw !== undefined) actions[action.id] = serializableActionValue(normalized);
  });

  const calculation = calculateScoutingScore({ actions }, normalizedConfig);
  const id = firstDefined(record.id, record.recordId, record.scoutingId);

  return {
    ...record,
    ...(id !== undefined ? { id } : {}),
    eventId: firstDefined(record.eventId, record.event?.id),
    matchId: firstDefined(record.matchId, record.match?.id),
    teamId: firstDefined(record.teamId, record.team?.id, record.team?.number),
    scoutId: firstDefined(record.scoutId, record.scout?.id),
    seasonId: firstDefined(record.seasonId, normalizedConfig.id),
    actions,
    normalizedActions,
    score: {
      auto: calculation.auto,
      teleop: calculation.teleop,
      endgame: calculation.endgame,
      total: calculation.total,
    },
    cycles: calculation.cycles,
    failures: calculation.failures,
    calculatedScore: calculation,
    validation: { valid: calculation.valid, errors: calculation.errors },
    updatedAt: firstDefined(record.updatedAt, record.timestamp, new Date().toISOString()),
  };
}

/** Alias for callers that use the shorter record-normalization name. */
export const normalizeRecord = normalizeScoutingRecord;

export default {
  DEFAULT_PHASES,
  PHASES,
  ACTION_STATUSES,
  normalizePhase,
  normalizeActionStatus,
  normalizeActionDefinition,
  normalizeSeasonConfig,
  getSeasonActions,
  normalizeActionValue,
  validateActionValue,
  isActionValueValid,
  calculateActionScore,
  calculatePhaseScore,
  calculateScoutingScore,
  calculateRecord,
  normalizeScoutingRecord,
  normalizeRecord,
};
