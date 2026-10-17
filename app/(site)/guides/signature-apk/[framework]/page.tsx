import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocLayout } from "@/components/ui/doc-layout";
import { Prose } from "@/components/ui/prose";
import { siteUrl } from "@/lib/site-url";
import {
  getGuideDoc,
  SIGNATURE_APK_GUIDE_META,
  SIGNATURE_APK_GUIDE_SLUGS,
  type SignatureApkGuideSlug,
} from "@/lib/guides";

type Params = { framework: string };

const CHILD_SLUGS = SIGNATURE_APK_GUIDE_SLUGS.filter((s) => s !== "signature-apk");

/** Résout le segment d'URL en slug de fiche, ou renvoie undefined s'il est inconnu. */
const slugFor = (framework: string): SignatureApkGuideSlug | undefined =>
  CHILD_SLUGS.find((s) => s === `signature-apk-${framework}`);

const HUB = "/guides/signature-apk";

/** Descriptions SEO FR par fiche (title + description OG). */
const META: Partial<Record<SignatureApkGuideSlug, { title: string; description: string }>> = {
  "signature-apk-android": {
    title: "Android natif — signer son APK release | Mada-Made",
    description:
      "Keystore, keystore.properties, signingConfigs Kotlin DSL + Groovy avec v1/v2/v3, build release, vérification apksigner.",
  },
  "signature-apk-flutter": {
    title: "Flutter — signer son APK release | Mada-Made",
    description:
      "key.properties, les deux DSL Gradle, sortie du signingConfig debug, flutter clean, build apk --release, vérification apksigner.",
  },
  "signature-apk-react-native": {
    title: "React Native — signer son APK release | Mada-Made",
    description:
      "gradle.properties MYAPP_UPLOAD_*, signingConfigs avec garde hasProperty, assembleRelease, vérification apksigner.",
  },
  "signature-apk-expo": {
    title: "Expo — signer son APK release | Mada-Made",
    description:
      "EAS Build (géré) ou credentials.json local, eas.json buildType apk, eas credentials pour récupérer le keystore, cas expo prebuild.",
  },
  "signature-apk-capacitor": {
    title: "Capacitor — signer son APK release | Mada-Made",
    description:
      "keystore.properties, signingConfigs Gradle, npx cap build avec --signing-type apksigner (jarsigner = v1 seulement), vérification apksigner.",
  },
  "signature-apk-depannage": {
    title: "Signer son APK : vérifier et dépanner | Mada-Made",
    description:
      "Lire apksigner verify --print-certs, décoder les refus de la plateforme, clé de debug, keystore perdu, JKS vers PKCS12.",
  },
};

/** Énumère les segments d'URL des fiches à pré-générer, sans le hub. */
export function generateStaticParams(): Params[] {
  return CHILD_SLUGS.map((s) => ({ framework: s.replace("signature-apk-", "") }));
}

/** Métadonnées SEO de la fiche ; désactive l'indexation pour un segment inconnu. */
export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { framework } = await params;
  const slug = slugFor(framework);
  const meta = slug ? META[slug] : undefined;
  if (!slug || !meta) return { robots: { index: false, follow: false } };
  const url = `${siteUrl()}${HUB}/${framework}`;
  return {
    title: meta.title,
    description: meta.description,
    alternates: { canonical: url },
    openGraph: {
      title: meta.title,
      description: meta.description,
      url,
      type: "article",
    },
    twitter: { card: "summary", title: meta.title, description: meta.description },
  };
}

/** Fiche framework (contenu `content/guides/`, sommaire auto, ancres stables). */
export default async function SignatureApkFrameworkPage({ params }: { params: Promise<Params> }) {
  const { framework } = await params;
  const slug = slugFor(framework);
  if (!slug) notFound();
  const doc = await getGuideDoc(slug);
  if (!doc) notFound();
  const current = SIGNATURE_APK_GUIDE_META[slug];
  return (
    <DocLayout
      eyebrow={`Guides makers · Signature APK · ${current.label}`}
      title={`${current.label} — signer son APK release`}
      updated="2026-10-17"
      headings={doc.headings}
      siblings={[
        { href: HUB, label: "Vue d'ensemble" },
        ...CHILD_SLUGS.filter((s) => s !== slug).map((s) => ({
          href: `${HUB}/${s.replace("signature-apk-", "")}`,
          label: SIGNATURE_APK_GUIDE_META[s].label,
          logo: SIGNATURE_APK_GUIDE_META[s].logo,
          logoDarkInvert: SIGNATURE_APK_GUIDE_META[s].dark,
        })),
      ]}
      footer={
        <p className="text-[14px] font-medium text-muted-foreground">
          Vérifié avec <code className="font-mono text-[12px]">apksigner</code> ?{" "}
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
