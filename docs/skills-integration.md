# Skills integration

This workspace can carry the Codex and Antigravity skill catalog alongside the
application so VS Code agents can discover the same instructions without
machine-specific global paths.

## Layout

- `.agents/skills/` contains the imported `SKILL.md` definitions and supporting
  assets.
- `.agents/skills/manifest.json` records the imported skill names and their
  original source directories.
- `skills/antigravity-inventory.json` contains the Antigravity audit metadata,
  including domains, descriptions, dependencies, and trigger information.
- `scripts/import-skills.mjs` refreshes both sources.

## Refreshing from local sources

Run the importer from the workspace root:

```powershell
node scripts/import-skills.mjs `
  --source-root "C:\path\to\Codex" `
  --antigravity-dir "C:\path\to\Antigravity-Skills-Audit"
```

The importer replaces `.agents/skills` so stale definitions are not left
behind. It keeps the first definition for a skill name, preferring a source
under `.agents/skills` when duplicates exist.
