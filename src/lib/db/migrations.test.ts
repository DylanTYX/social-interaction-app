import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The migration files, read as the sequence someone setting up the database
 * runs them in.
 *
 * `append_interview_turn` once set `interview_sessions.updated_at`, a column no
 * migration had created. plpgsql only resolves column names when a statement
 * runs, so the function was created without complaint and every turn afterwards
 * failed with 42703 — the greeting generated and thrown away, every reply lost,
 * every resumed session blank. Nothing in the test suite read the migrations, so
 * nothing noticed. This does: it rebuilds each table's columns from the SQL and
 * checks every column the latest definition of each function inserts into or
 * assigns.
 *
 * The files are also meant to run top to bottom on a new project, so a table
 * named before any file has created it — a policy in the security file for a
 * table the schema file forgot, or a foreign key to a table defined further
 * down — is reported too. Postgres would stop at that statement.
 */

type SqlFile = { file: string; text: string };

const DIR = "supabase/migrations";
const migrations: SqlFile[] = readdirSync(DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort()
  .map((file) => ({
    file,
    text: readFileSync(`${DIR}/${file}`, "utf8").replace(/--[^\n]*/g, ""),
  }));

function schemaColumns(files: SqlFile[]): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const add = (table: string, column: string) => {
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table)!.add(column);
  };
  for (const { text } of files) {
    for (const m of text.matchAll(
      /create table(?: if not exists)?\s+(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\n\);/gi,
    )) {
      for (const line of m[2].split("\n")) {
        const column = line.trim().match(/^([a-z_]+)\s+[a-z]/i)?.[1];
        if (column && !/^(constraint|primary|unique|check|foreign)$/i.test(column)) {
          add(m[1], column);
        }
      }
    }
    // One statement can add several columns, so read every `add column` up to
    // the statement's end, not just the first.
    for (const m of text.matchAll(/alter table\s+(?:public\.)?([a-z_]+)\s+([^;]*);/gi)) {
      for (const c of m[2].matchAll(/add column(?: if not exists)?\s+([a-z_]+)/gi)) {
        add(m[1], c[1]);
      }
    }
    for (const m of text.matchAll(
      /alter table\s+(?:public\.)?([a-z_]+)\s+rename column\s+([a-z_]+)\s+to\s+([a-z_]+)/gi,
    )) {
      tables.get(m[1])?.delete(m[2]);
      add(m[1], m[3]);
    }
  }
  return tables;
}

function latestFunctions(files: SqlFile[]) {
  const functions = new Map<string, { file: string; body: string }>();
  for (const { file, text } of files) {
    for (const m of text.matchAll(
      /create or replace function\s+(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\$\$\s*;/gi,
    )) {
      functions.set(m[1], { file, body: m[2] });
    }
  }
  return functions;
}

function unknownColumnWrites(files: SqlFile[]): string[] {
  const schema = schemaColumns(files);
  const problems: string[] = [];
  for (const [fn, { file, body }] of latestFunctions(files)) {
    for (const m of body.matchAll(/insert into\s+(?:public\.)?([a-z_]+)\s*\(([^)]*)\)/gi)) {
      for (const column of m[2].split(",").map((c) => c.trim()).filter(Boolean)) {
        if (!schema.get(m[1])?.has(column)) {
          problems.push(`${fn} (${file}) inserts ${m[1]}.${column}`);
        }
      }
    }
    for (const m of body.matchAll(/update\s+(?:public\.)?([a-z_]+)\s+set\s+([\s\S]*?)\bwhere\b/gi)) {
      for (const k of m[2].matchAll(/(?:^|,)\s*([a-z_]+)\s*=/g)) {
        if (!schema.get(m[1])?.has(k[1])) {
          problems.push(`${fn} (${file}) sets ${m[1]}.${k[1]}`);
        }
      }
    }
  }
  return problems;
}

/** Statements that fail outright if their table does not exist yet. */
const TABLE_USES = [
  /references\s+(?:public\.)?([a-z_]+)\s*\(/gi,
  /alter table\s+(?:public\.)?([a-z_]+)/gi,
  /on table\s+(?:public\.)?([a-z_]+)/gi,
  /create policy\s+"[^"]+"\s+on\s+(?:public\.)?([a-z_]+)/gi,
  /create (?:unique )?index(?: if not exists)?\s+[a-z_]+\s+on\s+(?:public\.)?([a-z_]+)/gi,
  /\bbefore (?:insert|update|delete) on\s+(?:public\.)?([a-z_]+)/gi,
  /comment on column\s+(?:public\.)?([a-z_]+)\./gi,
  /insert into\s+(?:public\.)?([a-z_]+)/gi,
  /update\s+(?:public\.)?([a-z_]+)\s+set\b/gi,
];

function tablesUsedBeforeCreated(files: SqlFile[]): string[] {
  const created = new Set<string>();
  const problems = new Set<string>();
  for (const { file, text } of files) {
    const events = [
      ...[...text.matchAll(/create table(?: if not exists)?\s+(?:public\.)?([a-z_]+)/gi)].map(
        (m) => ({ at: m.index, table: m[1], creates: true }),
      ),
      ...TABLE_USES.flatMap((pattern) =>
        [...text.matchAll(pattern)].map((m) => ({ at: m.index, table: m[1], creates: false })),
      ),
    ].sort((a, b) => a.at - b.at);
    for (const { table, creates } of events) {
      if (creates) created.add(table);
      else if (!created.has(table)) problems.add(`${file} uses ${table} before any file creates it`);
    }
  }
  return [...problems];
}

describe("the migration files", () => {
  it("reads the migrations it claims to check", () => {
    // Guards against a parser that finds nothing and so passes vacuously.
    expect([...(schemaColumns(migrations).get("interview_sessions") ?? [])]).toEqual(
      expect.arrayContaining(["turn_count", "status", "summary", "updated_at", "archived_at", "active_seconds"]),
    );
    expect([...latestFunctions(migrations).keys()]).toEqual(
      expect.arrayContaining(["append_interview_turn", "update_session_progress", "record_llm_usage"]),
    );
  });

  it("finds no function assigning or inserting a column no migration creates", () => {
    expect(unknownColumnWrites(migrations)).toEqual([]);
  });

  it("would have caught the updated_at bug", () => {
    // Today's schema minus that one column: the check has to name the column
    // that broke every interview turn, or it is not testing anything.
    const withoutColumn = migrations.map(({ file, text }) => ({
      file,
      text: text.replace(
        /(create table if not exists interview_sessions \([\s\S]*?\n)\s*updated_at [^\n]*\n/,
        "$1",
      ),
    }));
    expect(withoutColumn).not.toEqual(migrations);
    expect(unknownColumnWrites(withoutColumn)).toContain(
      "append_interview_turn (0003_functions.sql) sets interview_sessions.updated_at",
    );
  });

  it("creates every table before a later statement uses it", () => {
    expect(tablesUsedBeforeCreated(migrations)).toEqual([]);
  });

  it("would notice the files run out of order", () => {
    const reversed = [...migrations].reverse();
    expect(tablesUsedBeforeCreated(reversed)).toContain(
      "0003_functions.sql uses interview_sessions before any file creates it",
    );
  });
});
