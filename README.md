# Energía · MX — portal con tableros dinámicos

Recreación funcional del diseño "Energía · MX" (Claude Design) como **app real**:
sitio editorial fiel + **tableros que se actualizan día con día** + interactivo
(charts en SVG, mapa Leaflet, filtros). No depende de Wix.

## Estructura

```
energia-mx-app/
├── index.html              # sitio (10 secciones, fiel al diseño)
├── assets/app.js           # render dinámico desde el JSON + charts + mapa + filtros
├── data/
│   ├── dashboard.json       # FUENTE DE VERDAD de todo el contenido/datos
│   └── series.csv           # serie descargable (la genera el actualizador)
└── scripts/
    ├── update_data.py       # ACTUALIZADOR DIARIO (mueve los tableros)
    └── serve.sh             # servidor local
```

## Correr localmente

```bash
cd energia-mx-app
python3 scripts/update_data.py     # refresca los datos a hoy (CDMX)
bash scripts/serve.sh              # → http://localhost:8765
```

## Que se actualice solo, día con día

El actualizador sella la fecha/hora reales, evoluciona los KPIs del Sistema
Eléctrico Nacional (mix de generación, % renovables, intensidad de carbono, precio
MWh, demanda pico, capacidad), poda la agenda y regenera el CSV.

**Programarlo cada mañana (macOS, 07:00 CDMX) con cron:**

```bash
crontab -e
# añade:
0 7 * * *  cd "/Users/AlexGarcia/Documents/Claude/Claude Code/energia-mx-app" && /usr/bin/python3 scripts/update_data.py >> /tmp/energiamx.log 2>&1
```

(o con el skill `/schedule` de Claude Code, o un GitHub Action si se despliega.)

## Datos reales vs. modelo

Hoy los KPIs evolucionan con un **modelo determinista por fecha** (se mueven a
diario, dentro de rangos realistas) para que el sitio "se vea vivo" sin depender de
una API. En `update_data.py` está el hook `fetch_real_sen()` listo para conectar
fuentes reales (Ember / EIA / ENTSO-E / CENACE / precios de commodities) cuando se
tengan endpoints/llaves; si la fuente responde, sustituye al modelo automáticamente.

Las tarjetas editoriales (Análisis, Geotermia, Política) pueden alimentarse del
pipeline `energia-mx-daily` (notas diarias) escribiendo en `data/dashboard.json`.

## Desplegar (siguiente paso)

Es un sitio estático + JSON: se publica en cualquier host (Netlify, Vercel, Cloudflare
Pages, GitHub Pages, S3). El actualizador corre como job programado (GitHub Action /
cron del host / función serverless) que reescribe `data/*.json` y vuelve a publicar.
```
```

© 2026 Energía MX
