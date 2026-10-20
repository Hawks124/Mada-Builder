"use client";

/**
 * Image markdown — **client**, isolée dans son propre fichier.
 *
 * Pourquoi un fichier à part : `Prose` est un composant SERVEUR (le
 * markdown d'une fiche ne doit pas coûter de JS au chargement). Or un
 * gestionnaire d'événement (`onError`) est interdit dans un composant
 * serveur : React lève « Event handlers cannot be passed to Client
 * Component props » et **la page entière plante** — c'est ce qui
 * rendait la revue admin inutilisable (et aurait tué la fiche publique
 * de tout produit dont la description contient une image).
 *
 * Ce composant isole donc le seul `onError` du rendu markdown : le
 * reste de `Prose` reste serveur, sans un octet de JS client.
 */
export function ProseImage({
  src,
  alt,
  ...rest
}: {
  src?: string | Blob;
  alt?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={typeof src === "string" ? src : undefined}
      alt={alt ?? ""}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={(e) => {
        // Image morte : on la masque (jamais d'icône brisée sur la fiche).
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
      {...rest}
      className="my-6 max-w-full rounded-2xl border border-border/60"
    />
  );
}
