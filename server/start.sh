#!/usr/bin/env bash
set -euo pipefail
export GAME_ROOT=/var/www/kartracer/public
export ACCOUNT_DATA=/var/www/kartracer/data
export PUBLIC_ORIGIN="$(cat /var/www/kartracer/account-origin)"
exec /usr/bin/python3 "$GAME_ROOT/server/app.py"
