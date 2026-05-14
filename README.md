# TVR Tube

App de escritorio para descargar videos de YouTube hasta 4K (2160p) o pistas de audio (MP3/M4A) desde una UI minimalista, dark-first, estilo Linear/Vercel/Raycast.

Stack: **Electron · Next.js 16 · React 19 · Tailwind 4 · TypeScript estricto · shadcn-style primitives · Framer Motion · Zod + RHF · sonner**. Procesamiento local con **yt-dlp + ffmpeg** — los binarios se manejan automáticamente en el primer launch.

> Herramienta personal de aprendizaje. No afiliada con YouTube ni con Google. Usá solo contenido del que seas propietario o que tenga licencia que lo permita.

## Estado por fases

| Fase | Estado | Alcance |
|---|---|---|
| 1 — UI | ✅ | Validación de URL, preview de metadata, selector de calidad, historial local, theme toggle, páginas legales. |
| 2 — Bin manager | ✅ | En primer launch descarga `yt-dlp` a `userData/bin/` con barra de progreso, verifica SHA256 contra `SHA2-256SUMS` y empaqueta `ffmpeg-static`. |
| 3 — IPC real | ✅ | Handlers `metadata:get` (oEmbed + probe de qualities) y `download:start` (yt-dlp + ffmpeg con merge a mp4 o extracción de audio), progreso por `download:progress`, cancelación con `download:cancel`. |
| 4 — Settings UI | ✅ | Sheet con ⚙️ en el header. Carpeta de descargas configurable (file picker nativo) y theme picker. Settings persistidos en `userData/settings.json`. |
| 5 — Empaquetado | ✅ | Instalador NSIS para Windows funcional. Config de DMG (macOS) y AppImage (Linux) lista para correr en sus respectivas plataformas. Iconos generados desde `build/icon.svg`. |
| 6 — Auto-update | ⏳ | Opcional, vía GitHub releases. |

## Setup local

### 1) Requisitos

- Node.js 20+
- npm (este repo usa npm)
- No hace falta tener `yt-dlp` ni `ffmpeg` instalados en el sistema — la app los provee.

### 2) Variables de entorno

```bash
cp .env.example .env.local
```

Para correr en desarrollo alcanza con dejarlo vacío.

### 3) Instalar e iniciar

```bash
npm install
npm run dev
```

`npm run dev` levanta Next en `http://localhost:3000` y, en paralelo, Electron apuntando a ese dev server. El primer launch descarga `yt-dlp` (~17 MB) a `userData/bin/`, valida su SHA256, y muestra un overlay mientras tanto.

## Estructura

```
electron/
├── main.ts                   # Main process: ventana, IPC handlers, bootstrap de binarios
├── preload.ts                # Bridge contextIsolated → window.tvr
├── bin-manager.ts            # Descarga + verificación SHA256 de yt-dlp, paths de ffmpeg
├── ytdlp.ts                  # Wrapper sobre yt-dlp: downloadVideo, downloadAudio, probe
├── metadata.ts               # oEmbed + extractVideoId + probe de qualities
├── download-service.ts       # Orquesta descargas: tmpdir, AbortController, mover al final
└── tsconfig.json             # Build a dist-electron/

src/
├── app/
│   ├── layout.tsx            # ThemeProvider + Toaster + Geist
│   ├── page.tsx              # Hero + Downloader + History (envuelto en BinariesGate)
│   ├── globals.css           # Tokens dark-first + utilities + animaciones
│   └── legal/{terms,privacy}/
├── components/
│   ├── ui/                   # Primitives shadcn-style (manuales)
│   └── features/
│       ├── binaries-gate.tsx # Overlay durante bootstrap de yt-dlp/ffmpeg
│       ├── downloader.tsx    # Orquestador, consume window.tvr
│       ├── video-preview.tsx
│       ├── quality-selector.tsx
│       ├── download-history.tsx
│       ├── theme-toggle.tsx
│       ├── site-header.tsx
│       └── site-footer.tsx
├── hooks/
│   └── use-download-history.ts
├── lib/
│   ├── youtube.ts            # extractVideoId, canonicalUrl, thumbnailUrl (renderer)
│   ├── constants.ts          # Calidades, bitrates, formatos
│   └── utils.ts              # cn, formatters
└── types/
    ├── video.ts
    └── tvr-api.d.ts          # Tipos del bridge window.tvr
```

## Decisiones de diseño

- **Dark-first** con tokens HSL en CSS variables. Toggle a claro vía `next-themes` con `class` strategy. Tailwind 4 `@variant dark` configura el variant.
- **Acento gradiente violeta→fucsia** restringido a CTAs y badges, nunca en fondos grandes.
- **Glassmorphism sutil** en header y toaster (backdrop blur con saturación ligera, sin sobreuso).
- **Animaciones**: Framer Motion para transiciones de estado, micro-animaciones CSS para hover/active. `prefers-reduced-motion` honrado globalmente.
- **Accesibilidad**: ARIA labels en todos los controles, `focus-visible` con doble ring, contraste ≥ 4.5:1 en tokens.
- **Sin shadcn CLI**: primitives copiados a mano para control total y mantenerlos compatibles con Tailwind 4.

## Notas técnicas

- Next.js 16 hizo `cookies()`, `headers()`, `params` **async** — todo el código respeta eso.
- El historial vive en `localStorage` bajo la clave `ytv:download-history` (máx 25 entradas).
- `ffmpeg` viene empaquetado vía `ffmpeg-static`; en builds de producción queda fuera del `asar` (ver `build.asarUnpack` en [package.json](package.json)).
- `yt-dlp` se descarga del release `latest` de GitHub y se valida contra el `SHA2-256SUMS` del mismo release antes del primer uso.
- Las descargas se guardan por defecto en `~/Downloads/TVR Tube/` (carpeta `downloads` del sistema vía `app.getPath("downloads")`). Configurable desde el sheet ⚙️. Si ya existe un archivo con el mismo nombre, se renombra con sufijo ` (2)`, ` (3)`, etc.
- Cookies opcionales: setear `YT_DLP_COOKIES_PATH` en el entorno para pasarle a yt-dlp un `cookies.txt` (útil para videos con bot-check o restricción de edad).
- `--extractor-args` opcional: setear `YT_DLP_EXTRACTOR_ARGS` para pasar flags como `youtube:player_client=android` cuando YouTube cambia su API.
- Los settings del usuario viven en `userData/settings.json` (validados con Zod, escritura atómica vía `.tmp` + rename).

## Empaquetado

```bash
npm run icons:generate   # Re-genera build/icon.png desde build/icon.svg
npm run dist:win         # → release/TVR Tube-<version>-win-x64.exe (NSIS, requiere Developer Mode en Windows)
npm run dist:mac         # → release/TVR Tube-<version>-mac-<arch>.dmg (correr en macOS)
npm run dist:linux       # → release/TVR Tube-<version>.AppImage
```

**Windows:** electron-builder descarga `winCodeSign` que contiene symlinks de macOS. Para que Windows pueda extraerlo sin admin, activá **Developer Mode** (Settings → Privacy & Security → For developers → ON). El instalador NSIS resultante es un asistente con elección de directorio, shortcut en desktop y en menú inicio.

**macOS:** cross-build desde Windows produce DMG sin firmar que Gatekeeper bloquea — conviene correrlo en una Mac.

**Iconos:** la fuente es `build/icon.svg`. Si querés cambiar el branding, editá el SVG y corré `npm run icons:generate`. electron-builder convierte el PNG resultante a `.ico` / `.icns` automáticamente al empaquetar.

## Scripts

```bash
npm run dev            # Next dev + Electron en paralelo (concurrently)
npm run next:dev       # Solo Next dev server
npm run electron:dev   # Solo Electron (build TS + wait-on tcp:3000 + electron .)
npm run build          # next build + tsc del main process
npm run icons:generate # Regenera build/icon.png desde el SVG fuente
npm run dist           # Build + electron-builder (todas las plataformas configuradas)
npm run dist:win       # Build + instalador NSIS para Windows
npm run dist:mac       # Build + DMG para macOS
npm run dist:linux     # Build + AppImage para Linux
npm run lint           # ESLint
```
