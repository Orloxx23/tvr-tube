<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Auto-actualización (electron-updater)

La app usa `electron-updater` con GitHub Releases. El flujo:

1. Subí la versión en `package.json` (`version`).
2. Exportá un token con permisos `repo`: `setx GH_TOKEN <token>` (o `$env:GH_TOKEN="..."` para la sesión).
3. Ejecutá `npm run release` (o `release:win`/`release:mac`/`release:linux`). Esto buildea Next + Electron, empaqueta y sube los artefactos + `latest.yml` a un release nuevo en `Orloxx23/tvr-tube`.
4. Publicá el release en GitHub (de borrador a publicado) para que los clientes lo detecten.

La app empaquetada chequea actualizaciones al iniciar (4 s después del arranque) y muestra el `UpdateNotifier` (banner abajo a la derecha). Descarga en segundo plano y pide al usuario reiniciar para instalar. En `dev` los chequeos están deshabilitados.
