/** Utilities for exporting scouting data without a server or third-party SDK. */

export const CSV_MIME_TYPE = "text/csv;charset=utf-8";
export const JSON_MIME_TYPE = "application/json;charset=utf-8";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function jsonValue(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

/** Formats a single field according to RFC 4180-compatible CSV escaping. */
export function escapeCsv(value, delimiter = ",") {
  let text;
  if (value === null || value === undefined) text = "";
  else if (value instanceof Date) text = value.toISOString();
  else if (typeof value === "object") text = jsonValue(value);
  else text = String(value);

  if (text.includes('"')) text = text.replaceAll('"', '""');
  return /[\r\n"]/.test(text) || text.includes(delimiter) ? `"${text}"` : text;
}

function normalizeColumns(rows, columns) {
  if (Array.isArray(columns) && columns.length) {
    return columns.map((column) =>
      typeof column === "string"
        ? { key: column, label: column }
        : { key: column.key, label: column.label || column.key, format: column.format },
    );
  }

  const keys = new Set();
  for (const row of rows) {
    if (isObject(row)) Object.keys(row).forEach((key) => keys.add(key));
  }
  return [...keys].map((key) => ({ key, label: key }));
}

/** Converts rows into a UTF-8 CSV string. */
export function toCsv(rows, columns, options = {}) {
  const source = asArray(rows);
  const delimiter = options.delimiter || ",";
  const lineEnding = options.lineEnding || "\r\n";
  const includeBom = options.includeBom !== false;
  const normalizedColumns = normalizeColumns(source, columns);
  const header = normalizedColumns.map((column) => escapeCsv(column.label, delimiter));
  const body = source.map((row) =>
    normalizedColumns
      .map((column) => {
        const value = typeof column.format === "function"
          ? column.format(row?.[column.key], row)
          : row?.[column.key];
        return escapeCsv(value, delimiter);
      })
      .join(delimiter),
  );

  return `${includeBom ? "\uFEFF" : ""}${[header.join(delimiter), ...body].join(lineEnding)}`;
}

/** Alias with a descriptive name for UI callers. */
export const serializeCsv = toCsv;

function indexBy(items, key = "id") {
  return new Map(asArray(items).map((item) => [item?.[key], item]));
}

function scoreValue(record, name) {
  const score = record?.score || record?.scores || record?.calculatedScore || {};
  const candidates = {
    auto: [score.auto, score.autonomous, record?.autoScore, record?.auto],
    teleop: [score.teleop, score.teleOp, record?.teleopScore, record?.teleop],
    endgame: [score.endgame, score.endGame, record?.endgameScore, record?.endgame],
    total: [score.total, score.estimatedTotal, record?.totalScore, record?.estimatedTotal],
    cycles: [score.cycles, record?.cycles],
  };
  const values = candidates[name] || [];
  const found = values.find((value) => Number.isFinite(Number(value)));
  return safeNumber(found, 0);
}

function actionDefinitions(state) {
  const seasonById = indexBy(state?.seasonConfigs);
  const definitions = new Map();

  for (const season of seasonById.values()) {
    const actions = Array.isArray(season?.actions)
      ? season.actions
      : isObject(season?.actions)
        ? Object.values(season.actions).flatMap((phase) => asArray(phase))
        : [];
    for (const action of actions) {
      if (action?.id && !definitions.has(action.id)) definitions.set(action.id, action);
    }
  }
  return definitions;
}

function actionValue(record, actionId) {
  const actions = record?.actions || record?.actionValues || {};
  const raw = isObject(actions) ? actions[actionId] : undefined;
  if (isObject(raw)) return raw.value ?? raw.count ?? raw.selected ?? "";
  return raw ?? "";
}

/** Flattens a scouting record into a spreadsheet-friendly row. */
export function scoutingRecordToRow(record, state = {}, options = {}) {
  const teamById = indexBy(state.teams);
  const scoutById = indexBy(state.scouts);
  const matchById = indexBy(state.matches);
  const eventById = indexBy(state.events);
  const team = teamById.get(record?.teamId);
  const scout = scoutById.get(record?.scoutId);
  const match = matchById.get(record?.matchId);
  const event = eventById.get(record?.eventId);
  const season = indexBy(state.seasonConfigs).get(record?.seasonId);
  const observationsOnly = season?.scoringScope === "observations_only";
  const definitions = options.actionDefinitions || actionDefinitions(state);

  const row = {
    "ID do registro": record?.id || "",
    Evento: event?.name || record?.eventId || "",
    Partida: match?.label || match?.number || match?.matchNumber || record?.matchId || "",
    Time: team?.number || team?.teamNumber || record?.teamId || "",
    "Nome do time": team?.name || "",
    Aliança: record?.alliance || "",
    Posição: record?.position || "",
    Scout: scout?.name || record?.scoutId || "",
    Temporada: record?.seasonId || "",
    "Status de pontuação": observationsOnly ? "Métricas internas; sem pontuação oficial" : season?.scoringStatus === "official_archive" ? "Referência histórica oficial" : "Estimativa de scouting",
    Auto: observationsOnly ? "" : scoreValue(record, "auto"),
    TeleOp: observationsOnly ? "" : scoreValue(record, "teleop"),
    Endgame: observationsOnly ? "" : scoreValue(record, "endgame"),
    "Total estimado": observationsOnly ? "" : scoreValue(record, "total"),
    Ciclos: scoreValue(record, "cycles"),
    Status: record?.status || "",
    Observações: record?.notes || record?.observations || "",
    "Criado em": record?.createdAt || "",
    "Salvo em": record?.savedAt || record?.updatedAt || "",
  };

  for (const [id, action] of definitions) {
    row[`Ação: ${action.label || id}`] = actionValue(record, id);
  }
  return row;
}

/** Produces a CSV for all completed scouting records in the supplied state. */
export function buildScoutingCsv(state, options = {}) {
  const eventId = options.eventId;
  const definitions = actionDefinitions(state);
  const records = asArray(state?.scoutingRecords).filter(
    (record) => !eventId || record?.eventId === eventId,
  );
  const rows = records.map((record) =>
    scoutingRecordToRow(record, state, { actionDefinitions: definitions }),
  );
  return toCsv(rows, options.columns, options);
}

/** Produces a concise CSV suitable for team-list imports or reviews. */
export function buildTeamsCsv(state, options = {}) {
  const eventId = options.eventId;
  const rows = asArray(state?.teams)
    .filter((team) => !eventId || !team?.eventIds || team.eventIds.includes(eventId))
    .map((team) => ({
      "ID do time": team?.id || "",
      Número: team?.number || team?.teamNumber || "",
      Nome: team?.name || "",
      Cidade: team?.city || "",
      Estado: team?.state || team?.region || "",
      País: team?.country || "",
      Rookie: Boolean(team?.rookie),
      Notas: team?.notes || "",
    }));
  return toCsv(rows, options.columns, options);
}

/** Serializes a complete data backup. A fresh clone avoids later mutation. */
export function exportStateJson(state, options = {}) {
  const indentation = Number.isInteger(options.indentation) ? options.indentation : 2;
  return JSON.stringify(state ?? {}, null, indentation);
}

export const toJson = exportStateJson;

function exportFileBaseName(state, options) {
  if (options.filename) return options.filename.replace(/\.(csv|json)$/i, "");
  const eventId = options.eventId || state?.settings?.activeEventId;
  const event = asArray(state?.events).find((item) => item?.id === eventId);
  const safeEventName = String(event?.name || "ftc-scouting")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${safeEventName || "ftc-scouting"}-${options.scope || "scouting"}`;
}

/**
 * Builds an export artifact. It does not start a browser download, making it
 * useful for a future Google Sheets or cloud-sync integration as well.
 */
export function exportData(state, options = {}) {
  const format = String(options.format || "csv").toLowerCase();
  const scope = options.scope || "scouting";
  const baseName = exportFileBaseName(state, { ...options, scope });

  if (format === "json") {
    const content = scope === "backup" ? state : scope === "teams" ? asArray(state?.teams) : asArray(state?.scoutingRecords).filter((record) => !options.eventId || String(record.eventId) === String(options.eventId));
    return {
      filename: `${baseName}.json`,
      mimeType: JSON_MIME_TYPE,
      content: exportStateJson(content, options),
      format: "json",
      scope,
    };
  }

  const content = scope === "teams"
    ? buildTeamsCsv(state, options)
    : buildScoutingCsv(state, options);
  return {
    filename: `${baseName}.csv`,
    mimeType: CSV_MIME_TYPE,
    content,
    format: "csv",
    scope,
  };
}

export const createExport = exportData;

/**
 * Triggers a browser file download. Returns false in non-browser contexts
 * instead of throwing, so export generation can still be tested server-side.
 */
export function downloadFile(content, filename, mimeType = CSV_MIME_TYPE) {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof Blob === "undefined"
  ) {
    return false;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

/** Creates an artifact and immediately downloads it when running in a browser. */
export function downloadExport(state, options = {}) {
  const artifact = exportData(state, options);
  return {
    ...artifact,
    downloaded: downloadFile(artifact.content, artifact.filename, artifact.mimeType),
  };
}

export default {
  toCsv,
  serializeCsv,
  escapeCsv,
  scoutingRecordToRow,
  buildScoutingCsv,
  buildTeamsCsv,
  exportStateJson,
  exportData,
  createExport,
  downloadFile,
  downloadExport,
};
