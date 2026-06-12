#!/usr/bin/env bash
# Sirve Energía MX localmente en http://localhost:8765
cd "$(dirname "$0")/.."
echo "Energía MX → http://localhost:8765"
python3 -m http.server 8765
