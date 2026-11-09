# Export RGPD — assemblage côté client (desktop)

> Statut : plan / non implémenté — décision opérateur 09/11/2026 (options
> (a) V1 interim livrée · (b) cible = ce document).
> Précédents : `docs/plans/rgpd-robuste-pont-notifications-et-reponse-mobile.md`.

## Pourquoi

Log Vercel 09/11/2026 (compte réel, médias inclus) :

```
GET /api/v1/me/export 200 in 5.1min (next.js: 8ms, application-code: 5.1min)
```

- 5 min de build serveur = la fonction est **au plafond Vercel Hobby (300 s)**,
  un gros média de plus → 504.
- Le client ne voit **aucun octet** pendant le build → attente aveugle
  (« stuck à 0 o », vécu terrain 09/11).
- Le web/mobile téléchargent le même ZIP : le format restera côté TS (inchangé),
  le desktop assemblera **localement** à partir d'un manifest signé.

La PRD §13 sanctions Vercel Cron ou Inngest pour les jobs — ici on évite les
deux : le desktop A déjà Go + disque + un contexte cancellable + `Cancel()`.

## Cible

- Desktop construit le ZIP **localement** (Go `archive/zip`), octets téléchargés
  chiffrés via HTTPS direct R2 / Supabase Storage / CDN public.
- Serveur : **une seule nouvelle route** `GET /api/v1/me/export/manifest` qui
  renvoie `{ data, counts, media: [...fetch-instructions...] }` — pas de ZIP.
- Web et mobile gardent la route actuelle (`buildUserExport`), inchangée.
- % réel pendant tout le transfert (octets flux réel, pas une estimation).

## Inventaire du ZIP (source : `services/export.service.ts`)

| Entrée ZIP       | Origine                                             | Fetch côté desktop ?                                 |
| ---------------- | --------------------------------------------------- | ---------------------------------------------------- |
| `data.json`      | `collectExportBundle().data`                        | via manifest (route #1, inline JSON)                 |
| `media/*-logo`   | DB products.iconUrl (CDN pub)                       | direct HTTP GET                                      |
| `media/*-shot-N` | product_screenshots.url (pub)                       | direct HTTP GET                                      |
| `builds/…apk`    | product_builds.r2Key (**priv**)                     | presign R2 GET, 15 min TTL                           |
| `appeals/…bin`   | appeals.evidence_paths (**priv**, Supabase Storage) | `createSignedUrl` admin, 15 min TTL                  |
| `MANIFEST.txt`   | `manifestTxt()` (TS)                                | reimplémenté en Go — contrat `docs/export-format.md` |

Contrat de structure : `collectExportBundle` reste l'unique source de vérité ;
le manifest réutilise ses sorties — **zéro duplication de logique**.

## Serveur (petite tranche, ~0,5–1 j)

1. Refactor `services/export.service.ts` : extraire `buildExportManifest(userId)`
   = `collectExportBundle` + résolution des fetch instructions :
   - `kind: url` → URL nue, `method: GET`;
   - `kind: r2` → réutiliser **`presignBuildDownload()` déjà en place** dans
     `lib/r2.ts` (l.332, `GetObjectCommand`, TTL 300 s, garde `builds/`) —
     zéro nouveau presigner requis ; vérifier au code que les `r2Key` résident
     bien sous `builds/` (fait en dépendance du bucket PRODUCT_BUILDS_BUCKET);
   - `kind: appeals` → `createAdminClient().storage.from(APPEALS_BUCKET).createSignedUrl(path, 900)`
     (API existante, côté admin — à confirmer au code).
   - `sizeBytes` pour chaque média (utile au % desktop ; optional mais nominale).
2. `app/api/v1/me/export/manifest/route.ts` : GET Bearer, `allowBanned: true`
   (un banni garde son RGPD), rate limit 6/h, pas de cache (no-store).
3. Les 2 routes ZIP web/v1 restent telles quelles (refactor déjà livré) ;
   `verify-export.ts` continue de servir de preuve.
4. `scripts/verify-export-manifest.ts` (optionnel, petite) : prouve que le
   manifest renvoie des URLs signées valides et que chaque média répond 200.

## Desktop (Go, ~1,5–2 j)

Fichiers touchés : `desktop/internal/export/{service,assemble}.go` + bindings.

1. `Run()` réécrit (la signature Wails ne change pas) :
   - GET manifest (timeout 30 s, 2 retry backoff 500 ms/2 s) ;
   - écrit `data.json` (marshal Go du même shape ; ordre des clés ignoré,
     schéma = contrat `docs/export-format.md`) ;
   - télécharge médias en concurrence 4 (`sync.WaitGroup` + channel, pas
     errgroup externe — stdlib suffit) ; chaque fichier **streamed**
     `io.Copy(zipWriter, resp.Body)` → mémoire constante même pour APK 200 Mo ;
   - progression : `percent = bytesStreamed / Σ media.sizeBytes`, fallback
     `filesDone / filesTotal` si size absente ; event `export/progress`
     identique (webview inchangée hors copie) ;
   - skip-par-fichier comme le web (échec = noté dans MANIFEST, jamais bloquant) ;
   - `.part` + renommage atomique + `Cancel()` conservés (déjà en place) ;
   - expiration presign mid-run (403) → **un seul** re-fetch du manifest + retry ;
     sinon noté skipped.
2. `MANIFEST.txt` : même texte/anglais-fr que le TS (contrat), compteurs depuis
   manifest.counts.
3. `data.json` : `exporteLe` = horodatage serveur du manifest (`serverTime`)
   pour cohérence avec le web (évite 2 horodatages divergents).

## Contrat partagé — `docs/export-format.md` (livrable obligatoire)

- Schéma de `data.json` (tous champs, types, `iso()` pour les dates).
- Layout `MANIFEST.txt` (template exact + skipped semantics).
- Conventions `zipPath` (slug safe, nommage logo/shot/apk/preuve).
- Règle : toute évolution du format passe par ce doc **avant** code des deux côtés.

## Critères d'acceptation

- [ ] Compte réel (celui qui a produit le log 5,1 min) : export < 1 min côté
      perception, % progresse dès ~2 s, aucune fuite `.part` sur kill mid-run.
- [ ] Compte vide (verify-export) : pas de régression, ZIP valide PK magic.
- [ ] Binaire + appeals présents pour propriétaire ; 403 presign → retry unique,
      sinon skipped dans MANIFEST (jamais d'échec global).
- [ ] Navigateur/refresh pendant assemble : même ré-alignement `Status()` qu'aujourd'hui.
- [ ] Web ZIP inchangé (verify-export 6/6 toujours vert).
- [ ] `npm run check` vert + snapshot desktop du Jalon F9.

## Risques / points ouverts

- **Dérive format** web↔desktop → contrat + revue manuelle du MANIFEST.
- `@aws-sdk/s3-request-presigner` : déjà en dépendance + `presignBuildDownload()`
  EXISTE (lib/r2.ts l.332) → presigner clos. TTL 300 s : si un APK très gros
  est trop lent sur lien lent, le re-fetch manifest (retry unique prévu)
  régénère des URLs fraîches.
- Media très gros (APK 300 Mo) : percent imprécis si `sizeBytes` inconnu →
  afficher « N fichiers téléchargés » en secours (copy déjà livré en V1 interim).
- Supabase Storage `createSignedUrl` — TTL à confirmer au code (l'admin client
  en JS supporte généralement 1 h).
- Fan-out parallèle de 4 presigned URLs : trafic R2 direct = coût zéro Vercel.

## Séquence & estimation (à relire avant jalon)

1. `docs/export-format.md` + route manifest + verify-manifest — **0,5–1 j**
2. Go `assemble.go` + progress/cancel/retry — **1–1,5 j**
3. QA compte réel + snapshot F9 — **0,5 j**

Total ≈ **2–3 jours** (contre 5 min de build aveugle par export, plafond Vercel).

## Hors périmètre

- Web/mobile inchangés (route ZIP actuelle conservée pour toujours ou dépréciée
  plus tard — décision séparée).
- Pas de job Inngest / cron — pas de nouveau service.
- Pas de ZIP chiffré, pas d'email delivery (hors V1).
