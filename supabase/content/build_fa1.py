"""Builds SQL for 'Foundational Algebra — Practice 1' (original questions, draft state)."""
import json
from fractions import Fraction as F

def p(text): return {"blocks": [{"type": "paragraph", "text": text}]}

Q = []
def q(stem, opts, correct, expl, level="application", diff="easy", stim=False):
    assert correct in "ABCD" and len(opts) == 4 and len(set(opts)) == 4
    Q.append(dict(stem=stem, opts=opts, correct=correct, expl=expl, level=level, diff=diff, stim=stim))

# 1  3(x-4) = 2x+5 -> x = 17
x = 17; assert 3*(x-4) == 2*x+5
q("If $3(x - 4) = 2x + 5$, what is the value of $x$?", ["$1$", "$9$", "$17$", "$21$"], "C",
  "Expand: $3x - 12 = 2x + 5$. Subtract $2x$ from both sides and add $12$: $x = 17$.")
# 2  slope through (0,3),(2,11) = 4
assert F(11-3, 2-0) == 4
q("A line passes through the points $(0, 3)$ and $(2, 11)$. What is the slope of the line?", ["$3$", "$4$", "$7$", "$8$"], "B",
  "Slope $= \\dfrac{11 - 3}{2 - 0} = \\dfrac{8}{2} = 4$.", level="knowledge")
# 3  5(2x-3)-4(x-1) = 6x-11
for t in range(-3, 4): assert 5*(2*t-3)-4*(t-1) == 6*t-11
q("Which of the following is equivalent to $5(2x - 3) - 4(x - 1)$?", ["$6x - 11$", "$6x - 19$", "$14x - 11$", "$6x + 11$"], "A",
  "Distribute: $10x - 15 - 4x + 4$. Combine like terms: $6x - 11$. Watch the sign: $-4 \\times -1 = +4$.", level="knowledge")
# 4  C = 25m + 40
q("A gym charges a one-time joining fee of $\\$40$ plus $\\$25$ per month. Which equation gives the total cost $C$, in dollars, of a membership for $m$ months?",
  ["$C = 40m + 25$", "$C = 25m + 40$", "$C = 65m$", "$C = 25(m + 40)$"], "B",
  "The monthly charge grows with $m$, so it multiplies $m$: $25m$. The joining fee is paid once, so it is added: $C = 25m + 40$.")
# 5  x+y=10, x-y=4 -> x=7
assert (10+4)//2 == 7
q("If $x + y = 10$ and $x - y = 4$, what is the value of $x$?", ["$3$", "$6$", "$14$", "$7$"], "D",
  "Add the two equations: $2x = 14$, so $x = 7$. (Then $y = 3$.)")
# 6  x-intercept of 3x-4y=24 -> 8
assert F(24, 3) == 8
q("What is the $x$-intercept of the line $3x - 4y = 24$?", ["$8$", "$-8$", "$6$", "$-6$"], "A",
  "At the $x$-intercept, $y = 0$: $3x = 24$, so $x = 8$.", level="knowledge")
# 7  2/3 x + 5 = 11 -> 9
assert F(2, 3)*9 + 5 == 11
q("If $\\dfrac{2}{3}x + 5 = 11$, what is the value of $x$?", ["$9$", "$4$", "$6$", "$24$"], "A",
  "Subtract $5$: $\\dfrac{2}{3}x = 6$. Multiply by $\\dfrac{3}{2}$: $x = 9$.")
# 8  4-2x>10 -> x<-3
for t in [-10, -4, -3.5]: assert 4-2*t > 10
for t in [-3, 0, 5]: assert not (4-2*t > 10)
q("Which of the following describes all values of $x$ that satisfy $4 - 2x > 10$?", ["$x > -3$", "$x < -3$", "$x > 3$", "$x < 3$"], "B",
  "Subtract $4$: $-2x > 6$. Dividing by a negative number reverses the inequality: $x < -3$.", diff="medium")
# 9-10 taxi table: fare = 7 + 3d
for d, f in [(2, 13), (5, 22), (8, 31)]: assert 7 + 3*d == f
q("What is the charge per kilometre?", ["$\\$2$", "$\\$3$", "$\\$4.50$", "$\\$6.50$"], "B",
  "Between 2 km and 5 km the fare rises by $\\$22 - \\$13 = \\$9$ over $3$ km, so the rate is $\\$9 \\div 3 = \\$3$ per km.", stim=True)
assert 7 + 3*12 == 43
q("What is the fare for a 12-kilometre trip?", ["$\\$36$", "$\\$40$", "$\\$43$", "$\\$48$"], "C",
  "The fixed fee is $\\$13 - 2 \\times \\$3 = \\$7$, so the fare is $F = 7 + 3d$. For $d = 12$: $F = 7 + 36 = \\$43$.", diff="medium", stim=True)

stimulus = {"blocks": [
  {"type": "paragraph", "text": "A taxi company charges a fixed fee plus a constant rate for each kilometre travelled. The table shows the total fare for three trips."},
  {"type": "table", "header": ["Distance (km)", "Total fare ($)"], "rows": [["2", "13"], ["5", "22"], ["8", "31"]]},
]}

def lit(v): return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"

out = ["do $$", "declare", "  v_subject uuid; v_topic uuid; v_exam uuid; v_section uuid; v_stim uuid; v_q uuid;", "begin",
       "  select id into v_subject from public.subjects where code = 'est1-math';",
       "  select id into v_topic from public.topics where subject_id = v_subject and name = 'Foundational Algebra';",
       "  if exists (select 1 from public.exams where slug = 'foundational-algebra-practice-1') then",
       "    raise exception 'Exam already exists';", "  end if;",
       "  insert into public.exams (subject_id, slug, title, description, kind, focus_topic_id, difficulty, access, status, duration_minutes, origin)",
       "  values (v_subject, 'foundational-algebra-practice-1', 'Foundational Algebra — Practice 1',",
       "    'Ten questions on linear equations, expressions, inequalities and linear models — a quick check of the algebra every EST I Math paper starts from.',",
       "    'practice', v_topic, 'easy', 'free', 'draft', 15, 'ai_generated') returning id into v_exam;",
       "  insert into public.exam_sections (exam_id, position, title) values (v_exam, 1, 'Section 1') returning id into v_section;",
       f"  insert into public.stimuli (subject_id, kind, content, origin) values (v_subject, 'table', {lit(stimulus)}, 'ai_generated') returning id into v_stim;"]
for i, item in enumerate(Q, 1):
    out.append(f"  insert into public.questions (subject_id, stimulus_id, stem, explanation, topic_id, cognitive_level, difficulty, origin, status)")
    out.append(f"  values (v_subject, {'v_stim' if item['stim'] else 'null'}, {lit(p(item['stem']))}, {lit(p(item['expl']))}, v_topic, '{item['level']}', '{item['diff']}', 'ai_generated', 'draft') returning id into v_q;")
    vals = ", ".join(f"(v_q, '{l}', {lit(p(o))}, {'true' if l == item['correct'] else 'false'})" for l, o in zip("ABCD", item['opts']))
    out.append(f"  insert into public.question_options (question_id, label, content, is_correct) values {vals};")
    out.append(f"  insert into public.exam_questions (exam_id, section_id, question_id, position) values (v_exam, v_section, v_q, {i});")
out += ["end $$;"]
open("fa1_practice.sql", "w").write("\n".join(out) + "\n")
print("questions:", len(Q), "answers:", "".join(x["correct"] for x in Q))
