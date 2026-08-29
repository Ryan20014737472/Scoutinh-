import {
  APP_SCHEMA_VERSION,
  DEFAULT_RATING_WEIGHTS,
  createRobotState,
  getSeasonActions,
} from "../types/domain.js";

export { APP_SCHEMA_VERSION } from "../types/domain.js";
export const STORAGE_KEY = "ftc-scout-arena.state.v1";

export const SEED_IDS = Object.freeze({
  season: "season-2026-nexus",
  event: "event-nexus-qualifier",
  currentScout: "scout-ana",
});

const SEED_CREATED_AT = "2026-08-29T11:40:00.000-03:00";
const SEED_UPDATED_AT = "2026-08-29T14:35:00.000-03:00";

/**
 * Example game configuration. The app renders controls from this data instead
 * of hard-coding a particular FTC season's scoring rules.
 */
const SEASON_CONFIG = {
  id: SEED_IDS.season,
  name: "Temporada 2026 · Nexus",
  gameName: "Nexus",
  year: "2026",
  isActive: true,
  createdAt: SEED_CREATED_AT,
  updatedAt: SEED_UPDATED_AT,
  actions: {
    auto: [
      {
        id: "auto_scored",
        phase: "auto",
        label: "Objetos pontuados",
        shortLabel: "Objetos",
        inputType: "counter",
        points: 5,
        max: 12,
        countsTowardCycles: false,
        description: "Objetos marcados durante o Autonomous.",
      },
      {
        id: "auto_leave_zone",
        phase: "auto",
        label: "Saiu da zona inicial",
        shortLabel: "Saiu da zona",
        inputType: "boolean",
        points: 3,
        max: 1,
        countsTowardCycles: false,
      },
      {
        id: "auto_special_goal",
        phase: "auto",
        label: "Objetivo especial",
        shortLabel: "Especial",
        inputType: "boolean",
        points: 8,
        max: 1,
        countsTowardCycles: false,
      },
      {
        id: "auto_failed_attempts",
        phase: "auto",
        label: "Tentativas com falha",
        shortLabel: "Falhas",
        inputType: "counter",
        points: 0,
        max: 20,
        countsTowardCycles: false,
        countsAsFailure: true,
      },
    ],
    teleop: [
      {
        id: "teleop_low_goal",
        phase: "teleop",
        label: "Objetos no alvo baixo",
        shortLabel: "Alvo baixo",
        inputType: "counter",
        points: 2,
        max: 40,
        countsTowardCycles: false,
      },
      {
        id: "teleop_high_goal",
        phase: "teleop",
        label: "Objetos no alvo alto",
        shortLabel: "Alvo alto",
        inputType: "counter",
        points: 4,
        max: 40,
        countsTowardCycles: false,
      },
      {
        id: "teleop_cycles",
        phase: "teleop",
        label: "Ciclos completos",
        shortLabel: "Ciclos",
        inputType: "counter",
        points: 0,
        max: 25,
        countsTowardCycles: true,
      },
      {
        id: "teleop_special_action",
        phase: "teleop",
        label: "Ação especial",
        shortLabel: "Especial",
        inputType: "boolean",
        points: 5,
        max: 1,
        countsTowardCycles: false,
      },
      {
        id: "teleop_failed_attempts",
        phase: "teleop",
        label: "Tentativas com falha",
        shortLabel: "Falhas",
        inputType: "counter",
        points: 0,
        max: 30,
        countsTowardCycles: false,
        countsAsFailure: true,
      },
    ],
    endgame: [
      {
        id: "endgame_park",
        phase: "endgame",
        label: "Estacionou",
        shortLabel: "Estacionou",
        inputType: "boolean",
        points: 8,
        max: 1,
        countsTowardCycles: false,
      },
      {
        id: "endgame_hang_level",
        phase: "endgame",
        label: "Nível de suspensão",
        shortLabel: "Suspensão",
        inputType: "select",
        points: 0,
        max: 1,
        countsTowardCycles: false,
        options: [
          { value: "none", label: "Não tentou", points: 0 },
          { value: "low", label: "Nível baixo", points: 15 },
          { value: "high", label: "Nível alto", points: 30 },
        ],
      },
      {
        id: "endgame_special_goal",
        phase: "endgame",
        label: "Objetivo especial",
        shortLabel: "Especial",
        inputType: "boolean",
        points: 12,
        max: 1,
        countsTowardCycles: false,
      },
      {
        id: "endgame_failed_attempts",
        phase: "endgame",
        label: "Tentativas com falha",
        shortLabel: "Falhas",
        inputType: "counter",
        points: 0,
        max: 10,
        countsTowardCycles: false,
        countsAsFailure: true,
      },
    ],
  },
};

const TEAMS = [
  {
    id: "team-10234",
    number: "10234",
    name: "Aurora Robotics",
    robotName: "Solstice",
    city: "Curitiba, PR",
    rookieYear: 2017,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "team-11877",
    number: "11877",
    name: "Maré Alta",
    robotName: "Nautilus",
    city: "Florianópolis, SC",
    rookieYear: 2018,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "team-13594",
    number: "13594",
    name: "Circuit Breakers",
    robotName: "Volt",
    city: "São Paulo, SP",
    rookieYear: 2019,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "team-14901",
    number: "14901",
    name: "Atlas Robotics",
    robotName: "Keystone",
    city: "Campinas, SP",
    rookieYear: 2020,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "team-16284",
    number: "16284",
    name: "Vortex Robotics",
    robotName: "Gyro",
    city: "Joinville, SC",
    rookieYear: 2021,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "team-17320",
    number: "17320",
    name: "HexaDrive",
    robotName: "Pulse",
    city: "Ponta Grossa, PR",
    rookieYear: 2022,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "team-18452",
    number: "18452",
    name: "Lumen Robotics",
    robotName: "Photon",
    city: "Maringá, PR",
    rookieYear: 2023,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "team-19606",
    number: "19606",
    name: "Quantum Core",
    robotName: "Qubit",
    city: "Londrina, PR",
    rookieYear: 2024,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "team-20731",
    number: "20731",
    name: "Orion Mechanics",
    robotName: "Nova",
    city: "São José dos Pinhais, PR",
    rookieYear: 2025,
    createdAt: SEED_CREATED_AT,
  },
];

const SCOUTS = [
  {
    id: "scout-ana",
    name: "Ana Costa",
    initials: "AC",
    role: "Administrador",
    color: "#7c5cff",
    isActive: true,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "scout-bruno",
    name: "Bruno Lima",
    initials: "BL",
    role: "Scout",
    color: "#1ec8a5",
    isActive: true,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "scout-camila",
    name: "Camila Rocha",
    initials: "CR",
    role: "Scout",
    color: "#ff9f43",
    isActive: true,
    createdAt: SEED_CREATED_AT,
  },
  {
    id: "scout-diego",
    name: "Diego Alves",
    initials: "DA",
    role: "Estratégia",
    color: "#46a7ff",
    isActive: true,
    createdAt: SEED_CREATED_AT,
  },
];

const EVENT = {
  id: SEED_IDS.event,
  seasonId: SEED_IDS.season,
  name: "Nexus Qualifier · Curitiba",
  code: "NQ-2026-CTB",
  type: "Qualifier",
  status: "active",
  location: "Curitiba, PR",
  timezone: "America/Sao_Paulo",
  startDate: "2026-08-29",
  endDate: "2026-08-30",
  teamIds: TEAMS.map((team) => team.id),
  import: {
    source: "manual",
    externalId: null,
    lastImportedAt: null,
  },
  createdAt: SEED_CREATED_AT,
  updatedAt: SEED_UPDATED_AT,
};

/**
 * A UI-friendly match representation. `matchTeams` below mirrors each alliance
 * entry as a normalized collection for eventual database sync/import adapters.
 */
function createMatch({ number, status, scheduledAt, red, blue, assignments = {} }) {
  const id = `match-q-${String(number).padStart(2, "0")}`;
  return {
    id,
    eventId: SEED_IDS.event,
    seasonId: SEED_IDS.season,
    number,
    level: "qualification",
    label: `Qualificação ${number}`,
    status,
    scheduledAt,
    alliances: {
      red: { teamIds: red, scoreOfficial: null },
      blue: { teamIds: blue, scoreOfficial: null },
    },
    // Small aliases keep simple list/detail views terse without changing IDs.
    redAlliance: red,
    blueAlliance: blue,
    scoutAssignments: assignments,
    createdAt: SEED_CREATED_AT,
    updatedAt: SEED_UPDATED_AT,
  };
}

const MATCHES = [
  createMatch({
    number: 1,
    status: "complete",
    scheduledAt: "2026-08-29T09:00:00.000-03:00",
    red: ["team-10234", "team-11877"],
    blue: ["team-13594", "team-14901"],
    assignments: {
      "red-1": "scout-ana",
      "red-2": "scout-bruno",
      "blue-1": "scout-camila",
      "blue-2": "scout-diego",
    },
  }),
  createMatch({
    number: 2,
    status: "complete",
    scheduledAt: "2026-08-29T09:18:00.000-03:00",
    red: ["team-16284", "team-17320"],
    blue: ["team-18452", "team-19606"],
    assignments: {
      "red-1": "scout-camila",
      "red-2": "scout-ana",
      "blue-1": "scout-diego",
      "blue-2": "scout-bruno",
    },
  }),
  createMatch({
    number: 3,
    status: "complete",
    scheduledAt: "2026-08-29T09:36:00.000-03:00",
    red: ["team-20731", "team-10234"],
    blue: ["team-13594", "team-16284"],
    assignments: {
      "red-1": "scout-diego",
      "red-2": "scout-ana",
      "blue-1": "scout-bruno",
      "blue-2": "scout-camila",
    },
  }),
  createMatch({
    number: 4,
    status: "in_progress",
    scheduledAt: "2026-08-29T09:54:00.000-03:00",
    red: ["team-11877", "team-14901"],
    blue: ["team-17320", "team-18452"],
    assignments: {
      "red-1": "scout-bruno",
      "red-2": "scout-diego",
      "blue-1": "scout-ana",
      "blue-2": "scout-camila",
    },
  }),
  createMatch({
    number: 5,
    status: "not_started",
    scheduledAt: "2026-08-29T10:12:00.000-03:00",
    red: ["team-19606", "team-20731"],
    blue: ["team-10234", "team-13594"],
  }),
  createMatch({
    number: 6,
    status: "not_started",
    scheduledAt: "2026-08-29T10:30:00.000-03:00",
    red: ["team-14901", "team-16284"],
    blue: ["team-11877", "team-18452"],
  }),
  createMatch({
    number: 7,
    status: "not_started",
    scheduledAt: "2026-08-29T10:48:00.000-03:00",
    red: ["team-17320", "team-19606"],
    blue: ["team-20731", "team-14901"],
  }),
];

const MATCH_TEAMS = MATCHES.flatMap((match) => [
  ...match.alliances.red.teamIds.map((teamId, index) => ({
    id: `${match.id}:${teamId}`,
    matchId: match.id,
    teamId,
    alliance: "red",
    station: index + 1,
  })),
  ...match.alliances.blue.teamIds.map((teamId, index) => ({
    id: `${match.id}:${teamId}`,
    matchId: match.id,
    teamId,
    alliance: "blue",
    station: index + 1,
  })),
]);

function actionPoints(action, value) {
  if (action.inputType === "boolean") return value ? Number(action.points) || 0 : 0;
  if (action.inputType === "select") {
    const option = action.options?.find((item) => item.value === value);
    return Number(option?.points ?? action.points) || 0;
  }
  return (Number(value) || 0) * (Number(action.points) || 0);
}

function calculateSeedScore(actions) {
  const phaseScores = { auto: 0, teleop: 0, endgame: 0 };
  let cycles = 0;
  let failures = 0;
  for (const action of getSeasonActions(SEASON_CONFIG)) {
    const value = actions[action.id];
    phaseScores[action.phase] += actionPoints(action, value);
    if (action.countsTowardCycles) cycles += Number(value) || 0;
    if (action.countsAsFailure) failures += Number(value) || 0;
  }
  return {
    auto: phaseScores.auto,
    teleop: phaseScores.teleop,
    endgame: phaseScores.endgame,
    total: phaseScores.auto + phaseScores.teleop + phaseScores.endgame,
    cycles,
    failures,
  };
}

function createRecord({ id, matchId, teamId, scoutId, alliance, station, actions, robot, notes, createdAt }) {
  const calculated = calculateSeedScore(actions);
  return {
    id,
    eventId: SEED_IDS.event,
    matchId,
    teamId,
    scoutId,
    seasonId: SEED_IDS.season,
    alliance,
    station,
    status: "synced",
    actions,
    score: {
      auto: calculated.auto,
      teleop: calculated.teleop,
      endgame: calculated.endgame,
      total: calculated.total,
    },
    cycles: calculated.cycles,
    failures: calculated.failures,
    robot: createRobotState(robot),
    notes,
    createdAt,
    updatedAt: createdAt,
    syncedAt: createdAt,
  };
}

const SCOUTING_RECORDS = [
  createRecord({
    id: "record-q01-t10234",
    matchId: "match-q-01",
    teamId: "team-10234",
    scoutId: "scout-ana",
    alliance: "red",
    station: 1,
    actions: {
      auto_scored: 4, auto_leave_zone: true, auto_special_goal: true, auto_failed_attempts: 0,
      teleop_low_goal: 5, teleop_high_goal: 9, teleop_cycles: 8, teleop_special_action: true, teleop_failed_attempts: 1,
      endgame_park: true, endgame_hang_level: "high", endgame_special_goal: false, endgame_failed_attempts: 0,
    },
    robot: { defense: "none", exceptionalPerformance: true },
    notes: "Auto consistente e ciclos rápidos. Excelente candidato de aliança.",
    createdAt: "2026-08-29T09:04:20.000-03:00",
  }),
  createRecord({
    id: "record-q01-t11877",
    matchId: "match-q-01",
    teamId: "team-11877",
    scoutId: "scout-bruno",
    alliance: "red",
    station: 2,
    actions: {
      auto_scored: 2, auto_leave_zone: true, auto_special_goal: false, auto_failed_attempts: 1,
      teleop_low_goal: 8, teleop_high_goal: 4, teleop_cycles: 6, teleop_special_action: false, teleop_failed_attempts: 2,
      endgame_park: true, endgame_hang_level: "low", endgame_special_goal: false, endgame_failed_attempts: 0,
    },
    robot: { defense: "medium" },
    notes: "Bom volume no alvo baixo; perdeu um ciclo por congestionamento.",
    createdAt: "2026-08-29T09:04:42.000-03:00",
  }),
  createRecord({
    id: "record-q01-t13594",
    matchId: "match-q-01",
    teamId: "team-13594",
    scoutId: "scout-camila",
    alliance: "blue",
    station: 1,
    actions: {
      auto_scored: 3, auto_leave_zone: true, auto_special_goal: false, auto_failed_attempts: 0,
      teleop_low_goal: 4, teleop_high_goal: 10, teleop_cycles: 8, teleop_special_action: true, teleop_failed_attempts: 1,
      endgame_park: true, endgame_hang_level: "high", endgame_special_goal: false, endgame_failed_attempts: 0,
    },
    robot: { defense: "none" },
    notes: "Mira muito boa no alvo alto. Autônomo limpo.",
    createdAt: "2026-08-29T09:05:03.000-03:00",
  }),
  createRecord({
    id: "record-q01-t14901",
    matchId: "match-q-01",
    teamId: "team-14901",
    scoutId: "scout-diego",
    alliance: "blue",
    station: 2,
    actions: {
      auto_scored: 1, auto_leave_zone: true, auto_special_goal: false, auto_failed_attempts: 2,
      teleop_low_goal: 6, teleop_high_goal: 3, teleop_cycles: 5, teleop_special_action: false, teleop_failed_attempts: 4,
      endgame_park: false, endgame_hang_level: "none", endgame_special_goal: false, endgame_failed_attempts: 1,
    },
    robot: { stalled: true, programmingIssue: true, defense: "medium" },
    notes: "Travou duas vezes na coleta; observar estabilidade do software.",
    createdAt: "2026-08-29T09:05:27.000-03:00",
  }),
  createRecord({
    id: "record-q02-t16284",
    matchId: "match-q-02",
    teamId: "team-16284",
    scoutId: "scout-camila",
    alliance: "red",
    station: 1,
    actions: {
      auto_scored: 3, auto_leave_zone: true, auto_special_goal: true, auto_failed_attempts: 0,
      teleop_low_goal: 2, teleop_high_goal: 11, teleop_cycles: 9, teleop_special_action: true, teleop_failed_attempts: 0,
      endgame_park: true, endgame_hang_level: "high", endgame_special_goal: true, endgame_failed_attempts: 0,
    },
    robot: { defense: "none", exceptionalPerformance: true },
    notes: "Partida muito completa. Alta pontuação em todas as fases.",
    createdAt: "2026-08-29T09:22:19.000-03:00",
  }),
  createRecord({
    id: "record-q02-t17320",
    matchId: "match-q-02",
    teamId: "team-17320",
    scoutId: "scout-ana",
    alliance: "red",
    station: 2,
    actions: {
      auto_scored: 0, auto_leave_zone: true, auto_special_goal: false, auto_failed_attempts: 1,
      teleop_low_goal: 3, teleop_high_goal: 5, teleop_cycles: 6, teleop_special_action: false, teleop_failed_attempts: 2,
      endgame_park: true, endgame_hang_level: "low", endgame_special_goal: false, endgame_failed_attempts: 0,
    },
    robot: { defense: "strong" },
    notes: "Defesa forte sem muitas penalidades. Auto ainda inconsistente.",
    createdAt: "2026-08-29T09:22:48.000-03:00",
  }),
  createRecord({
    id: "record-q02-t18452",
    matchId: "match-q-02",
    teamId: "team-18452",
    scoutId: "scout-diego",
    alliance: "blue",
    station: 1,
    actions: {
      auto_scored: 2, auto_leave_zone: true, auto_special_goal: false, auto_failed_attempts: 0,
      teleop_low_goal: 9, teleop_high_goal: 3, teleop_cycles: 7, teleop_special_action: true, teleop_failed_attempts: 1,
      endgame_park: true, endgame_hang_level: "low", endgame_special_goal: false, endgame_failed_attempts: 0,
    },
    robot: { defense: "medium" },
    notes: "Boa rota de coleta; pode ser parceiro complementar.",
    createdAt: "2026-08-29T09:23:02.000-03:00",
  }),
  createRecord({
    id: "record-q02-t19606",
    matchId: "match-q-02",
    teamId: "team-19606",
    scoutId: "scout-bruno",
    alliance: "blue",
    station: 2,
    actions: {
      auto_scored: 1, auto_leave_zone: false, auto_special_goal: false, auto_failed_attempts: 1,
      teleop_low_goal: 5, teleop_high_goal: 6, teleop_cycles: 6, teleop_special_action: false, teleop_failed_attempts: 3,
      endgame_park: true, endgame_hang_level: "none", endgame_special_goal: false, endgame_failed_attempts: 1,
    },
    robot: { electricalIssue: true, defense: "none" },
    notes: "Queda momentânea de energia; precisa de nova observação.",
    createdAt: "2026-08-29T09:23:18.000-03:00",
  }),
  createRecord({
    id: "record-q03-t20731",
    matchId: "match-q-03",
    teamId: "team-20731",
    scoutId: "scout-diego",
    alliance: "red",
    station: 1,
    actions: {
      auto_scored: 2, auto_leave_zone: true, auto_special_goal: false, auto_failed_attempts: 0,
      teleop_low_goal: 7, teleop_high_goal: 7, teleop_cycles: 7, teleop_special_action: true, teleop_failed_attempts: 1,
      endgame_park: true, endgame_hang_level: "high", endgame_special_goal: false, endgame_failed_attempts: 0,
    },
    robot: { defense: "none", exceptionalPerformance: true },
    notes: "Rookie promissor: ritmo estável e finalização confiável.",
    createdAt: "2026-08-29T09:40:15.000-03:00",
  }),
  createRecord({
    id: "record-q03-t10234",
    matchId: "match-q-03",
    teamId: "team-10234",
    scoutId: "scout-ana",
    alliance: "red",
    station: 2,
    actions: {
      auto_scored: 3, auto_leave_zone: true, auto_special_goal: true, auto_failed_attempts: 0,
      teleop_low_goal: 4, teleop_high_goal: 8, teleop_cycles: 8, teleop_special_action: true, teleop_failed_attempts: 1,
      endgame_park: true, endgame_hang_level: "high", endgame_special_goal: false, endgame_failed_attempts: 0,
    },
    robot: { defense: "none", exceptionalPerformance: true },
    notes: "Mantém alto nível; ficou livre para marcar enquanto o parceiro defendia.",
    createdAt: "2026-08-29T09:40:39.000-03:00",
  }),
  createRecord({
    id: "record-q03-t13594",
    matchId: "match-q-03",
    teamId: "team-13594",
    scoutId: "scout-bruno",
    alliance: "blue",
    station: 1,
    actions: {
      auto_scored: 3, auto_leave_zone: true, auto_special_goal: false, auto_failed_attempts: 0,
      teleop_low_goal: 2, teleop_high_goal: 12, teleop_cycles: 9, teleop_special_action: true, teleop_failed_attempts: 0,
      endgame_park: true, endgame_hang_level: "high", endgame_special_goal: true, endgame_failed_attempts: 0,
    },
    robot: { defense: "none", exceptionalPerformance: true },
    notes: "Melhor partida até agora. Excelente alinhamento no alvo alto.",
    createdAt: "2026-08-29T09:40:56.000-03:00",
  }),
  createRecord({
    id: "record-q03-t16284",
    matchId: "match-q-03",
    teamId: "team-16284",
    scoutId: "scout-camila",
    alliance: "blue",
    station: 2,
    actions: {
      auto_scored: 2, auto_leave_zone: true, auto_special_goal: true, auto_failed_attempts: 1,
      teleop_low_goal: 3, teleop_high_goal: 9, teleop_cycles: 8, teleop_special_action: false, teleop_failed_attempts: 1,
      endgame_park: true, endgame_hang_level: "high", endgame_special_goal: false, endgame_failed_attempts: 0,
    },
    robot: { defense: "medium" },
    notes: "Bom desempenho mesmo com defesa média no fim da partida.",
    createdAt: "2026-08-29T09:41:12.000-03:00",
  }),
];

const FAVORITES = [
  {
    id: "favorite-t10234",
    eventId: SEED_IDS.event,
    teamId: "team-10234",
    createdBy: "scout-ana",
    createdAt: "2026-08-29T09:42:00.000-03:00",
  },
  {
    id: "favorite-t13594",
    eventId: SEED_IDS.event,
    teamId: "team-13594",
    createdBy: "scout-ana",
    createdAt: "2026-08-29T09:42:10.000-03:00",
  },
  {
    id: "favorite-t16284",
    eventId: SEED_IDS.event,
    teamId: "team-16284",
    createdBy: "scout-diego",
    createdAt: "2026-08-29T09:42:20.000-03:00",
  },
];

const WATCHLIST = [
  {
    id: "watch-t14901",
    eventId: SEED_IDS.event,
    teamId: "team-14901",
    category: "watch_again",
    priority: "high",
    reason: "Confirmar se as travadas vistas na Qualificação 1 persistem.",
    createdBy: "scout-diego",
    createdAt: "2026-08-29T09:43:00.000-03:00",
  },
  {
    id: "watch-t17320",
    eventId: SEED_IDS.event,
    teamId: "team-17320",
    category: "defense",
    priority: "medium",
    reason: "Mapear em quais rotas a defesa é mais eficaz.",
    createdBy: "scout-ana",
    createdAt: "2026-08-29T09:43:10.000-03:00",
  },
  {
    id: "watch-t20731",
    eventId: SEED_IDS.event,
    teamId: "team-20731",
    category: "alliance_pick",
    priority: "high",
    reason: "Verificar repetibilidade antes da rodada de alianças.",
    createdBy: "scout-ana",
    createdAt: "2026-08-29T09:43:20.000-03:00",
  },
];

const NOTES = [
  {
    id: "note-event-briefing",
    eventId: SEED_IDS.event,
    authorId: "scout-ana",
    body: "Prioridade da manhã: validar autonomia e suspensão dos times favoritos.",
    createdAt: "2026-08-29T08:40:00.000-03:00",
    updatedAt: "2026-08-29T08:40:00.000-03:00",
  },
  {
    id: "note-team-19606",
    eventId: SEED_IDS.event,
    teamId: "team-19606",
    authorId: "scout-bruno",
    body: "Solicitar novo scout na Qualificação 5 após possível problema elétrico.",
    createdAt: "2026-08-29T09:44:00.000-03:00",
    updatedAt: "2026-08-29T09:44:00.000-03:00",
  },
];

// Read-only convenience exports for screens/services that need the sample
// entities independently. They are frozen together with DEFAULT_STATE below.
export const SEED_SEASON_CONFIG = SEASON_CONFIG;
export const SEED_EVENT = EVENT;
export const SEED_MATCHES = MATCHES;
export const SEED_TEAMS = TEAMS;
export const SEED_SCOUTS = SCOUTS;

function buildSeedState() {
  return {
    schemaVersion: APP_SCHEMA_VERSION,
    createdAt: SEED_CREATED_AT,
    updatedAt: SEED_UPDATED_AT,
    seasonConfigs: [SEASON_CONFIG],
    events: [EVENT],
    scouts: SCOUTS,
    teams: TEAMS,
    matches: MATCHES,
    matchTeams: MATCH_TEAMS,
    scoutingRecords: SCOUTING_RECORDS,
    favorites: FAVORITES,
    watchlist: WATCHLIST,
    notes: NOTES,
    // Queue entries use this shape when an offline submission still needs sync.
    syncQueue: [],
    settings: {
      currentScoutId: SEED_IDS.currentScout,
      activeEventId: SEED_IDS.event,
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

/** Immutable reference data. Always use createSeedState() before editing. */
export const DEFAULT_STATE = deepFreeze(buildSeedState());

/**
 * Return a completely detached, JSON-safe initial state for storage hydration,
 * demos or reset-to-sample-data. No caller can mutate DEFAULT_STATE by accident.
 */
export function createSeedState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

export default createSeedState;
