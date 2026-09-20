import type { Metadata } from "next";
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
} from "@phosphor-icons/react/dist/ssr";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionButton } from "@/components/ui/action-button";
import { InputField } from "@/components/ui/input-field";
import { ProfileOccupation } from "@/components/dashboard/profile-occupation";

// Auth pages are noindex (§7)
export const metadata: Metadata = {
  title: "Profil",
  robots: { index: false, follow: false },
};

const SOCIALS = [
  { id: "github", label: "GitHub", icon: GithubLogoIcon },
  { id: "x", label: "X / Twitter", icon: XLogoIcon },
  { id: "facebook", label: "Facebook", icon: FacebookLogoIcon },
  { id: "instagram", label: "Instagram", icon: InstagramLogoIcon },
  { id: "linkedin", label: "LinkedIn", icon: LinkedinLogoIcon },
  { id: "tiktok", label: "TikTok", icon: TiktokLogoIcon },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsappLogoIcon },
];

const PROFILE_TIPS = [
  "Photo carrée et lisible, même en miniature.",
  "Occupation honnête — elle s'affiche en badge public.",
  "Localisation : la ville suffit. Elle ancre vos produits dans leur marché (délais, mobile money, langue) et nourrit la fierté locale — jamais d'adresse exacte.",
  "Bio courte (160 caractères) : qui vous aide, et en quoi.",
  "Liens vérifiés uniquement — ils apparaissent en public.",
];

// Public maker profile edition — avatar, occupation, bio, links.
// Reads + mutates the session user once auth lands. The public view
// lives at /makers/[username].
export default function DashboardProfilePage() {
  return (
    <div className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-10">
      <PageHeader
        title="Profil"
        subtitle="Votre vitrine publique de maker — nom, bio et liens."
        actions={
          <ActionButton
            href="/makers/kaliana"
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
        {/* Form */}
        <div className="flex flex-col gap-10 min-w-0">
          {/* Avatar */}
          <div className="flex items-center gap-6">
            <img
              src="https://i.pravatar.cc/150?u=kaliana"
              alt="Kaliana R."
              className="h-20 w-20 rounded-full object-cover shrink-0"
            />
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="self-start px-6 py-2.5 rounded-full bg-foreground text-background text-[13px] font-bold hover:opacity-80 transition-opacity cursor-pointer"
              >
                Changer l&apos;avatar
              </button>
              <p className="text-[12px] font-medium text-muted-foreground">
                PNG, JPG ou WebP — carré, max 2 Mo.
              </p>
            </div>
          </div>

          <div className="w-full h-px bg-border/40" />

          {/* Identity */}
          <div className="flex flex-col gap-6">
            <InputField
              label="Nom d'affichage"
              subtitle="Visible sur votre page maker et vos fiches."
              placeholder="Kaliana R."
              defaultValue="Kaliana R."
            />
            <ProfileOccupation />
            <div className="flex flex-col gap-2">
              <label className="text-[14px] font-bold text-foreground">
                Bio
              </label>
              <textarea
                rows={4}
                placeholder="Qui êtes-vous, que construisez-vous ?"
                defaultValue="Maker malgache — SaaS RH et outils fintech."
                className="w-full bg-background border border-border/60 rounded-2xl px-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none resize-none leading-relaxed focus:border-foreground/40 hover:border-foreground/20 transition-colors"
              />
              <span className="text-[12px] font-medium text-muted-foreground leading-relaxed">
                160 caractères max, affichée sous votre nom.
              </span>
            </div>
            <InputField
              label="Site web"
              placeholder="https://votre-site.com"
            />
            <InputField
              label="Localisation"
              subtitle="Ville, Pays — affichée sur votre profil public."
              placeholder="Antananarivo, Madagascar"
              defaultValue="Antananarivo, Madagascar"
            />
          </div>

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
                  placeholder="https://…"
                  className="flex-1 min-w-0 bg-background border border-border/60 rounded-2xl px-4 py-3 text-[14px] font-medium placeholder:text-muted-foreground/30 text-foreground outline-none focus:border-foreground/40 hover:border-foreground/20 transition-colors"
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4 pt-2">
            <ActionButton className="h-12 px-8">Enregistrer</ActionButton>
          </div>
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
