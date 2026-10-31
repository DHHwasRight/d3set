// Build against local checkouts of brocanth, rsx and jt instead of their GitHub versions.
//
//   node scripts/dev/local-deps.mjs on       # use ../brocanth, ../templ (rsx), ../jt
//   node scripts/dev/local-deps.mjs off      # back to GitHub, Cargo.lock as it was
//   node scripts/dev/local-deps.mjs status
//
// The repository takes the three from GitHub, pinned by Cargo.lock, so a fresh clone and CI build
// alone. `on` writes `.cargo/config.toml` (not in git) with one `[patch]` per repository: cargo,
// rust-analyzer and the gallery's build all use the local sources, for every crate of that
// repository in the dependency graph (patching only some would give two copies of the shared
// ones). A patch changes Cargo.lock, so `on` keeps a copy and `off` puts it back: never commit
// Cargo.lock while `on` (CI checks it with `cargo metadata --locked`).
//
// Other locations: BROCANTH_DIR, RSX_DIR, JT_DIR (absolute, or relative to this repository).

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const config = join(root, ".cargo/config.toml");
const lock = join(root, "Cargo.lock");
const saved = join(root, "target/Cargo.lock.remote");
const MARK = "# Written by scripts/dev/local-deps.mjs";

const REPOS = [
  { url: "https://github.com/DHHwasRight/brocanth.git", dir: process.env.BROCANTH_DIR ?? "../brocanth" },
  { url: "https://github.com/DHHwasRight/rsx.git", dir: process.env.RSX_DIR ?? "../templ" },
  { url: "https://github.com/DHHwasRight/jt.git", dir: process.env.JT_DIR ?? "../jt" },
];

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code) => (text) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
const green = paint(32);
const red = paint(31);
const dim = paint(2);

function fail(message, help) {
  console.error(`${red("local-deps:")} ${message}\nhelp: ${help}`);
  process.exit(1);
}

/** The crates Cargo.lock takes from `url`: every one of them must be patched. */
function lockedCrates(url) {
  const text = readFileSync(existsSync(saved) ? saved : lock, "utf8");
  const names = [];
  for (const block of text.split("[[package]]")) {
    const name = block.match(/^name = "([^"]+)"/m)?.[1];
    const source = block.match(/^source = "git\+([^?#"]+)/m)?.[1];
    if (name && source === url) names.push(name);
  }
  return names;
}

/** Package name → directory, for every crate under `<repo>/crates`. */
function localCrates(repo) {
  const crates = new Map();
  const dir = join(repo, "crates");
  if (!existsSync(dir)) return crates;
  for (const entry of readdirSync(dir)) {
    const manifest = join(dir, entry, "Cargo.toml");
    if (!existsSync(manifest)) continue;
    const name = readFileSync(manifest, "utf8").match(/^\[package\][^[]*?^name\s*=\s*"([^"]+)"/ms)?.[1];
    if (name) crates.set(name, join(dir, entry));
  }
  return crates;
}

function cargoMetadata() {
  const r = spawnSync("cargo", ["metadata", "--format-version", "1", "-q"], {
    cwd: root,
    stdio: ["ignore", "ignore", "pipe"],
  });
  return { ok: r.status === 0, err: r.stderr.toString() };
}

function on() {
  if (existsSync(config) && !readFileSync(config, "utf8").startsWith(MARK)) {
    fail(
      ".cargo/config.toml exists and was not written by this script",
      "move it away, or add the patches to it by hand",
    );
  }
  const sections = [];
  for (const { url, dir } of REPOS) {
    const repo = resolve(root, dir);
    if (!existsSync(repo)) {
      console.log(`  ${dim("–")} ${url} ${dim(`(no checkout at ${repo}: GitHub)`)}`);
      continue;
    }
    const local = localCrates(repo);
    const lines = [];
    for (const name of lockedCrates(url)) {
      const path = local.get(name);
      if (!path)
        fail(
          `${repo} has no crate named ${name}`,
          `update that checkout, or set the directory with its *_DIR variable`,
        );
      lines.push(`${JSON.stringify(name)} = { path = ${JSON.stringify(path)} }`);
    }
    sections.push(`[patch.${JSON.stringify(url)}]\n${lines.join("\n")}`);
    console.log(`  ${green("✓")} ${url} ${dim(`→ ${repo} (${lines.length} crates)`)}`);
  }
  if (!existsSync(saved)) {
    mkdirSync(dirname(saved), { recursive: true });
    copyFileSync(lock, saved);
  }
  mkdirSync(dirname(config), { recursive: true });
  writeFileSync(config, `${MARK}: \`node scripts/dev/local-deps.mjs off\` removes it.\n\n${sections.join("\n\n")}\n`);
  const meta = cargoMetadata();
  if (!meta.ok) {
    off(true);
    fail(`cargo cannot resolve the local checkouts:\n${meta.err}`, "fix the checkout, then run `on` again");
  }
  console.log(
    green("local-deps: on") + dim(" — cargo builds against the local checkouts. `off` before you commit Cargo.lock."),
  );
}

function off(quiet = false) {
  if (existsSync(config) && readFileSync(config, "utf8").startsWith(MARK)) rmSync(config);
  if (existsSync(join(root, ".cargo")) && readdirSync(join(root, ".cargo")).length === 0)
    rmSync(join(root, ".cargo"), { recursive: true });
  if (existsSync(saved)) {
    copyFileSync(saved, lock);
    rmSync(saved);
  }
  if (!quiet)
    console.log(green("local-deps: off") + dim(" — brocanth, rsx and jt from GitHub, as pinned by Cargo.lock."));
}

function status() {
  const active = existsSync(config) && readFileSync(config, "utf8").startsWith(MARK);
  console.log(active ? `local-deps: ${green("on")}` : `local-deps: off ${dim("(GitHub)")}`);
  if (active)
    console.log(
      dim(
        readFileSync(config, "utf8")
          .split("\n")
          .filter((l) => l.startsWith("[patch"))
          .join("\n"),
      ),
    );
}

const command = process.argv[2];
if (command === "on") on();
else if (command === "off") off();
else if (command === "status" || !command) status();
else fail(`unknown command "${command}"`, "use on, off, or status");
