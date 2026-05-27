<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Auto-actualización (electron-updater)

La app usa `electron-updater` con GitHub Releases. La app empaquetada chequea actualizaciones al iniciar (4 s después del arranque) y muestra el `UpdateNotifier` (banner abajo a la derecha). Descarga en segundo plano y pide al usuario reiniciar para instalar. En `dev` los chequeos están deshabilitados.

### Publicar un release (automático, recomendado)

CI corre `.github/workflows/release.yml` y buildea Windows/macOS/Linux en paralelo cuando aparece un tag `v*`.

1. Subí la `version` en `package.json` y commiteala.
2. `rtk git tag v0.1.2 && rtk git push origin v0.1.2`
3. Esperá que termine el workflow en Actions; va a crear un release como borrador con los instaladores y `latest*.yml`.
4. Editá el release en GitHub y marcalo como publicado para que los clientes lo detecten.

### Publicar un release (manual / local)

1. Subí la `version` en `package.json`.
2. `$env:GH_TOKEN = "<PAT con scope repo o fine-grained Contents:RW>"`
3. `npm run release:win` (o `release:mac` / `release:linux`).
4. Publicá el release en GitHub (borrador → publicado).
