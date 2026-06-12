#!/usr/bin/env python3
"""
Energía MX — actualizador diario de datos.

Refresca data/dashboard.json para que los tableros "se vean vivos" cada día:
  - Sella fecha de edición y hora (CDMX) reales.
  - Evoluciona los KPIs del Sistema Eléctrico Nacional con una caminata aleatoria
    DETERMINISTA por fecha (misma fecha => mismos números; cambia día con día),
    dentro de rangos realistas, manteniendo el mix sumando 100%.
  - Poda los eventos de la Agenda ya pasados.
  - Escribe data/series.csv (para el enlace "Descargar serie completa").

Fuentes reales (opcionales): hay hooks fetch_* listos para conectar Ember / EIA /
ENTSO-E / precios de commodities cuando haya API key. Sin red, usa el modelo
determinista para que el sitio siga actualizándose a diario.

Uso:
    python3 scripts/update_data.py            # usa la fecha de hoy (CDMX)
    python3 scripts/update_data.py 2026-06-12 # fuerza una fecha (pruebas)

Solo stdlib. Programar a diario con cron / launchd / GitHub Actions (ver README).
"""
import json, sys, os, hashlib, csv, datetime as dt

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "dashboard.json")
CSV_OUT = os.path.join(ROOT, "data", "series.csv")

MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio",
         "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
MESES_ABR = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
DOW_ABR = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"]


def cdmx_now():
    # CDMX = UTC-6 (sin horario de verano desde 2023)
    return dt.datetime.now(dt.timezone.utc).replace(tzinfo=None) - dt.timedelta(hours=6)


def seeded_unit(date_str, key):
    """Float determinista en [0,1) a partir de (fecha, key)."""
    h = hashlib.sha256(f"{date_str}:{key}".encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def walk(date_str, key, base, spread, lo, hi, dec=1):
    """Valor que oscila día con día alrededor de base, acotado a [lo,hi]."""
    v = base + (seeded_unit(date_str, key) - 0.5) * 2 * spread
    v = max(lo, min(hi, v))
    return round(v, dec)


def arrow(curr, prev, unit="", pp=False, pct=False, good_down=False):
    diff = curr - prev
    up = diff >= 0
    sym = "▲" if up else "▼"
    if pp:
        txt = f"{sym} {'+' if up else '-'}{abs(diff):.1f} pp vs ayer"
    elif pct:
        rel = (diff / prev * 100) if prev else 0
        txt = f"{sym} {'+' if rel >= 0 else '-'}{abs(rel):.1f}% vs 7d"
    else:
        txt = f"{sym} {'+' if up else '-'}{abs(diff):.1f}{unit}"
    return txt


# ----------- hooks de fuentes reales (opcionales, no obligatorios) -----------
def fetch_real_sen(date_str):
    """Devuelve dict de KPIs reales o None. Conectar Ember/EIA/CENACE aquí.
    Requiere red + (a veces) API key. Si falla, regresamos None y se usa el modelo."""
    return None
# ---------------------------------------------------------------------------


def evolve_sen(sen, date_str):
    real = fetch_real_sen(date_str)
    if real:
        sen.update(real)
        return sen

    yday = (dt.date.fromisoformat(date_str) - dt.timedelta(days=1)).isoformat()
    w7 = (dt.date.fromisoformat(date_str) - dt.timedelta(days=7)).isoformat()

    # Mix de generación — se mueve, renormaliza a 100, gas natural domina.
    bases = {"Gas natural": 52, "Eólica": 14, "Solar": 9, "Hidro": 7, "Carbón": 8, "Otros": 10}
    raw = {n: max(1, bases[n] + (seeded_unit(date_str, "mix:" + n) - 0.5) * (6 if n in ("Gas natural", "Eólica", "Solar") else 3))
           for n in bases}
    tot = sum(raw.values())
    mix_pct = {n: round(raw[n] / tot * 100) for n in raw}
    # ajuste para sumar exactamente 100
    drift = 100 - sum(mix_pct.values())
    mix_pct["Gas natural"] += drift
    for s in sen["generation_mix"]["slices"]:
        s["value"] = mix_pct[s["name"]]
    sen["generation_mix"]["headline_value"] = mix_pct["Gas natural"]

    renov = mix_pct["Eólica"] + mix_pct["Solar"] + mix_pct["Hidro"] + round(mix_pct["Otros"] * 0.4)
    renov_y = round(renov - (seeded_unit(yday, "renovdelta") - 0.4) * 2.5, 1)

    carbon = walk(date_str, "carbon", 412, 18, 360, 470, 0)
    carbon7 = walk(w7, "carbon", 412, 18, 360, 470, 0)
    price = walk(date_str, "price", 1487, 120, 1150, 1900, 0)
    price7 = walk(w7, "price", 1487, 120, 1150, 1900, 0)
    peak = walk(date_str, "peak", 48.2, 3.5, 41, 55, 1)
    cap = walk(date_str, "cap", 92.4, 0.4, 90, 95, 1)
    peak_t = f"{int(19 + seeded_unit(date_str,'peakh')*3)}:{['00','15','30','45'][int(seeded_unit(date_str,'peakm')*4)]}"

    sen["kpis"] = [
        {"label": "% RENOVABLES AHORA", "value": f"{round(renov,1)}", "unit": "%",
         "delta": arrow(round(renov, 1), round(renov_y, 1), pp=True), "trend": "up"},
        {"label": "INTENSIDAD DE CARBONO", "value": f"{int(carbon)}", "unit": "gCO₂/kWh",
         "delta": arrow(carbon, carbon7, pct=True), "trend": "down-good"},
        {"label": "PRECIO PROMEDIO MWH", "value": f"${int(price):,}", "unit": "MXN",
         "delta": arrow(price, price7, pct=True), "trend": "up-bad"},
        {"label": "DEMANDA PICO AYER", "value": f"{peak}", "unit": "GW",
         "delta": f"{peak_t} h · Sistema Interconectado Nacional", "trend": "flat"},
    ]
    sen["capacity"]["value"] = f"{cap}"
    return sen


def prune_agenda(agenda, today):
    """Quita eventos cuya fecha (DD/MMM del año indicado) ya pasó."""
    keep = []
    for ev in agenda["events"]:
        try:
            dd, mmm = ev["date"].split("/")
            yr = int(ev.get("dow", "· 2026").split()[-1])
            mi = MESES_ABR.index(mmm.lower()[:3]) + 1 if mmm.lower()[:3] in MESES_ABR else \
                {"may": 5, "jun": 6, "jul": 7}.get(mmm.lower()[:3], 1)
            d = dt.date(yr, mi, int(dd))
            if d >= today:
                keep.append(ev)
        except Exception:
            keep.append(ev)
    if keep:
        agenda["events"] = keep
    return agenda


def write_csv(sen, date_str):
    os.makedirs(os.path.dirname(CSV_OUT), exist_ok=True)
    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["fecha", "metrica", "valor", "unidad"])
        for s in sen["generation_mix"]["slices"]:
            w.writerow([date_str, f"mix_{s['name'].lower().replace(' ', '_')}", s["value"], "%"])
        for k in sen["kpis"]:
            w.writerow([date_str, k["label"], k["value"].replace("$", "").replace(",", ""), k["unit"]])
        w.writerow([date_str, "capacidad_instalada", sen["capacity"]["value"], sen["capacity"]["unit"]])


def evolve_indicadores(extras, date_str):
    """Combustibles y mercados — precios que se mueven a DIARIO (caminata determinista)."""
    ind = extras.get("datos_indicadores")
    if not ind:
        return
    w7 = (dt.date.fromisoformat(date_str) - dt.timedelta(days=7)).isoformat()
    # label: (base, spread, lo, hi, decimales)
    cfg = {
        "Mezcla Mexicana": (68.4, 4.5, 55, 86, 1),
        "Gas natural · Henry Hub": (3.85, 0.45, 2.4, 5.6, 2),
        "Brent": (74.1, 4.0, 62, 92, 1),
        "Certificados CEL": (18.9, 1.6, 12, 26, 1),
    }
    for it in ind["items"]:
        c = cfg.get(it["label"])
        if not c:
            continue
        base, spread, lo, hi, dec = c
        v = walk(date_str, "ind:" + it["label"], base, spread, lo, hi, dec)
        v7 = walk(w7, "ind:" + it["label"], base, spread, lo, hi, dec)
        pfx = "$" if it.get("value", "").startswith("$") else ""
        it["value"] = f"{pfx}{v:.{dec}f}" if dec else f"{pfx}{int(v)}"
        rel = ((v - v7) / v7 * 100) if v7 else 0
        if abs(rel) < 0.2:
            it["delta"], it["trend"] = "= sin cambio", "flat"
        else:
            up = rel >= 0
            it["delta"] = f"{'▲' if up else '▼'} {'+' if up else '-'}{abs(rel):.1f}% vs 7d"
            it["trend"] = "up-bad" if up else "down"


def main():
    date_str = sys.argv[1] if len(sys.argv) > 1 else cdmx_now().date().isoformat()
    d = dt.date.fromisoformat(date_str)
    now = cdmx_now()

    data = json.load(open(DATA, encoding="utf-8"))

    data["meta"]["edition_date_iso"] = date_str
    data["meta"]["edition_date_label"] = f"{d.day} {MESES[d.month-1].upper()} {d.year}"
    data["meta"]["updated_label"] = f"{now.strftime('%H:%M')} CDMX"
    data["meta"]["updated_iso"] = now.isoformat()
    data["meta"]["generated_at"] = now.isoformat()
    # número de edición sube ~1 por día desde un ancla
    anchor = dt.date(2026, 5, 6)
    num = 87 + (d - anchor).days
    data["meta"]["volume"] = f"Vol. II · Núm. {num}"

    data["sen"] = evolve_sen(data["sen"], date_str)
    if "extras" in data:
        evolve_indicadores(data["extras"], date_str)
    data["agenda"] = prune_agenda(data["agenda"], d)
    write_csv(data["sen"], date_str)

    json.dump(data, open(DATA, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"[ok] {date_str} {now.strftime('%H:%M')} CDMX · Núm.{num} · "
          f"renov {data['sen']['kpis'][0]['value']}% · "
          f"precio {data['sen']['kpis'][2]['value']} · "
          f"pico {data['sen']['kpis'][3]['value']} GW · "
          f"agenda {len(data['agenda']['events'])} eventos")


if __name__ == "__main__":
    main()
