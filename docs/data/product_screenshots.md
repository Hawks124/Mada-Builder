# Table `product_screenshots`

Galerie ordonnée (une seule source — jamais de `gallery_urls` en doublon).
`url` = URL publique R2 (racine par bucket). Orientation/dimensions
MESURÉES à l'upload (jamais choisies) : la fiche rend chaque capture
dans son ratio, slots dimensionnés par `gallery_orientation`.

## Colonnes

| Colonne            | Type                                    | Notes                                          |
| ------------------ | --------------------------------------- | ---------------------------------------------- |
| `id`               | `uuid` PK, UUIDv7                       |                                                |
| `product_id`       | `uuid` NOT NULL → `products.id` CASCADE |                                                |
| `url`              | `text` NOT NULL                         | R2 public                                      |
| `position`         | `integer` NOT NULL DEFAULT `0`          | Ordre (`ORDER BY position`)                    |
| `caption`          | `text` NULL                             | Légende                                        |
| `orientation`      | `text` NOT NULL DEFAULT `'landscape'`   | Mesurée (`portrait` si h > w au ratio déclaré) |
| `width` / `height` | `integer` NULL                          | Sortie pipeline (jamais au-delà de la source)  |
| `created_at`       | `timestamptz` NOT NULL                  |                                                |

Index : `(product_id, position)`.

## RLS (`setup.sql`)

- `screenshots_select_published` : `anon, authenticated`, screenshots de
  produits `published` non supprimés.
- **AUCUNE écriture directe** : upload/remplacement via service (magic-bytes, 400 px min, orientation du type, WebP, quota 6, remplacement total en édition).

## Règles métier miroir (serveur, jamais client)

- Formats PNG/JPG/WebP, 10 Mo max entrée (compresser < 2 Mo côté client).
- Ratio hors 1:3…3:1 refusé ; orientation imposée par le type (`both` = choix).
- Édition : nouveaux fichiers = remplacement TOTAL (anciens purgés R2) ; absents = conservés.

## Realtime

- Non publiée (galerie + refresh après upload).

## Usage mobile

- **Direct** : lire la galerie (`WHERE product_id`, `ORDER BY position`).
- **Écriture** : multipart API ou staged présigné (`POST /uploads/presign` → PUT R2 → clés au submit).
