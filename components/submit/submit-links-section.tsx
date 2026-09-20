"use client";

import { 
  AppWindowIcon, 
  AppleLogo, 
  GooglePlayLogo, 
  GithubLogo, 
  Browser, 
  LockKey,
  ShieldCheck,
  FileText
} from "@phosphor-icons/react";
import { FieldBadge } from "@/components/ui/field-badge";
import { useSubmitForm } from "@/components/submit/submit-form-context";

export function SubmitLinksSection() {
  const { audience } = useSubmitForm();
  const isKids = audience === "kids";

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-black tracking-tight">Liens & Plateformes</h2>
        <p className="text-[14px] font-medium text-muted-foreground">Où les utilisateurs peuvent-ils trouver et télécharger votre produit ?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        
        {/* Website (Moved from Basics) */}
        <div className="flex flex-col gap-2 relative">
          <label className="text-[13px] font-bold text-foreground flex items-center gap-2">
            Site web officiel
            <FieldBadge variant="required" />
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <Browser weight="bold" className="w-5 h-5" />
            </div>
            <input 
              type="url" 
              placeholder="https://votre-app.com"
              className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow"
            />
          </div>
        </div>

        {/* Apple App Store */}
        <div className="flex flex-col gap-2 relative">
          <label className="text-[13px] font-bold text-foreground flex items-center gap-2">
            Apple App Store
            <FieldBadge variant="optional" />
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <AppleLogo weight="fill" className="w-5 h-5" />
            </div>
            <input 
              type="url" 
              placeholder="https://apps.apple.com/..."
              className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow"
            />
          </div>
        </div>

        {/* Google Play */}
        <div className="flex flex-col gap-2 relative">
          <label className="text-[13px] font-bold text-foreground flex items-center gap-2">
            Google Play Store
            <FieldBadge variant="optional" />
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <GooglePlayLogo weight="fill" className="w-5 h-5" />
            </div>
            <input 
              type="url" 
              placeholder="https://play.google.com/..."
              className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow"
            />
          </div>
        </div>

        {/* GitHub Repository */}
        <div className="flex flex-col gap-2 relative">
          <label className="text-[13px] font-bold text-foreground flex items-center gap-2">
            GitHub (Open Source)
            <FieldBadge variant="optional" />
          </label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
              <GithubLogo weight="fill" className="w-5 h-5" />
            </div>
            <input 
              type="url" 
              placeholder="https://github.com/..."
              className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow"
            />
          </div>
        </div>

      </div>

      <div className="w-full h-px bg-border/40 my-2" />

      {/* Trust & Legal */}
      <div className="flex flex-col gap-6">
        <h3 className="text-sm font-black tracking-widest uppercase text-muted-foreground">Légal et Confiance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <div className="flex flex-col gap-2 relative">
            <label className="text-[13px] font-bold text-foreground flex items-center gap-2">
              Politique de confidentialité
              {isKids ? (
                <FieldBadge variant="required" />
              ) : (
                <FieldBadge variant="optional" />
              )}
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <ShieldCheck weight="fill" className="w-5 h-5" />
              </div>
              <input 
                type="url" 
                placeholder="Lien vers la Privacy Policy"
                className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow"
              />
            </div>
          </div>
          <div className="flex flex-col gap-2 relative">
            <label className="text-[13px] font-bold text-foreground flex items-center gap-2">
              Conditions d&apos;utilisation (ToS)
              <FieldBadge variant="optional" />
            </label>
            <div className="relative">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                <FileText weight="fill" className="w-5 h-5" />
              </div>
              <input 
                type="url" 
                placeholder="Lien vers les Terms of Service"
                className="w-full bg-muted/30 border-none rounded-2xl pl-12 pr-5 py-4 text-[15px] font-medium placeholder:text-muted-foreground/40 text-foreground outline-none ring-1 ring-inset ring-border/50 focus:ring-2 focus:ring-foreground transition-shadow"
              />
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
