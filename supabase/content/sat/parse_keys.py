"""Reads the answer key and raw->scaled conversion table from each SAT scoring guide into data/keys.json."""
import json, re, sys
from pathlib import Path
import pypdf

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\aahme\OneDrive\Desktop\Digital SAT Practice Tests\1 - SAT")
OUT = Path(__file__).parent / "data" / "keys.json"

def parse(guide: Path):
    pages = [p.extract_text() for p in pypdf.PdfReader(str(guide)).pages]
    # The worksheet answer key page (page 1 can carry a stray hidden copy of another key, so search from the end).
    key_page = next(t for t in reversed(pages) if "Answer Key" in t and "MATH SECTION RAW SCORE" in t and "Module 2\nQUESTION" in t)
    # Answer rows "n ANSWER" in order: RW M1 (33), RW M2 (33), Math M1 (27), Math M2 (27)
    rows = re.findall(r"^(\d{1,2}) ([A-D]|-?[0-9./]+(?:\s*;\s*-?[0-9./]+)*)\s*$", key_page, re.M)
    cur, mods = [], []
    for n, a in rows:
        n = int(n)
        if n == 1 and cur:
            mods.append(cur); cur = []
        cur.append(a.strip())
    mods.append(cur)
    lens = [len(m) for m in mods]
    start = next((i for i in range(len(mods)) if lens[i:i + 4] == [33, 33, 27, 27]), 0)
    mods = mods[start:start + 4]
    assert [len(m) for m in mods] == [33, 33, 27, 27], [len(m) for m in mods]
    table_page = next(t for t in reversed(pages) if "Raw Score Conversion Table" in t and re.search(r"^66 \d{3} \d{3}", t, re.M))
    rw, math = {}, {}
    for raw, *vals in re.findall(r"^(\d{1,2}) (\d{3}) (\d{3})(?: (\d{3}) (\d{3}))?\s*$", table_page, re.M):
        raw = int(raw)
        rw[raw] = [int(vals[0]), int(vals[1])]
        if vals[2]:
            math[raw] = [int(vals[2]), int(vals[3])]
    assert len(rw) == 67 and len(math) == 55, (len(rw), len(math))
    spr = lambda a: [x.strip() for x in a.split(";")]
    return {
        "rw": [mods[0], mods[1]],
        "math": [[a if re.fullmatch(r"[A-D]", a) else spr(a) for a in m] for m in mods[2:]],
        "scale": {"rw": [rw[i] for i in range(67)], "math": [math[i] for i in range(55)]},
    }

keys = {}
for d in sorted(SRC.glob("SAT Test *")):
    n = d.name.split()[-1]
    keys[n] = parse(d / "3 - Scoring Guide.pdf")
OUT.write_text(json.dumps(keys, indent=1))
for n, k in keys.items():
    print(n, "spr:", sum(isinstance(a, list) for m in k["math"] for a in m), "math55:", k["scale"]["math"][54], "rw33:", k["scale"]["rw"][33])
same = len({json.dumps(k["scale"]) for k in keys.values()})
print("distinct scale tables:", same)
