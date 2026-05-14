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
            size=$(stat -c%s "$dest" 2>/dev/null || echo "?")
            first_line=$(head -n 1 "$dest" 2>/dev/null || echo "")
            yt_count=$(grep -c -E "\.?youtube\.com" "$dest" 2>/dev/null || echo 0)
            echo "[entrypoint] Cookies size=${size}B, first_line='${first_line}', youtube_entries=${yt_count}"
            if [ "$size" -lt 100 ] 2>/dev/null; then
                echo "[entrypoint] AVISO: el archivo de cookies parece vacío o muy chico." >&2
            fi
            if ! echo "$first_line" | grep -q "Netscape HTTP Cookie File"; then
                echo "[entrypoint] AVISO: la primera línea no es '# Netscape HTTP Cookie File' — yt-dlp requiere formato Netscape, no JSON." >&2
            fi
            if [ "$yt_count" = "0" ]; then
                echo "[entrypoint] AVISO: no se encontraron entradas de youtube.com en las cookies." >&2
            fi
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
