import test from "node:test";
import assert from "node:assert/strict";
import { createSeedState, createBiobuzzPreseasonConfig, createDecodeArchiveConfig } from "../src/data/seed.js";
import { parseTeamLines, parseBackup } from "../src/services/import.js";
import { createDraft, normalizeDraft, resetState, saveState, loadState, updateState, submitRecord } from "../src/services/storage.js";
import { getDashboardStats, getRanking, calculateTeamProfile } from "../src/services/analytics.js";
import { exportData, exportStateJson } from "../src/services/export.js";

function fixture() {
  const state = createSeedState();
  const season = state.seasonConfigs[0];
  state.teams = parseTeamLines("12345; Horizonte\n23456; Circuito Verde\n34567; Nova Geração\n45678; Robótica Brasil");
  state.scouts = [{ id: "scout-ana", name: "Ana", role: "Scout" }];
  state.events = [{ id: "regional", name: "Regional", seasonId: season.id, seasonConfigId: season.id, teamIds: state.teams.map((team) => team.id) }];
  state.matches = [{ id: "match-1", eventId: "regional", number: 1, status: "not_started", alliances: { red: { teamIds: ["team-12345", "team-23456"] }, blue: { teamIds: ["team-34567", "team-45678"] } }, scoutAssignments: {} }];
  state.settings.currentScoutId = "scout-ana";
  state.settings.activeEventId = "regional";
  return state;
}

test("bulk registration accepts pasted spreadsheet rows and rejects duplicates before saving", () => {
  assert.equal(parseTeamLines("00123; Equipe A\n234, Equipe B\n345\tEquipe C")[0].number, "123");
  assert.throws(() => parseTeamLines("123; A\n00123; B"), /repetida/);
  assert.throws(() => parseTeamLines("123; A", [{ number: "123" }]), /cadastrada/);
  assert.throws(() => parseTeamLines("123; A\nlinha inválida"), /Linha 2/);
  assert.throws(() => parseTeamLines("0; A"), /número/);
});

test("backup round trip preserves the complete workspace, including in-progress drafts", () => {
  const state = fixture();
  const draft = createDraft({ eventId: "regional", matchId: "match-1", teamId: "team-12345", scoutId: "scout-ana", alliance: "red", position: 1 }, state.seasonConfigs[0]);
  draft.notes = "Ciclo rápido e boa defesa. ";
  state.drafts = { [draft.id]: draft };
  const restored = parseBackup(exportStateJson(state));
  assert.deepEqual(restored.teams, state.teams);
  assert.equal(restored.drafts[draft.id].notes, draft.notes);
  assert.equal(restored.settings.activeEventId, "regional");
});

test("restoration rejects incomplete, inconsistent and future-version backups", () => {
  assert.throws(() => parseBackup("{"), /JSON válido/);
  assert.throws(() => parseBackup("[]"), /backup completo/);
  const state = fixture();
  state.seasonConfigs[0].actions.auto = {};
  assert.throws(() => parseBackup(JSON.stringify(state)), /três fases/);
  const missingTeam = fixture();
  missingTeam.matches[0].alliances.red.teamIds[0] = "missing";
  assert.throws(() => parseBackup(JSON.stringify(missingTeam)), /equipes inválidas/);
  const newer = fixture();
  newer.schemaVersion += 1;
  assert.throws(() => parseBackup(JSON.stringify(newer)), /mais recente/);
});

test("draft normalization preserves typing whitespace and clamps serialized counter values", () => {
  const season = createBiobuzzPreseasonConfig();
  const draft = normalizeDraft({ actions: { pre_auto_actions: { value: 50, status: "success" } }, notes: "um ciclo " }, season);
  assert.equal(draft.notes, "um ciclo ");
  assert.equal(draft.actions.pre_auto_actions, 30);
});

test("queued writes and submissions preserve counts, reject duplicate records, and clean up drafts atomically", async () => {
  const state = fixture();
  await resetState();
  await saveState(state);
  await Promise.all(Array.from({ length: 20 }, () => updateState((next) => {
    next.metadata = { clicks: (next.metadata?.clicks || 0) + 1 };
  })));
  assert.equal((await loadState()).metadata.clicks, 20);
  const season = state.seasonConfigs[0];
  const draft = createDraft({ eventId: "regional", matchId: "match-1", teamId: "team-12345", scoutId: "scout-ana", alliance: "red", position: 1 }, season);
  draft.actions.pre_teleop_cycles = 7;
  await updateState((next) => {
    next.drafts = { [draft.id]: draft };
    next.matches[0].scoutAssignments = { "red-1": draft.scoutId };
  });
  const results = await Promise.allSettled([submitRecord(draft, season), submitRecord(draft, season)]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.find((result) => result.status === "rejected").reason.code, "DUPLICATE_SCOUTING_RECORD");
  let savedState = await loadState();
  assert.equal(savedState.scoutingRecords.length, 1);
  assert.equal(Object.keys(savedState.drafts).length, 0);
  assert.equal(savedState.matches[0].scoutAssignments["red-1"], undefined);
  assert.equal(savedState.matches[0].status, "in_progress");
  const corrected = { ...savedState.scoutingRecords[0], actions: { pre_teleop_cycles: 9 } };
  await submitRecord(corrected, season, { replace: true });
  savedState = await loadState();
  assert.equal(savedState.scoutingRecords.length, 1);
  assert.equal(getDashboardStats(savedState).completionRate, 25);
  assert.equal(getRanking(savedState)[0].averageCycles, 9);
});

test("observation consistency responds to cycle variation without inventing points", () => {
  const season = createBiobuzzPreseasonConfig();
  const records = [2, 10].map((cycles, i) => ({ id: "record-" + i, eventId: "regional", matchId: "match-" + i, teamId: "team-12345", actions: { pre_teleop_cycles: cycles }, status: "submitted" }));
  const profile = calculateTeamProfile({ id: "team-12345", number: "12345" }, records, season);
  assert.equal(profile.averageScore, 0);
  assert.equal(profile.averageCycles, 6);
  assert(profile.consistency > 0 && profile.consistency < 100);
});

test("favorites and watchlist stay scoped to their event", () => {
  const state = fixture();
  state.favorites = [{ teamId: "team-12345", eventId: "other" }];
  state.watchlist = [{ teamId: "team-12345", eventId: "other", category: "defense" }];
  assert.equal(getRanking(state).find((team) => team.teamId === "team-12345").favorite, false);
  assert.equal(getRanking(state).find((team) => team.teamId === "team-12345").watchlist, false);
});

test("JSON exports respect their scope, while a backup keeps every event", () => {
  const state = fixture();
  state.scoutingRecords = [{ id: "a", eventId: "regional" }, { id: "b", eventId: "other" }];
  assert.deepEqual(JSON.parse(exportData(state, { format: "json", scope: "scouting", eventId: "regional" }).content).map((record) => record.id), ["a"]);
  assert.equal(JSON.parse(exportData(state, { format: "json", scope: "backup" }).content).scoutingRecords.length, 2);
});

test("the historical DECODE preset still calculates official-reference contributions", async () => {
  const season = createDecodeArchiveConfig();
  const state = fixture();
  state.seasonConfigs = [season];
  await saveState(state);
  const draft = createDraft({ eventId: "regional", matchId: "match-1", teamId: "team-12345", scoutId: "scout-ana", alliance: "red", position: 1 }, season);
  draft.actions.decode_auto_leave = true;
  draft.actions.decode_auto_classified = 2;
  draft.actions.decode_base_return = "full";
  const record = await submitRecord(draft, season);
  assert.equal(record.score.total, 19);
});
