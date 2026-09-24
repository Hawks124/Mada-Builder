import Link from "next/link";
import ReactMarkdown from "react-markdown";
import * as React from "react";
import { slugifyHeading, type LegalDoc } from "@/lib/legal";

// Layout partagé des docs juridiques versionnés git (confidentialité,
// conditions). Sommaire ancré + prose + liens croisés.
export function LegalLayout({
  doc,
  siblings,
}: {
  doc: LegalDoc;
  siblings: { href: string; label: string }[];
}) {
  return (
    <main className="min-h-screen bg-background">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            {doc.title}
          </h1>
          {doc.description && (
            <p className="text-lg font-medium text-muted-foreground">
              {doc.description}
            </p>
          )}
          {doc.updated && (
            <p className="text-[12px] font-bold uppercase tracking-widest text-muted-foreground/70">
              Mis à jour le{" "}
              {new Date(doc.updated + "T00:00:00").toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
        </div>

        {doc.headings.length > 0 && (
          <nav
            aria-label="Sommaire"
            className="flex flex-col gap-1 rounded-3xl border border-border/40 bg-muted/20 px-6 py-5"
          >
            {doc.headings.map((h, i) => (
              <Link
                key={h.id}
                href={`#${h.id}`}
                className="flex items-baseline gap-3 py-1 text-[14px] font-semibold text-muted-foreground hover:text-foreground transition-colors w-fit"
              >
                <span className="text-[12px] font-black tabular-nums text-muted-foreground/60">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {h.text}
              </Link>
            ))}
          </nav>
        )}

        <div className="prose prose-zinc dark:prose-invert prose-p:text-muted-foreground prose-p:font-medium prose-p:leading-relaxed prose-headings:font-extrabold prose-headings:tracking-tight prose-headings:scroll-mt-24 prose-li:font-medium prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-foreground prose-a:font-bold max-w-none text-[15px] md:text-[16px]">
          <ReactMarkdown
            components={{
              h2: ({ children }) => {
                const text = React.Children.toArray(children)
                  .map((c) => (typeof c === "string" ? c : ""))
                  .join("");
                return <h2 id={slugifyHeading(text)}>{children}</h2>;
              },
            }}
          >
            {doc.body}
          </ReactMarkdown>
        </div>

        <div className="w-full h-px bg-border/40" />

        <div className="flex flex-wrap gap-2">
          {siblings.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-full border border-border/60 px-5 py-2.5 text-[14px] font-bold text-muted-foreground hover:text-foreground hover:border-foreground/30 hover:bg-muted/50 transition-colors"
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
