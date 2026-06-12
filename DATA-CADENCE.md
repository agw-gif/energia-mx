# Energía MX — cadencia de actualización por dato

Auditoría de cada dato del portal y cómo se mantiene. El refresco automático lo corre el
GitHub Action (`.github/workflows/deploy.yml`) vía `scripts/update_data.py`; las notas las
alimenta el flujo editorial `energia-portal-daily` (con aprobación humana).

| Sección / dato | Cadencia | Cómo se actualiza | Estado |
|---|---|---|---|
| **Datos · KPIs SEN** (mix de generación, % renovables, intensidad de carbono, precio MWh, demanda pico, capacidad) | **Diario** | `update_data.py` → `evolve_sen()` (modelo determinista por fecha; hook `fetch_real_sen()` para fuente real) | ✅ automático |
| **Datos · Tendencia 14 días** | **Diario** | derivada del KPI de renovables en el front | ✅ automático |
| **Datos · Combustibles y mercados** (Mezcla Mexicana, Henry Hub, Brent, CEL) | **Diario** | `update_data.py` → `evolve_indicadores()` | ✅ automático |
| **Datos · serie CSV** | **Diario** | `update_data.py` → `write_csv()` | ✅ automático |
| **Meta** (fecha de edición, hora CDMX, número) | **Diario** | `update_data.py` | ✅ automático |
| **Noticias** (12/día, 2 por categoría) | **Diario/según se corra** | flujo `energia-portal-daily` (descubre → redacta → Gemini → aprobación → `publish_to_portal.py`); poda a 120 | ✅ semiautomático (con aprobación) |
| **Agenda · próximos hitos** | **Diario (poda) / curado** | `update_data.py` → `prune_agenda()` quita eventos pasados; alta de nuevos hitos vía edición/flujo editorial | ✅ poda automática |
| **Mapa · Top 5 por tecnología** | **Anual** | datos de capacidad (IRENA/IEA/Ember); se revisan ~1 vez al año | 🖉 manual (anual) |
| **Casos de Éxito** | **Fijo / curado** | curaduría editorial; se dejan en el portal un tiempo, no se suben a diario | 🖉 manual |
| **Política · briefs y documentos** | **Mensual / por evento** | se actualizan cuando hay cambio regulatorio relevante | 🖉 manual |
| **Hero, footer, textos de marca** | **Estático** | solo cambian por decisión editorial | 🖉 manual |

## Resumen
- **Automático cada mañana (GitHub Action):** KPIs del SEN, tendencia, combustibles, CSV, meta, poda de agenda.
- **Diario con aprobación humana:** las 12 noticias (flujo `energia-portal-daily`).
- **Manual por su naturaleza:** Top 5 del mapa (anual), Casos de Éxito (curados), briefs de Política (por evento).

> Para conectar datos REALES en lugar del modelo determinista, ver el hook `fetch_real_sen()`
> en `update_data.py` (Ember / EIA / ENTSO-E / CENACE) y añadir adaptadores análogos para
> combustibles (p. ej. EIA para Brent/Henry Hub).
