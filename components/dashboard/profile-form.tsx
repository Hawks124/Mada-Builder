"use client";

import * as React from "react";
import {
  EyeIcon,
  GithubLogoIcon,
  XLogoIcon,
  FacebookLogoIcon,
  InstagramLogoIcon,
  LinkedinLogoIcon,
  TiktokLogoIcon,
  WhatsappLogoIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { InputField } from "@/components/ui/input-field";
import { ProfileOccupation } from "@/components/dashboard/profile-occupation";
import { AvatarImage } from "@/components/ui/avatar-image";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { registerUnsavedChecker } from "@/lib/unsaved-guard";
import { AvatarCropDialog } from "@/components/dashboard/avatar-crop-dialog";
import {
  updateMyProfile,
  uploadMyAvatar,
  type ProfileActionState,
} from "@/app/actions/profile";

const SOCIALS = [
  { id: "github", label: "GitHub", icon: GithubLogoIcon },
  { id: "x", label: "X / Twitter", icon: XLogoIcon },
  { id: "facebook", label: "Facebook", icon: FacebookLogoIcon },
  { id: "instagram", label: "Instagram", icon: InstagramLogoIcon },
  { id: "linkedin", label: "LinkedIn", icon: LinkedinLogoIcon },
  { id: "tiktok", label: "TikTok", icon: TiktokLogoIcon },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsappLogoIcon },
] as const;

const PROFILE_TIPS = [
  "Photo carrée et lisible, même en miniature.",
  "Occupation honnête — elle s'affiche en badge public.",
  "Localisation : la ville suffit. Elle ancre vos produits dans leur marché (délais, mobile money, langue) et nourrit la fierté locale — jamais d'adresse exacte.",
  "Bio courte (160 caractères) : qui vous aide, et en quoi.",
  "Liens vérifiés uniquement — ils apparaissent en public.",
];

// Miroir de AVATAR_MAX_INPUT_BYTES (services/users.service.ts) — la source
// de vérité reste le service, jamais ce chiffre.
const AVATAR_MAX_INPUT_BYTES = 10 * 1024 * 1024;

export type ProfileInitial = {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  occupation: string;
  websiteUrl: string | null;
  location: string;
  socialLinks: Record<string, string>;
};

function FormMessage({ state }: { state: ProfileActionState }) {
  if (!state.message) return null;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={
        state.ok
          ? "text-[13px] font-bold text-emerald-600 dark:text-emerald-400"
          : "text-[13px] font-bold text-red-600 dark:text-red-400"
      }
    >
      {state.message}
    </p>
  );
}

// Formulaire profil câblé (Server Actions) — mêmes sections que la maquette :
// avatar, identité, réseaux. Valeurs initiales serveur (mock si pas de
// backend : la sauvegarde répond "Connectez-vous", jamais de crash).
export function ProfileForm({ initial }: { initial: ProfileInitial }) {
  const [saveState, saveAction, savePending] = React.useActionState(
    updateMyProfile,
    { ok: false, message: null },
  );
  const [avatarState, avatarAction, avatarPending] = React.useActionState(
    uploadMyAvatar,
    { ok: false, message: null } as ProfileActionState & {
      avatarUrl?: string;
    },
  );
  const [preview, setPreview] = React.useState<string | null>(null);
  const [clientError, setClientError] = React.useState<string | null>(null);
  // Fichier brut en cours de cadrage (dialog) — jamais envoyé tel quel.
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const avatarFormRef = React.useRef<HTMLFormElement>(null);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  // Garde anti-double-toast (le message succès est constant).
  const lastAvatarToast = React.useRef<string | null>(null);
  const currentAvatar = preview ?? avatarState.avatarUrl ?? initial.avatarUrl;

  // Succès avatar → toast partagé (l'erreur reste inline : contexte retry).
  React.useEffect(() => {
    if (
      avatarState.ok &&
      avatarState.message &&
      lastAvatarToast.current !== avatarState.message
    ) {
      lastAvatarToast.current = avatarState.message;
      toast("ok", avatarState.message);
    }
  }, [avatarState]);

  // Modifications non enregistrées : bouton verrouillé tant que propre,
  // dialogue natif sur refresh/fermeture/lien externe quand sale.
  // Limite honnête : le retour in-app (SPA) n'est pas interceptable
  // proprement en App Router — pas de hack history, que du natif.
  const [dirty, setDirty] = React.useState(false);
  // Miroir ref pour la garde in-app (closure stable, valeur fraîche).
  const dirtyRef = React.useRef(false);
  React.useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  React.useEffect(() => registerUnsavedChecker(() => dirtyRef.current), []);
  React.useEffect(() => {
    if (saveState.ok) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirty(false);
    }
  }, [saveState]);
  React.useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Profil"
        subtitle="Votre vitrine publique de maker — nom, bio et liens."
        actions={
          <ActionButton
            href={`/makers/${initial.username}`}
            variant="outline"
            isFullWidthOnMobile={false}
            className="h-11! px-6! text-[14px]!"
          >
            <EyeIcon weight="bold" className="h-4 w-4" />
            Voir mon profil public
          </ActionButton>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-12 items-start">
        <div className="flex flex-col gap-10 min-w-0">
          {/* Avatar — choix du fichier = envoi immédiat (un seul geste). */}
          <form
            ref={avatarFormRef}
            action={avatarAction}
            className="flex items-center gap-6"
          >
            {currentAvatar ? (
              <AvatarImage
                src={currentAvatar}
                name={initial.displayName}
                size={80}
              />
            ) : (
              <span
                aria-hidden="true"
                className="h-20 w-20 rounded-full bg-[#EA580C] flex items-center justify-center text-white font-bold text-2xl shrink-0"
              >
                {initial.displayName.slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className="flex flex-col gap-2">
              <label
                htmlFor="avatar-file"
                className="self-start inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-foreground text-background text-[13px] font-bold hover:opacity-80 transition-opacity cursor-pointer"
              >
                {avatarPending && <Spinner size="xs" />}
                {avatarPending ? "Envoi en cours…" : "Changer l'avatar"}
              </label>
              <input
                id="avatar-file"
                ref={avatarInputRef}
                name="avatar"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                required
                disabled={avatarPending}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  // Garde client (miroir AVATAR_MAX_INPUT_BYTES du service) :
                  // rejet immédiat sans requête — le body 12 Mo Next ne doit
                  // jamais être atteint pour un fichier trop lourd.
                  if (file.size > AVATAR_MAX_INPUT_BYTES) {
                    e.target.value = "";
                    setClientError(
                      "Fichier trop lourd — 10 Mo maximum.",
                    );
                    return;
                  }
                  setClientError(null);
                  lastAvatarToast.current = null;
                  // Cadrage d'abord : l'envoi part au Valider du dialogue.
                  setPreview((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(file);
                  });
                  setCropSrc((prev) => {
                    if (prev) URL.revokeObjectURL(prev);
                    return URL.createObjectURL(file);
                  });
                }}
              />
              <p className="text-[12px] font-medium text-muted-foreground">
                PNG, JPG ou WebP — carré, max 10 Mo (compressée à l&apos;envoi).
              </p>
              {clientError && (
                <p
                  role="alert"
                  className="text-[13px] font-bold text-red-600 dark:text-red-400"
                >
                  {clientError}
                </p>
              )}
              {/* Erreurs inline (contexte retry) ; succès → toast partagé. */}
              {!avatarState.ok && <FormMessage state={avatarState} />}
            </div>
          </form>

          {/* Cadrage : Valider injecte le crop et envoie (un seul geste utile) */}
          {cropSrc && (
            <AvatarCropDialog
              imageSrc={cropSrc}
              onCancel={() => {
                setCropSrc((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
                setPreview(null);
                if (avatarInputRef.current) avatarInputRef.current.value = "";
              }}
              onValidate={(file) => {
                setCropSrc((prev) => {
                  if (prev) URL.revokeObjectURL(prev);
                  return null;
                });
                const input = avatarInputRef.current;
                const form = avatarFormRef.current;
                if (!input || !form) return;
                const transfer = new DataTransfer();
                transfer.items.add(file);
                input.files = transfer.files;
                form.requestSubmit();
              }}
            />
          )}

          <div className="w-full h-px bg-border/40" />

          {/* Identity */}
          <form
            action={saveAction}
            onChange={() => setDirty(true)}
            className="flex flex-col gap-6"
          >
            <InputField
              label="Nom d'affichage"
              subtitle="Visible sur votre page maker et vos fiches."
              placeholder="Kaliana R."
              name="displayName"
              required
              minLength={2}
              maxLength={50}
              defaultValue={initial.displayName}
            />
            <ProfileOccupation defaultValue={initial.occupation} />
            <div className="flex flex-col gap-2">
              <label
                htmlFor="profile-bio"
                className="text-[14px] font-bold text-foreground"
              >
                Bio
              </label>
              <textarea
                id="profile-bio"
                name="bio"
                rows={4}
                maxLength={160}
                placeholder="Qui êtes-vous, que construisez-vous ?"
                defaultValue={initial.bio ?? ""}
                className="w-full bg-background border border-border/60 rounded-2xl px-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none resize-none leading-relaxed focus:border-foreground/40 hover:border-foreground/20 transition-colors"
              />
              <span className="text-[12px] font-medium text-muted-foreground leading-relaxed">
                160 caractères max, affichée sous votre nom.
              </span>
            </div>
            <InputField
              label="Site web"
              placeholder="https://votre-site.com"
              name="websiteUrl"
              type="url"
              defaultValue={initial.websiteUrl ?? ""}
            />
            <InputField
              label="Localisation"
              subtitle="Ville, Pays — affichée sur votre profil public."
              placeholder="Antananarivo, Madagascar"
              name="location"
              defaultValue={initial.location}
            />

            <div className="w-full h-px bg-border/40" />

            {/* Socials — logo + label + URL */}
            <div className="flex flex-col gap-4">
              <h2 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
                Réseaux
              </h2>
              {SOCIALS.map((social) => (
                <div key={social.id} className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-xl bg-muted/40 border border-border/40 flex items-center justify-center shrink-0">
                    <social.icon
                      weight="fill"
                      className="w-5 h-5 text-muted-foreground"
                    />
                  </div>
                  <div className="flex flex-col min-w-0 w-28 sm:w-32 shrink-0">
                    <span className="text-[14px] font-bold text-foreground leading-tight">
                      {social.label}
                    </span>
                    <span className="text-[11px] font-medium text-muted-foreground leading-tight truncate">
                      URL du profil
                    </span>
                  </div>
                  <input
                    type="url"
                    name={`social:${social.id}`}
                    placeholder="https://…"
                    defaultValue={initial.socialLinks[social.id] ?? ""}
                    className="flex-1 min-w-0 bg-background border border-border/60 rounded-2xl px-4 py-3 text-[14px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none focus:border-foreground/40 hover:border-foreground/20 transition-colors"
                  />
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-4 pt-2">
              <FormMessage state={saveState} />
              <button
                type="submit"
                disabled={savePending || !dirty}
                title={dirty ? undefined : "Modifiez un champ pour enregistrer"}
                className="h-12 px-8 rounded-full bg-foreground text-background text-[15px] font-bold hover:opacity-90 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {savePending && <Spinner size="sm" />}
                {savePending ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>

        {/* Guidance aside */}
        <aside className="hidden lg:flex flex-col gap-5 sticky top-8 rounded-3xl border border-border/40 bg-muted/20 p-6">
          <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground">
            Conseils profil
          </h3>
          {PROFILE_TIPS.map((tip) => (
            <div key={tip} className="flex items-start gap-3">
              <CheckCircleIcon
                weight="fill"
                className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"
              />
              <p className="text-[13px] font-medium text-muted-foreground leading-relaxed">
                {tip}
              </p>
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
