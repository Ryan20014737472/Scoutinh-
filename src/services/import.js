import { normalizeState } from "./storage.js";
import { APP_SCHEMA_VERSION } from "../types/domain.js";
import { getMatchTeams } from "../utils/domain.js";

/** Parse spreadsheet rows as a whole so a bad row never leaves a partial import. */
export function parseTeamLines(text, existingTeams = []) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) throw new Error("Cole pelo menos uma equipe, com número e nome.");
  if (lines.length > 500) throw new Error("Adicione no máximo 500 equipes de cada vez.");
  const numbers = new Set(existingTeams.map((team) => String(team.number).replace(/^0+(?=\d)/, "")));
  return lines.map((line, index) => {
    const match = line.match(/^(\d{1,8})\s*(?:[;,\t]|\s[-–]\s)\s*(.+)$/);
    if (!match) throw new Error(`Linha ${index + 1}: use número; nome da equipe.`);
    const number = match[1].replace(/^0+(?=\d)/, "");
    const name = match[2].trim();
    if (Number(number) < 1 || name.length > 60) throw new Error(`Linha ${index + 1}: confira o número e use um nome de até 60 caracteres.`);
    if (numbers.has(number)) throw new Error(`A equipe ${number} está repetida ou já foi cadastrada.`);
    numbers.add(number);
    return { id: `team-${number}`, number, name, robotName: "", city: "", createdAt: new Date().toISOString() };
  });
}

/** Accept only a full, consistent backup before offering a replacement. */
export function parseBackup(text) {
  let value;
  try { value = JSON.parse(text); } catch { throw new Error("Este arquivo não contém um JSON válido."); }
  if (!value || typeof value !== "object" || Array.isArray(value) || !Number.isInteger(value.schemaVersion) || !value.settings || typeof value.settings !== "object" || Array.isArray(value.settings)) throw new Error("Selecione um backup completo do Acrux Scout.");
  if (value.schemaVersion > APP_SCHEMA_VERSION) throw new Error("Este backup foi criado em uma versão mais recente do Acrux Scout.");
  const keys = ["seasonConfigs", "events", "scouts", "teams", "matches", "scoutingRecords"];
  for (const key of keys) {
    if (!Array.isArray(value[key])) throw new Error("Selecione o arquivo de backup, e não uma exportação de scouting.");
    const ids = new Set();
    for (const item of value[key]) {
      if (!item || typeof item !== "object" || typeof item.id !== "string" || !item.id || ids.has(item.id)) throw new Error(`O backup contém dados inválidos ou duplicados em ${key}.`);
      ids.add(item.id);
    }
  }
  if (!value.seasonConfigs.length) throw new Error("O backup precisa ter uma temporada configurada.");
  const known = (key, id) => value[key].some((item) => String(item.id) === String(id));
  for (const season of value.seasonConfigs) {
    if (!season.actions || typeof season.actions !== "object" || Array.isArray(season.actions)) throw new Error("A configuração da temporada é inválida.");
    const actionIds = new Set();
    for (const phase of ["auto", "teleop", "endgame"]) {
      if (!Array.isArray(season.actions[phase])) throw new Error("A temporada precisa ter as três fases de scouting.");
      for (const action of season.actions[phase]) {
        if (!action || typeof action.id !== "string" || !action.id || actionIds.has(action.id) || typeof action.label !== "string" || (action.options && !Array.isArray(action.options))) throw new Error("O backup contém uma ação de temporada inválida.");
        actionIds.add(action.id);
      }
    }
  }
  for (const team of value.teams) {
    if (!/^[0-9]{1,8}$/.test(String(team.number)) || Number(team.number) < 1 || typeof team.name !== "string" || !team.name.trim()) throw new Error("Há uma equipe sem número ou nome válido no backup.");
  }
  if (new Set(value.teams.map((team) => Number(team.number))).size !== value.teams.length) throw new Error("Há números de equipe repetidos no backup.");
  for (const event of value.events) {
    if (typeof event.name !== "string" || !event.name.trim() || !known("seasonConfigs", event.seasonConfigId || event.seasonId)) throw new Error("Há um evento inválido no backup.");
  }
  for (const scout of value.scouts) {
    if (typeof scout.name !== "string" || !scout.name.trim()) throw new Error("Há um scout sem nome no backup.");
  }
  const targets = new Set();
  for (const record of value.scoutingRecords) {
    if (!known("teams", record.teamId) || !known("matches", record.matchId) || !known("events", record.eventId) || !known("scouts", record.scoutId) || !known("seasonConfigs", record.seasonId)) throw new Error("Há registros no backup que apontam para equipes, partidas ou scouts inexistentes.");
    const target = JSON.stringify([record.eventId, record.matchId, record.teamId]);
    if (targets.has(target)) throw new Error("O backup contém observações duplicadas da mesma equipe e partida.");
    targets.add(target);
    if (record.savedAt && !Number.isFinite(new Date(record.savedAt).getTime())) throw new Error("Há uma observação com data inválida no backup.");
  }
  for (const match of value.matches) {
    if (!known("events", match.eventId)) throw new Error("Há partidas no backup sem um evento válido.");
    const ids = getMatchTeams(value, match).map((entry) => entry.teamId);
    if (ids.length !== 4 || new Set(ids).size !== 4 || ids.some((id) => !known("teams", id))) throw new Error("Há uma partida com equipes inválidas no backup.");
  }
  if (value.settings.activeEventId && !known("events", value.settings.activeEventId)) throw new Error("O evento ativo não existe no backup.");
  if (value.settings.currentScoutId && !known("scouts", value.settings.currentScoutId)) throw new Error("O scout ativo não existe no backup.");
  if (value.drafts !== undefined && (!value.drafts || typeof value.drafts !== "object" || Array.isArray(value.drafts))) throw new Error("Os rascunhos do backup são inválidos.");
  for (const [id, draft] of Object.entries(value.drafts || {})) {
    if (!draft || draft.id !== id || !known("teams", draft.teamId) || !known("matches", draft.matchId) || !known("events", draft.eventId) || !known("scouts", draft.scoutId) || !known("seasonConfigs", draft.seasonId)) throw new Error("O backup contém um rascunho inválido.");
  }
  return normalizeState(value);
}
