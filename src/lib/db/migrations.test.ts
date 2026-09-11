import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Database functions against the schema the migrations actually build.
 *
 * 0012 rewrote `append_interview_turn` to set `interview_sessions.updated_at`,
 * a column no migration ever created. plpgsql only resolves column names when a
 * statement runs, so the migration applied without complaint and every turn
 * afterwards failed with 42703 — the greeting generated and thrown away, every
 * reply lost, every resumed session blank. Nothing in the test suite reads the
 * migrations, so nothing noticed. This does: it rebuilds each table's columns
 * from the migration files and checks every column the latest definition of
 * each function inserts into or assigns.
 */

const DIR = "supabase/migrations";
const files = readdirSync(DIR)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = (file: string) =>
  readFileSync(`${DIR}/${file}`, "utf8").replace(/--[^\n]*/g, "");

function schemaColumns(upTo = files.length): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const add = (table: string, column: string) => {
    if (!tables.has(table)) tables.set(table, new Set());
    tables.get(table)!.add(column);
  };
  for (const file of files.slice(0, upTo)) {
    const text = sql(file);
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
    // One statement can add several columns (0009 adds four), so read every
    // `add column` up to the statement's end, not just the first.
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

function latestFunctions(upTo = files.length) {
  const functions = new Map<string, { file: string; body: string }>();
  for (const file of files.slice(0, upTo)) {
    for (const m of sql(file).matchAll(
      /create or replace function\s+(?:public\.)?([a-z_]+)\s*\(([\s\S]*?)\$\$\s*;/gi,
    )) {
      functions.set(m[1], { file, body: m[2] });
    }
  }
  return functions;
}

function unknownColumnWrites(upTo = files.length): string[] {
  const schema = schemaColumns(upTo);
  const problems: string[] = [];
  for (const [fn, { file, body }] of latestFunctions(upTo)) {
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

describe("database functions write only columns that exist", () => {
  it("reads the migrations it claims to check", () => {
    // Guards against a parser that finds nothing and so passes vacuously.
    expect([...(schemaColumns().get("interview_sessions") ?? [])]).toEqual(
      expect.arrayContaining(["turn_count", "status", "summary", "updated_at"]),
    );
    expect([...latestFunctions().keys()]).toEqual(
      expect.arrayContaining(["append_interview_turn", "update_session_progress", "record_llm_usage"]),
    );
  });

  it("finds no function assigning or inserting a column no migration creates", () => {
    expect(unknownColumnWrites()).toEqual([]);
  });

  it("would have caught the 0012 bug", () => {
    // Replayed without 0017: the check has to name the column that broke
    // every interview turn, or it is not testing anything.
    const before0017 = files.findIndex((file) => file.startsWith("0017_"));
    expect(before0017).toBeGreaterThan(0);
    expect(unknownColumnWrites(before0017)).toContain(
      "append_interview_turn (0012_server_owned_writes.sql) sets interview_sessions.updated_at",
    );
  });
});
