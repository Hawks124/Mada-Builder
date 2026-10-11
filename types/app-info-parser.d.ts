/**
 * Types minimaux pour `app-info-parser@1.1.6` (pinné, sans types officiels).
 * La lib accepte un chemin (Node) ou un Blob/File (navigateur) et résout
 * un objet manifest brut — notre couche `lib/apk.ts` normalise derrière.
 * Import profond `src/apk.js` : APK seul, sans la chaîne iOS (`fs`).
 */
declare module "app-info-parser" {
  class AppInfoParser {
    constructor(file: string | Blob);
    parse(): Promise<unknown>;
  }
  export default AppInfoParser;
}

declare module "app-info-parser/src/apk.js" {
  class ApkParser {
    constructor(file: string | Blob);
    parse(): Promise<unknown>;
  }
  export default ApkParser;
}
