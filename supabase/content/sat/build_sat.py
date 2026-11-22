"""Builds sat_practice_tests.sql: the official paper SAT Practice Tests 4-11 as published premium exams,
two per test (Reading and Writing, Math), each in two modules, with the official answer keys and score tables.

Inputs (data/):
  keys.json          answer keys + raw->scaled tables            (parse_keys.py)
  sat-NN-rw.json     Reading and Writing questions               (parse_rw.py)
  math-NN-draft.json math figures and keys                       (parse_math.py)
  sat-NN-math.txt    math stems/choices/explanations, hand-transcribed in this format:

      ## M1 Q7 | ALG | easy            (topic: ALG, ADV, PSDA, GEO; optional "| nofig" drops the auto figure)
      Stem text with $inline$ LaTeX.   (blank line = new paragraph; $$ ... $$ alone = display math;
                                        | a | b | rows = table, first row is the header)
      A) choice                        (no choices for grid-ins: their accepted answers come from keys.json)
      B) choice
      > Explanation, one or more lines starting with ">".

Usage: python build_sat.py [test numbers...]   (default: every test that has both files)"""
import json, re, sys
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
TOPICS = {
    "sat-math": ["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry"],
    "sat-english": ["Craft and Structure", "Information and Ideas", "Standard English Conventions", "Expression of Ideas"],
}
MATH_TOPIC = {"ALG": "Algebra", "ADV": "Advanced Math", "PSDA": "Problem-Solving and Data Analysis", "GEO": "Geometry and Trigonometry"}
RW_MINUTES, MATH_MINUTES = 78, 86   # paper format: 2 x 39 min (33 questions) and 2 x 43 min (27 questions)

# ---------------------------------------------------------------------------- content blocks

def para(text):
    return {"type": "paragraph", "text": text}

def money(text):
    """R&W prose has no math, so "$300" is a price: typeset it as math so two prices can't pair up as $...$."""
    return re.sub(r"\$(\d[\d,]*(?:\.\d+)?)", lambda m: "$\\$" + m.group(1).replace(",", "{,}") + "$", text)

def rw_blocks(content):
    for b in content["blocks"]:
        for k in ("text",):
            if k in b:
                b[k] = money(b[k])
        if "items" in b:
            b["items"] = [money(i) for i in b["items"]]
    return content

def text_to_blocks(text):
    """Python port of textToContent (src/lib/content.ts)."""
    blocks = []
    for raw in re.split(r"\n\s*\n", text.replace("\r\n", "\n")):
        chunk = raw.strip()
        if not chunk:
            continue
        lines = [l.strip() for l in chunk.split("\n")]
        img = re.fullmatch(r"!\[([^\]]*)\]\(([^)\s]+)\)", chunk)
        if img:
            blocks.append({"type": "image", "alt": img.group(1), "src": img.group(2)})
        elif re.fullmatch(r"\$\$[\s\S]+\$\$", chunk) and "$$" not in chunk[2:-2]:
            blocks.append({"type": "math", "latex": chunk[2:-2].strip()})
        elif all(l.startswith("|") for l in lines):
            rows = [[c.strip() for c in l.strip("|").split("|")] for l in lines]
            sep = len(rows) > 1 and all(re.fullmatch(r":?-{3,}:?", c) for c in rows[1])
            blocks.append({"type": "table", "header": rows[0], "rows": rows[2:]} if sep else {"type": "table", "header": rows[0], "rows": rows[1:]})
        elif all(re.match(r"[-*] ", l) for l in lines):
            blocks.append({"type": "list", "items": [l[2:] for l in lines]})
        else:
            blocks.append(para(" ".join(lines)))
    return {"blocks": blocks}

def image_block(test, fig, alt):
    width = min(560, round(fig["w"] * 1.5)) if fig.get("w") else None
    b = {"type": "image", "src": f"/sat/test-{test}/{fig['file']}", "alt": alt}
    if width:
        b["width"] = width
    return b

def rw_stimulus(test, q):
    blocks = [image_block(test, f, "Table or graph for this question") for f in q["figures"]]
    bullets = []
    for p in q["passage"]:
        if p.startswith("•"):
            bullets.append(p.lstrip("• ").strip())
            continue
        if bullets:
            blocks.append({"type": "list", "items": bullets})
            bullets = []
        m = re.match(r"^(Text [12])\s+(.*)$", p, re.S)
        if m:
            blocks += [{"type": "heading", "text": m.group(1)}, para(m.group(2))]
        else:
            blocks.append(para(p))
    if bullets:
        blocks.append({"type": "list", "items": bullets})
    return {"blocks": blocks}

def explanation_blocks(text):
    return {"blocks": [para(p.strip()) for p in text.split("\n\n") if p.strip()]}

# ---------------------------------------------------------------------------- math transcription

def parse_math_txt(path):
    items, cur = {}, None
    for line in path.read_text(encoding="utf-8").splitlines():
        h = re.match(r"^##\s*M([12])\s*Q(\d+)\s*\|\s*(ALG|ADV|PSDA|GEO)\s*\|\s*(easy|medium|hard)\s*(\|\s*nofig)?\s*$", line)
        if h:
            cur = {"module": int(h.group(1)), "n": int(h.group(2)), "topic": MATH_TOPIC[h.group(3)], "difficulty": h.group(4),
                   "nofig": bool(h.group(5)), "stem": [], "options": {}, "explanation": []}
            items[(cur["module"], cur["n"])] = cur
            continue
        if line.startswith("##"):
            raise ValueError(f"{path.name}: bad header {line!r}")
        if cur is None or line.startswith("# "):
            continue
        o = re.match(r"^([A-D])\)\s+(.*)$", line)
        if o:
            cur["options"][o.group(1)] = o.group(2).strip()
        elif line.startswith(">"):
            cur["explanation"].append(line[1:].strip())
        elif cur["options"]:
            if line.strip():   # continuation of the last choice (e.g. a second table row)
                last = sorted(cur["options"])[-1]
                cur["options"][last] += "\n" + line.strip()
        else:
            cur["stem"].append(line)
    return items

# ---------------------------------------------------------------------------- SQL

def lit(v):
    return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"

def txt(s):
    return "'" + s.replace("'", "''") + "'"

def arr(values):
    return "array[" + ", ".join(txt(v) for v in values) + "]::text[]"

def exam_sql(test, subject, kind, title, description, minutes, scale, modules, sort):
    """modules: [[question dict...] per module]; question dict has stem, explanation, topic, options|None, correct|accepted,
    stimulus (content|None), marker, difficulty, number."""
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")
    out = [f"  -- {title}",
           f"  if exists (select 1 from public.exams where slug = {txt(slug)}) then",
           f"    raise notice 'skipping {slug} (already imported)';",
           "  else",
           f"    select id into v_subject from public.subjects where code = {txt(subject)};",
           "    insert into public.exams (subject_id, slug, title, description, kind, access, status, duration_minutes, origin, sort_order, score_scale)",
           f"    values (v_subject, {txt(slug)}, {txt(title)}, {txt(description)}, 'full_mock', 'premium', 'draft', {minutes}, 'source', {sort}, {lit(scale)})",
           "    returning id into v_exam;"]
    pos = 0
    for mi, qs in enumerate(modules, 1):
        out.append(f"    insert into public.exam_sections (exam_id, position, title) values (v_exam, {mi}, 'Module {mi}') returning id into v_section;")
        for q in qs:
            pos += 1
            stim = "null"
            if q["stimulus"]:
                out.append(f"    insert into public.stimuli (subject_id, kind, content, origin) values (v_subject, '{q['stimulus_kind']}', {lit(q['stimulus'])}, 'source') returning id into v_stim;")
                stim = "v_stim"
            spr = q["options"] is None
            out.append("    insert into public.questions (subject_id, stimulus_id, stimulus_marker, stem, explanation, topic_id, difficulty, origin, status, "
                       "source_question_number, answer_format, accepted_answers)")
            out.append(f"    values (v_subject, {stim}, {'0' if q['marker'] else 'null'}, {lit(q['stem'])}, {lit(q['explanation'])}, "
                       f"(select id from public.topics where subject_id = v_subject and kind = 'topic' and name = {txt(q['topic'])}), "
                       f"'{q['difficulty']}', 'source', 'approved', {q['number']}, '{'spr' if spr else 'choice'}', "
                       f"{arr(q['accepted']) if spr else 'array[]::text[]'}) returning id into v_q;")
            if not spr:
                vals = ", ".join(f"(v_q, '{l}', {lit(c)}, {'true' if l == q['correct'] else 'false'})" for l, c in q["options"].items())
                out.append(f"    insert into public.question_options (question_id, label, content, is_correct) values {vals};")
            out.append(f"    insert into public.exam_questions (exam_id, section_id, question_id, position) values (v_exam, v_section, v_q, {pos});")
    out += ["    update public.exams set status = 'published' where id = v_exam;", "  end if;"]
    return out

def rw_modules(test, data):
    mods = [[], []]
    for q in data:
        mods[q["module"] - 1].append({
            "number": q["n"], "difficulty": "medium", "topic": q["skill"],
            "stimulus": rw_blocks(rw_stimulus(test, q)), "stimulus_kind": "table" if q["figures"] else "passage",
            "marker": any("[[1|" in p for p in q["passage"]),
            "stem": rw_blocks({"blocks": [para(q["prompt"])]}),
            "options": {k: rw_blocks({"blocks": [para(v)]}) for k, v in q["options"].items()},
            "correct": q["correct"], "explanation": rw_blocks(explanation_blocks(q["explanation"])),
        })
    for m in mods:
        for q in m:   # underline markers use number 0 (rendered without an EST-style [n] label)
            q["stimulus"] = json.loads(json.dumps(q["stimulus"], ensure_ascii=False).replace("[[1|", "[[0|"))
    return mods

def math_modules(test, draft, items):
    mods = [[], []]
    errors = []
    for d in draft:
        key = (d["module"], d["n"])
        it = items.get(key)
        if not it:
            errors.append(f"M{key[0]} Q{key[1]}: not transcribed")
            continue
        spr = isinstance(d["key"], list)
        if spr and it["options"]:
            errors.append(f"M{key[0]} Q{key[1]}: grid-in has choices")
        if not spr and sorted(it["options"]) != ["A", "B", "C", "D"]:
            errors.append(f"M{key[0]} Q{key[1]}: choices {sorted(it['options'])}")
        if not it["explanation"]:
            errors.append(f"M{key[0]} Q{key[1]}: no explanation")
        stem_text = "\n".join(it["stem"]).strip()
        if len(re.findall(r"(?<!\\)\$", stem_text)) % 2:   # an escaped \$ is a literal dollar sign
            errors.append(f"M{key[0]} Q{key[1]}: unbalanced $ in stem")
        stem = text_to_blocks(stem_text)
        if d["figure"] and not it["nofig"]:
            w, h = d["figure_size"]
            stem["blocks"].insert(0, image_block(test, {"file": d["figure"], "w": w}, f"Figure for question {d['n']}"))
        mods[d["module"] - 1].append({
            "number": d["n"], "difficulty": it["difficulty"], "topic": it["topic"],
            "stimulus": None, "stimulus_kind": None, "marker": False, "stem": stem,
            "options": None if spr else {k: text_to_blocks(v) for k, v in sorted(it["options"].items())},
            "correct": None if spr else d["key"], "accepted": d["key"] if spr else None,
            "explanation": text_to_blocks("\n\n".join(it["explanation"])),
        })
    return mods, errors

def main():
    keys = json.loads((DATA / "keys.json").read_text())
    tests = sys.argv[1:] or sorted(keys)
    sql = ["-- Official SAT Practice Tests (paper versions), generated by supabase/content/sat/build_sat.py. Do not edit by hand.",
           "-- Run after migration 20261121000001_student_produced_responses.sql. Safe to re-run: existing exams are skipped.",
           "",
           "insert into public.topics (subject_id, kind, name, sort_order)",
           "select s.id, 'topic', v.name, v.ord from (values"]
    rows = [f"  ({txt(code)}, {txt(name)}, {i})" for code, names in TOPICS.items() for i, name in enumerate(names, 1)]
    sql += [",\n".join(rows), ") as v(code, name, ord) join public.subjects s on s.code = v.code", "on conflict (subject_id, kind, name) do nothing;", ""]
    header = list(sql)
    built, problems, per_test = [], [], {}
    for t in tests:
        n = int(t)
        body = []
        rw_path, math_path = DATA / f"sat-{t}-rw.json", DATA / f"sat-{t}-math.txt"
        if rw_path.exists():
            rw = json.loads(rw_path.read_text(encoding="utf-8"))
            body += exam_sql(t, "sat-english", "rw", f"SAT Practice Test {n}: Reading and Writing",
                             f"Official SAT Practice Test {n} (College Board), Reading and Writing: 66 questions in two modules, timed as the paper test (39 minutes per module).",
                             RW_MINUTES, keys[t]["scale"]["rw"], rw_modules(t, rw), 200 + n * 2)
        if math_path.exists():
            draft = json.loads((DATA / f"math-{t}-draft.json").read_text(encoding="utf-8"))
            mods, errs = math_modules(t, draft, parse_math_txt(math_path))
            if errs:
                problems += [f"test {t} math: {e}" for e in errs]
            else:
                body += exam_sql(t, "sat-math", "math", f"SAT Practice Test {n}: Math",
                                 f"Official SAT Practice Test {n} (College Board), Math: 54 questions in two modules, including student-produced responses. Calculator allowed; 43 minutes per module.",
                                 MATH_MINUTES, keys[t]["scale"]["math"], mods, 201 + n * 2)
        if body:
            # a named dollar quote: question text contains "$$" (display math)
            block = ["do $sat$", "declare", "  v_subject uuid; v_exam uuid; v_section uuid; v_stim uuid; v_q uuid;", "begin", *body, "end $sat$;", ""]
            sql += block
            per_test[t] = block
            built.append(t)
    text = "\n".join(sql)
    (HERE / "sat_practice_tests.sql").write_text(text, encoding="utf-8")
    # One self-contained file per test, small enough to paste into the Supabase SQL editor.
    split = HERE / "sql"
    split.mkdir(exist_ok=True)
    for t, block in per_test.items():
        (split / f"sat_test_{t}.sql").write_text("\n".join(header + block), encoding="utf-8")
    # parse_math.py crops every drawing it finds; drop the crops no question uses (equations drawn as vectors, etc.)
    public = HERE.parent.parent.parent / "public"
    referenced = set(re.findall(r"/sat/test-\d\d/[\w.-]+\.png", text))
    for png in public.glob("sat/test-*/math-*.png"):
        if "/" + png.relative_to(public).as_posix() not in referenced:
            png.unlink()
    print("built:", ", ".join(built) or "nothing")
    for p in problems:
        print("  PROBLEM", p)

if __name__ == "__main__":
    main()
