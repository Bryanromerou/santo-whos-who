# Santos Studio

Local app for organizing Catholic saints and creating printable worksheets for the youth group.
Everything runs on your Mac: SQLite database, portraits in a local folder, no accounts, no cloud, no paid services.

> **Languages.** The interface is in **English** by default and can be switched to **Spanish** in **Settings → Interface language**. Saint content (names, bullet points, dates, countries, collections) and the **printed worksheets / PDFs are always in Spanish**.

## What's included

| Area | Route | What it does |
| --- | --- | --- |
| Saints Library | `/santos` | Accent-insensitive search (name, country, patronage, characteristics), filters by category, collection and review status, multi-select → Create worksheets / add to collection, duplicate and delete with confirmation. |
| Saint editor | `/santos/[id]`, `/santos/nuevo` | Validated form, sortable characteristics (drag or ↑↓ arrows), portrait (upload, replace, remove, zoom, framing, crop/whole image), unsaved-changes warning and a live preview identical to the printout. |
| Collections | `/colecciones` | Create, rename, delete, reorder; edit members and their order with drag and drop; "Create worksheets with this collection". |
| Create Worksheets | `/crear-fichas` | Select/order saints, real multipage preview (zoom, page count), paper settings (Letter/A4), 1/2/4 per page, margins, font size, spacing, photo width, show/hide portrait, country and page numbers. Detects cards that don't fit and blocks export until fixed. |
| Print / PDF | buttons in Create Worksheets | "Print" uses the `/imprimir` view (same component and CSS). "Download PDF" generates a vector PDF with local Chromium from that same view. |
| Import JSON | `/configuracion/importar` | Validates the whole file before writing, shows a preview (saints, characteristics, collections, duplicates, errors) and offers Skip existing / Update existing / Replace library. |
| Settings | `/configuracion` | Interface language, export JSON, download ZIP backup, restore backup (validated), data location. |

## Requirements

- macOS (tested) with **Node.js 20.9 or later** (Node 24 recommended) and **npm**.
- ~150 MB of disk for Chromium (only for "Download PDF").

## Installation

```bash
npm install
npm run setup:pdf      # downloads local Chromium for PDF export (one time)
npm run db:migrate     # optional: the app applies migrations on startup
npm run dev            # http://127.0.0.1:3000
```

`npm install` builds/uses native modules (`better-sqlite3`, `sharp`). Install-script approvals are already in `package.json` (`allowScripts`).

If you don't run `npm run setup:pdf`, the app tries to use an installed Google Chrome; if that isn't available either, "Download PDF" shows a message with the command to run. "Print" always works (it uses your browser).

## Interface language

- Go to **Settings → Interface language** and choose **English** or **Español**. The change applies immediately.
- The choice is stored in the local database (`app_settings`, key `ui.locale`), so it's the same in every browser on this computer and is included in ZIP backups (a "Replace library" restore brings it back).
- Only the interface changes: menus, buttons, forms, dialogs, notifications, import/validation reports and server error messages. Saint data, collection names, the library JSON format (`"language": "es"`) and the printed worksheet stay Spanish.

## Importing `santos_studio_43_santos.json`

1. Copy the file to `seed/santos_studio_43_santos.json` (already included in this repository).
2. Open the app. If the library is empty you'll see "Found santos_studio_43_santos.json" → **Review and import**.
   You can also go to **Settings → Import JSON** and pick any file.
3. Review the preview (nothing is saved yet) and click **Import**.
   Expected result: **43 saints imported · 258 characteristics · 6 collections**.

Notes:
- Text is imported exactly (accents, punctuation, «aprox.», ranges and phrases like «según testimonios»). Nothing is marked as verified: `reviewStatus` is kept.
- `portraitPath: null` is expected; the app never downloads photos from the internet or creates fake images.
- Edited records are never overwritten automatically. "Replace library" asks you to type REPLACE (REEMPLAZAR in Spanish).

## Where data is stored

```
data/
  santos.sqlite            # database (SQLite + Drizzle)
  uploads/saints/          # portraits: <uuid>.jpg (master) and <uuid>.thumb.jpg (thumbnail)
```

- The folder can be changed with `SANTOS_DATA_DIR` (or the database file with `SANTOS_DATABASE_PATH`) in `.env.local`; see `.env.example`.
- `data/` is in `.gitignore` and outside `public/`; the Next.js build doesn't include it.
- The database stores only the portrait's relative path (`uploads/saints/<uuid>.jpg`) and metadata, never the image bytes.

### Portraits

- JPG, PNG or WebP up to 10 MB (`SANTOS_MAX_UPLOAD_MB`). The real file content is checked (not the extension), re-encoded with Sharp to JPEG (max 2400 px, enough for sharp printing), EXIF/GPS is stripped and a thumbnail is generated. File names are opaque UUIDs.
- Served from `/api/portraits/<uuid>.jpg` (allowlisted names; paths with `..` or other files return 404).
- When a portrait is replaced, the new image and its database reference are saved first; only then is the old one deleted, and only if no other saint uses it (duplicates share the file).
- Framing (zoom, position, crop/whole image) is non-destructive: the original file is never modified.

## Backups

- **Export JSON** (Settings): `library.json` with the same schema as the importer (`schemaVersion: 1`, `format: "santos-studio-library"`). It can be re-imported without losing fields.
- **ZIP backup**: contains `manifest.json` (version, counts and SHA-256 of every file), `library.json`, `settings.json` (worksheet settings and interface language) and `portraits/*.jpg`.
- **Restore**: on another computer, install the app and go to **Settings → Restore backup**. The whole ZIP is validated (checksums, file names, images and data) and a preview is shown; nothing changes until you confirm. If anything fails, nothing is written and copied images are removed again.

## Local production (faster)

```bash
npm run build
npm run start          # next start -H 127.0.0.1 -p 3000 (only reachable from this Mac)
```

## Tests and quality

```bash
npm run typecheck      # TypeScript (also fails if messages/en.json and es.json have different keys)
npm run lint           # ESLint
npm test               # Vitest: schema, 43-saint import, duplicates, collections, SQLite persistence,
                       # portraits (validation/serving/replacement), backups, pagination, i18n catalogs and setting
npm run test:e2e       # Playwright: production build on an empty data folder (.e2e-data)
npm run check          # typecheck + lint + test
```

Tests use `seed/santos_studio_43_santos.json` if present; otherwise `tests/fixtures/library-43.json` (synthetic test data, not real biographies — `npm run fixture:test` regenerates it). Unit tests never touch `data/`: each test uses a temporary folder.

The E2E suite switches the interface to Spanish first (it selects elements by their Spanish text) and walks through: empty library → import through the UI (43 / 258 / 6) → search «José Sánchez del Río» → edit and reorder San Carlo Acutis's bullets and check after reload → upload a portrait → 4 saints = 2 pages → PDF (2 Letter pages, image included) and identical print view → overflow case (warning with the name, export blocked, "One page for this saint" fixes it) → export JSON and ZIP, empty the library, restore and compare everything is identical. A final test switches to English, checks navigation, the library, the builder and an English server-error toast, confirms the print view/PDF labels stay Spanish, and switches back. PDFs and screenshots go to `test-results/e2e-artifacts/`.

## Architecture (development notes)

```
src/
  app/(app)/…            pages (server components read through repositories)
  app/imprimir/          print-only view used by "Print" and the PDF renderer
  app/api/…              route handlers (runtime = "nodejs"): saints, portraits, collections,
                         import, export/json, backup, backup/restore, worksheet, pdf, settings/locale
  db/schema.ts           Drizzle schema · db/client.ts singleton + auto-migrate
  db/repositories/       saints, collections, settings — the only place that queries SQLite
  i18n/                  locales, message loading, next-intl request config, server translator
  lib/imports/           Zod validation, dry-run analysis, transactional import
  lib/exports/           JSON export, backup ZIP create/parse/restore
  lib/images/            content sniffing, Sharp processing, safe paths, portrait lifecycle
  lib/worksheet/         settings schema, pagination, card data, config codec
  lib/pdf/               Playwright print-to-PDF
  components/worksheets/ WorksheetDocument + worksheet.css (shared by preview, print and PDF)
messages/                es.json / en.json interface strings (next-intl, ICU plurals)
drizzle/                 SQL migrations (npm run db:generate after schema changes)
```

- **One renderer**: `WorksheetDocument` + `worksheet.css` (physical units, `@page`, margins inside the page, `margin: 0` so no browser header/footer). Overflow is measured in the browser (`measure.ts`) for the preview, for printing and inside headless Chromium before `page.pdf()`; the server refuses (HTTP 422) to export clipped content.
- **Data/renderer separation**: card data (`toWorksheetSaint`) and pagination (`paginate`) are pure functions, so a DOCX exporter could reuse them.
- **Cache Components is disabled** in `next.config.ts`: every page reads live local data (`dynamic = "force-dynamic"`), and route handlers declare `runtime = "nodejs"`, which Cache Components doesn't allow.
- Service seams for future features (auth, cloud sync, image search, AI) are the repositories and `lib/*` modules; nothing in v1 needs network access.

### Internationalization (next-intl)

- **No locale in the URL.** `src/i18n/request.ts` reads the locale from `app_settings` (`ui.locale`, default `en`) for every request; `<html lang>` follows it. The settings page saves it through `PUT /api/settings/locale` and refreshes.
- **Messages** live in `messages/en.json` and `messages/es.json`, grouped by area (`common`, `nav`, `meta`, `library`, `editor`, `portraits`, `collections`, `builder`, `settings`, `import`, `backup`, `validation`, `errors`). Counts use ICU plurals, e.g. `"{count, plural, one {# saint} other {# saints}}"`.
- **Type-safe keys**: `src/global.d.ts` types `t()` keys from `es.json`, and `src/i18n/messages.ts` makes `tsc` fail if `en.json` is missing a key (or has an extra one). A unit test checks the same and that every message is valid ICU.
- **Server messages**: `AppError` takes a message key (`errors.*`) and `errorResponse` renders it in the interface language. Import/backup reports (`lib/imports/validate.ts`, `lib/exports/backup.ts`) and the import summary use the locale stored in the database they work on; pure helpers take an explicit `locale` argument.
- **Zod**: schemas with custom messages are built per locale (`librarySchemas(locale)`, `saintInputSchemaFor(locale)`, memoized), and Zod's built-in messages are passed per parse (`{ error: zodErrorMap(locale) }`). Nothing mutates Zod's global config, so concurrent requests can't leak each other's language.
- **Adding a string**: add the key to both JSON files, then use `useTranslations("area")` in client components or `getTranslations("area")` in server components.
- The printed worksheet's labels («Año de nacimiento», «Edad al morir», «País de origen», «Características», «Página X de Y», «Espacio para foto») are intentionally hard-coded Spanish in `worksheet-document.tsx` / `portrait-frame.tsx`; translating the printout would be a separate feature.

## Known limitations

- **DOCX is not implemented** (PDF and printing only). The data/renderer separation makes it easier later.
- **Non-destructive crop**: portraits are framed with zoom and position; there's no free-form crop rectangle or manual rotation (EXIF orientation is applied).
- **Four per page** uses a 2×2 grid; with long texts you'll get warnings and need a smaller font or 2 per page.
- **One user/window**: if you edit the same saint in two tabs, the second save gets a conflict warning (nothing typed is lost, but you need to reload and re-apply).
- **Print view in Safari**: "Print" uses a hidden iframe; if your browser blocks it, use "Open print view in another tab" and `⌘P`.
- Characteristic ids must be unique within each saint; repeats across different saints are accepted with a warning.
- Fonts (Inter and Source Serif 4) are bundled locally; PDFs are generated with Playwright's Chromium, so they look identical to the preview in Chrome. Other browsers may differ slightly when printing.
