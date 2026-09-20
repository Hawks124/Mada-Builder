"use client";
import * as React from "react";
import { useSearchParams } from "next/navigation";
import { SubmitGuidanceSidebar } from "@/components/submit/submit-guidance-sidebar";
import { SubmitBasicsSection } from "@/components/submit/submit-basics-section";
import { SubmitCategoriesSection } from "@/components/submit/submit-categories-section";
import { SubmitMetadataSection } from "@/components/submit/submit-metadata-section";
import { SubmitMediaSection } from "@/components/submit/submit-media-section";
import { SubmitLinksSection } from "@/components/submit/submit-links-section";
import {
  SubmitFormProvider,
  useSubmitForm,
} from "@/components/submit/submit-form-context";
import { ActionButton } from "@/components/ui/action-button";

function SubmitForm() {
  const { isEditing, editApp } = useSubmitForm();

  return (
    <main className="min-h-screen bg-background relative selection:bg-foreground selection:text-background">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight text-foreground">
            {isEditing ? "Modifier le produit" : "Soumettre un produit"}
          </h1>
          <p className="text-lg md:text-xl font-medium text-muted-foreground max-w-2xl">
            {isEditing && editApp
              ? `Modifiez la fiche de ${editApp.name}. Les changements sur le nom et les liens repassent en revue.`
              : "Ajoutez votre application pour que la communauté de makers de Madagascar puisse la découvrir et la soutenir."}
          </p>
        </div>
      </div>

      {/* ── 2-Column Layout (70 / 30) ── */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">
          {/* Main Form (70%) */}
          <div className="lg:col-span-8 flex flex-col gap-24">
            <SubmitBasicsSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitCategoriesSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitLinksSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitMetadataSection />
            <div className="w-full h-px bg-border/40" />

            <SubmitMediaSection />

            {/* Bottom Actions */}
            <div className="flex items-center justify-end gap-4 pt-8">
              <button className="px-6 h-12 bg-muted/30 text-foreground hover:bg-muted/60 rounded-full text-[15px] font-bold tracking-wide transition-colors cursor-pointer">
                Enregistrer le brouillon
              </button>
              <ActionButton className="h-12 px-8">
                {isEditing ? "Enregistrer les modifications" : "Publier le produit"}
              </ActionButton>
            </div>
          </div>

          {/* Sticky Sidebar (30%) */}
          <div className="lg:col-span-4 hidden lg:block">
            <SubmitGuidanceSidebar />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function SubmitProductPage() {
  return (
    <React.Suspense
      fallback={
        <main className="min-h-screen bg-background flex items-center justify-center">
          <p className="text-muted-foreground font-medium">
            Chargement du formulaire…
          </p>
        </main>
      }
    >
      <SubmitWithParams />
    </React.Suspense>
  );
}

function SubmitWithParams() {
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");

  return (
    <SubmitFormProvider editId={editId} key={editId ?? "new"}>
      <SubmitForm />
    </SubmitFormProvider>
  );
}
