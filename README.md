# Santos Studio

Aplicación local para organizar santos católicos y crear fichas imprimibles para el grupo juvenil.
Todo funciona en tu Mac: base de datos SQLite, retratos en una carpeta local, sin cuentas, sin nube y sin servicios de pago.

> UI and printouts are in Spanish. This README mixes Spanish (usage) and English (development notes).

## Qué incluye

| Área | Ruta | Qué hace |
| --- | --- | --- |
| Biblioteca de Santos | `/santos` | Búsqueda sin acentos (nombre, país, patronazgo, características), filtros por categoría, colección y revisión, selección múltiple → Crear fichas / añadir a colección, duplicar y eliminar con confirmación. |
| Editor de Santo | `/santos/[id]`, `/santos/nuevo` | Formulario con validación, características ordenables (arrastrar o flechas ↑↓), retrato (subir, reemplazar, quitar, zoom, encuadre, recortar/imagen completa), aviso de cambios sin guardar y vista previa en vivo idéntica a la impresión. |
| Colecciones | `/colecciones` | Crear, renombrar, eliminar, reordenar; editar santos y su orden con arrastrar y soltar; «Crear fichas con esta colección». |
| Crear Fichas | `/crear-fichas` | Selección/orden de santos, vista previa multipágina real (zoom, número de páginas), ajustes de papel (Carta/A4), 1/2/4 por página, márgenes, letra, espaciado, ancho de foto, mostrar/ocultar retrato, país y numeración. Detecta fichas que no caben y bloquea la exportación hasta corregirlo. |
| Imprimir / PDF | botones en Crear Fichas | «Imprimir» usa la vista `/imprimir` (mismo componente y CSS). «Descargar PDF» genera un PDF vectorial con Chromium local a partir de esa misma vista. |
| Importar JSON | `/configuracion/importar` | Valida todo el archivo antes de escribir, muestra vista previa (santos, características, colecciones, duplicados, errores) y permite Saltar existentes / Actualizar existentes / Reemplazar biblioteca. |
| Configuración | `/configuracion` | Exportar JSON, descargar respaldo ZIP, restaurar respaldo (validado), ubicación de los datos. |

## Requisitos

- macOS (probado) con **Node.js 20.9 o superior** (recomendado Node 24) y **npm**.
- ~150 MB de disco para Chromium (solo para «Descargar PDF»).

## Instalación

```bash
npm install
npm run setup:pdf      # descarga Chromium local para la exportación a PDF (una sola vez)
npm run db:migrate     # opcional: la app aplica las migraciones sola al arrancar
npm run dev            # http://127.0.0.1:3000
```

`npm install` compila/usa módulos nativos (`better-sqlite3`, `sharp`). Las aprobaciones de scripts de instalación ya están en `package.json` (`allowScripts`).

Si no ejecutas `npm run setup:pdf`, la app intenta usar Google Chrome instalado; si tampoco existe, el botón «Descargar PDF» muestra un mensaje indicando el comando. «Imprimir» funciona siempre (usa tu navegador).

## Importar `santos_studio_43_santos.json`

1. Copia el archivo a `seed/santos_studio_43_santos.json` (ya está incluido en este repositorio).
2. Abre la app. Si la biblioteca está vacía verás «Se encontró santos_studio_43_santos.json» → **Revisar e importar**.
   También puedes ir a **Configuración → Importar JSON** y elegir cualquier archivo.
3. Revisa la vista previa (no se guarda nada todavía) y pulsa **Importar**.
   Resultado esperado: **43 santos importados · 258 características · 6 colecciones**.

Notas:
- El texto se importa exactamente (acentos, puntuación, «aprox.», rangos y expresiones como «según testimonios»). Nada se marca como verificado: se conserva `reviewStatus`.
- `portraitPath: null` es lo esperado; la app nunca descarga fotos de internet ni crea imágenes falsas.
- Nunca se sobrescriben registros editados de forma automática. «Reemplazar biblioteca» pide escribir REEMPLAZAR.

## Dónde se guardan los datos

```
data/
  santos.sqlite            # base de datos (SQLite + Drizzle)
  uploads/saints/          # retratos: <uuid>.jpg (maestro) y <uuid>.thumb.jpg (miniatura)
```

- La carpeta se puede cambiar con `SANTOS_DATA_DIR` (o la base de datos con `SANTOS_DATABASE_PATH`) en `.env.local`; ver `.env.example`.
- `data/` está en `.gitignore` y fuera de `public/`; el build de Next.js no la incluye.
- La base de datos solo guarda la ruta relativa del retrato (`uploads/saints/<uuid>.jpg`) y metadatos; nunca los bytes de la imagen.

### Retratos

- JPG, PNG o WebP hasta 10 MB (`SANTOS_MAX_UPLOAD_MB`). Se verifica el contenido real del archivo (no la extensión), se re-codifica con Sharp a JPEG (máx. 2400 px, suficiente para impresión nítida), se eliminan EXIF/GPS y se genera una miniatura. Los nombres son UUID opacos.
- Se sirven por `/api/portraits/<uuid>.jpg` (lista blanca de nombres; rutas con `..` u otros archivos devuelven 404).
- Al reemplazar un retrato primero se guarda la imagen nueva y la referencia en la base de datos; solo después se borra la anterior, y solo si ningún otro santo la usa (los duplicados comparten archivo).
- El encuadre (zoom, posición, recortar/imagen completa) es no destructivo: el archivo original no se modifica.

## Respaldos

- **Exportar JSON** (`Configuración`): `library.json` con el mismo esquema que el importador (`schemaVersion: 1`, `format: "santos-studio-library"`). Se puede volver a importar sin perder campos.
- **Respaldo ZIP**: contiene `manifest.json` (versión, conteos y SHA-256 de cada archivo), `library.json`, `settings.json` (ajustes de fichas) y `portraits/*.jpg`.
- **Restaurar**: en otra computadora, instala la app y ve a **Configuración → Restaurar respaldo**. Se valida el ZIP completo (sumas de verificación, nombres de archivo, imágenes y datos) y se muestra una vista previa; nada cambia hasta que confirmas. Si algo falla, no se escribe nada y las imágenes copiadas se retiran.

## Producción local (más rápida)

```bash
npm run build
npm run start          # next start -H 127.0.0.1 -p 3000 (solo accesible desde esta Mac)
```

## Pruebas y calidad

```bash
npm run typecheck      # TypeScript
npm run lint           # ESLint
npm test               # Vitest: esquema, importación de 43 santos, duplicados, colecciones,
                       # persistencia SQLite, retratos (validación/servido/reemplazo), respaldos, paginación
npm run test:e2e       # Playwright: build de producción sobre una carpeta de datos vacía (.e2e-data)
npm run check          # typecheck + lint + test
```

Las pruebas usan `seed/santos_studio_43_santos.json` si existe; si no, `tests/fixtures/library-43.json` (datos sintéticos de prueba, no biografías reales — `npm run fixture:test` lo regenera).

La prueba E2E recorre: biblioteca vacía → importar por la UI (43 / 258 / 6) → buscar «José Sánchez del Río» → editar y reordenar viñetas de San Carlo Acutis y comprobar tras recargar → subir retrato → 4 santos = 2 páginas → PDF (2 páginas Carta, imagen incluida) y vista de impresión idéntica → caso de desbordamiento (aviso con el nombre, exportación bloqueada, «Una página para este santo» lo resuelve) → exportar JSON y ZIP, vaciar la biblioteca, restaurar y comparar que todo es idéntico. Los PDF y capturas quedan en `test-results/e2e-artifacts/`.

## Arquitectura (development notes)

```
src/
  app/(app)/…            pages (server components read through repositories)
  app/imprimir/          print-only view used by «Imprimir» and the PDF renderer
  app/api/…              route handlers (runtime = "nodejs"): saints, portraits, collections,
                         import, export/json, backup, backup/restore, worksheet, pdf
  db/schema.ts           Drizzle schema · db/client.ts singleton + auto-migrate
  db/repositories/       saints, collections, settings — the only place that queries SQLite
  lib/imports/           Zod validation, dry-run analysis, transactional import
  lib/exports/           JSON export, backup ZIP create/parse/restore
  lib/images/            content sniffing, Sharp processing, safe paths, portrait lifecycle
  lib/worksheet/         settings schema, pagination, card data, config codec
  lib/pdf/               Playwright print-to-PDF
  components/worksheets/ WorksheetDocument + worksheet.css (shared by preview, print and PDF)
drizzle/                 SQL migrations (npm run db:generate after schema changes)
```

- **One renderer**: `WorksheetDocument` + `worksheet.css` (physical units, `@page`, margins inside the page, `margin: 0` so no browser header/footer). Overflow is measured in the browser (`measure.ts`) for the preview, for printing and inside headless Chromium before `page.pdf()`; the server refuses (HTTP 422) to export clipped content.
- **Data/renderer separation**: card data (`toWorksheetSaint`) and pagination (`paginate`) are pure functions, so a DOCX exporter could reuse them.
- **Cache Components is disabled** in `next.config.ts`: every page reads live local data (`dynamic = "force-dynamic"`), and route handlers declare `runtime = "nodejs"`, which Cache Components does not allow.
- Service seams for future features (auth, cloud sync, image search, AI) are the repositories and `lib/*` modules; nothing in v1 needs network access.

## Limitaciones conocidas

- **DOCX no está implementado** (solo PDF e impresión). La separación datos/renderizado lo facilita en el futuro.
- **Recorte no destructivo**: el retrato se encuadra con zoom y posición; no hay recorte libre con rectángulo ni rotación manual (la orientación EXIF sí se aplica).
- **Cuatro por página** usa una cuadrícula 2×2; con textos largos aparecerán avisos y habrá que reducir la letra o usar 2 por página.
- **Un solo usuario/ventana**: si editas el mismo santo en dos pestañas, la segunda en guardar recibe un aviso de conflicto (no se pierde lo escrito, pero hay que recargar y volver a aplicar).
- **Vista de impresión en Safari**: «Imprimir» usa un iframe oculto; si tu navegador lo bloquea, usa el enlace «Abrir vista de impresión en otra pestaña» y `⌘P`.
- Los ids de característica deben ser únicos dentro de cada santo; si se repiten entre santos distintos se acepta con un aviso.
- El tipo de letra (Inter y Source Serif 4) va incluido localmente; los PDF se generan con Chromium de Playwright, por lo que la apariencia es idéntica a la vista previa en Chrome. Otros navegadores pueden variar ligeramente al imprimir.
