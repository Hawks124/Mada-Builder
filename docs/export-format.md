# Contrat format — Export RGPD (desktop ↔ web)

> Tout ce que le desktop assemble en ZIP doit être lisible à l'identique de
> l'export web. Toute évolution du format passe par CE doc AVANT les deux
> implémentations. Source de vérité côté calcul : `collectExportBundle()`
> (`services/export.service.ts`) — les deux exports le consomment.

## ZIP — entrées obligatoires

| Entrée         | Nature                                                     |
| -------------- | ---------------------------------------------------------- |
| `data.json`    | JSON UTF-8 indenté (`JSON.stringify(x, null, 2)` côté web) |
| `MANIFEST.txt` | UTF-8, template exact §3                                   |
| `media/…`      | logos + captures (noms ci-dessous)                         |
| `builds/…apk`  | tous les binaires du maker                                 |
| `appeals/…bin` | preuves d'appel                                            |

### Noms `zipPath`

- Logo produit : `media/<slug>-logo.<ext>`
- Captures produit : `media/<slug>-shot-<n>.<ext>` (n part à 1)
- APK : `builds/<slug>-v<versionName>-<versionCode>.apk` ;
  `vinitial.apk` si aucun des deux, champs absents → `v?-?`
- Preuve appel : `appeals/appel-<seq>-preuve-<n>.<ext>` (n part à 1)

`<slug>` = `slug` du produit, `[^a-z0-9-]+→-`, tronqué à 60, fallback `produit`.
`<ext>` = extension réelle en minuscules, `.bin` si inconnue.

## §2 — `data.json` (clés exactes, camelCase)

```jsonc
{
  "exporteLe": "2026-11-09T12:00:00.000Z",     // serverTime — PAS une 2e horloge client
  "profil":   { /* users.*, createdAt ISO|null */ },
  "produits": [ /* products.* + dates ISO|null */ ],
  "votes":    [ { "productId", "weight", "createdAt" } ],
  "avis":     [ { "productId", "rating", "body", "makerResponse",
                  "createdAt", "updatedAt" } ],
  "commentaires": [ { "productId", "parentId", "body", "score",
                      "createdAt", "updatedAt" } ],
  "appels":   [ { "seq", "banReason", "explanation", "evidencePaths",
                  "status", "reviewedAt", "createdAt" } ],
  "binairesMeta": [ { "productId", "versionName", "versionCode",
                      "sha256", "certSha256", "sizeBytes", "status",
                      "createdAt", "reviewedAt" } ]
}
```

Dates = ISO 8601 strings ou `null` (jamais d'objet Date brut). Champs absents
chez le web = absents ici non plus (même bundle collecté).

## §3 — `MANIFEST.txt` (template exact)

```
Export Mada-Made — @<username>
Généré le <ISO serverTime>

Contenu : <P> produit(s), <V> vote(s), <R> avis, <C> commentaire(s), <B> binaire(s), <F> fichier(s) média.
data.json = vos données structurées. /media = logos et captures. /builds = vos APK (tous statuts). /appeals = preuves d'appel.

Tous les fichiers ont été inclus.
```

OU (si échec par fichier, jamais bloquant) :

```

Fichiers indisponibles au moment de l'export (notés, non bloquants) :
- <label 1>
- <label 2>
```

Labels exemples : `logo <slug>`, `capture <slug> #<n>`, `binaire <slug> v<x>-<y> (<status>)`, `preuve appel #<seq> (<i+1>)`.

## §4 — Manifest d'assemblage client (route v1 `…/export/manifest`)

```jsonc
{
  "serverTime": "2026-11-09T…Z",               // = data.exporteLe
  "data":       { /* §2 in extenso */ },
  "counts":     { "products": 0, "votes": 0, "reviews": 0,
                  "comments": 0, "builds": 0, "files": 0 },
  "skipped":    [ "<label>", … ],               // presign/URL impossible → absent de media[]
  "media": [
    {
      "zipPath": "media/foo-logo.webp",
      "label":   "logo foo",
      "sizeBytes": 12345,                        // null si inconnu (CDN/appeals)
      "fetch":   { "method": "GET", "url": "https://…" }
    }
  ]
}
```

- Média `url` (logos/captures, publics) : fetch direct, pas de header.
- Média `r2` (builds, privé) : URL présignée (GET, TTL 300 s).
- Média `appeals` (privé, Supabase Storage) : URL signée (GET, TTL 15 min).
- `skipped[]` = médias à ne PAS tenter ; déjà comptabilisés dans `counts.files`.

## §5 — Sémantique d'échec

- Un média en échec (404/403/timeout) → noté dans MANIFEST, **jamais** un ZIP
  rejeté. Le `skipped` final du MANIFEST = skipped serveur + échecs desktop.
- `data.json` ou `MANIFEST.txt` impossibles → échec global, rien n'est servi.
- Un 403 sur présigné → **un seul** re-fetch du manifest + retry des fichiers
  en échec ; toujours rien d'autre.
