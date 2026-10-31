// Build the GitHub Pages site: the four galleries in one directory, as the host serves it.
//
//   node scripts/pages/build.mjs [--out dist-pages] [--only <tasks>] [--follow-fixtures]
//   PAGES_URL=http://localhost:4000/d3set node scripts/pages/build.mjs   (local preview)
//
// Layout of the output, served at PAGES_URL (default https://dhhwasright.github.io/d3set):
//   /            the Rust gallery: pages, partials/<depth>/, data/<feed>.json, assets, 404.html
//   /vanilla/    /react/    /next/    the framework galleries
//
// The build is a set of tasks. A task starts as soon as the tasks it needs are done, so
// independent tasks run in parallel. Each task's output goes to target/pages-logs/<task>.log;
// the console shows one line per task, and the end of the log of a task that failed.
//
//   cargo      the gallery binary
//   fixtures   the Rust gallery's pages, exported for the framework galleries   (needs cargo)
//   rsx        the Rust gallery as files (gallery export)                        (needs cargo)
//   lib        d3set, @d3set/react and @d3set/next builds, for Next.js
//   vanilla    react    (need fixtures)        next (needs fixtures, lib)
//
// `--only` lists the tasks to run; the tasks they need run too when their output is missing.
// `--follow-fixtures`: when `fixtures` ran and its output changed, rebuild the three framework
// galleries as well (they bundle the fixtures). The watcher of serve.mjs uses it.

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const NOW = "2026-10-01T00:00:00Z";
const REFERENCE = `127.0.0.1:${process.env.GALLERY_REFERENCE_PORT ?? 3140}`;
const FRAMEWORKS = ["vanilla", "react", "next"];
const TASKS = ["cargo", "fixtures", "rsx", "lib", ...FRAMEWORKS];

// ------------------------------------------------------------------ options

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const all = !process.argv.includes("--only");
const only = new Set(arg("only", TASKS.join(",")).split(","));
for (const task of only) {
  if (!TASKS.includes(task)) {
    console.error(`pages: unknown task "${task}"\nhelp: use some of ${TASKS.join(", ")}`);
    process.exit(2);
  }
}
const follow = process.argv.includes("--follow-fixtures");
// A full build goes to a new directory that replaces the old one at the end, so a server keeps
// serving the previous site until then. A partial build updates the site in place.
const final = resolve(root, arg("out", "dist-pages"));
const out = all ? `${final}.new` : final;
const site = (process.env.PAGES_URL ?? "https://dhhwasright.github.io/d3set").replace(/\/+$/, "");
const base = new URL(site).pathname.replace(/\/+$/, "");
const libraries = `vanilla=${site}/vanilla,rsx=${site},react=${site}/react,next=${site}/next`;
const gallery = join(root, "target/debug/gallery");
const logs = join(root, "target/pages-logs");
const fixturesDir = join(root, "galleries/shared/fixtures");

// ------------------------------------------------------------------ console

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = paint(32);
const red = paint(31);
const dim = paint(2);
const bold = paint(1);
const seconds = (ms) => `${(ms / 1000).toFixed(1)}s`;

// ------------------------------------------------------------------ running commands

/** Run a command, its output appended to the task's log. Rejects on a non-zero exit. */
function exec(log, cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    log.write(`$ ${cmd} ${args.join(" ")}\n`);
    const child = spawn(cmd, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited with ${code}`))));
  });
}

/** A hash of every file under `dir`: did an export change anything? */
function digest(dir) {
  const hash = createHash("sha1");
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else hash.update(name).update(readFileSync(p));
    }
  };
  walk(dir);
  walk(join(root, "galleries/shared/public"));
  return hash.digest("hex");
}

// ------------------------------------------------------------------ tasks

const steps = {
  cargo: async (log) => exec(log, "cargo", ["build", "-p", "gallery"]),

  fixtures: async (log) => {
    const before = digest(fixturesDir);
    // The reference: the server-mode gallery with a fixed clock.
    const server = spawn(gallery, [], {
      cwd: root,
      env: { ...process.env, GALLERY_ADDR: REFERENCE, GALLERY_NOW: NOW },
      stdio: "ignore",
    });
    try {
      for (let i = 0; ; i++) {
        try {
          if ((await fetch(`http://${REFERENCE}/`)).ok) break;
        } catch {}
        if (i > 100) throw new Error(`the reference gallery did not start on ${REFERENCE}`);
        await new Promise((r) => setTimeout(r, 100));
      }
      await exec(log, "node", ["galleries/shared/scripts/export.mjs", `http://${REFERENCE}`]);
    } finally {
      server.kill();
    }
    return { changed: digest(fixturesDir) !== before };
  },

  rsx: async (log) => {
    // Exported aside, then merged: `--only rsx` must not delete the framework galleries.
    const tmp = join(root, "target/pages-rsx");
    await exec(log, gallery, ["export", "--out", tmp], {
      GALLERY_STATIC: "1",
      GALLERY_NOW: NOW,
      GALLERY_BASE: base,
      GALLERY_LIBRARIES: libraries,
    });
    mkdirSync(out, { recursive: true });
    cpSync(tmp, out, { recursive: true });
  },

  // Next.js loads d3set and its bindings from their builds; vanilla and React use the sources.
  lib: async (log) => {
    await exec(log, "npm", ["run", "build"]);
    await exec(log, "npm", ["run", "build", "-w", "packages/react"]);
    await exec(log, "npm", ["run", "build", "-w", "packages/next"]);
  },
};

for (const name of FRAMEWORKS) {
  steps[name] = async (log) => {
    await exec(log, "node", ["galleries/shared/scripts/pages.mjs", name], { PAGES_URL: site });
    const from = join(root, "galleries", name, name === "next" ? "out" : "dist");
    rmSync(join(out, name), { recursive: true, force: true });
    cpSync(from, join(out, name), { recursive: true });
  };
}

const NEEDS = {
  cargo: [],
  fixtures: ["cargo"],
  rsx: ["cargo"],
  lib: [],
  vanilla: ["fixtures"],
  react: ["fixtures"],
  next: ["fixtures", "lib"],
};

/** Whether a task's output already exists, so a partial build can skip it. */
const present = {
  cargo: () => existsSync(gallery),
  fixtures: () => existsSync(join(fixturesDir, "pages.json")),
  lib: () =>
    ["dist/core.js", "packages/react/dist/index.js", "packages/next/dist/config.js"].every((f) =>
      existsSync(join(root, f)),
    ),
};

// The tasks to run: the requested ones, plus what they need when it is missing. `cargo` always
// runs before `fixtures` and `rsx`: it is quick when nothing changed, and the binary must be fresh.
const wanted = new Set();
const want = (task, requested) => {
  if (wanted.has(task)) return;
  if (!requested && present[task]?.()) return;
  wanted.add(task);
  for (const need of NEEDS[task]) want(need, need === "cargo");
};
for (const task of only) want(task, true);

// ------------------------------------------------------------------ scheduler

mkdirSync(logs, { recursive: true });
rmSync(`${final}.new`, { recursive: true, force: true });
const started = Date.now();
const done = new Map(); // task -> Promise<result>
const results = [];

function run(task) {
  if (done.has(task)) return done.get(task);
  const promise = (async () => {
    const needs = NEEDS[task].filter((n) => wanted.has(n));
    const upstream = await Promise.all(needs.map(run));
    if (upstream.some((r) => !r.ok)) {
      results.push({ task, ok: false, skipped: true });
      console.log(`  ${dim("–")} ${task.padEnd(9)} ${dim("skipped: a task it needs failed")}`);
      return { ok: false };
    }
    const file = join(logs, `${task}.log`);
    const log = createWriteStream(file);
    const t0 = Date.now();
    try {
      const value = (await steps[task](log)) ?? {};
      results.push({ task, ok: true });
      const note = value.changed === false ? dim(" (unchanged)") : "";
      console.log(`  ${green("✓")} ${task.padEnd(9)} ${dim(seconds(Date.now() - t0))}${note}`);
      return { ok: true, ...value };
    } catch (err) {
      results.push({ task, ok: false, file });
      console.log(`  ${red("✗")} ${task.padEnd(9)} ${dim(seconds(Date.now() - t0))} ${red(err.message)}`);
      return { ok: false };
    } finally {
      await new Promise((r) => log.end(r));
    }
  })();
  done.set(task, promise);
  return promise;
}

console.log(bold(`pages: ${[...wanted].join(", ")} → ${final.replace(`${root}/`, "")}`));
await Promise.all([...wanted].map(run));

// New fixtures: the framework galleries bundle them, so they build again.
if (follow && wanted.has("fixtures") && (await done.get("fixtures")).changed) {
  const again = FRAMEWORKS.filter((f) => !wanted.has(f));
  for (const f of again) wanted.add(f);
  if (again.length) {
    if (!present.lib()) wanted.add("lib");
    await Promise.all(again.map(run));
  }
}

const failed = results.filter((r) => !r.ok && !r.skipped);
for (const { task, file } of failed) {
  const lines = readFileSync(file, "utf8").trimEnd().split("\n");
  console.log(`\n${red(bold(`${task} failed`))} ${dim(`(${file.replace(`${root}/`, "")}, last 25 lines)`)}`);
  console.log(lines.slice(-25).join("\n"));
}

if (failed.length) {
  console.log(`\n${red(bold(`pages: ${failed.length} task(s) failed`))} in ${seconds(Date.now() - started)}`);
  process.exit(1);
}
if (all) {
  rmSync(final, { recursive: true, force: true });
  renameSync(out, final);
}
console.log(green(bold(`pages: built for ${site} in ${seconds(Date.now() - started)}`)));
