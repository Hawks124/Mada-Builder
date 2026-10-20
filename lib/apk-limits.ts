/**
 * Limites binaires APK — source unique, partagée serveur + client
 * (jamais deux constantes qui dérivent).
 *
 * 300 Mo : plafond où le flow actuel reste fiable — empreinte SHA-256
 * plein-fichier en RAM navigateur + PUT single-shot sans reprise.
 * Au-delà, il faudrait hash par chunks + multipart avec reprise
 * (chantier dédié, pas une constante). R2 encaisserait des Go sans
 * broncher ; ce sont le navigateur et le réseau qui bornent.
 */
export const MAX_APK_BYTES = 300 * 1024 * 1024;

/**
 * Notes de version (whatsnew) : 1000 signes max — même plafond que le
 * serveur (`recordBuild`), pour que le formulaire ne puisse pas envoyer
 * une valeur que le serveur refusera.
 */
export const NOTES_MAX = 1000;
