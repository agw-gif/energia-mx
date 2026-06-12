#!/usr/bin/env python3
"""Arma un único archivo HTML autocontenido (datos + JS + CSS + imagen inline)
que abre con doble clic en cualquier navegador, sin servidor. Ideal para compartir.

Uso: python3 scripts/build_standalone.py
Salida: Energia-MX.html (en la raíz del proyecto y copia en ~/Downloads)
"""
import base64, re, pathlib, shutil

ROOT = pathlib.Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")
appjs = (ROOT / "assets/app.js").read_text(encoding="utf-8")
data = (ROOT / "data/dashboard.json").read_text(encoding="utf-8")

hero = pathlib.Path("/tmp/hero_small.jpg")
if not hero.exists():
    hero = ROOT / "assets/hero.jpg"
hero_uri = "data:image/jpeg;base64," + base64.b64encode(hero.read_bytes()).decode()

# usar datos embebidos en vez de fetch
appjs = appjs.replace(
    'DATA = await (await fetch("data/dashboard.json?_=" + Date.now())).json();',
    'DATA = EMBEDDED_DATA;')

inline = "<script>\nconst EMBEDDED_DATA = " + data + ";\n" + appjs + "\n</script>"
html = re.sub(r'<script src="assets/app\.js[^"]*"></script>', lambda m: inline, html)
html = html.replace("url('assets/hero.jpg')", "url('" + hero_uri + "')")
html = html.replace('href="data/series.csv" download', 'href="#" onclick="return false"')

out = ROOT / "Energia-MX.html"
out.write_text(html, encoding="utf-8")
dl = pathlib.Path.home() / "Downloads" / "Energia-MX.html"
shutil.copy(out, dl)
print(f"OK · {out.name} ({out.stat().st_size//1024} KB)")
print(f"copia en: {dl}")
