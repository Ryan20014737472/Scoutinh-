/**
 * Analytics helpers for FTC scouting records.
 *
 * The module accepts the compact local record shape used by the app as well as
 * common imported shapes (`scores`, `autoScore`, nested action values, etc.).
 * It is intentionally dependency-free so it can run in the browser while the
 * event is offline.
 */

import {
  DEFAULT_PHASES,
  calculateScoutingScore,
  normalizeActionValue,
  normalizePhase,
  normalizeSeasonConfig,
} from './scoring.js';
import { DEFAULT_RATING_WEIGHTS as DOMAIN_DEFAULT_RATING_WEIGHTS } from '../types/domain.js';

export const DEFAULT_RATING_WEIGHTS = Object.freeze({
  averageScore: 30,
  auto: 16,
  teleop: 21,
  endgame: 14,
  consistency: 8,
  cycles: 7,
  failures: -3,
  penalties: -1,
  ...(DOMAIN_DEFAULT_RATING_WEIGHTS || {}),
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const asArray = (value) => (Array.isArray(value) ? value : []);
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function finiteOrUndefined(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function safeNumber(value, fallback = 0) {
  const number = finiteOrUndefined(value);
  return number === undefined ? fallback : number;
}

function round(value, places = 1) {
  const number = safeNumber(value, 0);
  const factor = 10 ** places;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, safeNumber(value, min)));
}

function normalizeKey(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function idsEqual(left, right) {
  if (left === undefined || left === null || right === undefined || right === null) return false;
  return String(left) === String(right);
}

function objectId(value) {
  if (!isObject(value)) return value;
  return firstDefined(value.id, value.teamId, value.number, value.teamNumber);
}

function recordTeamId(record) {
  return objectId(firstDefined(record?.teamId, record?.team, record?.teamNumber, record?.number));
}

function recordEventId(record) {
  return objectId(firstDefined(record?.eventId, record?.event));
}

function recordMatchId(record) {
  return objectId(firstDefined(record?.matchId, record?.match));
}

function recordScoutId(record) {
  return objectId(firstDefined(record?.scoutId, record?.scout, record?.userId));
}

function phaseScoreCandidates(record, phase) {
  const score = firstDefined(record?.score, record?.scores, record?.calculatedScore, record?.result, {});
  const aliases = phase === 'auto'
    ? ['auto', 'autonomous']
    : phase === 'teleop'
      ? ['teleop', 'teleOp', 'driver']
      : ['endgame', 'endGame', 'end'];
  const directAliases = phase === 'auto'
    ? ['autoScore', 'autonomousScore', 'autoPoints']
    : phase === 'teleop'
      ? ['teleopScore', 'teleOpScore', 'teleopPoints']
      : ['endgameScore', 'endGameScore', 'endgamePoints'];
  return [
    ...aliases.map((key) => score?.[key]),
    ...aliases.map((key) => record?.[key]),
    ...directAliases.map((key) => record?.[key]),
  ];
}

function totalScoreCandidates(record) {
  const score = firstDefined(record?.score, record?.scores, record?.calculatedScore, record?.result, {});
  return [
    score?.total,
    score?.estimatedTotal,
    score?.totalScore,
    record?.total,
    record?.totalScore,
    record?.estimatedTotal,
    record?.points,
  ];
}

function hasConfiguredActions(seasonConfig) {
  return Boolean(seasonConfig?.actionList?.length || normalizeSeasonConfig(seasonConfig).actionList.length);
}

function calculatedRecordScore(record, seasonConfig) {
  if (!hasConfiguredActions(seasonConfig)) return null;
  return calculateScoutingScore(record, seasonConfig);
}

/**
 * Gets a finite score for a phase or the total. Saved scores take precedence;
 * when a legacy/imported record lacks them, configured actions are calculated.
 */
export function getRecordScore(record, phase = 'total', seasonConfig) {
  const canonicalPhase = phase === 'total' ? 'total' : normalizePhase(phase);
  const candidates = canonicalPhase === 'total'
    ? totalScoreCandidates(record)
    : phaseScoreCandidates(record, canonicalPhase);
  const explicit = candidates.map((candidate) => finiteOrUndefined(candidate)).find((value) => value !== undefined);
  if (explicit !== undefined) return explicit;

  const calculated = calculatedRecordScore(record, seasonConfig);
  if (calculated) return canonicalPhase === 'total' ? calculated.total : calculated[canonicalPhase];

  if (canonicalPhase === 'total') {
    return DEFAULT_PHASES.reduce((sum, currentPhase) => sum + getRecordScore(record, currentPhase, seasonConfig), 0);
  }
  return 0;
}

/** Compact score payload for summaries, exports, and chart adapters. */
export function getPhaseTotals(record = {}, seasonConfig) {
  const auto = getRecordScore(record, 'auto', seasonConfig);
  const teleop = getRecordScore(record, 'teleop', seasonConfig);
  const endgame = getRecordScore(record, 'endgame', seasonConfig);
  const explicitTotal = totalScoreCandidates(record)
    .map((value) => finiteOrUndefined(value))
    .find((value) => value !== undefined);
  const total = explicitTotal ?? (auto + teleop + endgame);
  return {
    auto,
    autonomous: auto,
    teleop,
    endgame,
    total,
    cycles: getRecordCycles(record, seasonConfig),
  };
}

function flattenedActionValues(record) {
  const source = firstDefined(record?.actions, record?.scoutingActions, record?.actionValues, {});
  const statuses = firstDefined(record?.actionStatus, record?.actionStatuses, record?.statuses, {});
  const result = {};

  function visit(value) {
    if (!isObject(value)) return;
    for (const [key, entry] of Object.entries(value)) {
      const phase = normalizePhase(key, null);
      if (phase && isObject(entry) && !('value' in entry) && !('status' in entry) && !('count' in entry)) visit(entry);
      else result[key] = entry;
    }
  }
  visit(source);

  if (isObject(statuses)) {
    for (const [id, status] of Object.entries(statuses)) {
      if (isObject(result[id])) result[id] = { ...result[id], status: firstDefined(result[id].status, status) };
      else result[id] = { value: result[id], status };
    }
  }
  return result;
}

function rawActionValue(record, actionId) {
  const values = flattenedActionValues(record);
  if (hasOwn(values, actionId)) return values[actionId];
  const matchingKey = Object.keys(values).find((key) => normalizeKey(key) === normalizeKey(actionId));
  return matchingKey ? values[matchingKey] : undefined;
}

/** Calculates configured cycle actions, falling back to an explicit cycle field. */
export function getRecordCycles(record, seasonConfig) {
  const explicit = [
    record?.cycles,
    record?.cycleCount,
    record?.stats?.cycles,
    record?.score?.cycles,
    record?.scores?.cycles,
  ].map((value) => finiteOrUndefined(value)).find((value) => value !== undefined);
  if (explicit !== undefined) return Math.max(0, explicit);

  const config = normalizeSeasonConfig(seasonConfig);
  if (!config.actionList.length) return 0;
  return config.actionList
    .filter((action) => action.countsTowardCycles)
    .reduce((total, action) => {
      const value = normalizeActionValue(rawActionValue(record, action.id), action);
      if (!value.attempted || value.status !== 'success') return total;
      if (action.inputType === 'counter') return total + Math.max(0, safeNumber(value.value, 0));
      return total + 1;
    }, 0);
}

function booleanOrCount(value) {
  const number = finiteOrUndefined(value);
  if (number !== undefined) return Math.max(0, number);
  return value ? 1 : 0;
}

function firstFlag(candidates) {
  const found = candidates.find((value) => value !== undefined && value !== null);
  return found === undefined ? 0 : booleanOrCount(found);
}

function explicitFailureCount(record) {
  const raw = firstDefined(record?.failures, record?.failureCount, record?.stats?.failures);
  if (isObject(raw)) {
    return [raw.actionAttempts, raw.actionFailures, raw.count, raw.total]
      .map((value) => finiteOrUndefined(value))
      .find((value) => value !== undefined);
  }
  return finiteOrUndefined(raw);
}

function configuredFailureCount(record, seasonConfig) {
  const config = normalizeSeasonConfig(seasonConfig);
  return config.actionList
    .filter((action) => action.countsAsFailure || action.isFailureMetric || action.metric === 'failure')
    .reduce((total, action) => {
      const value = normalizeActionValue(rawActionValue(record, action.id), action);
      if (!value.attempted) return total;
      if (action.inputType === 'counter') return total + Math.max(0, safeNumber(value.value, 0));
      if (action.inputType === 'boolean') return total + (value.value === true ? 1 : 0);
      return total + (value.status === 'success' ? 1 : 0);
    }, 0);
}

/**
 * Extracts robot reliability issues plus failed-attempt counters. A saved
 * numeric `record.failures` wins over recalculating configured failure actions,
 * so imported/seed records are never counted twice.
 */
export function getRecordFailures(record, seasonConfig) {
  const robot = firstDefined(record?.robot, record?.robotState, record?.conditions, {});
  const issues = firstDefined(record?.issues, robot?.issues, {});
  const issueArray = Array.isArray(issues) ? issues.map(normalizeKey) : [];
  const fromArray = (...names) => issueArray.some((entry) => names.some((name) => entry.includes(name))) ? 1 : undefined;
  const mechanical = firstFlag([
    robot?.mechanicalIssue, robot?.mechanical, record?.mechanicalIssue, record?.mechanical,
    issues?.mechanicalIssue, issues?.mechanical, fromArray('mechanical', 'mecanico'),
  ]);
  const electrical = firstFlag([
    robot?.electricalIssue, robot?.electrical, record?.electricalIssue, record?.electrical,
    issues?.electricalIssue, issues?.electrical, fromArray('electrical', 'eletrico'),
  ]);
  const programming = firstFlag([
    robot?.programmingIssue, robot?.softwareIssue, robot?.programming, record?.programmingIssue,
    record?.softwareIssue, issues?.programmingIssue, issues?.softwareIssue, fromArray('programming', 'software'),
  ]);
  const connection = firstFlag([
    robot?.connectionIssue, robot?.connection, record?.connectionIssue, record?.connection,
    issues?.connectionIssue, issues?.connection, fromArray('connection', 'conexao'),
  ]);
  const brokeDown = firstFlag([
    robot?.brokeDown, robot?.broken, record?.brokeDown, record?.broken, fromArray('broke', 'broken', 'quebrou'),
  ]);
  const stalled = firstFlag([
    robot?.stalled, robot?.stopped, record?.stalled, record?.stopped, fromArray('stalled', 'stopped', 'parado'),
  ]);

  const recordedFailures = explicitFailureCount(record);
  const actionFailures = Math.max(0, recordedFailures ?? configuredFailureCount(record, seasonConfig));
  return {
    mechanical,
    electrical,
    programming,
    connection,
    brokeDown,
    stalled,
    actionAttempts: actionFailures,
    actionFailures,
    total: mechanical + electrical + programming + connection + brokeDown + stalled + actionFailures,
  };
}

/** Extracts a non-negative penalty count from a scouting record. */
export function getRecordPenalties(record) {
  const robot = firstDefined(record?.robot, record?.robotState, {});
  const candidate = firstDefined(
    record?.penalties,
    record?.penaltyCount,
    record?.penaltyObserved,
    record?.penalty,
    robot?.penalties,
    robot?.penaltyCount,
    robot?.penaltyObserved,
    robot?.penalty,
  );
  return Math.max(0, booleanOrCount(candidate));
}

const DEFENSE_SCORES = Object.freeze({ none: 0, medium: 2, strong: 3 });

/** Normalizes English/Portuguese defense labels and numeric forms. */
export function getRecordDefense(record) {
  const robot = firstDefined(record?.robot, record?.robotState, record?.conditions, {});
  const raw = firstDefined(record?.defense, record?.defenseLevel, robot?.defense, robot?.defenseLevel, 'none');
  const numeric = finiteOrUndefined(raw);
  if (numeric !== undefined) {
    const score = clamp(numeric, 0, 3);
    return { level: score >= 2.5 ? 'strong' : score >= 1 ? 'medium' : 'none', score };
  }
  const key = normalizeKey(raw);
  const level = key.includes('strong') || key.includes('forte')
    ? 'strong'
    : key.includes('medium') || key.includes('media')
      ? 'medium'
      : 'none';
  return { level, score: DEFENSE_SCORES[level] };
}

function explicitPhaseSuccess(record, phase) {
  const phaseAliases = phase === 'auto' ? ['auto', 'autonomous'] : [phase];
  const candidates = [
    ...phaseAliases.flatMap((key) => [record?.[`${key}Success`], record?.[`${key}Succeeded`]]),
    ...phaseAliases.map((key) => record?.success?.[key]),
    ...phaseAliases.map((key) => record?.phaseSuccess?.[key]),
    ...phaseAliases.map((key) => record?.phaseStatus?.[key]),
  ];
  const value = candidates.find((candidate) => candidate !== undefined && candidate !== null);
  if (value === undefined) return null;
  if (typeof value === 'string') {
    const key = normalizeKey(value);
    if (['success', 'successful', 'completed', 'yes', 'true'].includes(key)) return true;
    if (['failure', 'failed', 'no', 'false', 'not_attempted'].includes(key)) return false;
  }
  return Boolean(value);
}

function likelySuccessAction(action, phase) {
  if (action.successMetric || action.isSuccessMetric || action.metric === 'success') return true;
  if (action.inputType !== 'boolean' && action.inputType !== 'status') return false;
  const text = normalizeKey(`${action.id} ${action.label}`);
  return phase === 'auto'
    ? /(success|sucesso|auto|autonomous|autonomo)/.test(text)
    : /(success|sucesso|hang|climb|park|endgame)/.test(text);
}

/**
 * Finds an explicit or configured success outcome for Autonomous/Endgame.
 * Null means the season has no comparable success metric, rather than failure.
 */
export function getPhaseSuccess(record, phase, seasonConfig) {
  const canonicalPhase = normalizePhase(phase);
  const explicit = explicitPhaseSuccess(record, canonicalPhase);
  if (explicit !== null) return explicit;

  const config = normalizeSeasonConfig(seasonConfig);
  const candidates = config.actions[canonicalPhase]
    .filter((action) => likelySuccessAction(action, canonicalPhase));
  if (!candidates.length) return null;

  const outcomes = candidates.map((action) => {
    const normalized = normalizeActionValue(rawActionValue(record, action.id), action);
    if (!normalized.attempted) return null;
    if (normalized.status === 'failure') return false;
    if (action.inputType === 'boolean') return normalized.value === true;
    return normalized.status === 'success';
  }).filter((value) => value !== null);
  if (!outcomes.length) return null;
  return outcomes.some(Boolean);
}

function dateValue(record) {
  const raw = firstDefined(record?.savedAt, record?.timestamp, record?.updatedAt, record?.createdAt, record?.date);
  const parsed = raw ? Date.parse(raw) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function matchNumber(record) {
  const raw = firstDefined(
    record?.matchNumber,
    record?.match?.number,
    record?.match?.matchNumber,
    record?.match?.sequence,
    record?.matchOrder,
  );
  return finiteOrUndefined(raw);
}

function sortRecords(records) {
  return [...asArray(records)].sort((left, right) => {
    const leftMatch = matchNumber(left);
    const rightMatch = matchNumber(right);
    if (leftMatch !== undefined && rightMatch !== undefined && leftMatch !== rightMatch) return leftMatch - rightMatch;
    const dateDifference = dateValue(left) - dateValue(right);
    if (dateDifference !== 0) return dateDifference;
    return String(recordMatchId(left) ?? '').localeCompare(String(recordMatchId(right) ?? ''));
  });
}

function mean(values) {
  const numbers = asArray(values).map((value) => safeNumber(value)).filter(Number.isFinite);
  return numbers.length ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length : 0;
}

function median(values) {
  const numbers = asArray(values).map((value) => safeNumber(value)).filter(Number.isFinite).sort((a, b) => a - b);
  if (!numbers.length) return 0;
  const middle = Math.floor(numbers.length / 2);
  return numbers.length % 2 ? numbers[middle] : (numbers[middle - 1] + numbers[middle]) / 2;
}

function standardDeviation(values, average = mean(values)) {
  const numbers = asArray(values).map((value) => safeNumber(value)).filter(Number.isFinite);
  if (!numbers.length) return 0;
  return Math.sqrt(numbers.reduce((sum, value) => sum + ((value - average) ** 2), 0) / numbers.length);
}

function percent(numerator, denominator) {
  return denominator > 0 ? round((numerator / denominator) * 100) : 0;
}

function teamIdentity(teamOrId, records = []) {
  const supplied = isObject(teamOrId) ? teamOrId : {};
  const id = objectId(firstDefined(teamOrId, supplied.id, supplied.teamId, supplied.number, supplied.teamNumber));
  const recordTeam = asArray(records).find((record) => idsEqual(recordTeamId(record), id));
  const embedded = isObject(recordTeam?.team) ? recordTeam.team : {};
  return {
    ...embedded,
    ...supplied,
    id: firstDefined(supplied.id, supplied.teamId, embedded.id, id),
    number: firstDefined(supplied.number, supplied.teamNumber, embedded.number, embedded.teamNumber, id),
    name: firstDefined(supplied.name, embedded.name, ''),
  };
}

function optionEventId(options) {
  return firstDefined(options?.eventId, options?.activeEventId, options?.settings?.activeEventId);
}

function filterRecords(records, { teamId, eventId, matchId, includeDrafts = false } = {}) {
  return asArray(records).filter((record) => {
    if (!isObject(record)) return false;
    if (!includeDrafts && record.status === 'draft') return false;
    if (teamId !== undefined && teamId !== null && !idsEqual(recordTeamId(record), teamId)) return false;
    if (eventId !== undefined && eventId !== null && !idsEqual(recordEventId(record), eventId)) return false;
    if (matchId !== undefined && matchId !== null && !idsEqual(recordMatchId(record), matchId)) return false;
    return true;
  });
}

/** Returns chronological scouting records for the requested/current event. */
export function getEventRecords(stateOrRecords = {}, eventId, options = {}) {
  const state = stateLike(stateOrRecords) ? stateOrRecords : null;
  const source = state ? recordsFromContext(state) : asArray(stateOrRecords);
  const eventOptions = isObject(eventId) ? eventId : options;
  const requestedEventId = firstDefined(
    isObject(eventId) ? eventId.eventId : eventId,
    eventOptions?.eventId,
    state?.settings?.activeEventId,
  );
  return sortRecords(filterRecords(source, {
    eventId: requestedEventId,
    includeDrafts: Boolean(eventOptions?.includeDrafts),
  }));
}

/** State-first team record lookup, also usable with a plain record array. */
export function getRecordsForTeam(stateOrRecords = {}, teamId, options = {}) {
  const state = stateLike(stateOrRecords) ? stateOrRecords : null;
  const source = state ? recordsFromContext(state) : asArray(stateOrRecords);
  const effectiveOptions = isObject(options) ? options : {};
  return sortRecords(filterRecords(source, {
    teamId: objectId(teamId),
    eventId: firstDefined(effectiveOptions.eventId, state?.settings?.activeEventId),
    matchId: effectiveOptions.matchId,
    includeDrafts: Boolean(effectiveOptions.includeDrafts),
  }));
}

function profileRecord(record, seasonConfig) {
  const auto = getRecordScore(record, 'auto', seasonConfig);
  const teleop = getRecordScore(record, 'teleop', seasonConfig);
  const endgame = getRecordScore(record, 'endgame', seasonConfig);
  const total = getRecordScore(record, 'total', seasonConfig);
  const totalFromPhases = auto + teleop + endgame;
  const failures = getRecordFailures(record, seasonConfig);
  const defense = getRecordDefense(record);
  return {
    id: record?.id,
    record,
    eventId: recordEventId(record),
    matchId: recordMatchId(record),
    matchNumber: matchNumber(record),
    savedAt: firstDefined(record?.savedAt, record?.updatedAt, record?.createdAt, record?.timestamp),
    auto,
    teleop,
    endgame,
    // Some historical imports only saved phase totals. Use them before a
    // missing/zero total so profile charts remain meaningful.
    total: total || totalFromPhases,
    cycles: getRecordCycles(record, seasonConfig),
    failures,
    penalties: getRecordPenalties(record),
    defense,
    autoSuccess: getPhaseSuccess(record, 'auto', seasonConfig),
    endgameSuccess: getPhaseSuccess(record, 'endgame', seasonConfig),
  };
}

function favoriteForTeam(team, options) {
  if (team?.favorite || team?.isFavorite) return true;
  const favorites = asArray(options?.favorites);
  return favorites.some((favorite) => idsEqual(objectId(firstDefined(favorite?.teamId, favorite?.team, favorite)), team?.id));
}

function watchlistForTeam(team, options) {
  const items = asArray(options?.watchlist)
    .filter((item) => idsEqual(objectId(firstDefined(item?.teamId, item?.team, item)), team?.id));
  const inline = asArray(firstDefined(team?.watchlist, team?.watchlistCategories, team?.tags, []));
  const categories = [...new Set([
    ...items.map((item) => firstDefined(item?.category, item?.type, item?.label)).filter(Boolean),
    ...inline.filter((item) => typeof item === 'string'),
  ])];
  return { watched: items.length > 0 || categories.length > 0, categories };
}

/**
 * Builds a complete, chart-friendly team profile from its scouting records.
 * `options.eventId` scopes it to an event without mutating the source arrays.
 */
export function calculateTeamProfile(teamOrId, records = [], seasonConfig = {}, options = {}) {
  // Allow a state-like object as the second argument when this helper is used
  // outside the app's pages.
  const sourceRecords = Array.isArray(records)
    ? records
    : firstDefined(records?.scoutingRecords, records?.records, []);
  const effectiveOptions = {
    ...(isObject(records) && !Array.isArray(records) ? records : {}),
    ...options,
  };
  const team = teamIdentity(teamOrId, sourceRecords);
  const eventId = optionEventId(effectiveOptions);
  const matchingRecords = sortRecords(filterRecords(sourceRecords, { teamId: team.id, eventId, includeDrafts: effectiveOptions.includeDrafts }));
  const entries = matchingRecords.map((record) => profileRecord(record, seasonConfig));
  const totals = entries.map((entry) => entry.total);
  const autos = entries.map((entry) => entry.auto);
  const teleops = entries.map((entry) => entry.teleop);
  const endgames = entries.map((entry) => entry.endgame);
  const cycles = entries.map((entry) => entry.cycles);
  const averageScore = mean(totals);
  const deviation = standardDeviation(totals, averageScore);
  const consistency = totals.length === 0
    ? 0
    : averageScore === 0
      ? (totals.every((value) => value === 0) ? 100 : 0)
      : clamp(100 - ((deviation / Math.abs(averageScore)) * 100));
  const failures = entries.reduce((total, entry) => ({
    mechanical: total.mechanical + entry.failures.mechanical,
    electrical: total.electrical + entry.failures.electrical,
    programming: total.programming + entry.failures.programming,
    connection: total.connection + entry.failures.connection,
    brokeDown: total.brokeDown + entry.failures.brokeDown,
    stalled: total.stalled + entry.failures.stalled,
    actionAttempts: total.actionAttempts + entry.failures.actionAttempts,
    actionFailures: total.actionFailures + entry.failures.actionFailures,
    total: total.total + entry.failures.total,
  }), {
    mechanical: 0,
    electrical: 0,
    programming: 0,
    connection: 0,
    brokeDown: 0,
    stalled: 0,
    actionAttempts: 0,
    actionFailures: 0,
    total: 0,
  });
  const defenseCounts = entries.reduce((counts, entry) => {
    counts[entry.defense.level] += 1;
    return counts;
  }, { none: 0, medium: 0, strong: 0 });
  const autoOutcomes = entries.map((entry) => entry.autoSuccess).filter((value) => value !== null);
  const endgameOutcomes = entries.map((entry) => entry.endgameSuccess).filter((value) => value !== null);
  const totalPenalties = entries.reduce((sum, entry) => sum + entry.penalties, 0);
  const favorite = favoriteForTeam(team, effectiveOptions);
  const watchlist = watchlistForTeam(team, effectiveOptions);

  return {
    ...team,
    teamId: team.id,
    teamNumber: team.number,
    matchesAnalyzed: entries.length,
    matchCount: entries.length,
    recordsCount: entries.length,
    totalPoints: round(totals.reduce((sum, value) => sum + value, 0)),
    averageScore: round(averageScore),
    averageTotal: round(averageScore),
    avgTotal: round(averageScore),
    averageAuto: round(mean(autos)),
    avgAuto: round(mean(autos)),
    averageTeleop: round(mean(teleops)),
    avgTeleop: round(mean(teleops)),
    averageEndgame: round(mean(endgames)),
    avgEndgame: round(mean(endgames)),
    bestScore: round(totals.length ? Math.max(...totals) : 0),
    worstScore: round(totals.length ? Math.min(...totals) : 0),
    medianScore: round(median(totals)),
    standardDeviation: round(deviation, 2),
    scoreStdDev: round(deviation, 2),
    consistency: round(consistency),
    cycles: round(cycles.reduce((sum, value) => sum + value, 0)),
    totalCycles: round(cycles.reduce((sum, value) => sum + value, 0)),
    averageCycles: round(mean(cycles)),
    avgCycles: round(mean(cycles)),
    autoSuccessRate: percent(autoOutcomes.filter(Boolean).length, autoOutcomes.length),
    autoSuccessSamples: autoOutcomes.length,
    endgameSuccessRate: percent(endgameOutcomes.filter(Boolean).length, endgameOutcomes.length),
    endgameSuccessSamples: endgameOutcomes.length,
    failures,
    failureRate: percent(entries.filter((entry) => entry.failures.total > 0).length, entries.length),
    penalties: totalPenalties,
    penaltyRate: percent(entries.filter((entry) => entry.penalties > 0).length, entries.length),
    defense: {
      ...defenseCounts,
      averageRating: round(mean(entries.map((entry) => entry.defense.score))),
      score: round(mean(entries.map((entry) => entry.defense.score))),
    },
    reliability: percent(entries.filter((entry) => entry.failures.total === 0).length, entries.length),
    favorite,
    isFavorite: favorite,
    watchlist: watchlist.watched,
    watchlistCategories: watchlist.categories,
    scoutIds: [...new Set(matchingRecords.map(recordScoutId).filter((id) => id !== undefined && id !== null))],
    records: matchingRecords,
    history: entries,
    phaseEvolution: calculatePhaseEvolution(matchingRecords, undefined, seasonConfig),
  };
}

/** Alias used by profile pages and external integrations. */
function stateLike(value) {
  return isObject(value) && (
    Array.isArray(value.scoutingRecords)
    || Array.isArray(value.records)
    || Array.isArray(value.teams)
    || Array.isArray(value.seasonConfigs)
  );
}

function resolveStateSeasonConfig(state, override, eventId) {
  if (override && isObject(override) && (override.actions || override.actionList)) return override;
  const event = asArray(state?.events).find((item) => idsEqual(item?.id, eventId));
  const seasonId = firstDefined(
    override?.seasonId,
    state?.settings?.activeSeasonId,
    state?.settings?.seasonId,
    event?.seasonId,
  );
  return asArray(state?.seasonConfigs).find((item) => idsEqual(item?.id, seasonId))
    || asArray(state?.seasonConfigs)[0]
    || {};
}

/**
 * State-first convenience used by pages: `getTeamStats(state, teamId,
 * seasonConfig?)`. The original `(team, records, config, options)` form stays
 * supported for integrations that use the lower-level service directly.
 */
export function getTeamStats(stateOrTeam, teamIdOrRecords, seasonConfig = {}, options = {}) {
  if (!stateLike(stateOrTeam)) {
    return calculateTeamProfile(stateOrTeam, teamIdOrRecords, seasonConfig, options);
  }

  const state = stateOrTeam;
  const explicitOptions = isObject(options) ? options : {};
  const eventId = firstDefined(explicitOptions.eventId, state.settings?.activeEventId);
  const teamId = objectId(teamIdOrRecords);
  const team = asArray(state.teams).find((item) => idsEqual(objectId(item), teamId)) || teamIdOrRecords;
  const config = resolveStateSeasonConfig(state, seasonConfig, eventId);
  return calculateTeamProfile(team, recordsFromContext(state), config, {
    ...state,
    ...explicitOptions,
    eventId,
    favorites: state.favorites,
    watchlist: state.watchlist,
  });
}

function recordsFromContext(value) {
  return Array.isArray(value) ? value : firstDefined(value?.scoutingRecords, value?.records, []);
}

function teamsFromContext(value) {
  return Array.isArray(value) ? value : firstDefined(value?.teams, []);
}

function uniqueTeams(teams, records) {
  const result = [];
  const ids = new Set();
  for (const item of asArray(teams)) {
    const id = objectId(item);
    if (id === undefined || id === null || ids.has(String(id))) continue;
    ids.add(String(id));
    result.push(item);
  }
  for (const record of asArray(records)) {
    const id = recordTeamId(record);
    if (id === undefined || id === null || ids.has(String(id))) continue;
    ids.add(String(id));
    result.push(isObject(record?.team) ? record.team : { id, number: id });
  }
  return result;
}

/** Calculates profiles for supplied teams plus any teams present only in records. */
export function calculateTeamProfiles(teams = [], records = [], seasonConfig = {}, options = {}) {
  const context = !Array.isArray(teams) && isObject(teams) ? teams : null;
  const sourceTeams = context ? teamsFromContext(context) : teams;
  const sourceRecords = context ? recordsFromContext(context) : recordsFromContext(records);
  const effectiveConfig = context ? firstDefined(seasonConfig, context.seasonConfig, context.config, {}) : seasonConfig;
  const effectiveOptions = {
    ...(context || {}),
    ...(isObject(records) && !Array.isArray(records) ? records : {}),
    ...options,
  };

  return uniqueTeams(sourceTeams, sourceRecords)
    .map((team) => calculateTeamProfile(team, sourceRecords, effectiveConfig, effectiveOptions));
}

function normalizeWeightKey(key) {
  const normalized = normalizeKey(key);
  const aliases = {
    average_score: 'averageScore',
    score: 'averageScore',
    total: 'averageScore',
    total_score: 'averageScore',
    autonomous: 'auto',
    auto_score: 'auto',
    tele_op: 'teleop',
    teleop_score: 'teleop',
    end_game: 'endgame',
    endgame_score: 'endgame',
    consistency: 'consistency',
    cycles: 'cycles',
    failures: 'failures',
    failure: 'failures',
    penalties: 'penalties',
    penalty: 'penalties',
  };
  return aliases[normalized] || key;
}

/**
 * Accepts decimal or percentage rating weights. Negative failure/penalty
 * weights deduct from the rating; positive values reward lower incidence.
 */
export function normalizeRatingWeights(weights = {}) {
  const source = isObject(weights) ? weights : {};
  const normalized = { ...DEFAULT_RATING_WEIGHTS };
  for (const [key, value] of Object.entries(source)) {
    const canonicalKey = normalizeWeightKey(key);
    if (!(canonicalKey in normalized)) continue;
    const number = finiteOrUndefined(value);
    if (number !== undefined) normalized[canonicalKey] = number;
  }

  const maxMagnitude = Math.max(...Object.values(normalized).map((value) => Math.abs(value)), 0);
  if (maxMagnitude > 0 && maxMagnitude <= 1) {
    Object.keys(normalized).forEach((key) => { normalized[key] *= 100; });
  }
  const denominator = Object.values(normalized)
    .filter((value) => value > 0)
    .reduce((sum, value) => sum + value, 0) || 1;
  return { weights: normalized, denominator };
}

function isProfile(value) {
  return isObject(value) && (
    hasOwn(value, 'averageScore') || hasOwn(value, 'matchesAnalyzed') || hasOwn(value, 'consistency')
  );
}

function maxOf(profiles, selector) {
  return Math.max(0, ...profiles.map((profile) => Math.max(0, safeNumber(selector(profile), 0))));
}

function relative(value, maximum) {
  return maximum > 0 ? clamp((Math.max(0, safeNumber(value, 0)) / maximum) * 100) : 0;
}

/**
 * Produces a configurable 0–100 Scouting Rating. It can receive precomputed
 * profiles or `(teams, records, seasonConfig, options)`.
 */
export function rankTeams(profilesOrTeams = [], records = [], seasonConfig = {}, options = {}) {
  const context = !Array.isArray(profilesOrTeams) && isObject(profilesOrTeams) ? profilesOrTeams : null;
  const source = context ? calculateTeamProfiles(context) : asArray(profilesOrTeams);
  const profiles = source.every(isProfile)
    ? source
    : calculateTeamProfiles(source, records, seasonConfig, options);
  const settingsWeights = firstDefined(
    options?.ratingWeights,
    options?.weights,
    context?.settings?.ratingWeights,
    context?.ratingWeights,
    {},
  );
  const { weights, denominator } = normalizeRatingWeights(settingsWeights);
  const maxima = {
    averageScore: maxOf(profiles, (profile) => profile.averageScore),
    auto: maxOf(profiles, (profile) => profile.averageAuto),
    teleop: maxOf(profiles, (profile) => profile.averageTeleop),
    endgame: maxOf(profiles, (profile) => profile.averageEndgame),
    cycles: maxOf(profiles, (profile) => profile.averageCycles),
  };

  const ranked = profiles.map((profile) => {
    const components = {
      averageScore: relative(profile.averageScore, maxima.averageScore),
      auto: relative(profile.averageAuto, maxima.auto),
      teleop: relative(profile.averageTeleop, maxima.teleop),
      endgame: relative(profile.averageEndgame, maxima.endgame),
      consistency: clamp(profile.consistency),
      cycles: relative(profile.averageCycles, maxima.cycles),
      failures: clamp(profile.failureRate),
      penalties: clamp(profile.penaltyRate),
    };
    let rating = 0;
    for (const [key, weight] of Object.entries(weights)) {
      const component = components[key] ?? 0;
      if (key === 'failures' || key === 'penalties') {
        rating += weight < 0
          ? (weight * component) / denominator
          : (weight * (100 - component)) / denominator;
      } else {
        rating += (weight * component) / denominator;
      }
    }
    return {
      ...profile,
      scoutingRating: round(clamp(rating), 1),
      rating: round(clamp(rating), 1),
      ratingComponents: components,
      ratingWeights: { ...weights },
    };
  });

  return ranked
    .sort((left, right) => (
      right.scoutingRating - left.scoutingRating
      || right.averageScore - left.averageScore
      || String(left.teamNumber ?? left.id).localeCompare(String(right.teamNumber ?? right.id), undefined, { numeric: true })
    ))
    .map((profile, index) => ({ ...profile, rank: index + 1 }));
}

/**
 * State-first ranking convenience: `getRanking(state, options?)`. It also
 * accepts an array of already calculated profiles for lightweight callers.
 */
export function getRanking(stateOrProfiles = {}, options = {}) {
  if (Array.isArray(stateOrProfiles)) {
    return rankTeams(stateOrProfiles, [], options?.seasonConfig || {}, options || {});
  }
  if (!stateLike(stateOrProfiles)) {
    return rankTeams(stateOrProfiles, [], options?.seasonConfig || {}, options || {});
  }

  const state = stateOrProfiles;
  const effectiveOptions = isObject(options) ? options : {};
  const eventId = firstDefined(effectiveOptions.eventId, state.settings?.activeEventId);
  const seasonConfig = resolveStateSeasonConfig(state, effectiveOptions.seasonConfig, eventId);
  const records = getEventRecords(state, eventId);
  const teams = asArray(state.teams).filter((team) => teamBelongsToEvent(team, eventId));
  const profiles = calculateTeamProfiles(teams, records, seasonConfig, {
    ...state,
    ...effectiveOptions,
    eventId,
    favorites: state.favorites,
    watchlist: state.watchlist,
  });
  return rankTeams(profiles, [], seasonConfig, {
    ...effectiveOptions,
    ratingWeights: firstDefined(effectiveOptions.ratingWeights, state.settings?.ratingWeights),
  });
}

function recordLabel(record, index) {
  const number = matchNumber(record);
  if (number !== undefined) return `Partida ${number}`;
  const match = record?.match;
  return String(firstDefined(match?.label, match?.name, recordMatchId(record), `Scout ${index + 1}`));
}

/**
 * Returns chronological, chart-ready phase data with cumulative averages.
 * Signatures supported: `(records, teamId?, seasonConfig?)` and
 * `(teamId, records, seasonConfig?)`.
 */
export function calculatePhaseEvolution(recordsOrTeamId = [], teamIdOrRecords, seasonConfig = {}) {
  const recordsFirst = Array.isArray(recordsOrTeamId);
  const records = recordsFirst ? recordsOrTeamId : asArray(teamIdOrRecords);
  const teamId = recordsFirst ? teamIdOrRecords : recordsOrTeamId;
  const filtered = teamId === undefined || teamId === null
    ? records
    : filterRecords(records, { teamId });
  const running = { auto: 0, teleop: 0, endgame: 0, total: 0, cycles: 0 };

  return sortRecords(filtered).map((record, index) => {
    const entry = profileRecord(record, seasonConfig);
    running.auto += entry.auto;
    running.teleop += entry.teleop;
    running.endgame += entry.endgame;
    running.total += entry.total;
    running.cycles += entry.cycles;
    const count = index + 1;
    return {
      index: count,
      recordId: record?.id,
      matchId: entry.matchId,
      matchNumber: entry.matchNumber,
      label: recordLabel(record, index),
      date: entry.savedAt,
      auto: entry.auto,
      teleop: entry.teleop,
      endgame: entry.endgame,
      total: entry.total,
      cycles: entry.cycles,
      averageAuto: round(running.auto / count),
      averageTeleop: round(running.teleop / count),
      averageEndgame: round(running.endgame / count),
      averageTotal: round(running.total / count),
      averageCycles: round(running.cycles / count),
    };
  });
}

export const getPhaseEvolution = calculatePhaseEvolution;
export const getTeamEvolution = calculatePhaseEvolution;

/**
 * Compares two to four teams in a metric-oriented shape that can be rendered
 * as side-by-side cards, a table, or bars without another transform.
 */
export function compareTeams(teamIdsOrProfiles = [], records = [], seasonConfig = {}, options = {}) {
  const source = asArray(teamIdsOrProfiles).slice(0, 4);
  const profiles = source.every(isProfile)
    ? source
    : source.map((team) => calculateTeamProfile(team, records, seasonConfig, options));
  const metrics = [
    ['averageScore', 'Média total', true],
    ['averageAuto', 'Autonomous', true],
    ['averageTeleop', 'TeleOp', true],
    ['averageEndgame', 'Endgame', true],
    ['averageCycles', 'Ciclos', true],
    ['consistency', 'Consistência', true],
    ['failureRate', 'Falhas', false],
    ['penaltyRate', 'Penalidades', false],
    ['bestScore', 'Melhor partida', true],
    ['autoSuccessRate', 'Sucesso no Auto', true],
    ['endgameSuccessRate', 'Sucesso no Endgame', true],
    ['defense.score', 'Defesa', true],
  ];
  const valuesFor = (profile, key) => key.split('.').reduce((value, part) => value?.[part], profile);
  const comparison = metrics.map(([key, label, higherIsBetter]) => {
    const values = profiles.map((profile) => ({
      teamId: profile.teamId ?? profile.id,
      teamNumber: profile.teamNumber ?? profile.number,
      value: round(valuesFor(profile, key)),
    }));
    const bestValue = values.length
      ? (higherIsBetter ? Math.max(...values.map((value) => value.value)) : Math.min(...values.map((value) => value.value)))
      : 0;
    return { key, label, higherIsBetter, bestValue, values };
  });

  return {
    teams: profiles,
    profiles,
    comparison,
    metrics: comparison,
    validSelection: profiles.length >= 2 && profiles.length <= 4,
  };
}

function resolveDashboardArguments(input = {}, records, seasonConfig, options) {
  if (isObject(input) && !Array.isArray(input)) {
    const context = input;
    const eventId = firstDefined(options?.eventId, context.eventId, context.settings?.activeEventId, context.activeEventId);
    const selectedEvent = asArray(context.events).find((event) => idsEqual(event?.id, eventId));
    const config = firstDefined(
      seasonConfig,
      context.seasonConfig,
      context.config,
      asArray(context.seasonConfigs).find((item) => idsEqual(item?.id, selectedEvent?.seasonId)),
      asArray(context.seasonConfigs).find((item) => idsEqual(item?.id, context.settings?.activeSeasonId)),
      {},
    );
    return {
      context,
      teams: asArray(context.teams),
      records: recordsFromContext(context),
      matches: asArray(context.matches),
      scouts: asArray(context.scouts),
      config,
      eventId,
      options: { ...context, ...(options || {}) },
      event: selectedEvent,
    };
  }

  return {
    context: {},
    teams: asArray(input),
    records: recordsFromContext(records),
    matches: asArray(options?.matches),
    scouts: asArray(options?.scouts),
    config: seasonConfig || {},
    eventId: optionEventId(options),
    options: options || {},
    event: options?.event,
  };
}

function teamBelongsToEvent(team, eventId) {
  if (eventId === undefined || eventId === null) return true;
  const eventIds = firstDefined(team?.eventIds, team?.events, []);
  if (Array.isArray(eventIds) && eventIds.length) return eventIds.some((id) => idsEqual(objectId(id), eventId));
  return !team?.eventId || idsEqual(team.eventId, eventId);
}

/**
 * Aggregates the live dashboard: current-event counts, ranking, coverage,
 * phase averages, recent records, favourites, and useful observation alerts.
 */
export function calculateDashboardAggregate(input = {}, records, seasonConfig, options = {}) {
  const args = resolveDashboardArguments(input, records, seasonConfig, options);
  const scopedRecords = sortRecords(filterRecords(args.records, { eventId: args.eventId, includeDrafts: args.options.includeDrafts }));
  const scopedTeams = args.teams.filter((team) => teamBelongsToEvent(team, args.eventId));
  const profiles = calculateTeamProfiles(scopedTeams, scopedRecords, args.config, {
    ...args.options,
    eventId: args.eventId,
    favorites: args.context.favorites,
    watchlist: args.context.watchlist,
  });
  const ranking = rankTeams(profiles, [], args.config, {
    ...args.options,
    ratingWeights: firstDefined(args.options.ratingWeights, args.context.settings?.ratingWeights),
  });
  const entries = scopedRecords.map((record) => profileRecord(record, args.config));
  const analyzedTeamIds = new Set(scopedRecords.map(recordTeamId).filter((id) => id !== undefined && id !== null).map(String));
  const unscoutedTeams = scopedTeams.filter((team) => !analyzedTeamIds.has(String(objectId(team))));
  const favoriteTeams = profiles.filter((profile) => profile.favorite);
  const watchlistTeams = profiles.filter((profile) => profile.watchlist);
  const uniqueMatchIds = new Set(scopedRecords.map(recordMatchId).filter((id) => id !== undefined && id !== null).map(String));
  const activeScoutIds = new Set(scopedRecords.map(recordScoutId).filter((id) => id !== undefined && id !== null).map(String));
  const phaseAverages = {
    auto: round(mean(entries.map((entry) => entry.auto))),
    teleop: round(mean(entries.map((entry) => entry.teleop))),
    endgame: round(mean(entries.map((entry) => entry.endgame))),
  };
  const averageScore = round(mean(entries.map((entry) => entry.total)));
  const recentRecords = [...entries].sort((left, right) => dateValue(right.record) - dateValue(left.record)).slice(0, 6);
  const topStandouts = ranking
    .filter((profile) => profile.matchesAnalyzed > 0 && profile.averageScore >= averageScore && profile.endgameSuccessRate >= 60)
    .slice(0, 3);
  const alerts = [
    ...watchlistTeams.slice(0, 4).map((profile) => ({
      type: 'watchlist',
      teamId: profile.teamId,
      teamNumber: profile.teamNumber,
      message: `${profile.teamNumber}: ${profile.watchlistCategories.join(', ') || 'precisa de observação'}`,
    })),
    ...topStandouts.map((profile) => ({
      type: 'standout',
      teamId: profile.teamId,
      teamNumber: profile.teamNumber,
      message: `${profile.teamNumber} combina média forte e endgame confiável.`,
    })),
    ...unscoutedTeams.slice(0, 3).map((team) => ({
      type: 'unscouted',
      teamId: objectId(team),
      teamNumber: firstDefined(team?.number, team?.teamNumber, objectId(team)),
      message: `${firstDefined(team?.number, team?.teamNumber, objectId(team))} ainda não foi analisado.`,
    })),
  ];
  const totalMatches = args.matches.filter((match) => !args.eventId || idsEqual(firstDefined(match?.eventId, match?.event?.id), args.eventId)).length;

  return {
    eventId: args.eventId ?? null,
    event: args.event ?? null,
    teamCount: scopedTeams.length || profiles.length,
    totalTeams: scopedTeams.length || profiles.length,
    analyzedTeams: analyzedTeamIds.size,
    unscoutedTeams,
    teamsNeedingScouting: unscoutedTeams,
    recordsCount: scopedRecords.length,
    scoutingRecords: scopedRecords.length,
    matchCount: uniqueMatchIds.size,
    matchesAnalyzed: uniqueMatchIds.size,
    totalMatches,
    completionRate: percent(uniqueMatchIds.size, totalMatches),
    scoutCount: activeScoutIds.size,
    activeScouts: activeScoutIds.size,
    averageScore,
    averageTotal: averageScore,
    phaseAverages,
    performanceByPhase: [
      { phase: 'auto', label: 'Autonomous', value: phaseAverages.auto },
      { phase: 'teleop', label: 'TeleOp', value: phaseAverages.teleop },
      { phase: 'endgame', label: 'Endgame', value: phaseAverages.endgame },
    ],
    averageCycles: round(mean(entries.map((entry) => entry.cycles))),
    favoriteTeams,
    watchlistTeams,
    recentRecords,
    recentMatches: recentRecords,
    topTeams: ranking.slice(0, 5),
    ranking,
    profiles,
    alerts,
  };
}

/**
 * State-first dashboard convenience. `options` can scope a different event or
 * pass a season config without requiring callers to unpack application state.
 */
export function getDashboardStats(stateOrTeams = {}, options = {}) {
  if (stateLike(stateOrTeams)) {
    const state = stateOrTeams;
    const effectiveOptions = isObject(options) ? options : {};
    const eventId = firstDefined(effectiveOptions.eventId, state.settings?.activeEventId);
    const seasonConfig = resolveStateSeasonConfig(state, effectiveOptions.seasonConfig, eventId);
    return calculateDashboardAggregate(state, undefined, seasonConfig, { ...effectiveOptions, eventId });
  }
  return calculateDashboardAggregate(stateOrTeams, [], options?.seasonConfig || {}, options || {});
}

export default {
  DEFAULT_RATING_WEIGHTS,
  getRecordScore,
  getPhaseTotals,
  getRecordCycles,
  getRecordFailures,
  getRecordPenalties,
  getRecordDefense,
  getPhaseSuccess,
  getEventRecords,
  getRecordsForTeam,
  calculateTeamProfile,
  getTeamStats,
  calculateTeamProfiles,
  normalizeRatingWeights,
  rankTeams,
  getRanking,
  calculatePhaseEvolution,
  getPhaseEvolution,
  getTeamEvolution,
  compareTeams,
  calculateDashboardAggregate,
  getDashboardStats,
};
