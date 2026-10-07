/**
 * Détection SPDX depuis un texte de licence (import licence, lot curation) :
 * on n'importe JAMAIS le texte intégral (le champ fait 60 signes) —
 * seul l'identifiant est pré-rempli, avec confiance. Premier match fort,
 * sinon null (l'utilisateur saisit à la main). Insensible à la casse,
 * tolère les retours ligne.
 */

const SIGNATURES: Array<{ id: string; patterns: RegExp[] }> = [
  // AGPL d'abord (un texte AGPL mentionne parfois la GPL).
  {
    id: "AGPL-3.0",
    patterns: [/gnu affero general public license/i, /\bagpl/i],
  },
  {
    id: "MIT",
    patterns: [/permission is hereby granted,?\s+free of charge/i, /\bmit license\b/i],
  },
  {
    id: "Apache-2.0",
    patterns: [
      /licensed under the apache license,?\s+version 2\.0/i,
      /apache license[^\n]{0,40}version 2\.0/i,
    ],
  },
  {
    id: "GPL-3.0",
    patterns: [/gnu general public license[^\n]{0,80}version 3/i, /\bgpl-?3(\.0)?\b/i],
  },
  {
    id: "GPL-2.0",
    patterns: [/gnu general public license[^\n]{0,80}version 2(?!\.)/i, /\bgpl-?2(\.0)?\b/i],
  },
  {
    id: "LGPL-3.0",
    patterns: [/gnu lesser general public license[^\n]{0,80}version 3/i, /\blgpl-?3/i],
  },
  {
    id: "LGPL-2.1",
    patterns: [/gnu lesser general public license[^\n]{0,80}version 2\.1/i, /\blgpl-?2\.1/i],
  },
  {
    id: "BSD-3-Clause",
    patterns: [
      /redistribution and use in source and binary forms[^\n]{0,200}neither the name/i,
      /\bbsd[- ]3-clause\b/i,
    ],
  },
  {
    id: "BSD-2-Clause",
    patterns: [/redistribution and use in source and binary forms/i, /\bbsd[- ]2-clause\b/i],
  },
  {
    id: "ISC",
    patterns: [/permission to use, copy, modify, and\/or distribute/i, /\bisc license\b/i],
  },
  {
    id: "MPL-2.0",
    patterns: [/mozilla public license[^\n]{0,40}version 2\.0/i, /\bmpl-?2\.0\b/i],
  },
  {
    id: "Unlicense",
    patterns: [/this is free and unencumbered software/i, /\bunlicense\b/i],
  },
  {
    id: "CC0-1.0",
    patterns: [/cc0 1\.0 universal/i, /\bcc0\b/i],
  },
  {
    id: "WTFPL",
    patterns: [/do what the fuck you want to public license/i, /\bwtfpl\b/i],
  },
  {
    id: "Proprietary",
    patterns: [/all rights reserved/i, /proprietary/i, /tous droits r[ée]serv[ée]s/i],
  },
];

export function detectSpdx(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ");
  for (const { id, patterns } of SIGNATURES) {
    if (patterns.some((re) => re.test(normalized))) return id;
  }
  return null;
}
