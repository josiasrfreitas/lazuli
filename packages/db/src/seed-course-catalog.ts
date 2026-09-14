import type { DatabaseClient as AppDatabaseClient } from "./client.js";

type DatabaseClient = Pick<AppDatabaseClient, "productLine" | "track" | "stage">;
type CatalogStatusValue = "ACTIVE" | "LEGACY";

type StageSeed = {
  name: string;
  internalCode: string;
};

type TrackSeed = {
  name: string;
  status: CatalogStatusValue;
  portalPrefix: string | null;
  stages: StageSeed[];
};

type ProductLineSeed = {
  key: string;
  name: string;
  status: CatalogStatusValue;
  portalPrefix: string | null;
  tracks: TrackSeed[];
};

export const COURSE_CATALOG: readonly ProductLineSeed[] = [
  {
    key: "adult",
    name: "Adultos",
    status: "ACTIVE",
    portalPrefix: null,
    tracks: [
      {
        name: "Adultos / English Main",
        status: "ACTIVE",
        portalPrefix: null,
        stages: [
          { name: "Essentials 1", internalCode: "E1" },
          { name: "Essentials 2", internalCode: "E2" },
          { name: "Transitions 1", internalCode: "T1" },
          { name: "Transitions 2", internalCode: "T2" },
          { name: "Fluency 1", internalCode: "F1" },
          { name: "Fluency 2", internalCode: "F2" },
          { name: "Fisk in Focus", internalCode: "FIF" },
        ],
      },
      {
        name: "Adultos / Speed",
        status: "ACTIVE",
        portalPrefix: null,
        stages: [
          { name: "Speed 1", internalCode: "S1" },
          { name: "Speed 2", internalCode: "S2" },
          { name: "Speed 3", internalCode: "S3" },
        ],
      },
      {
        name: "Adultos / Espanol",
        status: "ACTIVE",
        portalPrefix: null,
        stages: [
          { name: "Espanol Inmediato 1", internalCode: "EI1" },
          { name: "Espanol Inmediato 2", internalCode: "EI2" },
          { name: "Espanol Inmediato 3", internalCode: "EI3" },
        ],
      },
    ],
  },
  {
    key: "kids",
    name: "Infantil",
    status: "ACTIVE",
    portalPrefix: null,
    tracks: [
      {
        name: "Infantil",
        status: "ACTIVE",
        portalPrefix: null,
        stages: [
          { name: "Magic Way - Yellow Book", internalCode: "MWY" },
          { name: "Magic Way - Blue Book", internalCode: "MWB" },
          { name: "Magic Way - Red Book", internalCode: "MWR" },
          { name: "Magic Way - Green Book", internalCode: "MWG" },
          { name: "Playground - Hello A", internalCode: "PA" },
          { name: "Playground - Hello B", internalCode: "PB" },
          { name: "Playground - Slide", internalCode: "SL" },
          { name: "Playground - See-Saw", internalCode: "SS" },
          { name: "Playground - Merry-Go-Round", internalCode: "MGR" },
          { name: "Playground - Maze", internalCode: "MZ" },
          { name: "Fun at Home", internalCode: "FH" },
          { name: "Fun at School", internalCode: "FS" },
          { name: "Fun Around Town", internalCode: "FAT" },
        ],
      },
    ],
  },
  {
    key: "teens",
    name: "Teens",
    status: "LEGACY",
    portalPrefix: null,
    tracks: [
      {
        name: "Teens Legacy",
        status: "LEGACY",
        portalPrefix: null,
        stages: [
          { name: "Teens Elementary 1", internalCode: "TE1" },
          { name: "Teens Elementary 2", internalCode: "TE2" },
          { name: "Teens Pre-Intermediate", internalCode: "TPI" },
          { name: "Teens Intermediate", internalCode: "TI" },
          { name: "Teens Upper Intermediate", internalCode: "TUI" },
          { name: "Teens Advanced", internalCode: "TA" },
          { name: "Teens Higher 1", internalCode: "TH1" },
          { name: "Teens Higher 2", internalCode: "TH2" },
        ],
      },
    ],
  },
  {
    key: "teens_connect",
    name: "Teens Connect",
    status: "ACTIVE",
    portalPrefix: null,
    tracks: [
      {
        name: "Teens Connect",
        status: "ACTIVE",
        portalPrefix: null,
        stages: [
          { name: "Connect 1", internalCode: "C1" },
          { name: "Connect 2", internalCode: "C2" },
          { name: "Connect 3", internalCode: "C3" },
          { name: "Connect 4", internalCode: "C4" },
        ],
      },
    ],
  },
  {
    key: "teenstation",
    name: "Teenstation",
    status: "LEGACY",
    portalPrefix: null,
    tracks: [
      {
        name: "Teenstation Legacy",
        status: "LEGACY",
        portalPrefix: null,
        stages: [
          { name: "Teenstation 1", internalCode: "TS1" },
          { name: "Teenstation 2", internalCode: "TS2" },
          { name: "Teenstation 3", internalCode: "TS3" },
          { name: "Teenstation 4", internalCode: "TS4" },
        ],
      },
    ],
  },
] as const;

export async function seedCourseCatalog(database: DatabaseClient): Promise<void> {
  for (const productLineSeed of COURSE_CATALOG) {
    await seedProductLine(database, productLineSeed);
  }
}

async function seedProductLine(
  database: DatabaseClient,
  productLineSeed: ProductLineSeed,
): Promise<void> {
  const productLine = await database.productLine.upsert({
    where: { key: productLineSeed.key },
    create: {
      key: productLineSeed.key,
      name: productLineSeed.name,
      status: productLineSeed.status,
      portalPrefix: productLineSeed.portalPrefix,
    },
    update: {
      name: productLineSeed.name,
      status: productLineSeed.status,
      portalPrefix: productLineSeed.portalPrefix,
    },
  });

  for (const trackSeed of productLineSeed.tracks) {
    await seedTrack(database, { productLineId: productLine.id, trackSeed });
  }
}

async function seedTrack(
  database: DatabaseClient,
  { productLineId, trackSeed }: { productLineId: string; trackSeed: TrackSeed },
): Promise<void> {
  const track = await database.track.upsert({
    where: {
      productLineId_name: {
        productLineId,
        name: trackSeed.name,
      },
    },
    create: {
      productLineId,
      name: trackSeed.name,
      status: trackSeed.status,
      portalPrefix: trackSeed.portalPrefix,
    },
    update: {
      name: trackSeed.name,
      status: trackSeed.status,
      portalPrefix: trackSeed.portalPrefix,
    },
  });

  for (const [stageIndex, stageSeed] of trackSeed.stages.entries()) {
    await seedStage(database, { stageIndex, stageSeed, trackId: track.id });
  }
}

async function seedStage(
  database: DatabaseClient,
  { stageIndex, stageSeed, trackId }: { stageIndex: number; stageSeed: StageSeed; trackId: string },
): Promise<void> {
  await database.stage.upsert({
    where: {
      trackId_internalCode: {
        trackId,
        internalCode: stageSeed.internalCode,
      },
    },
    create: {
      trackId,
      name: stageSeed.name,
      internalCode: stageSeed.internalCode,
      sequence: stageIndex + 1,
    },
    update: {
      name: stageSeed.name,
      sequence: stageIndex + 1,
    },
  });
}
