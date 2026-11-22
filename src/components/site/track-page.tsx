import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import type { Track } from "@/lib/exam-catalog";
import { breadcrumbs, faqPage, absoluteUrl, JsonLd, ORG_ID, pageMetadata, SITE_ID } from "@/lib/seo";
import { getTrackCounts, getTrackGroups, TRACK_CONTENT } from "@/lib/tracks";

export async function trackMetadata(track: Track): Promise<Metadata> {
  const c = TRACK_CONTENT[track];
  const counts = await getTrackCounts();
  // A track with no live tests stays out of the index until it has real content.
  return pageMetadata({ title: c.metaTitle, description: c.metaDescription, path: c.path, noindex: counts[track] === 0, ownImage: true });
}

const OTHER: Record<Track, Track[]> = { est: ["sat", "act"], sat: ["est", "act"], act: ["est", "sat"] };

export function TrackPage({ track }: { track: Track }) {
  const c = TRACK_CONTENT[track];
  const crumbs = [
    { name: "Home", path: "/" },
    { name: `${c.name} practice tests`, path: c.path },
  ];

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-8 sm:px-6 sm:pt-12">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-500">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li><Link href="/" className="hover:text-ink-950">Home</Link></li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="text-ink-700">{c.name} practice tests</li>
        </ol>
      </nav>

      <header className="mt-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-mark-500">For American Diploma students</p>
        <h1 className="mt-3 font-display text-4xl font-medium leading-[1.05] text-ink-950 sm:text-5xl">{c.h1}</h1>
        <p className="mt-5 text-lg leading-relaxed text-ink-600">{c.intro}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={`/sign-up?next=${encodeURIComponent(`/exams?track=${track}`)}`} size="lg">Start free</ButtonLink>
          <ButtonLink href={`/exams?track=${track}`} variant="secondary" size="lg">Browse {c.name} exams</ButtonLink>
        </div>
      </header>

      <Suspense fallback={<div className="mt-16 h-64 animate-pulse rounded-[var(--radius-lg)] bg-paper-2" />}>
        <LiveTests track={track} />
      </Suspense>

      <div className="mt-20 grid gap-14 lg:grid-cols-[1.25fr_1fr]">
        <section aria-labelledby="about">
          <h2 id="about" className="text-2xl font-semibold text-ink-950">What is the {c.full === c.name ? c.name : `${c.name} (${c.full})`}?</h2>
          {c.about.map((p) => (
            <p key={p} className="mt-4 leading-relaxed text-ink-700">{p}</p>
          ))}
          <h3 className="mt-10 text-lg font-semibold text-ink-950">How your {c.name} practice is scored</h3>
          <p className="mt-3 leading-relaxed text-ink-700">{c.scoring}</p>
        </section>

        <section aria-labelledby="format">
          <h2 id="format" className="text-2xl font-semibold text-ink-950">{c.name} test-day format</h2>
          <div className="mt-5 overflow-hidden rounded-[var(--radius-lg)] bg-white ring-1 ring-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-paper-2/70 text-xs uppercase tracking-[0.1em] text-ink-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">Section</th>
                  <th scope="col" className="px-4 py-3 font-medium">Questions</th>
                  <th scope="col" className="px-4 py-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {c.format.map((f) => (
                  <tr key={f.section} className="align-top">
                    <th scope="row" className="px-4 py-3.5 font-medium text-ink-950">
                      {f.section}
                      <span className="mt-1 block text-xs font-normal leading-relaxed text-ink-500">{f.notes}</span>
                    </th>
                    <td className="px-4 py-3.5 text-ink-700">{f.questions}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-ink-700">{f.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <section aria-labelledby="how" className="mt-20">
        <h2 id="how" className="text-2xl font-semibold text-ink-950">How {c.name} practice works on TargetScore</h2>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Take a timed test", "The countdown runs like test day and your answers save as you go. When time is up, the test is submitted."],
            ["Review every question", "See the correct answer and a worked explanation for every question, including the ones you got right."],
            ["Fix your weakest topic", "Your results name the topic costing you the most points, so your next study session counts."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-[var(--radius-lg)] bg-white p-6 ring-1 ring-line">
              <span className="font-mono text-sm text-mark-500">0{i + 1}</span>
              <h3 className="mt-2 font-semibold text-ink-950">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="faq" className="mt-20 max-w-3xl">
        <h2 id="faq" className="text-2xl font-semibold text-ink-950">{c.name} practice: common questions</h2>
        <div className="mt-6 divide-y divide-line border-y border-line">
          {c.faqs.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink-950">
                {f.q}
                <span aria-hidden="true" className="text-ink-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-ink-700">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="more" className="mt-16">
        <h2 id="more" className="text-sm font-semibold uppercase tracking-[0.14em] text-ink-500">Preparing for another exam?</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {OTHER[track].map((t) => (
            <Link key={t} href={TRACK_CONTENT[t].path} className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-800 ring-1 ring-line hover:ring-ink-300">
              {TRACK_CONTENT[t].name} practice tests →
            </Link>
          ))}
          <Link href="/exams" className="rounded-full bg-white px-4 py-2 text-sm font-medium text-ink-800 ring-1 ring-line hover:ring-ink-300">
            Full exam library →
          </Link>
        </div>
      </section>

      <JsonLd
        data={[
          {
            "@type": "CollectionPage",
            "@id": `${absoluteUrl(c.path)}#webpage`,
            url: absoluteUrl(c.path),
            name: c.metaTitle,
            description: c.metaDescription,
            isPartOf: { "@id": SITE_ID },
            publisher: { "@id": ORG_ID },
            audience: { "@type": "EducationalAudience", educationalRole: "student", audienceType: "American Diploma students" },
            about: { "@type": "Thing", name: `${c.name} (${c.full})` },
          },
          breadcrumbs(crumbs),
          faqPage(c.faqs),
        ]}
      />
    </div>
  );
}

async function LiveTests({ track }: { track: Track }) {
  const c = TRACK_CONTENT[track];
  const groups = await getTrackGroups(track);

  if (!groups.length) {
    return (
      <section className="mt-16 rounded-[var(--radius-lg)] bg-white p-8 ring-1 ring-line">
        <Badge tone="neutral">Coming soon</Badge>
        <p className="mt-4 max-w-2xl leading-relaxed text-ink-700">{c.comingSoon}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href="/est" variant="secondary">EST practice tests</ButtonLink>
          <ButtonLink href="/sat" variant="secondary">SAT practice tests</ButtonLink>
        </div>
      </section>
    );
  }

  const all = groups.flatMap((g) => g.exams);
  return (
    <section aria-labelledby="tests" className="mt-16">
      <h2 id="tests" className="text-2xl font-semibold text-ink-950">
        {all.length} {c.name} practice {all.length === 1 ? "test" : "tests"} available now
      </h2>
      {groups.map(({ subject, exams }) => (
        <div key={subject.id} className="mt-8">
          <h3 className="text-lg font-semibold text-ink-950">{subject.name} practice tests</h3>
          {subject.description ? <p className="mt-1 text-sm text-ink-600">{subject.description}</p> : null}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {exams.map((e) => (
              <li key={e.id}>
                <Link href={`/exams/${e.slug}`} className="flex h-full flex-col rounded-[var(--radius-lg)] bg-white p-5 ring-1 ring-line transition-shadow hover:shadow-[var(--shadow-card)]">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-medium leading-snug text-ink-950">{e.title}</span>
                    {e.access === "free" ? <Badge tone="free">Free</Badge> : <Badge tone="premium">Premium</Badge>}
                  </span>
                  <span className="mt-auto pt-4 text-sm text-ink-500">
                    {e.question_count} questions · {e.duration_minutes} min · {e.kind === "full_mock" ? "Full-length" : "Practice set"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <JsonLd
        data={{
          "@type": "ItemList",
          name: `${c.name} practice tests`,
          numberOfItems: all.length,
          itemListElement: all.map((e, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: absoluteUrl(`/exams/${e.slug}`),
            name: e.title,
          })),
        }}
      />
    </section>
  );
}
