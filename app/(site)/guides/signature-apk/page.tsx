import type { Metadata } from "next";
import Link from "next/link";
import { DocLayout } from "@/components/ui/doc-layout";
import { Prose } from "@/components/ui/prose";
import { siteUrl } from "@/lib/site-url";
import { getGuideDoc, SIGNATURE_APK_GUIDE_META, SIGNATURE_APK_GUIDE_SLUGS } from "@/lib/guides";

const PAGE = "/guides/signature-apk";
const TITLE = "Signer son APK release — guides pas-à-pas | Mada-Made";
const DESCRIPTION =
  "Signez votre APK en v1, v2 et v3 pour Android natif, Flutter, React Native, Expo ou Capacitor : keystore, config Gradle, vérification apksigner, dépannage.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${siteUrl()}${PAGE}` },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${siteUrl()}${PAGE}`,
    type: "article",
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

/**
 * Enfant → chemin public : le slug meta `signature-apk-android` devient
 * `/guides/signature-apk/android` (URL courte, sans préfixe interne).
 */
function childHref(slug: string): string {
  return `${PAGE}/${slug.replace("signature-apk-", "")}`;
}

async function getDoc() {
  const doc = await getGuideDoc("signature-apk");
  if (!doc) throw new Error("Contenu signature-apk manquant");
  return doc;
}

/**
 * Hub signature APK (contenu `content/guides/signature-apk.md`, sommaire
 * auto). Les renvois portent les logos officiels des frameworks — même
 * mécanique que les renvois providers des guides revenus.
 */
export default async function SignatureApkGuidePage() {
  const doc = await getDoc();
  return (
    <DocLayout
      eyebrow="Guides makers · Signature APK"
      title="Signer son APK release"
      description={DESCRIPTION}
      updated="2026-10-17"
      headings={doc.headings}
      siblings={SIGNATURE_APK_GUIDE_SLUGS.filter((s) => s !== "signature-apk").map((slug) => ({
        href: childHref(slug),
        label: SIGNATURE_APK_GUIDE_META[slug].label,
        logo: SIGNATURE_APK_GUIDE_META[slug].logo,
        logoDarkInvert: SIGNATURE_APK_GUIDE_META[slug].dark,
      }))}
      footer={
        <p className="text-[14px] font-medium text-muted-foreground">
          APK signé en main ?{" "}
          <Link
            href="/products/submit"
            className="font-bold text-foreground underline underline-offset-4"
          >
            Publiez votre produit
          </Link>
          .
        </p>
      }
    >
      <Prose headingIds>{doc.markdown}</Prose>
    </DocLayout>
  );
}
