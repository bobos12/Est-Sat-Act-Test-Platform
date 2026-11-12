import { Logo } from "@/components/brand/logo";
import Image from "next/image";
import Link from "next/link";
import { GraphPaper } from "./GraphPaper";
import { TryQuestion } from "./TryQuestion";
import { ExamShelf } from "./ExamShelf";
import { RevealOnScroll } from "./Reveal";
import { StickyNote } from "./StickyNote";
import { Arrow } from "./Icons";
import { FREE_START_HREF, TRACKS, TRACK_OF, type ShelfExam } from "@/lib/exam-catalog";
import { formatPrice, type Plan } from "@/lib/catalog";
import { CONTACT, TESTIMONIALS, periodLabel, planPitch } from "@/lib/marketing";

const TOPICS = ["Foundational Algebra", "Words in Context", "SAT Advanced Math", "Data Analysis and Probability", "ACT English",
  "Expression of Ideas", "Geometry and Trigonometry", "ACT Science", "Standard English Conventions", "SAT Reading and Writing"];

const css = (vars: Record<string, string>) => vars as React.CSSProperties;

/**
 * 16hundred homepage. Server component; pass the exams and plans to show.
 * Wrapped in `.sh` so the brand styles never leak into the exam engine / admin.
 */
export function HomePage({ exams, plans }: { exams: ShelfExam[]; plans: Plan[] }) {
  const live = exams.filter((e) => e.access !== "soon");
  const questionCount = live.reduce((n, e) => n + e.questions, 0);
  const roundedQuestions = questionCount >= 100 ? `${Math.floor(questionCount / 100) * 100}+` : String(questionCount);

  return (
    <div className="sh">
      <RevealOnScroll />
<header className="nav" id="nav">
  <div className="wrap">
    <Logo href="/" />
    <nav className="nav-links" aria-label="Main">
      <Link href="/exams?track=sat">SAT</Link>
      <Link href="/exams?track=act">ACT</Link>
      <Link href="/exams?track=est">EST</Link>
      <a href="#exams">Exams</a>
      <a href="#pricing">Pricing</a>
      <a href="#contact">Contact</a>
    </nav>
    <div className="nav-right">
      <Link href="/sign-in" className="login">Log in</Link>
      <a href={FREE_START_HREF} className="btn btn-blue btn-sm">Free exams</a>
      <details className="mnav">
        <summary aria-label="Open menu"><span /><span /><span /></summary>
        <nav className="mnav-panel" aria-label="Mobile">
          <Link href="/exams?track=est">EST</Link>
          <Link href="/exams?track=sat">SAT</Link>
          <Link href="/exams?track=act">ACT</Link>
          <a href="#exams">Exam library</a>
          <a href="#pricing">Pricing</a>
          <a href="#contact">Contact</a>
          <Link href="/sign-in" className="mnav-login">Log in</Link>
        </nav>
      </details>
    </div>
  </div>
</header>

<section className="hero">
  <GraphPaper />
  <div className="wrap">
    <div>
      <span className="pill"><b>EST · SAT · ACT</b>Take every EST exam online</span>
      <h1 className="h">
        <span className="ln"><span>Train smarter. Score higher.</span></span>
        <span className="ln"><span>Reach <span className="goal">1600</span>.</span></span>
      </h1>
      <p className="lede">Your complete SAT, ACT and EST practice platform. Real timed tests, an explanation for every answer, and a score by topic, so you always know what to study next. <strong>Your first exam is free.</strong></p>
      <div className="ctas">
        <Link href="/sign-up" className="btn btn-blue">Start learning <Arrow s={16} /></Link>
        <a href="#pricing" className="btn btn-line">View plans</a>
        <a href={FREE_START_HREF} className="link">Try a free exam →</a>
      </div>
      <dl className="stats">
        <div><dt>Practice questions</dt><dd>{roundedQuestions}</dd></div>
        <div><dt>Timed tests</dt><dd>{live.length}</dd></div>
        <div><dt>Peak score</dt><dd>1,600</dd></div>
      </dl>
    </div>

    <div className="hero-card">
      <TryQuestion />
      <StickyNote color="yellow" rotate={6} className="note-card" doodle="arrow">Try it, it&apos;s <b>free</b>!</StickyNote>
    </div>
  </div>
</section>

<div className="ticker" aria-hidden="true"><div className="ticker-track">{[...TOPICS, ...TOPICS].map((t, i) => <span key={i}>{t}</span>)}</div></div>

{/* TRACKS */}
<section className="sec" id="tracks">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">Courses</div>
        <h2 className="h">One platform, <span className="serif">every exam</span> you need.</h2>
      </div>
      <p>EST is live now. SAT and ACT open as soon as their first full mocks are published.</p>
    </div>
    <p className="swipe-hint" aria-hidden="true">Swipe to see more →</p>
    <div className="tracks">
      {TRACKS.map((t) => {
        const count = live.filter((e) => TRACK_OF[e.subject] === t.key).length;
        return (
          <article key={t.key} className={`track rv${count ? " is-live" : ""}`}>
            <div className="track-top">
              <span className="track-tag">{t.tag}</span>
              {count ? <span className="live-dot"><i />LIVE · {count} EXAMS</span> : <span className="access soon">COMING SOON</span>}
            </div>
            <div className="logo-tile">
              <Image src={t.logo.src} alt={`${t.name} logo`} width={t.logo.w} height={t.logo.h} className="logo-img" loading="eager" />
            </div>
            <h3 className="h">{t.name} <span className="serif">prep</span></h3>
            <p className="fmt">{t.format}</p>
            <p>{t.blurb}</p>
            <div className="chips">
              {t.sections.map((s) => <Link key={s.code} href={`/exams?subject=${s.code}`}>{s.label}</Link>)}
            </div>
            <Link href={`/exams?track=${t.key}`} className="track-go">
              {count ? `Start practising ${t.name}` : `See what's coming`} <Arrow s={14} />
            </Link>
          </article>
        );
      })}
    </div>
  </div>
</section>

{/* EXAMS */}
<section className="sec tint" id="exams">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">The exam library</div>
        <h2 className="h">Pick an exam. <span className="serif">Start in one click.</span></h2>
      </div>
      <p>Each card shows the subject, how long it takes and whether it&apos;s free. Each dot on a card is one question.</p>
    </div>
    <ExamShelf exams={exams} />
    <div className="shelf-foot rv">
      <div className="legend">
        <span><span className="access free">FREE</span> with a free account</span>
        <span><span className="access pro">PRO</span> with a membership</span>
      </div>
      <Link href="/exams" className="link">Open the full library →</Link>
    </div>
  </div>
</section>

{/* STUDY SYSTEM */}
<section className="sec" id="system">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">Study system</div>
        <h2 className="h">Everything you need <span className="serif">to reach your score.</span></h2>
      </div>
      <p>Built around how students actually improve: practise under real conditions, see what went wrong, fix it.</p>
    </div>
    <p className="swipe-hint" aria-hidden="true">Swipe to see more →</p>
    <div className="sys-grid">
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5V5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM8 7h7M8 11h5"/></svg></span><h4>A question bank that keeps growing</h4><p>Hundreds of questions from full papers, with new exams added every month.</p></div>
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg></span><h4>Full, timed practice tests</h4><p>The real timer, module breaks and layout. When time runs out, your test is submitted.</p></div>
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg></span><h4>Explanations for every answer</h4><p>Not just the right letter. See why it&apos;s right and where the other options go wrong.</p></div>
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span><h4>Progress you can actually see</h4><p>Every attempt is saved with its score, so you can compare this month with last month.</p></div>
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg></span><h4>Scored by official topics</h4><p>Your weakest topic is named after every test, so you know exactly what to practise next.</p></div>
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/></svg></span><h4>Built for EST, SAT and ACT</h4><p>One account and one dashboard for every exam you&apos;re preparing for.</p></div>
    </div>
  </div>
</section>

{/* RESULTS */}
<section className="sec tint" id="results">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">Your results</div>
        <h2 className="h">Know exactly <span className="serif">what to fix</span> next.</h2>
      </div>
      <p>Every test is scored by topic, with a worked explanation for every question.</p>
    </div>
    <div className="results-grid">
      <div className="report rv" id="report">
        <StickyNote color="pink" rotate={5} className="note-results" doodle="check">Weakest topic = fastest points</StickyNote>
        <span className="sample">SAMPLE RESULT</span>
        <div className="score-row">
          <div className="score-big">41<small>/50</small></div>
          <div><div className="t">EST I Math · Full mock</div><div className="s">72:14 used of 75:00</div></div>
          <svg className="score-ring" viewBox="0 0 86 86"><circle cx="43" cy="43" r="36" fill="none" stroke="#ECF0F8" strokeWidth="9"/><circle id="ringArc" cx="43" cy="43" r="36" fill="none" stroke="#1559ED" strokeWidth="9" strokeLinecap="round" strokeDasharray="226.2" strokeDashoffset="226.2" transform="rotate(-90 43 43)" style={{transition:"strokeDashoffset 1.4s cubic-bezier(.2,.8,.2,1)"} as React.CSSProperties}/><text x="43" y="48" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="600" fontSize="15" fill="#0A0F1C">82%</text></svg>
        </div>
        <div className="bars">
          <div><div className="bar-l"><span>Foundational Algebra</span><span>13/14</span></div><div className="bar"><i style={css({"--w":"93%","--c":"var(--blue)"})}></i></div></div>
          <div><div className="bar-l"><span>Data Analysis and Probability</span><span>13/15</span></div><div className="bar"><i style={css({"--w":"87%","--c":"var(--blue)"})}></i></div></div>
          <div><div className="bar-l"><span>Advanced Algebra and Functions</span><span>12/15</span></div><div className="bar"><i style={css({"--w":"80%","--c":"var(--blue)"})}></i></div></div>
          <div><div className="bar-l"><span>Geometry and Trigonometry<em>FOCUS</em></span><span>3/6</span></div><div className="bar"><i style={css({"--w":"50%","--c":"var(--ink)"})}></i></div></div>
        </div>
        <div className="next"><span className="ic"><svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span><div><b>Up next: Geometry and Trigonometry practice</b><span>Your weakest topic, so this is where your fastest gains are.</span></div></div>
      </div>
      <div className="points">
        <div className="point rv"><span className="n">i.</span><div><h4>A score out of 800</h4><p>Every section gets an estimated scaled score, so you can track it the way the real exam reports it.</p></div></div>
        <div className="point rv"><span className="n">ii.</span><div><h4>Review every question</h4><p>Step through your mistakes one by one, with the passage, the right answer and the explanation.</p></div></div>
        <div className="point rv"><span className="n">iii.</span><div><h4>Retake and climb</h4><p>Take a new test, compare it with the last one, and keep closing the gap to 1600.</p></div></div>
      </div>
    </div>
  </div>
</section>

{/* PRICING */}
<section className="sec" id="pricing">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">Membership</div>
        <h2 className="h">Simple, <span className="serif">honest</span> pricing.</h2>
      </div>
      <p>Full access to every track, question and test. Free exams stay open with an account. Cancel anytime.</p>
    </div>
    {plans.length ? (
      <>
      <p className="swipe-hint" aria-hidden="true">Swipe to see more →</p>
    <div className="plans three">
        {plans.map((p) => {
          const pitch = planPitch(p, plans.find((x) => x.interval_months === 1)?.price_cents);
          return (
            <div key={p.id} className={`plan rv${pitch.popular ? " pro" : ""}`}>
              {pitch.popular ? <span className="ribbon">★ Most popular</span> : null}
              {pitch.popular ? <StickyNote color="blue" rotate={7} className="note-plan" doodle="heart">the sweet spot!</StickyNote> : null}
              <div className="top">
                <h3 className="h">{p.name}</h3>
                {pitch.save > 0 ? <span className="save">SAVE {pitch.save}%</span> : null}
              </div>
              <p className="hook">{pitch.hook}</p>
              <div className="price">
                {pitch.compareAtCents ? <s>{formatPrice(pitch.compareAtCents, p.currency)}</s> : null}
                <b>{formatPrice(p.price_cents, p.currency)}</b>
                <span>/ {periodLabel(p.interval_months)}</span>
              </div>
              <p className="per">
                {p.interval_months > 1 ? <>Just <b>{formatPrice(pitch.perMonth, p.currency)}</b> a month</> : <>Full access, billed monthly</>}
                {pitch.perDay ? <> · less than {pitch.perDay} EGP a day</> : null}
              </p>
              <Link href={`/checkout/${p.code}`} className={`btn ${pitch.popular ? "btn-blue" : "btn-ink"}`}>{pitch.cta} <Arrow s={16} /></Link>
              <ul>{p.features.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          );
        })}
      </div>
      <div className="assure rv">
        <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>Secure checkout by Paymob</span>
        <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>Instant access after payment</span>
        <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>Cancel anytime</span>
        <a href={FREE_START_HREF}>Not ready? Take a free exam first →</a>
      </div>
      </>
    ) : (
      <div className="plan rv">
        <h3 className="h">Free exams are open now</h3>
        <p className="tl">Create a free account to take every exam marked Free.</p>
        <Link href="/sign-up" className="btn btn-ink">Create free account</Link>
      </div>
    )}
  </div>
</section>

{/* TESTIMONIALS: shown only once real quotes are added in lib/marketing.ts */}
{TESTIMONIALS.length ? (
  <section className="sec tint" id="stories">
    <div className="wrap">
      <div className="sec-head rv">
        <div>
          <div className="eyebrow">Students</div>
          <h2 className="h">In their <span className="serif">own words.</span></h2>
        </div>
      </div>
      <div className="quotes">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="quote rv">
            <blockquote>&ldquo;{t.quote}&rdquo;</blockquote>
            <figcaption><b>{t.name}</b><span>{t.detail}</span></figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
) : null}

{/* FAQ */}
<section className="sec tint" id="faq">
  <div className="wrap">
    <div className="faq-wrap">
      <div className="side rv">
        <h3 className="h">Questions students and parents ask</h3>
        <p>Something else? Message us and a person will reply.</p>
      </div>
      <div className="rv">
        <details open><summary>Are these the official exams?<span className="pm">+</span></summary><p>No. 16hundred is an independent practice platform, not affiliated with the EST, SAT or ACT organisers. Our tests follow each exam&apos;s official format: the same topics, question types, number of questions and timing.</p></details>
        <details><summary>Which exams are available?<span className="pm">+</span></summary><p>EST I Math and Literacy, and EST II Math Level 1 and 2, are live now. SAT (Math, Reading and Writing) and ACT (Math, English, Science) open as soon as their first full mocks are published.</p></details>
        <details><summary>What&apos;s free and what needs a membership?<span className="pm">+</span></summary><p>Exams marked FREE only need a free account, no card. A membership unlocks every exam in the library, on every track.</p></details>
        <details><summary>How do I follow progress?<span className="pm">+</span></summary><p>Every submitted test is saved to the dashboard with the score out of 800, the time used, a breakdown by topic and an explanation for every question.</p></details>
        <details><summary>How do we pay?<span className="pm">+</span></summary><p>By card, through Paymob&apos;s secure checkout. We never see or store your card details.</p></details>
      </div>
    </div>
  </div>
</section>

<section className="final">
  <div className="ghost" aria-hidden="true">1600</div>
  <div className="wrap">
    <h2 className="h rv">Ready to start climbing<br /><span className="serif">toward 1600?</span></h2>
    <div className="row rv">
      <p>Create your free account, explore the exam library and take your first practice test today.</p>
      <div className="final-ctas">
        <Link href="/sign-up" className="btn btn-white">Start learning <Arrow s={16} /></Link>
        <a href="#pricing" className="btn btn-ghost-white">View plans</a>
      </div>
    </div>
  </div>
</section>

{/* CONTACT */}
<section className="sec" id="contact">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">Support</div>
        <h2 className="h">Need help? <span className="serif">We&apos;re one message away.</span></h2>
      </div>
    </div>
    <div className="contact-grid">
      <a className="par rv" href={`mailto:${CONTACT.email}`}><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg></span><h4>Email</h4><p>{CONTACT.email}</p></a>
      {CONTACT.whatsapp ? <a className="par rv" href={`https://wa.me/${CONTACT.whatsapp}`} target="_blank" rel="noreferrer"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 01-13.5 7.8L3 21l1.3-4.4A9 9 0 1121 12z"/></svg></span><h4>WhatsApp</h4><p>Direct support</p></a> : null}
      {CONTACT.instagram ? <a className="par rv" href={`https://instagram.com/${CONTACT.instagram}`} target="_blank" rel="noreferrer"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/></svg></span><h4>Instagram</h4><p>@{CONTACT.instagram}</p></a> : null}
      {CONTACT.tiktok ? <a className="par rv" href={`https://tiktok.com/@${CONTACT.tiktok}`} target="_blank" rel="noreferrer"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 3v11a4 4 0 11-4-4M14 3c0 3 2 5 5 5"/></svg></span><h4>TikTok</h4><p>@{CONTACT.tiktok}</p></a> : null}
    </div>
  </div>
</section>

<footer>
  <div className="wrap">
    <div className="foot-top">
      <div><Logo href="/" /><p>EST, SAT and ACT practice for American Diploma students. Study with intent, practise with precision.</p></div>
      <div><h6>Practice</h6><Link href="/exams?track=est">EST</Link><Link href="/exams?track=sat">SAT</Link><Link href="/exams?track=act">ACT</Link><Link href="/exams?access=free">Free exams</Link></div>
      <div><h6>Platform</h6><Link href="/exams">Exam library</Link><Link href="/pricing">Pricing</Link><a href="#contact">Contact</a><Link href="/dashboard">My account</Link></div>
      <div><h6>Account</h6><Link href="/sign-in">Log in</Link><Link href="/sign-up">Create account</Link></div>
    </div>
    <div className="wordmark" aria-hidden="true"><b>16</b>hundred</div>
    <div className="legal"><span>© 2026 16hundred. All rights reserved.</span><span>Independent practice platform, not affiliated with or endorsed by the EST, SAT or ACT organisers. SAT® is a trademark of the College Board; ACT® is a trademark of ACT, Inc.</span></div>
  </div>
</footer>
    </div>
  );
}
