import {
  APP_SCHEMA_VERSION,
  DEFAULT_RATING_WEIGHTS,
} from "../types/domain.js";

export { APP_SCHEMA_VERSION } from "../types/domain.js";
export const STORAGE_KEY = "ftc-scout-arena.state.v3";

export const SEED_IDS = Object.freeze({
  season: "season-2026-biobuzz",
  event: "event-ftc",
});

const SEED_CREATED_AT = "2026-08-30T00:00:00.000-03:00";

/** Official FIRST links are stored with each preset so internal measurements
 * cannot be mistaken for current, official game scoring. */
export const FIRST_OFFICIAL_FTC_SOURCES = Object.freeze({
  biobuzzMaterials: "https://ftc-resources.firstinspires.org/ftc/game",
  biobuzzManual: "https://ftc-resources.firstinspires.org/ftc/game/manual",
  decodeManual: "https://ftc-resources.firstinspires.org/ftc/archive/2026/game/cm-html/DECODE_Competition_Manual_TU32.htm",
});

/**
 * BIOBUZZ is the current 2026-2027 FTC game. Its public V0 material is
 * pre-season, so this preset deliberately records neutral observations only.
 * It never presents made-up values as an official FIRST score.
 */
const BIOBUZZ_PRESEASON_CONFIG = {
  id: SEED_IDS.season,
  name: "FIRST CANOPY 2026-2027 · BIOBUZZ™ (pré-temporada)",
  gameName: "BIOBUZZ™ presented by RTX",
  year: "2026-2027",
  isActive: true,
  scoringStatus: "preseason_pending_official_rules",
  scoringScope: "observations_only",
  officialSource: FIRST_OFFICIAL_FTC_SOURCES.biobuzzMaterials,
  officialManual: FIRST_OFFICIAL_FTC_SOURCES.biobuzzManual,
  officialNote: "A FIRST ainda não publicou critérios ou valores de pontuação do BIOBUZZ. O Kickoff e a revelação do jogo estão previstos para 12 de setembro de 2026. Estas métricas são internas e não calculam pontuação oficial.",
  createdAt: SEED_CREATED_AT,
  updatedAt: SEED_CREATED_AT,
  actions: {
    auto: [
      {
        id: "pre_auto_routine_observed",
        phase: "auto",
        label: "Rotina autônoma observada",
        shortLabel: "Auto observada",
        inputType: "boolean",
        points: 0,
        max: 1,
        countsTowardCycles: false,
        description: "Métrica interna de pré-temporada; não representa pontos oficiais.",
      },
      {
        id: "pre_auto_actions",
        phase: "auto",
        label: "Ações autônomas concluídas",
        shortLabel: "Ações auto",
        inputType: "counter",
        points: 0,
        max: 30,
        countsTowardCycles: false,
        description: "Contagem interna para acompanhar a rotina, sem valor oficial.",
      },
    ],
    teleop: [
      {
        id: "pre_teleop_cycles",
        phase: "teleop",
        label: "Ciclos observados",
        shortLabel: "Ciclos",
        inputType: "counter",
        points: 0,
        max: 40,
        countsTowardCycles: true,
        description: "Métrica interna; adapte após a divulgação das regras oficiais.",
      },
      {
        id: "pre_teleop_actions",
        phase: "teleop",
        label: "Ações concluídas",
        shortLabel: "Ações",
        inputType: "counter",
        points: 0,
        max: 50,
        countsTowardCycles: false,
        description: "Métrica interna; não é contagem oficial de jogo.",
      },
    ],
    endgame: [
      {
        id: "pre_endgame_outcome",
        phase: "endgame",
        label: "Ação final observada",
        shortLabel: "Ação final",
        inputType: "select",
        points: 0,
        max: 1,
        countsTowardCycles: false,
        options: [
          { value: "none", label: "Não observada", points: 0 },
          { value: "attempted", label: "Tentou", points: 0 },
          { value: "completed", label: "Concluiu", points: 0 },
        ],
        description: "Registro interno de pré-temporada; sem valor oficial.",
      },
    ],
  },
};

/**
 * Historical scoring preset. It is deliberately separate from BIOBUZZ: use
 * it only for a 2025-2026 DECODE event or historical data review. Values are
 * from the official DECODE Competition Manual TU32, section 10.5.4, Table 10-2.
 */
const DECODE_ARCHIVE_CONFIG = {
  id: "season-2025-decode",
  name: "DECODE™ 2025-2026 (arquivo oficial)",
  gameName: "DECODE™ presented by RTX",
  year: "2025-2026",
  isActive: true,
  scoringStatus: "official_archive",
  scoringScope: "team_scouting_estimate",
  officialSource: FIRST_OFFICIAL_FTC_SOURCES.decodeManual,
  manualVersion: "TU32 · seção 10.5.4, tabela 10-2",
  officialNote: "Valores oficiais de DECODE 2025-2026. O total é uma estimativa de contribuição do time para scouting; não substitui a pontuação oficial da aliança nem o sistema de scorekeeping da FIRST.",
  createdAt: SEED_CREATED_AT,
  updatedAt: SEED_CREATED_AT,
  actions: {
    auto: [
      { id: "decode_auto_leave", phase: "auto", label: "LEAVE no AUTO", shortLabel: "Leave", inputType: "boolean", points: 3, max: 1, description: "3 pontos; o robô não pode estar sobre uma LAUNCH LINE ao fim do AUTO." },
      { id: "decode_auto_classified", phase: "auto", label: "ARTIFACTS CLASSIFIED", shortLabel: "Classified", inputType: "counter", points: 3, max: 36, description: "3 pontos por ARTIFACT CLASSIFIED no AUTO." },
      { id: "decode_auto_overflow", phase: "auto", label: "ARTIFACTS em OVERFLOW", shortLabel: "Overflow", inputType: "counter", points: 1, max: 36, description: "1 ponto por ARTIFACT em OVERFLOW no AUTO." },
      { id: "decode_auto_pattern", phase: "auto", label: "ARTIFACTS do PATTERN que combinam com o MOTIF", shortLabel: "Pattern", inputType: "counter", points: 2, max: 36, description: "2 pontos por ARTIFACT do PATTERN que corresponde ao MOTIF." },
      { id: "decode_auto_failed", phase: "auto", label: "Tentativas sem pontuar", shortLabel: "Falhas", inputType: "counter", points: 0, max: 36, countsAsFailure: true, description: "Métrica interna de confiabilidade; não altera o placar oficial." },
    ],
    teleop: [
      { id: "decode_teleop_classified", phase: "teleop", label: "ARTIFACTS CLASSIFIED", shortLabel: "Classified", inputType: "counter", points: 3, max: 36, description: "3 pontos por ARTIFACT CLASSIFIED no TELEOP." },
      { id: "decode_teleop_overflow", phase: "teleop", label: "ARTIFACTS em OVERFLOW", shortLabel: "Overflow", inputType: "counter", points: 1, max: 36, description: "1 ponto por ARTIFACT em OVERFLOW no TELEOP." },
      { id: "decode_teleop_depot", phase: "teleop", label: "ARTIFACTS no DEPOT", shortLabel: "Depot", inputType: "counter", points: 1, max: 36, description: "1 ponto por ARTIFACT no DEPOT durante TELEOP." },
      { id: "decode_teleop_pattern", phase: "teleop", label: "ARTIFACTS do PATTERN que combinam com o MOTIF", shortLabel: "Pattern", inputType: "counter", points: 2, max: 36, description: "2 pontos por ARTIFACT do PATTERN que corresponde ao MOTIF." },
      { id: "decode_teleop_cycles", phase: "teleop", label: "Ciclos observados", shortLabel: "Ciclos", inputType: "counter", points: 0, max: 40, countsTowardCycles: true, description: "Métrica interna de velocidade; não adiciona pontos oficiais." },
      { id: "decode_teleop_failed", phase: "teleop", label: "Tentativas sem pontuar", shortLabel: "Falhas", inputType: "counter", points: 0, max: 40, countsAsFailure: true, description: "Métrica interna de confiabilidade; não altera o placar oficial." },
    ],
    endgame: [
      { id: "decode_base_return", phase: "endgame", label: "Retorno à BASE", shortLabel: "BASE", inputType: "select", points: 0, max: 1, description: "No fim do TELEOP: parcialmente na BASE vale 5; totalmente na BASE vale 10.", options: [{ value: "none", label: "Não retornou", points: 0 }, { value: "partial", label: "Parcialmente na BASE", points: 5 }, { value: "full", label: "Totalmente na BASE", points: 10 }] },
      { id: "decode_two_robots_base_bonus", phase: "endgame", label: "Bônus: 2 robôs totalmente na BASE", shortLabel: "Bônus BASE", inputType: "boolean", points: 10, max: 1, allianceScoped: true, description: "10 pontos por aliança. Registre somente uma vez por aliança para não duplicar o bônus." },
      { id: "decode_endgame_failed", phase: "endgame", label: "Tentativas finais sem pontuar", shortLabel: "Falhas", inputType: "counter", points: 0, max: 10, countsAsFailure: true, description: "Métrica interna de confiabilidade; não altera o placar oficial." },
    ],
  },
};

function clonePreset(preset) {
  return JSON.parse(JSON.stringify(preset));
}

export function createBiobuzzPreseasonConfig() {
  return clonePreset(BIOBUZZ_PRESEASON_CONFIG);
}

export function createDecodeArchiveConfig() {
  return clonePreset(DECODE_ARCHIVE_CONFIG);
}

export const SEED_SEASON_CONFIG = BIOBUZZ_PRESEASON_CONFIG;

function buildSeedState() {
  return {
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: SEED_CREATED_AT,
    updatedAt: SEED_CREATED_AT,
    seasonConfigs: [createBiobuzzPreseasonConfig()],
    events: [],
    scouts: [],
    teams: [],
    matches: [],
    matchTeams: [],
    scoutingRecords: [],
    favorites: [],
    watchlist: [],
    notes: [],
    syncQueue: [],
    settings: {
      currentScoutId: null,
      activeEventId: null,
      activeSeasonId: SEED_IDS.season,
      ratingWeights: { ...DEFAULT_RATING_WEIGHTS },
    },
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

/** Immutable template data. Always use createSeedState() before editing. */
export const DEFAULT_STATE = deepFreeze(buildSeedState());

/** Return a detached, empty local workspace configured for current FTC material. */
export function createSeedState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export default createSeedState;
