"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AvatarImage } from "@/components/ui/avatar-image";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CaretUpIcon,
  CaretDownIcon,
  ArrowBendDownRightIcon,
  PaperPlaneRightIcon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { CommentItem } from "@/services/feedback.service";
import {
  deleteCommentAction,
  submitCommentAction,
  voteCommentAction,
} from "@/app/actions/feedback";

function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function Composer({
  productId,
  slug,
  parentId,
  autoFocus,
  placeholder,
  onDone,
}: {
  productId: string;
  slug: string;
  parentId: string | null;
  autoFocus?: boolean;
  placeholder: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const send = async () => {
    if (text.trim() === "") return;
    setPending(true);
    setError(null);
    const res = await submitCommentAction({ productId, slug, body: text.trim(), parentId });
    setPending(false);
    if (!res.ok) {
      setError(res.message ?? "Envoi impossible.");
      return;
    }
    setText("");
    onDone?.();
    router.refresh();
  };

  return (
    <div className="flex-1 flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        autoFocus={autoFocus}
        placeholder={placeholder}
        rows={parentId ? 2 : 3}
        maxLength={1000}
        className="w-full resize-none rounded-2xl bg-muted/30 border border-border/40 focus:border-border focus:bg-muted/50 px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none transition-all font-medium"
      />
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground font-medium">
          {error ?? "Soyez respectueux et constructif."}
        </p>
        <button
          type="button"
          onClick={send}
          disabled={text.trim() === "" || pending}
          className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-full text-[13px] font-bold hover:opacity-80 transition-opacity disabled:opacity-30 cursor-pointer"
        >
          <PaperPlaneRightIcon weight="fill" className="w-3.5 h-3.5" />
          {pending ? "Envoi…" : "Publier"}
        </button>
      </div>
    </div>
  );
}

function VotePill({
  productId,
  slug,
  comment,
}: {
  productId: string;
  slug: string;
  comment: CommentItem;
}) {
  const router = useRouter();
  const [score, setScore] = React.useState(comment.score);
  const [myVote, setMyVote] = React.useState(comment.myVote);
  const [pending, setPending] = React.useState(false);

  const vote = async (value: "up" | "down") => {
    if (pending) return;
    setPending(true);
    const res = await voteCommentAction({ productId, slug, commentId: comment.id, value });
    setPending(false);
    if (res.ok) {
      setMyVote(res.voted ?? null);
      setScore(res.score ?? score);
    }
    router.refresh();
  };

  return (
    <div className="flex items-center bg-muted/40 rounded-full p-0.5">
      <button
        type="button"
        onClick={() => vote("up")}
        aria-label="Vote positif"
        aria-pressed={myVote === "up"}
        className="p-1.5 hover:bg-background rounded-full transition-colors group cursor-pointer"
      >
        <CaretUpIcon
          weight="bold"
          className={cn(
            "w-3 h-3 transition-colors",
            myVote === "up"
              ? "text-emerald-500"
              : "text-muted-foreground group-hover:text-emerald-500",
          )}
        />
      </button>
      <span className="text-[10px] font-black text-foreground px-1 tabular-nums">{score}</span>
      <button
        type="button"
        onClick={() => vote("down")}
        aria-label="Vote négatif"
        aria-pressed={myVote === "down"}
        className="p-1.5 hover:bg-background rounded-full transition-colors group cursor-pointer"
      >
        <CaretDownIcon
          weight="bold"
          className={cn(
            "w-3 h-3 transition-colors",
            myVote === "down" ? "text-red-500" : "text-muted-foreground group-hover:text-red-500",
          )}
        />
      </button>
    </div>
  );
}

function CommentRow({
  productId,
  slug,
  comment,
  makerUsername,
  depth,
}: {
  productId: string;
  slug: string;
  comment: CommentItem;
  makerUsername: string;
  depth: number;
}) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const isMaker = comment.author.username === makerUsername;

  const remove = async () => {
    setDeleting(true);
    await deleteCommentAction({ productId, slug, commentId: comment.id });
    setDeleting(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 items-start">
        <Link
          href={`/makers/${comment.author.username}`}
          className="shrink-0 hover:opacity-75 transition-opacity"
        >
          <AvatarImage src={comment.author.avatarUrl} name={comment.author.displayName} size={36} />
        </Link>
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Link
                href={`/makers/${comment.author.username}`}
                className="text-[14px] font-bold text-foreground hover:underline"
              >
                {comment.author.displayName}
              </Link>
              {isMaker && (
                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md ring-1 ring-inset ring-emerald-500/20">
                  Maker
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">{dateFr(comment.createdAt)}</span>
          </div>
          <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">
            {comment.body}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <VotePill productId={productId} slug={slug} comment={comment} />
            {depth === 0 && (
              <button
                type="button"
                onClick={() => setReplyOpen((o) => !o)}
                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest cursor-pointer"
              >
                <ArrowBendDownRightIcon weight="bold" className="w-3.5 h-3.5" />
                Répondre
              </button>
            )}
            {comment.own && (
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="text-[11px] font-bold text-muted-foreground hover:text-red-600 transition-colors uppercase tracking-widest cursor-pointer disabled:opacity-50"
              >
                {deleting ? "…" : "Supprimer"}
              </button>
            )}
          </div>
          {depth === 0 && replyOpen && (
            <div className="flex gap-3 items-start mt-2">
              <Composer
                productId={productId}
                slug={slug}
                parentId={comment.id}
                autoFocus
                placeholder={`Répondre à ${comment.author.displayName}…`}
                onDone={() => setReplyOpen(false)}
              />
            </div>
          )}
        </div>
      </div>

      {comment.replies.length > 0 && (
        <div className="ml-12 flex flex-col gap-3 border-l-2 border-border/20 pl-4">
          {comment.replies.map((reply) => (
            <CommentRow
              key={reply.id}
              productId={productId}
              slug={slug}
              comment={reply}
              makerUsername={makerUsername}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ProductComments({
  productId,
  slug,
  makerUsername,
  signedIn,
  viewerAvatarUrl,
  viewerDisplayName,
  initial,
}: {
  productId: string;
  slug: string;
  makerUsername: string;
  signedIn: boolean;
  viewerAvatarUrl: string | null;
  viewerDisplayName: string;
  initial: CommentItem[];
}) {
  const total = initial.reduce((acc, c) => acc + 1 + c.replies.length, 0);
  return (
    <div className="flex flex-col gap-8 pt-10 border-t border-border/40" id="comments">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-extrabold tracking-tight">Commentaires</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-muted text-[11px] font-black text-muted-foreground tabular-nums">
            {total}
          </span>
        </div>
        <p className="text-[13px] font-medium text-muted-foreground max-w-lg">
          Les commentaires sont pour les{" "}
          <strong className="text-foreground">
            questions techniques, suggestions et retours informels
          </strong>{" "}
          au maker. Pour noter l&apos;expérience globale du produit, utilisez la section{" "}
          <a
            href="#reviews"
            className="text-foreground underline underline-offset-2 hover:text-primary transition-colors"
          >
            Avis
          </a>
          .
        </p>
      </div>

      {signedIn ? (
        <div className="flex gap-3 items-start">
          <AvatarImage
            src={viewerAvatarUrl}
            name={viewerDisplayName}
            size={36}
            className="mt-0.5"
          />
          <Composer
            productId={productId}
            slug={slug}
            parentId={null}
            placeholder="Posez une question au maker, signalez un bug, ou suggérez une amélioration..."
          />
        </div>
      ) : (
        <p className="text-[14px] font-medium text-muted-foreground">
          <Link href="/signin" className="font-bold text-foreground underline underline-offset-4">
            Connectez-vous
          </Link>{" "}
          pour commenter.
        </p>
      )}

      {total === 0 ? (
        <EmptyState
          size="sm"
          title="Aucun commentaire pour le moment."
          description="Lancez la discussion."
        />
      ) : (
        <div className="flex flex-col gap-6">
          {initial.map((comment) => (
            <CommentRow
              key={comment.id}
              productId={productId}
              slug={slug}
              comment={comment}
              makerUsername={makerUsername}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
