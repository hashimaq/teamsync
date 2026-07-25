import { existsSync, readdirSync } from "node:fs";
import { spawn, spawnSync, execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pathKey = process.env.Path !== undefined ? "Path" : "PATH";
const isWin = process.platform === "win32";

function prependPath(dir) {
  if (!dir || !existsSync(dir)) return;
  const current = process.env[pathKey] ?? "";
  if (current.toLowerCase().includes(dir.toLowerCase())) return;
  process.env[pathKey] = `${dir}${path.delimiter}${current}`;
}

function which(cmd) {
  try {
    const r = spawnSync(isWin ? "where.exe" : "which", [cmd], {
      encoding: "utf8",
      env: process.env,
      shell: false,
    });
    if (r.status !== 0) return null;
    return (r.stdout || "").split(/\r?\n/).map((s) => s.trim()).find(Boolean) ?? null;
  } catch {
    return null;
  }
}

/** Put MSVC link.exe / cl.exe on PATH via vswhere + vcvars64.bat */
function injectMsvcEnv() {
  if (!isWin) return false;
  if (which("link.exe")) return true;

  const vswhere = path.join(
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
    "Microsoft Visual Studio",
    "Installer",
    "vswhere.exe",
  );
  if (!existsSync(vswhere)) return false;

  let installPath = "";
  try {
    installPath = execFileSync(
      vswhere,
      [
        "-latest",
        "-products",
        "*",
        "-requires",
        "Microsoft.VisualStudio.Component.VC.Tools.x86.x64",
        "-property",
        "installationPath",
      ],
      { encoding: "utf8" },
    ).trim();
  } catch {
    return false;
  }
  if (!installPath) return false;

  const vcvars = path.join(installPath, "VC", "Auxiliary", "Build", "vcvars64.bat");
  if (!existsSync(vcvars)) return false;

  const dumped = spawnSync(
    "cmd.exe",
    ["/d", "/s", "/c", `"${vcvars}" && set`],
    { encoding: "utf8", shell: false },
  );
  if (dumped.status !== 0 || !dumped.stdout) return false;

  for (const line of dumped.stdout.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i <= 0) continue;
    const key = line.slice(0, i);
    const val = line.slice(i + 1);
    if (key === "Path" || key === "PATH") {
      process.env[pathKey] = val;
    } else {
      process.env[key] = val;
    }
  }
  return Boolean(which("link.exe"));
}

function prependMingw() {
  const wingetPackages = path.join(
    process.env.LOCALAPPDATA ?? "",
    "Microsoft",
    "WinGet",
    "Packages",
  );
  if (!existsSync(wingetPackages)) return;
  for (const name of readdirSync(wingetPackages)) {
    if (!/winlibs|mingw|llvm-mingw/i.test(name)) continue;
    const bin = path.join(wingetPackages, name, "mingw64", "bin");
    if (existsSync(path.join(bin, "dlltool.exe"))) {
      prependPath(bin);
      return;
    }
  }
}

prependPath(path.join(os.homedir(), ".cargo", "bin"));

if (isWin) {
  const msvcOk = injectMsvcEnv();
  if (msvcOk) {
    console.log("[teamsync-desktop] MSVC ready — using stable-x86_64-pc-windows-msvc");
    process.env.RUSTUP_TOOLCHAIN = "stable-x86_64-pc-windows-msvc";
  } else {
    // GNU works for desktop now that crate-type is rlib-only (no cdylib ordinal crash).
    console.warn(
      "[teamsync-desktop] MSVC link.exe not ready yet — using windows-gnu (WinLibs).\n" +
        "  Build Tools is still installing or incomplete. After it finishes, open a NEW terminal.\n" +
        "  Prefer long-term: rustup default stable-x86_64-pc-windows-msvc",
    );
    process.env.RUSTUP_TOOLCHAIN = "stable-x86_64-pc-windows-gnu";
    prependMingw();
  }
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/run-tauri.mjs <dev|build|…>");
  process.exit(1);
}

const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn("npx", ["tauri", ...args], {
  stdio: "inherit",
  shell: true,
  env: process.env,
  cwd: desktopRoot,
});

child.on("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
