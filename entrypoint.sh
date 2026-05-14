#!/bin/bash
set -e

# Cookies montadas desde fuera (Coolify file mount, docker -v, etc.) suelen ser
# propiedad de root y, peor aún, el directorio padre puede no tener +x para
# "others", lo que impide a `nextjs` (uid 1001) siquiera atravesarlo. Copiamos
# el archivo a un path bajo el HOME de `nextjs` y reapuntamos la var ahí.
if [ -n "$YT_DLP_COOKIES_PATH" ]; then
    if [ -f "$YT_DLP_COOKIES_PATH" ]; then
        dest="/home/nextjs/cookies.txt"
        echo "[entrypoint] Copiando cookies de $YT_DLP_COOKIES_PATH -> $dest"
        if cp "$YT_DLP_COOKIES_PATH" "$dest" \
           && chown nextjs:nodejs "$dest" \
           && chmod 600 "$dest"; then
            export YT_DLP_COOKIES_PATH="$dest"
        else
            echo "[entrypoint] AVISO: no se pudo preparar la copia de cookies; continuando sin cookies." >&2
            unset YT_DLP_COOKIES_PATH
        fi
    else
        echo "[entrypoint] AVISO: YT_DLP_COOKIES_PATH=$YT_DLP_COOKIES_PATH no es un archivo regular; continuando sin cookies." >&2
        unset YT_DLP_COOKIES_PATH
    fi
fi

# Bajamos privilegios y ejecutamos el comando original como nextjs.
exec gosu nextjs:nodejs "$@"
