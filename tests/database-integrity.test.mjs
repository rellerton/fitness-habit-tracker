import test from "node:test";
import assert from "node:assert/strict";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { basename, join, resolve, sep } from "node:path";
import { PrismaClient } from "@prisma/client";

const REPO_ROOT = process.cwd();
const SOURCE_PRISMA = join(REPO_ROOT, "prisma");
const SOURCE_MIGRATIONS = join(SOURCE_PRISMA, "migrations");
const TEST_ROOT = join(REPO_ROOT, "data", "test-runs");
const MIGRATIONS = readdirSync(SOURCE_MIGRATIONS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

function databaseUrl(path) {
  const absolutePath = resolve(path).replaceAll("\\", "/");
  return `file:${absolutePath}`;
}

function runPrisma(args, env) {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(command, ["prisma", ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
    stdio: "inherit",
  });
}

function safeRemoveTestDirectory(directory) {
  const resolvedDirectory = resolve(directory);
  const resolvedTestRoot = resolve(TEST_ROOT);
  if (
    !resolvedDirectory.startsWith(`${resolvedTestRoot}${sep}`) ||
    !basename(resolvedDirectory).startsWith("e2m-tracker-test-")
  ) {
    throw new Error(`Refusing to remove unexpected test directory: ${resolvedDirectory}`);
  }
  rmSync(resolvedDirectory, { recursive: true, force: true });
}

function createMigrationWorkspace(migrationCount = MIGRATIONS.length) {
  mkdirSync(TEST_ROOT, { recursive: true });
  const directory = mkdtempSync(join(TEST_ROOT, "e2m-tracker-test-"));
  const prismaDirectory = join(directory, "prisma");
  const migrationsDirectory = join(prismaDirectory, "migrations");
  mkdirSync(migrationsDirectory, { recursive: true });
  copyFileSync(join(SOURCE_PRISMA, "schema.prisma"), join(prismaDirectory, "schema.prisma"));
  copyFileSync(
    join(SOURCE_MIGRATIONS, "migration_lock.toml"),
    join(migrationsDirectory, "migration_lock.toml")
  );
  for (const migration of MIGRATIONS.slice(0, migrationCount)) {
    cpSync(join(SOURCE_MIGRATIONS, migration), join(migrationsDirectory, migration), {
      recursive: true,
    });
  }
  // Prisma 5's Windows schema engine does not reliably create a SQLite file in
  // a freshly-created nested test directory, so create the empty database first.
  writeFileSync(join(directory, "database.db"), "");
  return {
    directory,
    databasePath: join(directory, "database.db"),
    migrationDatabaseUrl: "file:../database.db",
    migrationsDirectory,
    schemaPath: join(prismaDirectory, "schema.prisma"),
  };
}

async function migrationCount(client) {
  const rows = await client.$queryRawUnsafe(
    'SELECT COUNT(*) AS "count" FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL'
  );
  return Number(rows[0].count);
}

test("every historical schema state upgrades through the current migration", async () => {
  assert.ok(MIGRATIONS.length > 1, "migration history should contain upgrade states");

  for (let prefixLength = 1; prefixLength < MIGRATIONS.length; prefixLength += 1) {
    const workspace = createMigrationWorkspace(prefixLength);
    const url = databaseUrl(workspace.databasePath);
    try {
      runPrisma(["migrate", "deploy", "--schema", workspace.schemaPath], {
        DATABASE_URL: workspace.migrationDatabaseUrl,
      });

      for (const migration of MIGRATIONS.slice(prefixLength)) {
        cpSync(
          join(SOURCE_MIGRATIONS, migration),
          join(workspace.migrationsDirectory, migration),
          { recursive: true }
        );
      }

      runPrisma(["migrate", "deploy", "--schema", workspace.schemaPath], {
        DATABASE_URL: workspace.migrationDatabaseUrl,
      });

      const client = new PrismaClient({ datasources: { db: { url } } });
      try {
        assert.equal(await migrationCount(client), MIGRATIONS.length);
      } finally {
        await client.$disconnect();
      }
    } finally {
      safeRemoveTestDirectory(workspace.directory);
    }
  }
});

test("transactions, concurrency, cascades, and cold backup restore preserve integrity", async () => {
  const workspace = createMigrationWorkspace();
  const sourceUrl = databaseUrl(workspace.databasePath);
  const backupPath = join(workspace.directory, "backup.db");
  let client = new PrismaClient({ datasources: { db: { url: sourceUrl } } });

  try {
    runPrisma(["migrate", "deploy", "--schema", workspace.schemaPath], {
      DATABASE_URL: workspace.migrationDatabaseUrl,
    });

    await assert.rejects(
      client.$transaction(async (transaction) => {
        await transaction.person.create({ data: { name: "Rollback sentinel" } });
        throw new Error("intentional rollback");
      }),
      /intentional rollback/
    );
    assert.equal(await client.person.count({ where: { name: "Rollback sentinel" } }), 0);

    const trackerType = await client.trackerType.create({ data: { name: "Integrity type" } });
    const category = await client.category.create({
      data: { trackerTypeId: trackerType.id, name: "Integrity category" },
    });
    const person = await client.person.create({ data: { name: "Integrity person" } });
    const otherPerson = await client.person.create({ data: { name: "Other person" } });
    const tracker = await client.tracker.create({
      data: {
        personId: person.id,
        trackerTypeId: trackerType.id,
        name: "Integrity tracker",
      },
    });

    await assert.rejects(
      client.round.create({
        data: {
          personId: otherPerson.id,
          trackerId: tracker.id,
          startDate: new Date("2026-03-02T00:00:00"),
          lengthWeeks: 4,
        },
      }),
      /Foreign key constraint violated/
    );

    const round = await client.round.create({
      data: {
        personId: person.id,
        trackerId: tracker.id,
        startDate: new Date("2026-03-02T00:00:00"),
        lengthWeeks: 4,
        roundCategories: {
          create: {
            categoryId: category.id,
            displayName: category.name,
            sortOrder: 1,
          },
        },
        weightEntries: {
          create: { weekIndex: 0, date: new Date("2026-03-02T00:00:00"), weight: 180 },
        },
      },
    });

    const entryDate = new Date("2026-03-03T00:00:00");
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        client.entry.upsert({
          where: {
            roundId_categoryId_date: {
              roundId: round.id,
              categoryId: category.id,
              date: entryDate,
            },
          },
          update: { status: index % 2 === 0 ? "HALF" : "DONE" },
          create: {
            roundId: round.id,
            categoryId: category.id,
            date: entryDate,
            status: "HALF",
          },
        })
      )
    );
    assert.equal(await client.entry.count({ where: { roundId: round.id } }), 1);

    await client.$disconnect();
    copyFileSync(workspace.databasePath, backupPath);

    const restored = new PrismaClient({
      datasources: { db: { url: databaseUrl(backupPath) } },
    });
    try {
      assert.equal(await restored.round.count({ where: { id: round.id } }), 1);
      assert.equal(await restored.entry.count({ where: { roundId: round.id } }), 1);
      assert.equal(await restored.weightEntry.count({ where: { roundId: round.id } }), 1);

      await restored.person.delete({ where: { id: person.id } });
      assert.equal(await restored.tracker.count({ where: { id: tracker.id } }), 0);
      assert.equal(await restored.round.count({ where: { id: round.id } }), 0);
      assert.equal(await restored.entry.count({ where: { roundId: round.id } }), 0);
      assert.equal(await restored.weightEntry.count({ where: { roundId: round.id } }), 0);
    } finally {
      await restored.$disconnect();
    }
  } finally {
    await client.$disconnect().catch(() => undefined);
    safeRemoveTestDirectory(workspace.directory);
  }
});
