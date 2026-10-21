/**
 * Identité d'un build APK (module PUR — aucun import serveur).
 *
 * Why: ce calcul est utilisé par la fiche de revue admin, qui est un
 * composant CLIENT. Il ne peut donc pas importer `@/services/builds.service`
 * (qui tire la connexion Postgres → `fs`/`net` → build cassé). Le
 * calcul vit ici, sans dépendance.
 *
 * Le cas grave : un APK d'une AUTRE application. Il se parse, il se
 * signe, il s'affiche — seul son `package` le distingue. Sans ce
 * signal, un admin approuve en comparant le numéro de version, et le
 * binaire erroné remplace le téléchargement de la fiche.
 *
 * `certChanged` = rotation de clé (légitime parfois : clé perdue,
 * migration) → signal d'alerte, l'admin tranche.
 * `packageChanged` = autre application → refus.
 */
export function diffBuildIdentity(
  build: { certSha256?: string | null; package?: string | null },
  online: { certSha256?: string | null; package?: string | null } | null | undefined,
): { certChanged: boolean; packageChanged: boolean } {
  if (!online) return { certChanged: false, packageChanged: false };
  return {
    certChanged: Boolean(
      online.certSha256 && build.certSha256 && online.certSha256 !== build.certSha256,
    ),
    packageChanged: Boolean(online.package && build.package && online.package !== build.package),
  };
}
