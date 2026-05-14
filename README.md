# TVR Tube

Descarga videos de YouTube hasta 4K (2160p) o pistas de audio (MP3/M4A) desde una UI minimalista, dark-first, estilo Linear/Vercel/Raycast.

Stack: **Next.js 16 · React 19 · Tailwind 4 · TypeScript estricto · shadcn-style primitives · Framer Motion · Zod + RHF · sonner**. Procesamiento server-side con **yt-dlp + ffmpeg** y almacenamiento temporal en **Cloudflare R2**.

> Herramienta personal de aprendizaje. No afiliada con YouTube ni con Google. Usá solo contenido del que seas propietario o que tenga licencia que lo permita.

## Estado por fases

| Fase | Estado | Alcance |
|---|---|---|
| 1 | ✅ | UI, validación de URL, preview de metadata (oEmbed), selector de calidad, historial local, theme toggle, páginas legales. |
| 2 | ⏳ | Descarga real con yt-dlp, merge ffmpeg, upload a R2, URLs pre-firmadas. |
| 3 | ⏳ | Cola BullMQ + Redis, SSE para progreso en tiempo real, rate limiting por IP. |
| 4 | ⏳ | Dockerfile, hardening, pulido visual, deploy guide. |

## Setup local

### 1) Requisitos

- Node.js 20+
- npm (este repo usa npm)
- **ffmpeg** en `PATH` (verificá con `ffmpeg -version`)
- **yt-dlp** en `PATH` — necesario desde Fase 2. Instalación:
  - Windows (Chocolatey): `choco install yt-dlp`
  - Windows (Scoop): `scoop install yt-dlp`
  - Manual: descargar [yt-dlp.exe](https://github.com/yt-dlp/yt-dlp/releases/latest) y agregar al PATH.

### 2) Variables de entorno

```bash
cp .env.example .env.local
```

Para Fase 1 alcanza con dejarlo vacío. Para Fase 2 necesitás credenciales de R2 — instrucciones en `.env.example`.

### 3) Instalar e iniciar

```bash
npm install
npm run dev
```

Abrí http://localhost:3000.

## Estructura

```
src/
├── app/
│   ├── layout.tsx              # ThemeProvider + Toaster + Geist
│   ├── page.tsx                # Hero + Downloader + Disclaimer + History
│   ├── globals.css             # Tokens dark-first + utilities + animaciones
│   ├── api/
│   │   └── metadata/route.ts   # Proxy oEmbed (Fase 1)
│   └── legal/{terms,privacy}/
├── components/
│   ├── ui/                     # Primitives shadcn-style (manuales)
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── card.tsx
│   │   ├── select.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   ├── skeleton.tsx
│   │   ├── separator.tsx
│   │   └── label.tsx
│   ├── features/
│   │   ├── downloader.tsx      # Orquestador (cliente)
│   │   ├── video-preview.tsx
│   │   ├── quality-selector.tsx
│   │   ├── download-history.tsx
│   │   ├── disclaimer.tsx
│   │   ├── theme-toggle.tsx
│   │   ├── site-header.tsx
│   │   └── site-footer.tsx
│   └── providers.tsx
├── hooks/
│   └── use-download-history.ts
├── lib/
│   ├── env.ts                  # Validación zod de env
│   ├── youtube.ts              # extractVideoId, canonicalUrl, thumbnailUrl
│   ├── constants.ts            # Calidades, bitrates, formatos
│   └── utils.ts                # cn, formatters
└── types/
    └── video.ts
```

## Decisiones de diseño

- **Dark-first** con tokens HSL en CSS variables. Toggle a claro vía `next-themes` con `class` strategy. Tailwind 4 `@variant dark` configura el variant.
- **Acento gradiente violeta→fucsia** restringido a CTAs y badges, nunca en fondos grandes.
- **Glassmorphism sutil** en header y toaster (backdrop blur con saturación ligera, sin sobreuso).
- **Animaciones**: Framer Motion para transiciones de estado, micro-animaciones CSS para hover/active. `prefers-reduced-motion` honrado globalmente vía media query.
- **Accesibilidad**: ARIA labels en todos los controles, `focus-visible` con doble ring, contraste ≥ 4.5:1 en tokens.
- **Sin shadcn CLI**: primitives copiados a mano para control total y mantenerlos compatibles con Tailwind 4.

## Notas técnicas

- Next.js 16 hizo `cookies()`, `headers()`, `params` **async** — todos los route handlers respetan eso.
- En Fase 1 el endpoint `/api/metadata` usa la API pública oEmbed de YouTube (sin auth, rate-limited por YT). No requiere yt-dlp aún.
- El historial vive en `localStorage` bajo la clave `ytv:download-history` (máx 25 entradas).
- Vercel **no soporta** ffmpeg/yt-dlp en serverless. Deploy planeado: Docker en Fly.io, Railway o VPS (Fase 4).

## Scripts

```bash
npm run dev      # dev server con turbopack
npm run build    # build producción
npm run start    # serve producción
npm run lint     # ESLint
```
