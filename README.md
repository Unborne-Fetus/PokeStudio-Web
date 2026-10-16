# PokéStudio Web

**PokéStudio Web** is a browser-first, install-free Pokémon ROM-hacking workspace for projects based on **pokeemerald-expansion**, initially optimized for **Pokémon Brisk Emerald**.

🌐 **Live site:** https://unborne-fetus.github.io/PokeStudio-Web/

The editor works with a source repository, not a compiled GBA ROM. Open it on desktop, phone, or tablet. It deploys on GitHub Pages; no Ubuntu, VS Code, Porymap, Node installation, or local build tools are required to *use* the hosted editor.

## Implemented

| Area | Current functionality |
| --- | --- |
| Project browsing | Connect to any public GitHub repo and branch, recursively browse folders, filename filter, quick open (Ctrl/Cmd + P), and load individual text/binary files |
| Code | CodeMirror code editor (with built-in textarea fallback), line numbers, common syntax modes, find/replace, shortcuts and downloads |
| Maps & events | Three separate map modes — Appearance (paint/pick metatiles), Collision (paint collision and elevation), Events (add/edit/drag NPCs, warps, triggers and signs) — plus map metadata and connections |
| Map layouts | Read `data/layouts/layouts.json` and binary `map.bin`; recolor indexed tileset art using the project’s JASC `.pal` files; preserve collision/elevation bitfields while painting appearance |
| Wild encounters | Parse `src/data/wild_encounters.json`, find maps and edit encounter rates, species and per-slot level ranges without changing existing slot counts |
| Pokémon | Search species and forms with the same animated front sprites as Trainer Studio; switch the list between normal and shiny, and compare both previews. Visually edit source-backed base stats, types, abilities, growth, breeding, simple evolutions, level-up and egg moves across linked C files. Unsupported expressions are preserved and exposed in Code mode. |
| Trainers | Dedicated visual Trainer Studio with trainer portraits, searchable roster, 6-slot Pokémon cards, sprites, team settings, moves, abilities, items, levels, IVs/EVs, party add/remove/reorder and careful source edits |
| Data | Inspect and edit primitives in nested JSON (unknown keys retained) |
| Sprites & graphics | Preview PNG and other common image assets, zoom nearest-neighbor, stage replacement graphics |
| Recovery | Store compatible unsaved browser drafts in IndexedDB; no access token is stored. Workspace-level undo/redo tracks source, trainer, JSON and binary map edits (Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z) |
| Save | Review changed files, export individually or in a ZIP preserving paths, commit multiple files via GitHub's Git Data API, detect diverged branches |
| Build | Trigger a recognized ROM-building GitHub Actions workflow (only if the connected project provides one with `workflow_dispatch`) |

The project is currently an **experimental alpha**, not a feature-complete Porymap or VS Code replacement.

## Start editing

1. Visit the site and connect to `Unborne-Fetus/Pokemon-Brisk-Emerald` (or another pokeemerald-expansion source repository). Leave the branch field blank to load the repository's default branch.
2. Browse the Explorer, click a file, or use the right-hand quick links.
3. Open a map's `map.json` and choose **Map & events** to work with events. Open `src/data/wild_encounters.json` and choose **Encounters** to edit routes. Use the **Pokémon** tab to edit species, linked level-up/egg move lists, and simple evolutions. Use the **Trainers** tab for visual roster and team editing; it loads `src/data/trainers.party` automatically.
4. Changes are staged **locally**, never pushed automatically. Click **Review changes** to inspect, **Export edits** to download an archive, or **Commit to GitHub** to save to the remote branch.

### GitHub write authentication

Reading public repositories requires no token. To commit files or trigger GitHub Actions, open **☰ Workspace settings** and supply a **fine-grained token** scoped only to the target repository.

- For commits: **Contents: Read and write**.
- For manual builds: **Actions: Read and write**.
- Use minimum permissions and short expiration. **Never paste a token into the project source, GitHub issue, chat, or URL.**
- The token is only held in memory while the browser tab is open. It is **not** stored in IndexedDB or localStorage.
- This version loads a pinned third-party CodeMirror script from a CDN. Like any web app that requests credentials, only enter a token after checking that you trust the deployed website and its loaded scripts. A production deployment should vendor dependencies and migrate to a GitHub App OAuth flow.

The commit action verifies the branch HEAD before writing a new Git tree. If someone else has updated the branch, it blocks the commit and asks you to reconnect/review instead of knowingly clobbering those commits. **It does not resolve merge conflicts** or validate whether edited C code compiles.

### Build Brisk Emerald

The Brisk Emerald project currently contains the workflow `.github/workflows/build-brisk-emerald.yml` with `workflow_dispatch`. After committing changes, the project can run on GitHub Actions (depending on the project's workflow permissions). The **Build ROM** button dispatches a recognized build workflow to the selected branch when authorized. Downloads are available from the target repository's Actions page, not through the web editor itself.

## Current limitations

- The map artwork renderer now applies the connected project’s JASC palettes to tileset PNGs. It is still experimental: layer behavior, tile animations and metatile behaviors are not fully reproduced. Colored metatile-ID fallback remains available if art cannot load.
- Map painting currently updates binary IDs; it does **not** provide Porymap's full metatile/palette authoring, border tools, connections editor, or collision-property interface.
- The map event inspector supports fields already present in map JSON and basic event templates, but does not graphically author custom event scripts.
- Trainer Studio has a source-aware roster and a visual team builder, but it does not validate every custom ability, move, item, form or trainerproc rule. Changes should be checked with a ROM build.
- The encounter editor intentionally does **not** auto-rebalance slot weights; check the project's config when adding/removing slots.
- Sprites can be inspected/replaced, not pixel-painted; indexed Pokémon PNG palettes may require external validation.
- No integrated compiler/emulator; compilation uses GitHub Actions.
- GitHub may truncate very large recursive trees; the app displays a warning when detected.
- Editing a local folder is possible, but browser permission restrictions mean local changes must be exported rather than written straight to disk.
- Some capabilities need desktop-sized screens; mobile editing is supported but complex map work is easier on a larger display.

## Development and deployment

The site is static HTML, CSS and native JavaScript modules. There is **no frontend build step**. GitHub Actions runs syntax checks and dependency-free unit tests before deploying to Pages.

```sh
npm run check
npm test
```

To deploy this repository: GitHub **Settings → Pages → Source: GitHub Actions**. Pushing to `main` automatically runs `.github/workflows/deploy.yml` and publishes after successful verification.

## Scope

PokéStudio Web is intended to become a flexible pokeemerald-expansion IDE, not a special-purpose editor tied permanently to Brisk Emerald. File formats are preserved wherever possible; editing arbitrary expansion forks still requires checking their own source format differences. Contributions and bug reports are welcome.

## Interface theme

PokéStudio uses a warm **aubergine, copper, and terracotta** color scheme instead of the blue or green palettes used in our other tools. The three map editor submodes share this theme while keeping tile artwork in its actual game colors.
