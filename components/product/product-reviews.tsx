"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StarIcon } from "@phosphor-icons/react";
import { AvatarImage } from "@/components/ui/avatar-image";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import type { ReviewItem } from "@/services/feedback.service";
import {
  deleteReviewAction,
  respondReviewAction,
  submitReviewAction,
} from "@/app/actions/feedback";

export type ReviewsData = {
  items: ReviewItem[];
  distribution: { avg: number; count: number; stars: [number, number, number, number, number] };
};

function Stars({ value, size = "w-5 h-5" }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-1" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon
          key={i}
          weight="fill"
          className={cn(
            size,
            i <= Math.round(value) ? "text-amber-500" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

function ReviewForm({
  productId,
  slug,
  existing,
}: {
  productId: string;
  slug: string;
  existing: ReviewItem | null;
}) {
  const router = useRouter();
  const [rating, setRating] = React.useState(existing?.rating ?? 5);
  const [body, setBody] = React.useState(existing?.body ?? "");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const send = async () => {
    setPending(true);
    setError(null);
    const res = await submitReviewAction({ productId, slug, rating, body: body.trim() });
    setPending(false);
    if (!res.ok) {
      setError(res.message ?? "Avis impossible.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-border/40 bg-muted/20 p-5 md:p-6">
      <p className="text-[14px] font-black tracking-tight text-foreground">
        {existing ? "Modifier mon avis" : "Donner mon avis"}
      </p>
      <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Note">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i} étoile${i > 1 ? "s" : ""}`}
            onClick={() => setRating(i)}
            className="cursor-pointer transition-transform hover:scale-110"
          >
            <StarIcon
              weight="fill"
              className={cn("w-7 h-7", i <= rating ? "text-amber-500" : "text-muted-foreground/30")}
            />
          </button>
        ))}
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={2000}
        placeholder="Ce que ce produit change pour vous (10 caractères minimum)…"
        className="w-full rounded-2xl border border-border/60 bg-background px-4 py-3 text-[14px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-foreground/40 resize-y"
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground/70">
          {body.trim().length} / 2000 · min 10
        </span>
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="rounded-full bg-foreground px-6 py-2.5 text-[13px] font-bold text-background hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {pending ? "Envoi…" : existing ? "Mettre à jour" : "Publier mon avis"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

function MakerResponseForm({
  productId,
  slug,
  reviewId,
}: {
  productId: string;
  slug: string;
  reviewId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [body, setBody] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!open) {
    return (
      <div className="mt-3 opacity-0 group-hover/review:opacity-100 transition-opacity duration-200">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Répondre
        </button>
      </div>
    );
  }

  const send = async () => {
    setPending(true);
    setError(null);
    const res = await respondReviewAction({ productId, slug, reviewId, body: body.trim() });
    setPending(false);
    if (!res.ok) {
      setError(res.message ?? "Réponse impossible.");
      return;
    }
    router.refresh();
  };

  return (
    <div className="mt-4 flex flex-col gap-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={2}
        maxLength={1000}
        placeholder="Réponse officielle du maker…"
        className="w-full rounded-2xl border border-amber-500/30 bg-background px-4 py-3 text-[14px] font-medium text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-amber-500/60 resize-y"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={pending}
          className="rounded-full bg-foreground px-5 py-2 text-[12px] font-bold text-background hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {pending ? "Envoi…" : "Répondre"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Annuler
        </button>
      </div>
      {error && (
        <p role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function ProductReviews({
  id,
  productId,
  slug,
  initial,
  signedIn,
  isMaker,
  curated,
}: {
  id?: string;
  productId: string;
  slug: string;
  initial: ReviewsData;
  signedIn: boolean;
  isMaker: boolean;
  /** Veille : avis désactivés (commentaires ouverts, eux). */
  curated: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const own = initial.items.find((r) => r.own) ?? null;
  const { distribution } = initial;

  const remove = async (reviewId: string) => {
    setDeleting(reviewId);
    await deleteReviewAction({ productId, slug, reviewId });
    setDeleting(null);
    router.refresh();
  };

  return (
    <div id={id} className="flex flex-col pt-10 border-t border-border/40">
      <h2 className="text-2xl font-extrabold tracking-tight mb-10">Avis utilisateurs</h2>

      {distribution.count === 0 ? (
        <EmptyState
          size="sm"
          title="Aucun avis pour le moment."
          description="Soyez le premier à noter ce produit."
        />
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-10 md:gap-20 items-end mb-16 w-full">
            <div className="flex flex-col gap-0 shrink-0">
              <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                Excellence globale
              </span>
              <div className="flex items-baseline gap-3">
                <span className="text-[7rem] md:text-[9rem] font-black tracking-tighter leading-none text-foreground -ml-1 tabular-nums">
                  {distribution.avg.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}
                </span>
                <span className="text-2xl font-bold text-muted-foreground/25 mb-2">/&nbsp;5</span>
              </div>
              <div className="flex items-center gap-1.5 mt-3">
                <Stars value={distribution.avg} />
              </div>
            </div>

            <div className="flex flex-col gap-4 w-full flex-1 pb-3">
              {[5, 4, 3, 2, 1].map((stars) => {
                const n = distribution.stars[5 - stars] ?? 0;
                const pct = distribution.count > 0 ? Math.round((n / distribution.count) * 100) : 0;
                return (
                  <div key={stars} className="flex items-center gap-5 w-full group">
                    <div className="flex items-center gap-1.5 shrink-0 w-7 opacity-35 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-[13px] font-bold text-foreground tabular-nums">
                        {stars}
                      </span>
                      <StarIcon weight="fill" className="w-3 h-3 text-amber-500" />
                    </div>
                    <div className="flex-1 h-[1.5px] bg-border/50 overflow-hidden relative rounded-full">
                      <div
                        className="absolute top-0 left-0 h-full bg-amber-500 rounded-full transition-all duration-1000 ease-[cubic-bezier(0.2,1,0.2,1)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[12px] font-bold text-muted-foreground w-4 text-right tabular-nums opacity-35 group-hover:opacity-100 transition-opacity duration-200">
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[13px] font-medium text-muted-foreground mb-10">
            Sur la base de <strong className="text-foreground">{distribution.count} avis</strong>.
            Seuls les utilisateurs enregistrés peuvent noter ce produit.
          </p>
        </>
      )}

      {curated ? (
        <p className="text-[14px] font-medium text-muted-foreground rounded-2xl border border-border/40 bg-muted/20 px-5 py-4">
          Produit en veille : les avis sont désactivés — les commentaires restent ouverts
          ci-dessous.
        </p>
      ) : signedIn ? (
        <ReviewForm productId={productId} slug={slug} existing={own} />
      ) : (
        <p className="text-[14px] font-medium text-muted-foreground">
          <Link href="/signin" className="font-bold text-foreground underline underline-offset-4">
            Connectez-vous
          </Link>{" "}
          pour donner votre avis.
        </p>
      )}

      {initial.items.length > 0 && (
        <div className="flex flex-col gap-10 mt-14">
          {initial.items.map((review) => (
            <div key={review.id} className="flex flex-col gap-0 group/review">
              <div className="flex items-start gap-4">
                <Link
                  href={`/makers/${review.author.username}`}
                  className="shrink-0 hover:opacity-75 transition-opacity"
                >
                  <AvatarImage
                    src={review.author.avatarUrl}
                    name={review.author.displayName}
                    size={44}
                  />
                </Link>
                <div className="flex flex-col flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <Link
                        href={`/makers/${review.author.username}`}
                        className="text-[14px] font-bold text-foreground hover:underline leading-tight"
                      >
                        {review.author.displayName}
                      </Link>
                      <Stars value={review.rating} size="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[12px] font-medium text-muted-foreground shrink-0">
                      {new Date(review.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-[15px] text-foreground font-medium mt-3 leading-relaxed">
                    {review.body}
                  </p>
                  {review.own && (
                    <button
                      type="button"
                      onClick={() => remove(review.id)}
                      disabled={deleting === review.id}
                      className="mt-2 self-start text-[11px] font-bold text-muted-foreground hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {deleting === review.id ? "Suppression…" : "Supprimer mon avis"}
                    </button>
                  )}
                  {isMaker && !review.makerResponse && (
                    <MakerResponseForm productId={productId} slug={slug} reviewId={review.id} />
                  )}
                </div>
              </div>

              {review.makerResponse && (
                <div className="mt-5 ml-2 md:ml-[60px] flex flex-col gap-4 border-l-[3px] border-amber-500/40 pl-5 md:pl-6">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-600 dark:text-amber-400">
                      Réponse de l&apos;auteur
                    </span>
                    <div className="h-px flex-1 bg-amber-500/15" />
                  </div>
                  <p className="text-[14px] text-muted-foreground font-medium leading-relaxed">
                    {review.makerResponse}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
