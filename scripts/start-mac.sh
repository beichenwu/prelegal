#!/usr/bin/env bash
# Build the image and run Prelegal in a container on http://localhost:8000
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$root"

docker build -t prelegal:latest .
docker rm -f prelegal >/dev/null 2>&1 || true

env_arg=()
[ -f .env ] && env_arg=(--env-file .env)

docker run -d --name prelegal -p 8000:8000 "${env_arg[@]}" prelegal:latest >/dev/null
echo "Prelegal is running at http://localhost:8000"
