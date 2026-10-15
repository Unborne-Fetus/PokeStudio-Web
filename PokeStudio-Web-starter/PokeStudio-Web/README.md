# PokéStudio Web

An early, static-browser IDE starter for **pokeemerald-expansion**, designed with Pokémon Brisk Emerald in mind.

## Current capabilities

- Open a local project folder (text files only; browser-dependent folder picker).
- Browse/filter and edit C, headers, scripts, JSON and other source files.
- Load an individual public GitHub file by repository, branch and path.
- Basic JSON map metadata form, text-based encounters preview, change indicator, and export of the selected edited file.
- Mobile-responsive interface and GitHub Pages deployment workflow.

## Not yet implemented

This is **not** a working Porymap replacement. It does not yet render tilesets, paint maps, manipulate NPCs/warps, parse expansion-specific trainers/encounters, commit back to GitHub, provide multi-file downloads, or compile ROMs. The editor does not modify source repositories automatically. The basic changes pane is not a real line diff.

## Run

Open `index.html` in a browser or deploy to GitHub Pages. For the best local folder support, serve the directory using any static web server. No build dependencies.

## Security and roadmap

Do not paste personal access tokens into this app. A production GitHub integration should use OAuth with PKCE and narrow permissions, plus branch-aware conflict detection. Next: Monaco/CodeMirror integration, repository tree browser, multi-file patch review, safe GitHub commits, map tileset renderer and structured expansion data parsers.
