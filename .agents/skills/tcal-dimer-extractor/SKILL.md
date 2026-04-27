# tcal Dimer Extractor Project Skill

Use this skill whenever working inside this repository.

## Purpose

This project builds a GitHub Pages compatible browser GUI for extracting tcal-ready molecular dimer `xyz` files from CIF crystal structures.

The app stops at reproducible input preparation. It does not run tcal calculations.

## Default Working Rules

- Read `AGENTS.md` first, then this skill.
- Keep changes small and product-oriented.
- Prefer existing, proven libraries for CIF parsing, periodic boundary handling, molecular splitting, ZIP export, and 3D rendering.
- Do not implement CIF parsing with ad hoc string manipulation when a structured parser is available.
- Keep domain data separate from transient UI state.
- Build recipe JSON from explicit domain objects, not from view-only state.
- Round floating point coordinates only at the export boundary.
- Keep generated filenames ASCII-safe; slug user labels before using them in exported names.

## Product Requirements To Preserve

- The first screen must be the usable workbench: CIF load, cell expansion, molecule selection, naming, preview, and export.
- The site must work as a static GitHub Pages app without a required server.
- CIF files must be processed in the browser and not sent to an external server.
- The user must be able to select one center molecule and multiple neighbor molecules.
- Each selected neighbor must support a user label such as `A`, `B`, `pi-stack`, or `herringbone`.
- Exported dimer `xyz` files should order atoms as center molecule first, selected neighbor second.
- The recipe must record center molecule atom count so heteromolecular or unequal-size dimers remain reconstructable.

## Verification

- Run the focused unit tests for code touched.
- For extraction logic, cover CIF loading, cell expansion, molecule splitting, dimer `xyz` output, and recipe restore.
- For GUI changes, verify desktop and mobile widths in a real browser.
- If 3D rendering changes, confirm the canvas is nonblank and center/selected/unselected molecules are visually distinguishable.
- Run the GitHub Pages build before claiming completion.
