import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles, BookOpen, GraduationCap, Wrench, Pill, CircleAlert } from "lucide-react";
import { TOPICS, REFERENCE_WEEK } from "@/content/curriculum";
import { ROTATIONS, rotationNeighbours } from "@/content/rotations";
import { loadTopic } from "@/lib/content";
import { Markdown } from "@/components/markdown";
import { KindChip } from "@/components/ui";
import { TopicHeaderActions, TopicDetails, TopicTabs, TableOfContents } from "@/components/topic-view";
import { DrugGroupGrid, ChapterList } from "@/components/drug-handbook";
import { ChapterProvider, ChapterBody, ChapterToc } from "@/components/chapter-notes";
import { drugHandbook } from "@/lib/drug-handbook";

const KIND_ICON = { lecture: GraduationCap, tutorial: BookOpen, skill: Wrench, reference: Pill } as const;

export const dynamicParams = false;

export function generateStaticParams() {
  return TOPICS.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata(props: PageProps<"/topics/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const c = loadTopic(slug);
  return c ? { title: c.topic.title, description: c.summary } : {};
}

export default async function TopicPage(props: PageProps<"/topics/[slug]">) {
  const { slug } = await props.params;
  const c = loadTopic(slug);
  if (!c) notFound();
  const { topic, study } = c;
  const rotation = ROTATIONS[topic.rotation];
  // Previous / next within the topic's own rotation.
  const { prev, next } = rotationNeighbours(slug);
  const sessions = rotation.sessions.filter((s) => s.topic === slug);
  const questions = study.mcqs.map((q) => ({ ...q, topic: slug }));
  const cards = study.flashcards.map((f) => ({ ...f, topic: slug }));

  const jump = [
    { re: /^management/i, label: "Management" },
    { re: /clinical workup/i, label: "Clinical workup" },
    { re: /clinical acumen/i, label: "Clinical acumen" },
    { re: /procedure/i, label: "Procedure" },
    { re: /high-yield summary/i, label: "High-yield" },
    { re: /ward-round|exam pearls/i, label: "Ward-round pearls" },
  ]
    .map((j) => ({ ...j, h: c.headings.find((h) => h.depth === 2 && j.re.test(h.text)) }))
    .filter((j) => j.h);
  // A drug handbook (reference topic with notes) is split into chapters with their own pages.
  const chapters = topic.kind === "reference" ? drugHandbook(slug) : [];
  const handbook = chapters.length
    ? chapters.map(({ slug: g, title, blurb, icon, tone, items }) => ({
        slug: g,
        title,
        blurb,
        icon,
        tone,
        items: items.map(({ id, text }) => ({ id, text })),
      }))
    : null;
  // Structured notes (numbered sections in four chapters): the chapter tabs replace the jump pills.
  const notes = handbook ? null : c.structured;
  if (handbook || notes) jump.length = 0;
  const Icon = KIND_ICON[topic.kind];
  const { meta } = c;
  const reviewed = meta.lastReviewed
    ? new Date(`${meta.lastReviewed}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    : null;

  const grid = (
    <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_292px] xl:gap-10">
      <div className="min-w-0">
        {c.highYield.length > 0 && !handbook && (
          <section className="mb-6 flex flex-col gap-2.5 rounded-[14px] border border-brand-line bg-surface px-5 py-4">
            <h2 className="flex items-center gap-2 text-[13px] font-semibold text-brand-text">
              <Sparkles size={15} className="fill-brand text-brand" /> Must know before the ward round
            </h2>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14.5px] leading-relaxed marker:font-semibold marker:text-brand">
              {c.highYield.map((h, k) => (
                <li key={k} className="pl-1">
                  <Markdown className="prose-compact [&_p]:m-0 [&_p]:text-[14.5px]">{h}</Markdown>
                </li>
              ))}
            </ol>
          </section>
        )}

        <TopicTabs
          slug={slug}
          topicTitle={topic.title}
          cards={cards}
          questions={questions}
          cases={study.cases}
          references={study.references}
          toc={handbook ? <ChapterList base={`/topics/${slug}`} groups={handbook} /> : notes ? undefined : <TableOfContents headings={c.headings} />}
        >
          {handbook ? (
            <>
              <DrugGroupGrid base={`/topics/${slug}`} groups={handbook} />
              <section className="mt-8 flex flex-col gap-2.5 rounded-[14px] border border-brand-line bg-surface px-5 py-4">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold text-brand-text">
                  <Sparkles size={15} className="fill-brand text-brand" /> Must-know drug facts
                </h2>
                <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14.5px] leading-relaxed marker:font-semibold marker:text-brand">
                  {c.highYield.map((h, k) => (
                    <li key={k} className="pl-1">
                      <Markdown className="prose-compact [&_p]:m-0 [&_p]:text-[14.5px]">{h}</Markdown>
                    </li>
                  ))}
                </ol>
              </section>
            </>
          ) : notes ? (
            <ChapterBody
              preamble={notes.preamble ? <Markdown>{notes.preamble}</Markdown> : undefined}
              contents={notes.sections.map((sec) => (
                <Markdown key={sec.key} headingIds slugSeed={sec.slugSeed}>
                  {sec.body}
                </Markdown>
              ))}
            />
          ) : c.body ? (
            <Markdown headingIds>{c.body}</Markdown>
          ) : (
            <div className="card p-8 text-center text-ink-3">Notes for this topic are being written. Check back soon, or try the flashcards and questions.</div>
          )}
        </TopicTabs>
      </div>

      <aside className="hidden xl:block">
        <div className="sticky top-20 flex max-h-[calc(100dvh-6rem)] flex-col gap-6 overflow-y-auto rounded-[14px] border border-line bg-surface p-5">
          <TopicDetails
            slug={slug}
            counts={{ flashcards: cards.length, mcqs: questions.length, cases: study.cases.length }}
            sessions={sessions}
            rotation={topic.rotation}
            faculty={topic.faculty}
            weekLabel={topic.week === REFERENCE_WEEK ? "Reference · not timetabled" : `${topic.week} · ${rotation.weekThemes[topic.week]}`}
          />
          <div className="border-t border-line pt-4">
            <div className="mb-2 text-[12px] font-medium text-ink-3">{handbook ? "Chapters" : notes ? "In this chapter" : "On this page"}</div>
            {handbook ? (
              <ChapterList base={`/topics/${slug}`} groups={handbook} />
            ) : notes ? (
              <ChapterToc />
            ) : (
              <TableOfContents headings={c.headings} />
            )}
          </div>
        </div>
      </aside>
    </div>
  );

  return (
    <article>
      {/* Record header */}
      <header className="mb-6 flex flex-col gap-4">
        <div className="flex items-start gap-4">
          <span className="hidden h-[52px] w-[52px] shrink-0 place-items-center rounded-[14px] bg-brand-soft text-brand sm:grid">
            <Icon size={24} strokeWidth={1.8} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <KindChip kind={topic.kind} />
              {topic.discipline !== "skills" && topic.discipline !== "paediatrics" && topic.week !== REFERENCE_WEEK && (
                <span className="chip capitalize">{topic.discipline}</span>
              )}
              <span className="chip">{rotation.name}</span>
              {topic.week !== REFERENCE_WEEK && (
                <span className="chip">
                  Week {topic.week} · {rotation.weekThemes[topic.week]}
                </span>
              )}
              {sessions.some((x) => x.presenting) && <span className="chip !border-transparent !bg-brand !text-white">You&apos;re presenting</span>}
              {topic.sharedWith?.map((r) => (
                <span key={r} className="chip">
                  Also in {ROTATIONS[r].name}
                </span>
              ))}
              {notes && meta.system && <span className="chip">{meta.system}</span>}
              {notes && meta.level && <span className="chip !border-transparent !bg-lilac-soft !text-lilac-text">{meta.level}</span>}
              {c.wordCount > 0 && <span className="chip">{Math.max(1, Math.round(c.wordCount / 200))} min read</span>}
              {notes && reviewed && <span className="chip">Reviewed {reviewed}</span>}
              {c.verifyCount > 0 && (
                <span className="chip !border-warn-line !bg-warn-soft !text-warn-text" title="Statements marked Verify are still being checked against the sources">
                  <CircleAlert size={12} strokeWidth={2.4} /> {c.verifyCount} to verify
                </span>
              )}
              <div className="ml-auto hidden sm:block">
                <TopicHeaderActions slug={slug} title={topic.title} />
              </div>
            </div>
            <h1 className="h-display !text-[clamp(2.1rem,1.6rem+1.8vw,2.9rem)] !leading-[1.03]">{topic.title}</h1>
            <p className="max-w-3xl text-[15px] leading-relaxed text-ink-2">{c.summary}</p>
            {topic.faculty.length > 0 && <p className="text-[13px] text-ink-3 xl:hidden">{topic.faculty.join(" · ")}</p>}
            <div className="sm:hidden">
              <TopicHeaderActions slug={slug} title={topic.title} />
            </div>
          </div>
        </div>
        {jump.length > 0 && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {jump.map((j, k) => (
              <a
                key={j.h!.id}
                href={`#${j.h!.id}`}
                className={
                  k === 0
                    ? "inline-flex h-[34px] shrink-0 items-center rounded-full bg-primary px-3.5 text-[13px] font-medium text-primary-ink"
                    : "inline-flex h-[34px] shrink-0 items-center rounded-full border border-line-strong bg-surface px-3.5 text-[13px] font-medium"
                }
              >
                {j.label}
              </a>
            ))}
          </div>
        )}
      </header>

      {notes ? (
        <ChapterProvider
          slug={slug}
          chapters={notes.chapters}
          sections={notes.sections.map(({ key, n, title, id, chapter, words, parts }) => ({
            key,
            n,
            title,
            id,
            chapter,
            minutes: Math.max(1, Math.round(words / 200)),
            parts,
          }))}
        >
          {grid}
        </ChapterProvider>
      ) : (
        grid
      )}

      <nav className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {prev ? (
          <Link href={`/topics/${prev.slug}`} className="card flex min-w-0 items-center gap-2 p-4">
            <ChevronLeft size={18} className="shrink-0 text-ink-3" />
            <div className="min-w-0">
              <div className="text-xs text-ink-3">Previous</div>
              <div className="truncate font-medium">{prev.title}</div>
            </div>
          </Link>
        ) : (
          <span />
        )}
        {next && (
          <Link href={`/topics/${next.slug}`} className="card flex min-w-0 items-center justify-end gap-2 p-4 text-right">
            <div className="min-w-0">
              <div className="text-xs text-ink-3">Next</div>
              <div className="truncate font-medium">{next.title}</div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-ink-3" />
          </Link>
        )}
      </nav>
    </article>
  );
}
