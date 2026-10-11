import type { ApkCert, ApkManifest } from "@/lib/apk";

/** Champs ligne build suffisants pour un tableau Play (D6). */
export type BuildTableSource = {
  package: string | null;
  versionCode: number | null;
  versionName: string | null;
  minSdk: number | null;
  targetSdk: number | null;
  permissions: string[];
  certSha256: string | null;
  certSha1: string | null;
  sigScheme: string | null;
  certSubjectCn: string | null;
  certSubjectO: string | null;
  certKeyAlg: string | null;
  certKeyBits: number | null;
  certSigAlg: string | null;
};

/**
 * Adaptateur ligne DB → tableau Play (D6, partagé revue admin + update
 * maker) : la ligne porte déjà tout l'affichage. Sans package ni cert
 * (upload D1 brut) → null, l'appelant affiche un bloc brut honnête.
 */
export function toTableInput(b: BuildTableSource): {
  manifest: ApkManifest;
  cert: ApkCert;
} | null {
  if (!b.package || !b.certSha256) return null;
  const debug = b.certSubjectCn === "Android Debug";
  return {
    manifest: {
      package: b.package,
      versionCode: b.versionCode ?? 0,
      versionName: b.versionName ?? "?",
      minSdk: b.minSdk,
      targetSdk: b.targetSdk,
      permissions: b.permissions,
      label: null,
      debuggable: debug,
      iconBase64: null,
    },
    cert: {
      scheme: b.sigScheme === "v1" || b.sigScheme === "v3" ? b.sigScheme : "v2",
      sha256: b.certSha256,
      sha1: b.certSha1 ?? "",
      subjectCn: b.certSubjectCn,
      subjectO: b.certSubjectO,
      issuerCn: null,
      serial: "—",
      validFrom: null,
      validTo: null,
      sigAlg: b.certSigAlg ?? "?",
      keyAlg: b.certKeyAlg ?? "?",
      keyBits: b.certKeyBits,
      debug,
    },
  };
}
