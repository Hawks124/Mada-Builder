/**
 * Skeleton immédiat du back-office : le layout + la page font ~25 requêtes
 * DB (pooler distant) — sans ceci, l'écran reste vide le temps du rendu
 * (impression de "loading loop"). Statique, zéro requête.
 */
export default function AdminLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Chargement du tableau de bord"
      className="w-full px-6 lg:px-12 pt-10 lg:pt-14 pb-24 flex flex-col gap-14 animate-pulse"
    >
      <div className="flex flex-col gap-2">
        <div className="h-8 w-64 rounded-xl bg-muted" />
        <div className="h-4 w-96 max-w-full rounded-lg bg-muted/70" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-x-6 gap-y-10">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="h-3 w-24 rounded bg-muted/70" />
            <div className="h-8 w-16 rounded-lg bg-muted" />
            <div className="h-3 w-32 rounded bg-muted/70" />
          </div>
        ))}
      </div>
      <div className="w-full h-px bg-border/40" />
      <div className="h-6 w-48 rounded-lg bg-muted" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-12 rounded-2xl bg-muted/60" />
        ))}
      </div>
    </div>
  );
}
