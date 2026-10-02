#!/usr/bin/env python3
"""Regenerate the ASSETS precache list in sw.js from the files on disk.
Run from the project root after adding/removing files:  python3 tools/build_sw.py
"""
import pathlib, re, json

root = pathlib.Path(__file__).resolve().parent.parent
include = ["index.html", "manifest.json"]
for folder in ["css", "js", "data", "assets"]:
    for p in sorted((root / folder).rglob("*")):
        if p.is_file() and not p.name.startswith("."):
            include.append(p.relative_to(root).as_posix())
assets = ["./"] + [f"./{p}" for p in include]
sw = (root / "sw.js").read_text()
block = "/* ASSETS:START */\nconst ASSETS = " + json.dumps(assets, indent=2) + ";\n/* ASSETS:END */"
sw = re.sub(r"/\* ASSETS:START \*/.*?/\* ASSETS:END \*/", block, sw, flags=re.S)
(root / "sw.js").write_text(sw)
print(f"sw.js: {len(assets)} assets precached")
