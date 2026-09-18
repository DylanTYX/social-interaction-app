/**
 * Where a committed artifact came from, so a reader can check it is current.
 *
 * An eval output in `docs/artifacts/` is a claim about code that has moved on
 * since. The usual defence is a promise in a README; this is better, because it
 * is falsifiable: the artifact names the commit it was produced from, and
 * `git show <sha>` either matches the numbers or does not.
 *
 * `dirty` is the part that matters most. An artifact generated from a working
 * tree with uncommitted changes describes code that exists on exactly one
 * machine, and saying so is the difference between evidence and decoration.
 */

import { execFileSync } from "node:child_process";

export interface Provenance {
  sha: string;
  /** True when the working tree had uncommitted changes at generation time. */
  dirty: boolean;
  generatedAt: string;
}

function git(...args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    // No git, or not a repository. A missing stamp is better than a wrong one.
    return null;
  }
}

export function provenance(): Provenance {
  return {
    sha: git("rev-parse", "--short", "HEAD") ?? "unknown",
    dirty: (git("status", "--porcelain") ?? "") !== "",
    // Date only. A wall-clock time would change every run and make two
    // otherwise identical artifacts look different in a diff.
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}

/** One line for the head of an artifact. */
export function provenanceLine(source: string): string {
  const { sha, dirty, generatedAt } = provenance();
  const state = dirty
    ? `${sha} + uncommitted changes — REGENERATE FROM A CLEAN TREE BEFORE QUOTING`
    : sha;
  return `Generated ${generatedAt} from ${state} by \`${source}\`.`;
}
