# Signer son APK release — mode d'emploi

> Procédures vérifiées le 2026-10-17 contre les documentations officielles de chaque framework (Android, Flutter, React Native, Expo, Capacitor). Liens sources en tête de chaque fiche. Une erreur ? Signalez-le via `/contact` — la fiche est corrigée le jour même.

## Pourquoi v1, v2 et v3

Android vérifie une signature selon trois schémas :

- **v1 (JAR)** — le plus ancien, signe chaque entrée du ZIP. Seuls les téléphones sous Android 6/7 (API < 24) savent le vérifier.
- **v2 (bloc APK)** — signe le fichier entier, via une signature placée avant le répertoire central du ZIP. Nécessaire pour les téléphones modernes.
- **v3 (rotation de clé)** — même mécanisme que v2, ajoute la rotation de clé. Coût zéro : même keystore.

Un APK signé **uniquement en v2/v3** s'installe sur les téléphones récents mais est refusé sur les anciens — et la scène malgache compte beaucoup de téléphones sous Android 6-7. Un APK signé **uniquement en v1** n'est pas conforme aux attentes des stores modernes. D'où la règle de la plateforme : **les trois schémas actifs**.

Le piège classique : le plugin Android Gradle n'active la v1 par défaut que si votre `minSdk` est < 24 — sinon une valeur par défaut s'applique, sans avertissement (voir la [référence `SigningConfig`](https://developer.android.com/reference/tools/gradle-api/9.5/com/android/build/api/variant/SigningConfig)). Avec un `minSdk` à 24 ou plus, votre APK sort donc signé sans v1. D'où les trois lignes explicites imposées dans chaque fiche :

```kotlin
enableV1Signing = true
enableV2Signing = true
enableV3Signing = true
```

## Le keystore : votre identité

Le keystore (`.jks` ou `.keystore`, `.p12`/PKCS12 par défaut depuis Java 9) contient la clé privée qui prouve **que c'est vous** qui signez. Trois règles non négociables :

1. **Sauvegardez-le** hors du repo (disque externe, gestionnaire de mots de passe). Le perdre = perdre l'identité de l'app : un reset est possible chez Google Play via un processus lourd, et les autres canaux de distribution acceptent rarement le changement de clé.
2. **Ne le commitez jamais** — `*.keystore`, `*.jks` et les fichiers de secrets Gradle dans le `.gitignore`, mots de passe hors VCS.
3. **Notez l'alias et les deux mots de passe** (keystore et clé, souvent identiques).

## Vérifier après chaque build (4 secondes)

```bash
apksigner verify --print-certs app-release.apk
```

Les lignes `Verified using v1 scheme`, `v2`, `v3` doivent toutes afficher `true` — lecture complète et refus de la plateforme (`UNSIGNED`, `BLOCK_UNREADABLE`, `V1_UNREADABLE`) : voir la [fiche dépannage](/guides/signature-apk/depannage).

## Choisir votre fiche

- [Android natif (Kotlin/Java)](/guides/signature-apk/android) — la base commune, détaillée ;
- [Flutter](/guides/signature-apk/flutter) ;
- [React Native](/guides/signature-apk/react-native) ;
- [Expo](/guides/signature-apk/expo) ;
- [Capacitor / Ionic](/guides/signature-apk/capacitor) ;
- [Vérifier & dépanner](/guides/signature-apk/depannage).

Chaque fiche est autonome de A à Z (keystore inclus) — pas besoin de lire la fiche Android pour suivre la vôtre. Elles font aussi office de rattrapage quand votre app signe déjà, mais sans les bons schémas.
