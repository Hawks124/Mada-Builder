"use client";

import { useState } from "react";
import Link from "next/link";
import { CaretUpIcon, CaretDownIcon, ArrowBendDownRightIcon, ChatCircleIcon, PaperPlaneRightIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

const MOCK_COMMENTS = [
  {
    id: "c1",
    author: "Mark Lester Aquino",
    role: "Sr. Software Engineer",
    avatar: "https://i.pravatar.cc/150?u=mark",
    date: "20 Août",
    text: "Pretty basic. Crunch is still way more advanced, but this one gets the job done for simple expense tracking.",
    upvotes: 2,
    downvotes: 0,
    replies: [],
  },
  {
    id: "c2",
    author: "Jas Apusaga",
    role: "Product Designer",
    avatar: "https://i.pravatar.cc/150?u=jas",
    date: "22 Juil",
    text: "UI is clean, but would love a dark mode. Also, any plans to support Orange Money natively?",
    upvotes: 5,
    downvotes: 0,
    replies: [],
  },
  {
    id: "c3",
    author: "Kyle Urgentrouse",
    role: "Developer",
    avatar: "https://i.pravatar.cc/150?u=kyle",
    date: "6 Juil",
    text: "hey, any ETA on the CSV import feature? I keep reading it's 'coming soon' but never arrives.",
    upvotes: 1,
    downvotes: 0,
    replies: [
      {
        id: "r1",
        author: "Bryl Lim",
        role: "Créateur de Tarsi",
        avatar: "https://i.pravatar.cc/150?u=bryl",
        date: "6 Juil",
        text: "CSV import is in active development — targeting Q3 2026! Thanks for pushing on this, it keeps it high on the priority list. 🙏",
        isMaker: true,
      },
    ],
  },
];

export function ProductComments() {
  const [commentText, setCommentText] = useState("");

  return (
    <div className="flex flex-col gap-8 pt-10 border-t border-border/40" id="comments">
      {/* ── Header with count ──────────────────────────────────────── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-extrabold tracking-tight">Commentaires</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-muted text-[11px] font-black text-muted-foreground">
            {MOCK_COMMENTS.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0)}
          </span>
        </div>
        {/* Subtitle to distinguish from Reviews */}
        <p className="text-[13px] font-medium text-muted-foreground max-w-lg">
          Les commentaires sont pour les <strong className="text-foreground">questions techniques, suggestions et retours informels</strong> au maker. Pour noter l'expérience globale du produit, utilisez la section <a href="#reviews" className="text-foreground underline underline-offset-2 hover:text-primary transition-colors">Avis</a>.
        </p>
      </div>

      {/* ── Composer ──────────────────────────────────────────────── */}
      <div className="flex gap-3 items-start">
        <img
          src="https://i.pravatar.cc/150?u=me"
          alt="Moi"
          className="w-9 h-9 rounded-full shrink-0 bg-muted mt-0.5"
        />
        <div className="flex-1 flex flex-col gap-2">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Posez une question au maker, signalez un bug, ou suggérez une amélioration..."
            className="w-full min-h-20 resize-none rounded-2xl bg-muted/30 border border-border/40 focus:border-border focus:bg-muted/50 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all font-medium"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground font-medium">
              Soyez respectueux et constructif.
            </p>
            <button
              className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-full text-[13px] font-bold hover:opacity-80 transition-opacity disabled:opacity-30 cursor-pointer"
              disabled={!commentText.trim()}
            >
              <PaperPlaneRightIcon weight="fill" className="w-3.5 h-3.5" />
              Publier
            </button>
          </div>
        </div>
      </div>

      {/* ── Comment list ──────────────────────────────────────────── */}
      <div className="flex flex-col gap-6">
        {MOCK_COMMENTS.map((comment) => (
          <div key={comment.id} className="flex flex-col gap-3">
            {/* Comment row */}
            <div className="flex gap-3 items-start">
              <Link href={`/makers/${comment.id}`} className="shrink-0 hover:opacity-75 transition-opacity">
                <img src={comment.avatar} alt={comment.author} className="w-9 h-9 rounded-full bg-muted" />
              </Link>
              <div className="flex-1 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/makers/${comment.id}`} className="text-[14px] font-bold text-foreground hover:underline">{comment.author}</Link>
                  <span className="text-[11px] text-muted-foreground">{comment.date}</span>
                </div>
                <span className="text-[11px] font-medium text-muted-foreground/70">{comment.role}</span>
                <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">{comment.text}</p>
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex items-center bg-muted/40 rounded-full p-0.5">
                    <button className="p-1.5 hover:bg-background rounded-full transition-colors group cursor-pointer">
                      <CaretUpIcon weight="bold" className="w-3 h-3 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                    </button>
                    <span className="text-[10px] font-black text-foreground px-1">{comment.upvotes}</span>
                    <button className="p-1.5 hover:bg-background rounded-full transition-colors group cursor-pointer">
                      <CaretDownIcon weight="bold" className="w-3 h-3 text-muted-foreground group-hover:text-red-500 transition-colors" />
                    </button>
                  </div>
                  <button className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest cursor-pointer">
                    <ArrowBendDownRightIcon weight="bold" className="w-3.5 h-3.5" />
                    Répondre
                  </button>
                </div>
              </div>
            </div>

            {/* Replies — distinct nested style */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="ml-12 flex flex-col gap-3 border-l-2 border-border/20 pl-4">
                {comment.replies.map((reply) => (
                  <div key={reply.id} className="flex gap-3 items-start">
                    <Link href={`/makers/${reply.id}`} className="shrink-0 hover:opacity-75 transition-opacity">
                      <img src={reply.avatar} alt={reply.author} className="w-8 h-8 rounded-full bg-muted" />
                    </Link>
                    <div className="flex-1 flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Link href={`/makers/${reply.id}`} className="text-[13px] font-bold text-foreground hover:underline">
                            {reply.author}
                          </Link>
                          {reply.isMaker && (
                            <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md ring-1 ring-inset ring-emerald-500/20">
                              Maker
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-muted-foreground">{reply.date}</span>
                      </div>
                      <span className="text-[10px] font-medium text-muted-foreground/70">{reply.role}</span>
                      <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">{reply.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
