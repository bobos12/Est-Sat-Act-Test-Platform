"""Extracts Reading and Writing questions (passage, prompt, choices, figures) and the official explanations
from a paper SAT practice test into data/sat-NN-rw.json.  Usage: python parse_rw.py <test number> [<source dir>]

Text is read from the visible glyphs (the PDFs also carry a hidden accessibility layer, which is ignored).
Underlined words are found from the rules drawn under them and become [[1|...]] passage markers.
Tables and graphs are cropped to PNGs in public/sat/test-NN/."""
import json, re, sys
from pathlib import Path
import fitz

HERE = Path(__file__).parent
SOURCE_ROOT = Path(r"C:\Users\aahme\OneDrive\Desktop\Digital SAT Practice Tests\1 - SAT")

def paths(n, root=None):
    """(test folder, figure output folder) for test number n."""
    return (Path(root) if root else SOURCE_ROOT) / f"SAT Test {n}", HERE.parent.parent.parent / "public" / "sat" / f"test-{n}"

COL_SPLIT = 306
FLAGS = fitz.TEXTFLAGS_TEXT | fitz.TEXT_IGNORE_ACTUALTEXT

def module_pages(doc):
    """{(section, module): [page indexes]} from the 'Module n / Reading and Writing|Math / N QUESTIONS' headers."""
    starts = []
    for i, p in enumerate(doc):
        m = re.search(r"(Reading and Writing|Math)\s*\n\s*(\d+)\s*QUESTIONS", p.get_text(flags=FLAGS))
        if m:
            mod = len([s for s in starts if s[1] == m.group(1)]) + 1
            starts.append((i, m.group(1), mod))
    out = {}
    for k, (i, sec, mod) in enumerate(starts):
        end = starts[k + 1][0] if k + 1 < len(starts) else len(doc)
        out[(sec, mod)] = list(range(i, end))
    return out

def clean(s: str) -> str:
    s = s.replace("\t", " ").replace("\u00a0", " ")
    s = re.sub(r"[.…]{5,}", " ", s)  # dotted separators
    s = re.sub(r"[ ]{2,}", " ", s)
    return s.strip()

def underline_segments(page):
    segs = []
    for d in page.get_drawings():
        for it in d["items"]:
            if it[0] == "l":
                p1, p2 = it[1], it[2]
                if abs(p1.y - p2.y) < 0.6 and abs(p2.x - p1.x) > 3:
                    segs.append((min(p1.x, p2.x), max(p1.x, p2.x), (p1.y + p2.y) / 2))
            elif it[0] == "re":
                r = it[1]
                if r.height < 1.6 and r.width > 3:
                    segs.append((r.x0, r.x1, (r.y0 + r.y1) / 2))
    # Table rules repeat with the same left and right ends; underlines under ragged text lines do not.
    return [s for s in segs if not any(abs(s[0] - o[0]) < 1 and abs(s[1] - o[1]) < 1 and 5 < abs(s[2] - o[2]) < 250 for o in segs)]

def union(a, b):
    """Rect union that also counts zero-height/width rules (fitz skips 'empty' rects)."""
    return fitz.Rect(min(a.x0, b.x0), min(a.y0, b.y0), max(a.x1, b.x1), max(a.y1, b.y1))

def figure_box(page, region, lines):
    """Union of drawings, images and non-passage-font text inside a question's region (None when there is no figure)."""
    parts = []
    for d in page.get_drawings():
        r = fitz.Rect(d["rect"])
        # anchored in this column; wide tables may run past the column edge
        if not (region.x0 <= r.x0 < region.x1 and region.y0 <= r.y0 and r.y1 <= region.y1 and r.x1 <= 600):
            continue
        if r.y0 < region.y0 + 14 and r.height < 15:      # question-number bar
            continue
        if r.width < 3 and r.height > 150:              # column separator
            continue
        if r.height < 1.6 and any(w["under"] for ln in lines for w in ln["words"] if abs(w["bbox"].y1 - r.y0) < 4 and w["bbox"].x0 < r.x1 and r.x0 < w["bbox"].x1):
            continue                                       # underline under passage words
        if r.width > 150 and r.height < 3:
            parts.append(("rule", r))                      # separator unless it borders the figure
            continue
        parts.append(("draw", r))
    for img in page.get_image_info():
        r = fitz.Rect(img["bbox"])
        if region.intersects(r) and r.width > 30 and r.height > 20 and r.y0 > region.y0 + 10:
            parts.append(("img", r & region))
    for ln in lines:
        if not ln["minion"] and re.search(r"[A-Za-z0-9]", ln["text"]) and ln["bbox"].width < region.width:
            parts.append(("text", ln["bbox"]))
    core = [r for k, r in parts if k != "rule"]
    rules = [r for k, r in parts if k == "rule"]
    table = [r for r in rules if sum(abs(r.x0 - o.x0) < 2 and abs(r.x1 - o.x1) < 2 for o in rules) >= 3]
    core += table
    if not core:
        return None
    # Cluster nearby parts; the figure is the largest cluster (stray blanks/rules elsewhere are dropped).
    clusters = [fitz.Rect(r.x0, r.y0, max(r.x1, r.x0 + 0.1), max(r.y1, r.y0 + 0.1)) for r in core]
    merged = True
    while merged:
        merged = False
        for i in range(len(clusters)):
            for j in range(i + 1, len(clusters)):
                a, b = clusters[i], clusters[j]
                if a.x0 - 14 < b.x1 and b.x0 - 14 < a.x1 and a.y0 - 28 < b.y1 and b.y0 - 28 < a.y1:
                    clusters[i] = union(a, b)
                    del clusters[j]
                    merged = True
                    break
            if merged:
                break
    box = max(clusters, key=lambda r: r.width * r.height)
    if box.width < 60 or box.height < 30:   # a blank line or stray rule, not a figure
        return None
    for _ in range(3):  # axis labels beside the plot, and lines the box only partly covers (footnotes)
        for ln in lines:
            b = ln["bbox"]
            overlap = min(b.y1, box.y1) - max(b.y0, box.y0)
            beside = box.x0 - 30 < b.x1 and b.x0 < box.x1 + 30
            if beside and overlap > 0.4 * min(b.height, box.height) and not box.contains(b):
                box = union(box, b)
            elif 0 <= b.y0 - box.y1 < 8 and re.match(r"(Note|Rows|Source|\*)", ln["text"]):
                box = union(box, b)   # table footnote
    for _ in range(2):  # table rules touching the figure, and passage-font text inside it (cells, titles)
        for k, r in parts:
            if k == "rule" and r.x0 < box.x1 + 4 and box.x0 - 4 < r.x1 and box.y0 - 20 <= r.y0 <= box.y1 + 20:
                box = union(box, r)
        for ln in lines:
            if (box + (-3, -3, 3, 3)).contains(ln["bbox"]):
                box = union(box, ln["bbox"])
        left = min((l["bbox"].x0 for l in lines), default=region.x0)
        for ln in sorted(lines, key=lambda l: -l["y"]):   # bold or centered title lines just above a table or graph
            # In these papers a table or graph always precedes its passage, so text above it is its title.
            if ln["bbox"].y1 <= box.y0 + 2 and ln["bbox"].y0 > region.y0 + 12:
                box = union(box, ln["bbox"])
    if box.width < 40 or box.height < 20:
        return None
    if any(re.search(r"\bSTOP\b|If you finish|Do not turn", ln["text"]) for ln in lines if box.intersects(ln["bbox"])):
        return None   # the end-of-module box
    return box

def lines_of(page, x0, x1, segs):
    """Visible text lines in a column, as words with font and underline information."""
    lines = []
    for b in page.get_text("rawdict", flags=FLAGS)["blocks"]:
        for l in b.get("lines", []):
            if not (x0 <= l["bbox"][0] < x1):
                continue
            words, cur = [], None
            for sp in l["spans"]:
                for ch in sp["chars"]:
                    c = ch["c"]
                    if c.isspace():
                        cur = None
                        continue
                    if cur is None:
                        cur = {"text": "", "bbox": fitz.Rect(ch["bbox"]), "font": sp["font"]}
                        words.append(cur)
                    cur["text"] += c
                    cur["bbox"] |= fitz.Rect(ch["bbox"])
            words = [w for w in words if w["text"]]
            if not words:
                continue
            for w in words:
                bb = w["bbox"]
                w["under"] = any(y > bb.y1 - 3.5 and y < bb.y1 + 3 and min(bb.x1, s1) - max(bb.x0, s0) > 0.6 * bb.width
                                 for s0, s1, y in segs) and not re.fullmatch(r"_+", w["text"])
            lines.append({"y": l["bbox"][1], "y1": l["bbox"][3], "x": l["bbox"][0], "words": words,
                          "text": " ".join(w["text"] for w in words),
                          "minion": all("MinionPro" in w["font"] for w in words),
                          "bbox": fitz.Rect(l["bbox"])})
    lines.sort(key=lambda l: (round(l["y"]), l["x"]))
    return lines

def marked(ln):
    """Line text with underlined runs wrapped as [[1|...]]."""
    out, run = [], []
    for w in ln["words"]:
        if w["under"]:
            run.append(w["text"])
            continue
        if run:
            out.append("[[1|" + " ".join(run) + "]]")
            run = []
        out.append(w["text"])
    if run:
        out.append("[[1|" + " ".join(run) + "]]")
    return clean(" ".join(out))

def is_bar(t):
    """A question-number bar: dashes/dots/underscores with at most a 1-2 digit number."""
    return bool(re.fullmatch(r"[-.,_~\s]*(\d{1,2})?[-.,_~\s]*", t)) and len(re.sub(r"\D", "", t)) <= 2

def parse_module(doc, pages, count, tag):
    qs, expected = [], 1
    for pi in pages:
        page = doc[pi]
        segs = underline_segments(page)
        page_figs = []
        for x0, x1 in ((0, COL_SPLIT), (COL_SPLIT, 612)):
            col_lines = [ln for ln in lines_of(page, x0, x1, segs) if 95 <= ln["y"] <= 740
                         and not any((f + (-2, -2, 2, 2)).contains(ln["bbox"]) for f in page_figs)]
            starts, first_start_y = [], None
            for ln in col_lines:
                t = clean(ln["text"])
                # the number sits alone or inside the dashed question bar ("- 23 - - -", ". 1 ,")
                if is_bar(t) and re.search(r"\d", t) and int(re.sub(r"\D", "", t)) == expected and ln["x"] - x0 < 70:
                    starts.append((expected, ln["y"]))
                    first_start_y = first_start_y or ln["y"]
                    expected += 1
            # A question can run on into the next column or page: lines above the first number belong to it.
            if qs and not (pi == pages[0] and x0 == 0):
                cont = [ln for ln in col_lines if (first_start_y is None or ln["y"] < first_start_y - 3) and not is_bar(clean(ln["text"]))]
                if cont:
                    cont[0] = {**cont[0], "brk": True}
                    qs[-1]["lines"].extend(cont)
            for k, (n, y0) in enumerate(starts):
                y1 = starts[k + 1][1] - 2 if k + 1 < len(starts) else 742
                region = fitz.Rect(x0, y0 - 4, x1, y1)
                own = [ln for ln in col_lines if y0 + 3 < ln["y"] < y1 and not is_bar(clean(ln["text"]))]
                fig = figure_box(page, region, own)
                if fig:
                    page_figs.append(fig)
                text_lines = [ln for ln in own if not (fig and (fig + (-2, -2, 2, 2)).contains(ln["bbox"]))]
                qs.append({"n": n, "page": pi, "col": (x0, x1), "y0": y0, "lines": text_lines, "figs": [fig] if fig else []})
    assert len(qs) == count, f"{tag}: found {len(qs)} questions, expected {count}"
    return qs

def structure(q):
    """Split a question's lines into passage paragraphs, prompt and A-D choices."""
    opts, body, cur_opt = {}, [], None
    for ln in q["lines"]:
        t = marked(ln)
        m = re.match(r"^([A-D])\)\s*(.*)$", t)
        if m and ((cur_opt is None and m.group(1) == "A") or (cur_opt and ord(m.group(1)) == ord(cur_opt) + 1)):
            cur_opt = m.group(1)
            opts[cur_opt] = [m.group(2)]
        elif cur_opt:
            opts[cur_opt].append(t)
        else:
            body.append((ln, t))
    steps = sorted(b["y"] - a["y"] for (a, _), (b, _) in zip(body, body[1:]) if 5 < b["y"] - a["y"] < 40)
    pitch = steps[len(steps) // 4] if steps else 12.5   # normal line spacing (lower quartile)
    paras, prev = [], None
    for ln, t in body:
        if prev is None or ln.get("brk") or ln["y"] - prev["y"] > pitch + 4 or t.startswith("•"):
            paras.append([(t, ln["x"])])
        else:
            paras[-1].append((t, ln["x"]))
        prev = ln
    texts = []
    for i, p in enumerate(paras):
        # Verse keeps its line breaks as " / " (wrapped continuation lines are indented further).
        if i > 0 and len(p) >= 3 and re.search(r"text is (?:adapted )?from .*\b(poem|poetry|verse|sonnet|song)\b", texts[-1], re.I):
            base = min(x for _, x in p)
            out = ""
            for t, x in p:
                out = t if not out else out + (" " if x > base + 6 else " / ") + t
            texts.append(out)
        else:
            texts.append(join_lines([t for t, _ in p]))
    # If the prompt ran into the passage, split at the start of the standard question sentence.
    if texts:
        starters = r"(Which choice|Which finding|Which quotation|Which statement|Based on the texts?|According to the|What does the text|As used in the text|The student wants|What is the main|How would the author|Which of the following)"
        cut = None
        for m in re.finditer(r"\s+" + starters, texts[-1]):
            before = texts[-1][:m.start()]
            if m.start() > 40 and (before[-1:] in ".?!”’)]_" or re.search(r"\d{4} by [^.]+$", before)):
                cut = m.start()
        if cut:
            texts = texts[:-1] + [texts[-1][:cut].strip(), texts[-1][cut:].strip()]
    prompt = texts[-1] if texts else ""
    return texts[:-1], prompt, {k: join_lines(v) for k, v in opts.items()}

def join_lines(parts):
    s = ""
    for p in parts:
        if not p:
            continue
        if s.endswith(("—", "-")):  # line breaks in these papers only fall after real compound hyphens
            s += p
        else:
            s += (" " if s else "") + p
    s = re.sub(r"\]\]\s*\[\[1\|", " ", s)        # an underline continuing onto the next line
    return s.strip()

def fix_text(s):
    # page furniture that runs into the last choice of a module
    s = re.sub(r"\s*(STOP\b.*|No Test Material On This Page.*)$", "", s, flags=re.S)
    s = re.sub(r"_{3,}", "______", s)
    s = re.sub(r"\[\[1\|([^\]]*?)([.,;:]?)\]\]", lambda m: f"[[1|{m.group(1)}]]{m.group(2)}", s)
    s = re.sub(r"\s+([,.;:?!])", r"\1", s)
    s = re.sub(r"[ ]{2,}", " ", s)
    return s.strip()

def explanations(path):
    """Explanations keyed by (section, module, question). Page headers name the section but must not cut an
    explanation that continues onto the next page."""
    doc = fitz.open(str(path))
    out, section, key, buf = {}, None, None, []

    def flush():
        if key and buf:
            body = "\n".join(buf)
            if key not in out or len(body) > len(out[key]):
                out[key] = body

    for line in "\n".join(p.get_text(flags=FLAGS) for p in doc).splitlines():
        h = re.search(r"(READING AND WRITING|MATH): MODULE (\d)", line)
        if h:
            new = (h.group(1), int(h.group(2)))
            if new != section:
                flush()
                section, key, buf = new, None, []
            continue
        if "ANSWER EXPLANATIONS" in line or re.fullmatch(r"\s*(\d+|n)\s*", line):   # page numbers, "n" = decorative glyph
            continue
        q = re.fullmatch(r"\s*QUESTION (\d+)\s*", line)
        if q and section:
            flush()
            key, buf = (section[0], section[1], int(q.group(1))), []
            continue
        if key:
            buf.append(line)
    flush()
    return out

def explanation_text(raw):
    raw = raw.replace("\u00a0", " ")
    paras = re.split(r"\n(?=Choice [A-D] is (?:the best answer|incorrect))", raw)
    clean_paras = [re.sub(r"\s*\n\s*", " ", p).strip() for p in paras if p.strip()]
    return "\n\n".join(re.sub(r"[ ]{2,}", " ", p) for p in clean_paras)

SKILL_RULES = [
    ("Expression of Ideas", r"while researching a topic|following notes|most logical transition|logical transition"),
    ("Standard English Conventions", r"conforms to the conventions of Standard English"),
    ("Craft and Structure", r"logical and precise word or phrase|most nearly mean|main purpose|overall structure|function of the|Text 2.*Text 1|Text 1.*Text 2"),
    ("Information and Ideas", r"."),
]

def skill_of(prompt):
    for name, pat in SKILL_RULES:
        if re.search(pat, prompt, re.I | re.S):
            return name
    return None

def main():
    N = sys.argv[1]
    SRC, FIG_DIR = paths(N, sys.argv[2] if len(sys.argv) > 2 else None)
    doc = fitz.open(str(SRC / "1 - Test.pdf"))
    mods = module_pages(doc)
    expl = explanations(SRC / "2 - Answer Explanations.pdf")
    keys = json.loads((HERE / "data" / "keys.json").read_text())[N]
    FIG_DIR.mkdir(parents=True, exist_ok=True)
    out, warnings = [], []
    for mod in (1, 2):
        qs = parse_module(doc, mods[("Reading and Writing", mod)], 33, f"RW M{mod}")
        for q in qs:
            passage, prompt, opts = structure(q)
            passage = [fix_text(p) for p in passage]
            passage = [re.sub(r"\bb l a n k\b", "______", p) for p in passage]   # test 11 prints blanks as spaced letters
            if re.search(r"complet", prompt) and passage and not any("______" in p for p in passage) and not re.search(r"[.!?”\"]$", passage[-1]):
                passage[-1] += " ______"   # the blank closes the passage
            split = []
            for p in passage:   # "©2005 by Joan Didion" on its own line
                m = re.search(r"\s+(©\s?\d{4}\s+by\s+[^.]+)$", p)
                split += [p[:m.start()].strip(), m.group(1)] if m else [p]
            passage = split
            prompt = fix_text(prompt)
            opts = {k: fix_text(v) for k, v in opts.items()}
            if "underlined" not in prompt:   # only keep markers the question refers to
                passage = [re.sub(r"\[\[1\|(.*?)\]\]", r"\1", p) for p in passage]
                opts = {k: re.sub(r"\[\[1\|(.*?)\]\]", r"\1", v) for k, v in opts.items()}
            prompt = re.sub(r"\[\[1\|(.*?)\]\]", r"\1", prompt)
            figs = []
            for j, f in enumerate(q["figs"]):
                name = f"rw-m{mod}-q{q['n']:02d}{'' if j == 0 else '-' + str(j + 1)}.png"
                clip = (f + (-6, -6, 6, 6)) & doc[q["page"]].rect
                doc[q["page"]].get_pixmap(clip=clip, dpi=200).save(str(FIG_DIR / name))
                figs.append({"file": name, "w": round(f.width), "h": round(f.height)})
            item = {
                "module": mod, "n": q["n"], "page": q["page"] + 1,
                "passage": passage, "prompt": prompt, "options": opts,
                "figures": figs, "correct": keys["rw"][mod - 1][q["n"] - 1],
                "skill": skill_of(prompt),
                "explanation": explanation_text(expl.get(("READING AND WRITING", mod, q["n"]), "")),
            }
            if sorted(opts) != ["A", "B", "C", "D"] or not all(opts.values()):
                warnings.append(f"M{mod} Q{q['n']}: options {sorted(opts)}")
            if not passage and not figs:
                warnings.append(f"M{mod} Q{q['n']}: no passage")
            if "underlined" in prompt and not any("[[1|" in p for p in passage):
                warnings.append(f"M{mod} Q{q['n']}: no underline found")
            if not item["explanation"].startswith(f"Choice {item['correct']} is the best answer"):
                warnings.append(f"M{mod} Q{q['n']}: explanation/key mismatch ({item['explanation'][:40]!r} vs {item['correct']})")
            if re.search(r"[\x00-\x08\x0b-\x1f]", json.dumps([passage, prompt, opts], ensure_ascii=False).replace("\\n", "")):
                warnings.append(f"M{mod} Q{q['n']}: control characters")
            out.append(item)
    (HERE / "data" / f"sat-{N}-rw.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"test {N}: {len(out)} RW questions, {sum(len(q['figures']) for q in out)} figures, {sum(any('[[1|' in p for p in q['passage']) for q in out)} underlined")
    for w in warnings:
        print("  WARN", w)

if __name__ == "__main__":
    main()
