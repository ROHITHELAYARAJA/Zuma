import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const projectRoot = process.cwd();
const sourceRoot = argument("--source-root", process.env.CODEX_SKILLS_ROOT);
const auditDir = argument("--antigravity-dir", process.env.ANTIGRAVITY_AUDIT_DIR);
const destination = path.resolve(projectRoot, argument("--destination", ".agents/skills"));
const inventoryDestination = path.resolve(
  projectRoot,
  argument("--inventory", "skills/antigravity-inventory.json"),
);

if (!sourceRoot) {
  throw new Error("Missing --source-root or CODEX_SKILLS_ROOT.");
}

async function collectSkillFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === ".next" ||
      entry.name === ".openmontage-venv" ||
      entry.name === ".uv-cache"
    ) continue;
    const entryPath = path.join(directory, entry.name);
    if (path.resolve(entryPath) === destination) continue;
    if (entry.isDirectory()) {
      files.push(...(await collectSkillFiles(entryPath)));
    } else if (entry.isFile() && entry.name === "SKILL.md") {
      files.push(entryPath);
    }
  }
  return files;
}

const skillFiles = await collectSkillFiles(path.resolve(sourceRoot));
const selected = new Map();
for (const file of skillFiles) {
  const name = path.basename(path.dirname(file));
  const existing = selected.get(name);
  if (!existing || file.includes(`${path.sep}.agents${path.sep}`)) {
    selected.set(name, file);
  }
}

await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });

const manifest = [];
for (const [name, skillFile] of [...selected.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  const sourceDirectory = path.dirname(skillFile);
  const targetDirectory = path.join(destination, name);
  await cp(sourceDirectory, targetDirectory, { recursive: true });
  manifest.push({
    name,
    source: path.relative(projectRoot, sourceDirectory),
    path: path.relative(projectRoot, targetDirectory),
  });
}

await mkdir(path.dirname(inventoryDestination), { recursive: true });
if (auditDir) {
  const inventoryPath = path.join(path.resolve(auditDir), "skills_inventory.json");
  await writeFile(
    inventoryDestination,
    await readFile(inventoryPath, "utf8"),
    "utf8",
  );
}

await writeFile(
  path.join(destination, "manifest.json"),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), skills: manifest }, null, 2)}\n`,
  "utf8",
);

console.log(`Imported ${manifest.length} skill definitions into ${destination}`);
if (auditDir) console.log(`Imported Antigravity inventory into ${inventoryDestination}`);
