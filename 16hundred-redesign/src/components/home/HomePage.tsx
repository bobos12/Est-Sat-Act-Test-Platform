import { Logo } from "@/components/brand/Logo";
import { GraphPaper } from "./GraphPaper";
import { TryQuestion } from "./TryQuestion";
import { ExamShelf } from "./ExamShelf";
import { EngineDemo } from "./EngineDemo";
import { RevealOnScroll } from "./Reveal";
import { Arrow, Check } from "./Icons";
import { FREE_START_HREF, type ShelfExam } from "@/lib/exam-catalog";

const TOPICS = ["Foundational Algebra", "Data Analysis and Probability", "Advanced Algebra and Functions", "Geometry and Trigonometry",
  "Words in Context", "Expression of Ideas", "Standard English Conventions", "Analysis in Science", "Analysis in History", "Analysis in Literature"];

/**
 * 16hundred homepage. Server component; pass the exams to show in the library.
 * Wrapped in `.sh` so the brand styles never leak into the exam engine / admin.
 */
export function HomePage({ exams }: { exams: ShelfExam[] }) {
  return (
    <div className="sh">
      <RevealOnScroll />
<header className="nav" id="nav">
  <div className="wrap">
    <Logo />
    <nav className="nav-links" aria-label="Main">
      <a href="#exams">Exams</a>
      <a href="#road">Road to 1600</a>
      <a href="#parents">For parents</a>
      <a href="#access">Pricing</a>
    </nav>
    <div className="nav-right">
      <a href="/login" className="login">Log in</a>
      <a href={FREE_START_HREF} className="btn btn-blue btn-sm">Start free exam</a>
    </div>
  </div>
</header>

<section className="hero">
  <GraphPaper />
  <div className="wrap">
    <div>
      <span className="pill"><b>EST I · EST II</b>Practice exams for American Diploma students</span>
      <h1 className="h">
        <span className="ln"><span>Practice the real EST.</span></span>
        <span className="ln"><span>Aim for <span className="goal">1600</span>.</span></span>
      </h1>
      <p className="lede">Timed mock exams that follow the official EST blueprint. Every exam is scored by topic, so you always know what to study next. <strong>Your first exam is free.</strong></p>
      <div className="ctas">
        <a href={FREE_START_HREF} className="btn btn-blue">Start a free exam <Arrow s={16} /></a>
        <a href="#exams" className="btn btn-line">Explore all exams</a>
        <a href="#access" className="link">Get Pro access →</a>
      </div>
      <div className="trust">
        <span><Check />Free account, no card</span>
        <span><Check />Built from 24 official EST papers</span>
        <span><Check />Every result saved</span>
      </div>
    </div>

    <TryQuestion />
  </div>
</section>

<div className="ticker" aria-hidden="true"><div className="ticker-track">{[...TOPICS, ...TOPICS].map((t, i) => <span key={i}>{t}</span>)}</div></div>

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
        <span><span className="access pro">PRO</span> with a subscription</span>
      </div>
      <a href="/exams" className="link">Open the full library →</a>
    </div>
  </div>
</section>

{/* ROAD TO 1600 */}
<section className="sec road" id="road">
  <div className="wrap">
    <div className="road-grid">
      <div className="rv">
        <div className="eyebrow">The road to 1600</div>
        <h2 className="h">Every top score <span className="serif">started with</span> a first mock.</h2>
        <p className="lead">1600 is the highest EST I score: a perfect 800 in Math plus a perfect 800 in Literacy. It&apos;s a big goal, and you don&apos;t reach it by luck. You get closer one topic at a time. Here&apos;s the plan.</p>
        <div className="counter" aria-label="1600"><span id="count">1600</span><small>The<br />goal</small></div>
        <div className="split"><span>Math <b>800</b></span><span>+</span><span>Literacy <b>800</b></span></div>
      </div>
      <div className="stairs rv" id="stairs">
        <div className="step" style={{"--h":"52%"} as React.CSSProperties}><span className="n">STEP 01</span><h4>Find your starting point</h4><p>Take one full mock under the real timer. That&apos;s your honest baseline.</p></div>
        <div className="step" style={{"--h":"67%"} as React.CSSProperties}><span className="n">STEP 02</span><h4>See where the points are</h4><p>Your results show which topics cost you marks.</p></div>
        <div className="step" style={{"--h":"83%"} as React.CSSProperties}><span className="n">STEP 03</span><h4>Practise just those</h4><p>Short topic sets with an explanation for every answer.</p></div>
        <div className="step" style={{"--h":"100%"} as React.CSSProperties}><span className="flag">1600</span><span className="n">STEP 04</span><h4>Retake and climb</h4><p>Take a new mock, compare it with the last one, and keep going.</p></div>
      </div>
    </div>
    <div className="promise rv">
      <span className="ic"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg></span>
      <div><b>You don&apos;t need to be perfect today. You just need to find your next ten points.</b><span>We can&apos;t promise anyone a 1600, and no honest platform can. What we can do is show you exactly where every point is hiding, so your practice counts.</span></div>
      <a href={FREE_START_HREF} className="btn btn-white">Take my first mock</a>
    </div>
  </div>
</section>

{/* EXAM ROOM */}
<section className="sec" id="engine">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">The exam room</div>
        <h2 className="h">Feels like test day, <span className="serif">so test day feels easy.</span></h2>
      </div>
      <p>The same layout, timing and question types as the real EST, so nothing on exam day is a surprise.</p>
    </div>
    <div className="engine-grid">
      <div className="rv"><EngineDemo /></div>
      <div className="features">
        <div className="feat rv"><span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/></svg></span><div><h4>A timer that works like the real one</h4><p>The server keeps the time. When it runs out, your exam is submitted automatically.</p></div></div>
        <div className="feat rv"><span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 13l4 4L19 7"/></svg></span><div><h4>Every answer saved</h4><p>Answers save as you go, even if the Wi-Fi drops. Come back and pick up where you stopped.</p></div></div>
        <div className="feat rv"><span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 21V4h11l-2 4 2 4H5"/></svg></span><div><h4>Flag it, come back to it</h4><p>Mark the hard ones, move on, and jump back from the question map.</p></div></div>
        <div className="feat rv"><span className="ic"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="8" height="16" rx="1"/><path d="M14 7h7M14 12h7M14 17h5"/></svg></span><div><h4>The passage stays on screen</h4><p>Literacy passages stay pinned beside the questions, with the tested part highlighted.</p></div></div>
      </div>
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
      <p>Every exam is scored by the official EST topics, with a worked explanation for every question.</p>
    </div>
    <div className="results-grid">
      <div className="report rv" id="report">
        <span className="sample">SAMPLE RESULT</span>
        <div className="score-row">
          <div className="score-big">41<small>/50</small></div>
          <div><div className="t">EST I Math · Full mock</div><div className="s">72:14 used of 75:00</div></div>
          <svg className="ring" viewBox="0 0 86 86"><circle cx="43" cy="43" r="36" fill="none" stroke="#ECF0F8" strokeWidth="9"/><circle id="ringArc" cx="43" cy="43" r="36" fill="none" stroke="#1559ED" strokeWidth="9" strokeLinecap="round" strokeDasharray="226.2" strokeDashoffset="226.2" transform="rotate(-90 43 43)" style={{transition:"strokeDashoffset 1.4s cubic-bezier(.2,.8,.2,1)"} as React.CSSProperties}/><text x="43" y="48" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="600" fontSize="15" fill="#0A0F1C">82%</text></svg>
        </div>
        <div className="bars">
          <div><div className="bar-l"><span>Foundational Algebra</span><span>13/14</span></div><div className="bar"><i style={{"--w":"93%","--c":"var(--blue)"} as React.CSSProperties}></i></div></div>
          <div><div className="bar-l"><span>Data Analysis and Probability</span><span>13/15</span></div><div className="bar"><i style={{"--w":"87%","--c":"var(--blue)"} as React.CSSProperties}></i></div></div>
          <div><div className="bar-l"><span>Advanced Algebra and Functions</span><span>12/15</span></div><div className="bar"><i style={{"--w":"80%","--c":"var(--blue)"} as React.CSSProperties}></i></div></div>
          <div><div className="bar-l"><span>Geometry and Trigonometry<em>FOCUS</em></span><span>3/6</span></div><div className="bar"><i style={{"--w":"50%","--c":"var(--ink)"} as React.CSSProperties}></i></div></div>
        </div>
        <div className="next"><span className="ic"><svg width="18" height="18" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span><div><b>Up next: Geometry and Trigonometry practice</b><span>Your weakest topic, so this is where your fastest gains are.</span></div></div>
      </div>
      <div className="points">
        <div className="point rv"><span className="n">i.</span><div><h4>Scored the way the EST is</h4><p>Results use the official topic names, so you know exactly which part of the test to work on.</p></div></div>
        <div className="point rv"><span className="n">ii.</span><div><h4>An explanation for every question</h4><p>Not just the right letter. You see why it&apos;s right and why the other options are wrong.</p></div></div>
        <div className="point rv"><span className="n">iii.</span><div><h4>Progress you can see</h4><p>Every attempt stays in your dashboard, so you can compare this month with last month.</p></div></div>
      </div>
    </div>
  </div>
</section>

{/* PARENTS */}
<section className="sec" id="parents">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">For parents</div>
        <h2 className="h">Know what your child is practising, <span className="serif">and how it&apos;s going.</span></h2>
      </div>
      <p>EST prep is a real investment. Here&apos;s what you get, in plain words.</p>
    </div>
    <div className="par-grid">
      <div className="par rv"><div className="k">24</div><h4>Built on the real exam</h4><p>We analysed 24 official EST papers and answer keys. Our exams follow the same topics, question counts and timing.</p></div>
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg></span><h4>Progress you can check together</h4><p>Every exam your child takes is saved with its score and topic breakdown. Sit down together and open their dashboard.</p></div>
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="10" width="18" height="11" rx="2"/><path d="M7 10V7a5 5 0 0110 0v3"/></svg></span><h4>Clear, secure payment</h4><p>You see the plan and price before you pay. Card payments go through Paymob, a licensed Egyptian payment provider.</p></div>
      <div className="par rv"><span className="ic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 21V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/></svg></span><h4>Try it before you pay</h4><p>The free account includes real, full-length exams. Pay only if your child finds it useful.</p></div>
    </div>

    <div className="faq-wrap">
      <div className="side rv">
        <h3 className="h">Questions parents ask</h3>
        <p>Something else? Email us at <b>support@16hundred.app</b> and a person will reply.</p>
      </div>
      <div className="rv">
        <details open><summary>Is this the official EST?<span className="pm">+</span></summary><p>No. 16hundred is an independent practice platform. Our exams are original questions written to match the official EST blueprint: the same topics, question types, number of questions and timing.</p></details>
        <details><summary>Which exams are available?<span className="pm">+</span></summary><p>EST I Math (50 questions, 75 minutes) and EST I Literacy (85 questions in 3 modules, 90 minutes), as full mocks and shorter topic practice sets. EST II Math Level 1 and 2, Biology and Chemistry are being prepared.</p></details>
        <details><summary>What&apos;s free and what needs a subscription?<span className="pm">+</span></summary><p>Exams marked FREE only need a free account, no card. Pro unlocks every exam in the library. Plans and prices are shown on the pricing page before you pay.</p></details>
        <details><summary>How can I follow my child&apos;s progress?<span className="pm">+</span></summary><p>Every exam your child submits is saved to their dashboard with the score, the time used, a breakdown by topic and an explanation for every question.</p></details>
        <details><summary>How do we pay?<span className="pm">+</span></summary><p>By card, through Paymob&apos;s secure checkout. We never see or store your card details.</p></details>
      </div>
    </div>
  </div>
</section>

{/* ACCESS */}
<section className="sec tint" id="access">
  <div className="wrap">
    <div className="sec-head rv">
      <div>
        <div className="eyebrow">Access</div>
        <h2 className="h">Start free. <span className="serif">Go Pro</span> when you&apos;re ready.</h2>
      </div>
      <p>Free gets you real exams, not a demo. Pro unlocks the whole library.</p>
    </div>
    <div className="plans">
      <div className="plan rv">
        <div className="top"><h3 className="h">Free</h3><span className="access free">NO CARD</span></div>
        <p className="tl">Create a free account and take your first full exam today.</p>
        <ul>
          <li>Every exam marked FREE in the library</li>
          <li>The real timer and exam layout</li>
          <li>Topic breakdown and explanations</li>
          <li>Every attempt saved to your dashboard</li>
        </ul>
        <a href="/signup" className="btn btn-ink">Create free account</a>
      </div>
      <div className="plan pro rv">
        <div className="top"><h3 className="h">Pro <span className="serif">access</span></h3><span className="access">ALL EXAMS</span></div>
        <p className="tl">Every full-length mock and every practice set in the library.</p>
        <ul>
          <li>Everything in Free</li>
          <li>Every EST I Math and Literacy full mock</li>
          <li>All topic and skill practice sets</li>
          <li>New exams as soon as they&apos;re published</li>
        </ul>
        <a href="/pricing" className="btn btn-blue">See plans &amp; prices</a>
      </div>
    </div>
  </div>
</section>

<section className="final">
  <div className="ghost" aria-hidden="true">1600</div>
  <div className="wrap">
    <h2 className="h rv">Your road to 1600<br /><span className="serif">starts today.</span></h2>
    <div className="row rv">
      <p>One free mock exam. 50 questions, 75 minutes, and a clear picture of where you stand.</p>
      <a href={FREE_START_HREF} className="btn btn-white">Start a free exam <Arrow s={16} /></a>
    </div>
  </div>
</section>

<footer>
  <div className="wrap">
    <div className="foot-top">
      <div><Logo /><p>EST mock exams for American Diploma students. Practise the real format and aim for 1600.</p></div>
      <div><h6>Exams</h6><a href="/exams?subject=math">EST I Math</a><a href="/exams?subject=literacy">EST I Literacy</a><a href="/exams?access=free">Free exams</a><a href="/exams">All exams</a></div>
      <div><h6>Account</h6><a href="/signup">Sign up</a><a href="/login">Log in</a><a href="/dashboard">Dashboard</a><a href="/pricing">Pricing</a></div>
      <div><h6>Help</h6><a href="#parents">For parents</a><a href="/terms">Terms</a><a href="/privacy">Privacy</a></div>
    </div>
    <div className="wordmark" aria-hidden="true"><b>16</b>hundred</div>
    <div className="legal"><span>© 2026 16hundred</span><span>Independent practice platform. Not affiliated with the official EST provider.</span></div>
  </div>
</footer>
    </div>
  );
}
