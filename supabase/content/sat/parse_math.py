"""Math drafts for transcription: per question its page, raw visible text, answer key and an auto-cropped figure.
Math expressions in these PDFs do not survive text extraction, so stems and choices are transcribed by hand into
data/sat-NN-math.txt (see build_sat.py for the format); this script supplies the figures and a text reference.
Usage: python parse_math.py <test number> [<page render dir>]"""
import json, re, sys
from pathlib import Path
import fitz
from parse_rw import FLAGS, COL_SPLIT, HERE, paths, module_pages, lines_of, is_bar, clean, union

def math_figure(page, region, lines):
    """Figures in math questions: clustered drawings/images (text is Times here, so fonts can't tell figures apart)."""
    core = []
    for d in page.get_drawings():
        r = fitz.Rect(d["rect"])
        if not (region.x0 <= r.x0 < region.x1 and region.y0 <= r.y0 and r.y1 <= region.y1 and r.x1 <= 600):
            continue
        if r.y0 < region.y0 + 14 and r.height < 15:      # question-number bar
            continue
        if r.width < 3 and r.height > 150:               # column separator
            continue
        if r.width > 150 and r.height < 3 and not any(abs(o.y0 - r.y0) > 5 and abs(o.x0 - r.x0) < 2 and abs(o.x1 - r.x1) < 2 for o in
                                                       (fitz.Rect(x["rect"]) for x in page.get_drawings())):
            continue                                       # lone separator rule (table rules repeat)
        core.append(r)
    for img in page.get_image_info():
        r = fitz.Rect(img["bbox"])
        if region.intersects(r) and r.width > 30 and r.height > 20 and r.y0 > region.y0 + 10:
            core.append(r & region)
    if not core:
        return None
    clusters = [fitz.Rect(r.x0, r.y0, max(r.x1, r.x0 + 0.1), max(r.y1, r.y0 + 0.1)) for r in core]
    merged = True
    while merged:
        merged = False
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                a, b = clusters[i], clusters[j]
                if a.x0 - 14 < b.x1 and b.x0 - 14 < a.x1 and a.y0 - 20 < b.y1 and b.y0 - 20 < a.y1:
                    clusters[i] = union(a, b)
                    del clusters[j]
                    merged = True
                    break
            if merged:
                break
    box = max(clusters, key=lambda r: r.width * r.height)
    if box.width < 50 or box.height < 40:
        return None
    for _ in range(3):   # labels inside or beside the figure
        for ln in lines:
            b = ln["bbox"]
            if re.match(r"^[A-D]\)", ln["text"].strip()):
                continue
            overlap = min(b.y1, box.y1) - max(b.y0, box.y0)
            near = box.x0 - 25 < b.x1 and b.x0 < box.x1 + 25
            short = len(ln["text"].strip()) <= 34 and not re.search(r"[?]$", ln["text"].strip()) and not re.match(r"(What|Which|If|In|The)", ln["text"].strip())
            below = 0 <= b.y0 - box.y1 < 10 and b.width < box.width + 20 and (short or ln["text"].strip().startswith("Note"))
            above = 0 <= box.y0 - b.y1 < 10 and b.width < box.width + 20 and short and not ln["text"].strip().endswith(".")
            if (near and overlap > 0.3 * min(b.height, box.height)) or (near and (below or above)):
                box = union(box, b)
    return box

def main():
    N = sys.argv[1]
    SRC, FIG_DIR = paths(N)
    render_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    doc = fitz.open(str(SRC / "1 - Test.pdf"))
    keys = json.loads((HERE / "data" / "keys.json").read_text())[N]["math"]
    mods = module_pages(doc)
    # hand-set figure boxes in PDF points, {"NN": {"m1-q06": [x0, y0, x1, y1]}}, for crops the detector gets wrong
    crops_path = HERE / "data" / "crops.json"
    overrides = json.loads(crops_path.read_text()).get(N, {}) if crops_path.exists() else {}
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    out = []
    for mod in (1, 2):
        pages = mods[("Math", mod)]
        qs, expected = [], 1
        for pi in pages:
            page = doc[pi]
            page_figs = []
            # question numbers sit inside the grey bar that heads each question (axis tick labels do not)
            bars = [fitz.Rect(d["rect"]) for d in page.get_drawings() if 8 < d["rect"].height < 16 and d["rect"].width > 120]
            for x0, x1 in ((0, COL_SPLIT), (COL_SPLIT, 612)):
                col_lines = [ln for ln in lines_of(page, x0, x1, []) if 95 <= ln["y"] <= 740
                             and not any((f + (-2, -2, 2, 2)).contains(ln["bbox"]) for f in page_figs)]
                starts, first_y = [], None
                for ln in col_lines:
                    t = clean(ln["text"])
                    in_bar = any((b + (-3, -3, 3, 3)).contains(fitz.Point((ln["bbox"].x0 + ln["bbox"].x1) / 2, (ln["bbox"].y0 + ln["bbox"].y1) / 2)) for b in bars)
                    if is_bar(t) and re.search(r"\d", t) and int(re.sub(r"\D", "", t)) == expected and ln["x"] - x0 < 70 and (in_bar or not bars):
                        starts.append((expected, ln["y"]))
                        first_y = first_y or ln["y"]
                        expected += 1
                if qs and starts != [] or (qs and not starts):
                    cont = [ln for ln in col_lines if (first_y is None or ln["y"] < first_y - 3) and not is_bar(clean(ln["text"]))
                            and not re.search(r"Unauthorized|CONTINUE|STOP|No Test Material", ln["text"])]
                    if cont and qs:
                        qs[-1]["text"] += "\n[continued]\n" + "\n".join(clean(l["text"]) for l in cont)
                for k, (n, y0) in enumerate(starts):
                    y1 = starts[k + 1][1] - 2 if k + 1 < len(starts) else 742
                    region = fitz.Rect(x0, y0 - 4, x1, y1)
                    own = [ln for ln in col_lines if y0 + 3 < ln["y"] < y1 and not is_bar(clean(ln["text"]))]
                    fig = math_figure(page, region, own)
                    manual = overrides.get(f"m{mod}-q{n:02d}")
                    manual_page = page
                    for k, v in overrides.items():   # "m1-q01@34": the figure is on another page
                        if k.startswith(f"m{mod}-q{n:02d}@"):
                            manual, manual_page = v, doc[int(k.split("@")[1]) - 1]
                    if manual:
                        fig = fitz.Rect(manual)
                    fig_file = None
                    if fig and manual:
                        page_figs.append(fig)
                        fig_file = f"math-m{mod}-q{n:02d}.png"
                        manual_page.get_pixmap(clip=fig, dpi=200).save(str(FIG_DIR / fig_file))
                    elif fig:
                        page_figs.append(fig)
                        fig_file = f"math-m{mod}-q{n:02d}.png"
                        # pad, but never into the question bar above or the next line of text below
                        prev = [l["bbox"].y1 for l in own if l["bbox"].y1 <= fig.y0 + 1 and not fig.contains(l["bbox"])]
                        top = max([fig.y0 - 5, y0 + 12] + [v + 1 for v in prev])
                        nxt = [l["bbox"].y0 for l in own if l["bbox"].y0 >= fig.y1 - 1 and not fig.contains(l["bbox"])]
                        bottom = min([fig.y1 + 5] + [v - 1 for v in nxt])
                        clip = fitz.Rect(fig.x0 - 5, top, fig.x1 + 5, max(bottom, fig.y1)) & page.rect
                        page.get_pixmap(clip=clip, dpi=200).save(str(FIG_DIR / fig_file))
                    qs.append({"module": mod, "n": n, "page": pi + 1, "col": 0 if x0 == 0 else 1,
                               "key": keys[mod - 1][n - 1], "figure": fig_file,
                               "figure_size": [round(fig.width), round(fig.height)] if fig else None,
                               "text": "\n".join(clean(l["text"]) for l in own if not (fig and fig.contains(l["bbox"])))})
        assert len(qs) == 27, f"M{mod}: {len(qs)} questions"
        # extra hand-set crops such as answer-choice graphs: "m1-q16-A" -> math-m1-q16-A.png on that question's page
        for key, box in overrides.items():
            m = re.fullmatch(rf"m{mod}-q(\d\d)-([A-D])(?:@(\d+))?", key)   # "@37": the choice is on another page
            if m:
                q = next(q for q in qs if q["n"] == int(m.group(1)))
                page_no = int(m.group(3)) if m.group(3) else q["page"]
                name = key.split("@")[0]
                doc[page_no - 1].get_pixmap(clip=fitz.Rect(box), dpi=200).save(str(FIG_DIR / f"math-{name}.png"))
        out += qs
        if render_dir:
            render_dir.mkdir(parents=True, exist_ok=True)
            for pi in sorted({q["page"] for q in qs}):
                doc[pi - 1].get_pixmap(dpi=110, clip=fitz.Rect(20, 95, 592, 745)).save(str(render_dir / f"t{N}-p{pi:02d}.png"))
    (HERE / "data" / f"math-{N}-draft.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"test {N}: {len(out)} math questions, {sum(bool(q['figure']) for q in out)} figures, "
          f"{sum(isinstance(q['key'], list) for q in out)} grid-ins, pages {sorted({q['page'] for q in out})}")

if __name__ == "__main__":
    main()
