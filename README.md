# PokéStudio Web

**PokéStudio Web** is a browser-first, install-free workspace for **pokeemerald-expansion** projects (including Brisk Emerald), **USUM patch projects** (including Pokémon Searing Sun), and other GitHub source repositories.

🌐 **Live site:** https://unborne-fetus.github.io/PokeStudio-Web/

The editor works with a source repository, not a compiled GBA ROM. Open it on desktop, phone, or tablet. It deploys on GitHub Pages; no Ubuntu, VS Code, Porymap, Node installation, or local build tools are required to *use* the hosted editor.

## Implemented

| Area | Current functionality |
| --- | --- |
| Project browsing | Select Brisk Emerald or Searing Sun as a preset, or connect to any GitHub repo/branch. PokéStudio automatically detects the project layout, shows compatible editors, and supports quick open (Ctrl/Cmd + P). |
| Code | CodeMirror code editor (with built-in textarea fallback), line numbers, common syntax modes, find/replace, shortcuts and downloads |
| Maps & events | Three separate map modes — Appearance (paint/pick metatiles), Collision (paint collision and elevation), Events (add/edit/drag NPCs, warps, triggers and signs) — plus map metadata and connections |
| Map layouts | Read `data/layouts/layouts.json` and binary `map.bin`; recolor indexed tileset art using the project’s JASC `.pal` files; preserve collision/elevation bitfields while painting appearance |
| Emerald wild encounters | Parse `src/data/wild_encounters.json`, find maps and edit encounter rates, species and per-slot level ranges without changing existing slot counts |
| Searing Sun / Gen 7 encounters | Edit the repository's sparse `data/encounters/changes.json` with table file/pair/time, species/form, SOS slot, levels, and rate overrides. Optionally load a local `reference.csv` for original encounter details and rate validation without uploading the CSV. |
| Pokémon | Search species and forms with the same animated front sprites as Trainer Studio; switch the list between normal and shiny, and compare both previews. Alternate forms and custom Megas are read from the ROM's own graphics and shiny palettes instead of incorrectly indexing Brisk Dex sprites by internal species IDs. Visually edit source-backed base stats, types, abilities, growth, breeding, simple evolutions, level-up and egg moves across linked C files. Unsupported expressions are preserved and exposed in Code mode. |
| Pokédex | Dedicated searchable Pokédex Studio with the shared animated normal and shiny Pokémon portraits, live description preview, source-backed display name, category, height, weight, color, Pokédex positioning, National Dex assignment and multiline Pokédex text. Includes source-aware unique or shared entry edits. |
| Trainers | Dedicated visual Trainer Studio with trainer portraits, searchable roster, 6-slot Pokémon cards, sprites, team settings, moves, abilities, items, levels, IVs/EVs, party add/remove/reorder and careful source edits |
| Data | Inspect and edit primitives in nested JSON (unknown keys retained) |
| Sprites & graphics | Preview PNG and other common image assets, zoom nearest-neighbor, stage replacement graphics |
| Recovery | Store compatible unsaved browser drafts in IndexedDB; no access token is stored. Workspace-level undo/redo tracks source, trainer, JSON and binary map edits (Ctrl+Z, Ctrl+Y or Ctrl+Shift+Z) |
| Save | Review changed files, export individually or in a ZIP preserving paths, commit multiple files via GitHub's Git Data API, detect diverged branches |
| Build | Trigger a recognized ROM-building GitHub Actions workflow (only if the connected project provides one with `workflow_dispatch`) |
| Play in Web Emu | Open Web Emu from PokéStudio, find the newest successful Brisk Emerald GBA build on the connected branch, download and unpack its GitHub Actions artifact, and securely transfer only the ROM bytes to Web Emu. If GitHub blocks browser ZIP redirects, choose the downloaded `.zip` or `.gba` manually. |

The project is currently an **experimental alpha**, not a feature-complete Porymap or VS Code replacement.

## Start editing

1. Visit the site and choose the **Brisk Emerald** or **Searing Sun** preset, or enter another GitHub repository. Leave the branch field blank to load the repository's default branch.
2. PokéStudio detects the repository's format and displays the appropriate editor tabs. Browse the Explorer, click a file, or use the project-specific quick links.
3. Open a map's `map.json` and choose **Map & events** to work with events. Open `src/data/wild_encounters.json` and choose **Encounters** to edit routes. Use the **Pokédex** tab to edit Pokédex names, categories, measurements and entries (including text stored in `shared_dex_text.h`), while previewing animated normal/shiny artwork. Use the **Pokémon** tab to edit species, linked level-up/egg move lists, and simple evolutions. Use the **Trainers** tab for visual roster and team editing; it loads `src/data/trainers.party` automatically.
4. Changes are staged **locally**, never pushed automatically. Click **Review changes** to inspect, **Export edits** to download an archive, or **Commit to GitHub** to save to the remote branch.

### GitHub write authentication

Reading public repositories requires no token. To commit files or trigger GitHub Actions, open **☰ Workspace settings** and supply a **fine-grained token** scoped only to the target repository.

- For commits: **Contents: Read and write**.
- For manual builds: **Actions: Read and write**.
- Use minimum permissions and short expiration. **Never paste a token into the project source, GitHub issue, chat, or URL.**
- The token is only held in memory while the browser tab is open. It is **not** stored in IndexedDB or localStorage.
- This version loads a pinned third-party CodeMirror script from a CDN. Like any web app that requests credentials, only enter a token after checking that you trust the deployed website and its loaded scripts. A production deployment should vendor dependencies and migrate to a GitHub App OAuth flow.

The commit action verifies the branch HEAD before writing a new Git tree. If someone else has updated the branch, it blocks the commit and asks you to reconnect/review instead of knowingly clobbering those commits. **It does not resolve merge conflicts** or validate whether edited C code compiles.

### Edit Pokémon Searing Sun (Gen 7 / USUM)

1. Choose **Searing Sun** from the project preset (repository `Unborne-Fetus/Pokemon-Seared-Sun`, default branch `main`). The app detects `data/encounters/changes.json` and `tools/encounters.py` and offers **Gen 7 Encounters** instead of the incompatible Emerald source editors.
2. Click **+ New encounter table** and enter the encounter file ID, pair index and day/night time confirmed on your PC. Set optional levels, species and form overrides in sets 0–7 (ten slots per set) or SOS/weather set 8 (six slots), and rate overrides as needed.
3. Optionally click **Load local reference.csv** to choose `workspace/encounters/reference.csv` generated by Searing Sun's local tools. The browser reads it **only in memory**, showing original area names, table levels, slots and effective rate totals. This file is never staged in GitHub or saved to drafts.
4. Click **Save table override** and **Review changes**, then commit or export the sparse `data/encounters/changes.json`. No extracted Ultra Sun assets, GARC archives, ROMs or game keys are uploaded.
5. On the PC with your matching USUM extraction, pull the JSON, run `APPLY_ENCOUNTERS.bat` and `SAVE_CHANGES.bat`, then commit the resulting patch. The website cannot directly rebuild your local 3DS game files.

Species names for standard Gen 7 Pokémon are searchable; expansion-only Pokémon can use numeric IDs. The local reference CSV allows effective rates to be checked against original values. Without it, the Python dry-run validator on your PC remains essential for file/pair validity and complete encounter-rate sums.

For any other project, **Code**, **JSON inspector**, **Changes** and GitHub commits still work; visual editing is shown only for supported formats.

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

PokéStudio Web aims to support multiple project formats, with separate editors for Emerald source data and Searing Sun's Gen 7 sparse patch workflow. File formats are preserved wherever possible; editing arbitrary expansion forks still requires checking their own source format differences. Contributions and bug reports are welcome.

## Interface theme

PokéStudio uses a warm **aubergine, copper, and terracotta** color scheme instead of the blue or green palettes used in our other tools. The three map editor submodes share this theme while keeping tile artwork in its actual game colors.

## Play the newest ROM in Web Emu

After connecting to `Unborne-Fetus/Pokemon-Brisk-Emerald` and entering a fine-grained token with **Actions: read**, click **▶ Play in Web Emu**. PokéStudio looks for the latest successful, unexpired `Pokemon-Brisk-Emerald` artifact produced by `.github/workflows/build-brisk-emerald.yml` on your selected branch. It opens the separate Web Emu tab, extracts the `.gba` from the artifact ZIP, and transfers the bytes through a validated, same-origin browser message. **Your GitHub token is never sent to Web Emu**. The emulator does not receive uncommitted PokéStudio edits; build and commit before playing them.

If the browser blocks the GitHub Actions ZIP download redirect, use **View build artifacts** to download the artifact from GitHub, then click **Choose GBA or artifact ZIP** in the PokéStudio dialog. It sends the chosen file to the already-open Web Emu tab. An older build is used only when it is the most recent *successful* run whose artifact is still available. Private branches without a successful build must be built first. Web Emu save data remains in its normal browser save storage.

## Alternate forms and custom Mega sprites

PokéStudio's three Pokémon editors use the same form-aware renderer. It tries the ROM's canonical graphic paths even when GitHub's recursive file tree is truncated, displays only the first frame of stacked `anim_front.png` assets, and uses the ROM's `normal.pal`/`shiny.pal` when available. If no form-specific art can be loaded, the renderer explicitly falls back to the base National Dex sprite. Since this is browser rendering, network or palette failures may fall back to normal art rather than inventing a shiny.

### Totem Pokémon visibility

Pokémon Studio and Pokédex Studio intentionally exclude Totem forms from their species browsers (by `TOTEM` species identifier or `.isTotem = TRUE`), including search results and counts. The ROM source and Totem definitions are not modified or deleted; other alternate forms and custom Megas remain selectable.
