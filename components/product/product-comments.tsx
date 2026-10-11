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
  PencilSimpleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { cn, timeAgoFr } from "@/lib/utils";
import { toast } from "@/components/ui/toast";
import { Spinner } from "@/components/ui/spinner";
import { useVoteWall } from "@/components/votes/use-vote-wall";
import type { CommentItem } from "@/services/feedback.service";
import {
  deleteCommentAction,
  submitCommentAction,
  updateCommentAction,
  voteCommentAction,
} from "@/app/actions/feedback";

function dateFr(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/** « modifié il y a X » — stricte supériorité (insert met les deux au même instant). */
function isEdited(c: CommentItem): boolean {
  return new Date(c.updatedAt).getTime() > new Date(c.createdAt).getTime();
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
          {pending ? (
            <Spinner size="xs" />
          ) : (
            <PaperPlaneRightIcon weight="fill" className="w-3.5 h-3.5" />
          )}
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
  // Mur auth (même règle que les votes produit) : sans session → vote
  // mis en attente + /signin?next=, jamais un clic mort et silencieux.
  const guardedVote = useVoteWall();

  // Optimiste : état immédiat, rollback silencieux + resync si échec.
  const vote = async (value: "up" | "down") => {
    if (pending) return;
    await guardedVote(async () => {
      const prevVote = myVote;
      const prevScore = score;
      const next = myVote === value ? null : value;
      setMyVote(next);
      setScore(
        prevScore +
          (next === "up" ? 1 : 0) -
          (next === "down" ? 1 : 0) -
          (prevVote === "up" ? 1 : 0) +
          (prevVote === "down" ? 1 : 0),
      );
      setPending(true);
      const res = await voteCommentAction({ productId, slug, commentId: comment.id, value });
      setPending(false);
      if (!res.ok) {
        setMyVote(prevVote);
        setScore(prevScore);
        router.refresh();
        return;
      }
      if (res.score !== undefined) setScore(res.score);
      if (res.voted !== undefined) setMyVote(res.voted);
      router.refresh();
    });
  };

  return (
    <div
      aria-busy={pending}
      className="flex items-center bg-muted/40 rounded-full p-0.5 min-w-[76px] justify-center"
    >
      <button
        type="button"
        onClick={() => vote("up")}
        disabled={pending}
        aria-label="Vote positif"
        aria-pressed={myVote === "up"}
        className="p-1.5 hover:bg-background rounded-full transition-colors group cursor-pointer disabled:cursor-default"
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
      {pending ? (
        <Spinner size="xs" className="px-1 text-muted-foreground" />
      ) : (
        <span className="text-[10px] font-black text-foreground px-1 tabular-nums">{score}</span>
      )}
      <button
        type="button"
        onClick={() => vote("down")}
        disabled={pending}
        aria-label="Vote négatif"
        aria-pressed={myVote === "down"}
        className="p-1.5 hover:bg-background rounded-full transition-colors group cursor-pointer disabled:cursor-default"
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
  signedIn,
}: {
  productId: string;
  slug: string;
  comment: CommentItem;
  makerUsername: string;
  depth: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [gone, setGone] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(comment.body);
  const [body, setBody] = React.useState(comment.body);
  const [saving, setSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);
  const [editedNow, setEditedNow] = React.useState(false);
  const isMaker = comment.author.username === makerUsername;
  const edited = editedNow || isEdited(comment);

  // Delete optimiste : retrait immédiat, retour + toast si échec.
  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setGone(true);
    const res = await deleteCommentAction({ productId, slug, commentId: comment.id });
    setDeleting(false);
    if (!res.ok) {
      setGone(false);
      toast("err", res.message ?? "Suppression impossible.");
      return;
    }
    router.refresh();
  };

  const saveEdit = async () => {
    const clean = draft.trim();
    if (clean === "" || clean === body) {
      setEditing(false);
      setDraft(body);
      return;
    }
    setSaving(true);
    setEditError(null);
    const res = await updateCommentAction({
      productId,
      slug,
      commentId: comment.id,
      body: clean,
    });
    setSaving(false);
    if (!res.ok) {
      setEditError(res.message ?? "Modification impossible.");
      return;
    }
    setBody(clean);
    setDraft(clean);
    setEditedNow(true);
    setEditing(false);
    router.refresh();
  };

  if (gone) return null;

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
            <span className="text-[11px] text-muted-foreground shrink-0">
              {dateFr(comment.createdAt)}
              {edited && (
                <span title="Commentaire modifié après publication">
                  {" "}
                  · modifié {editedNow ? "à l'instant" : timeAgoFr(comment.updatedAt)}
                </span>
              )}
            </span>
          </div>
          {editing ? (
            <div className="flex flex-col gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                autoFocus
                rows={3}
                maxLength={1000}
                className="w-full resize-none rounded-2xl bg-muted/30 border border-border/60 focus:border-foreground/40 px-4 py-3 text-[14px] text-foreground outline-none transition-all font-medium"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={saving || draft.trim() === ""}
                  className="flex items-center gap-2 rounded-full bg-foreground px-4 py-1.5 text-[12px] font-bold text-background hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
                >
                  {saving && <Spinner size="xs" />}
                  {saving ? "Enregistrement…" : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setDraft(body);
                    setEditError(null);
                  }}
                  disabled={saving}
                  className="text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Annuler
                </button>
              </div>
              {editError && (
                <p role="alert" className="text-[12px] font-bold text-red-600 dark:text-red-400">
                  {editError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[14px] font-medium text-muted-foreground leading-relaxed">{body}</p>
          )}
          <div className="flex items-center gap-3 mt-1">
            <VotePill productId={productId} slug={slug} comment={comment} />
            {depth === 0 &&
              (signedIn ? (
                <button
                  type="button"
                  onClick={() => setReplyOpen((o) => !o)}
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-bold transition-colors uppercase tracking-widest cursor-pointer",
                    replyOpen
                      ? "text-red-600 dark:text-red-400 hover:text-red-500"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {replyOpen ? (
                    <XIcon weight="bold" className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowBendDownRightIcon weight="bold" className="w-3.5 h-3.5" />
                  )}
                  {replyOpen ? "Annuler" : "Répondre"}
                </button>
              ) : (
                <Link
                  href="/signin"
                  className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
                >
                  <ArrowBendDownRightIcon weight="bold" className="w-3.5 h-3.5" />
                  Répondre
                </Link>
              ))}
            {comment.own && !editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest cursor-pointer"
              >
                <PencilSimpleIcon weight="bold" className="w-3.5 h-3.5" />
                Modifier
              </button>
            )}
            {comment.own && (
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-red-600 transition-colors uppercase tracking-widest cursor-pointer disabled:opacity-70"
              >
                {deleting && <Spinner size="xs" />}
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            )}
          </div>
          {depth === 0 && replyOpen && signedIn && (
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
        // Coudes individuels par réponse (un « L » chacun) : pas de rail
        // continu — la ligne s'arrête à chaque réponse, jamais d'effet
        // « ça continue » après la dernière. Contraste renforcé
        // (l'ancien border-border/30 était invisible sur fond clair).
        <div className="ml-[18px] flex flex-col gap-3">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="relative pl-6">
              <span
                aria-hidden="true"
                className="absolute left-0 top-0 h-[18px] w-6 rounded-bl-xl border-l-2 border-b-2 border-foreground/15 dark:border-border/60"
              />
              <CommentRow
                productId={productId}
                slug={slug}
                comment={reply}
                makerUsername={makerUsername}
                depth={1}
                signedIn={signedIn}
              />
            </div>
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
              signedIn={signedIn}
            />
          ))}
        </div>
      )}
    </div>
  );
}
