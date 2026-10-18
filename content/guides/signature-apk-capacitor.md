# Capacitor / Ionic — signer son APK release

> Procédure vérifiée le 2026-10-17 — sources : blog Ionic « Building and releasing your Capacitor Android app », docs [Android Play Store Deployment](https://ionicframework.com/docs/deployment/play-store), [CLI `cap build`](https://capacitorjs.com/docs/cli/commands/build). Complément vérification : [fiche dépannage](/guides/signature-apk/depannage).

## Créer le keystore

```bash
keytool -genkey -v -keystore release.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias capacitor-key
```

Placez le keystore et les secrets hors du repo. Notez l'alias et les deux mots de passe.

## `android/keystore.properties` + `build.gradle` (Groovy)

Créez `android/keystore.properties` (ne pas commiter) :

```properties
storePassword=motDePasseKeystore
keyPassword=motDePasseCle
keyAlias=capacitor-key
storeFile=../../release.keystore
```

Le `storeFile` se résout depuis le module `android/app` : ici le keystore est à la racine du repo, un cran au-dessus de `android/`. Un chemin absolu fonctionne aussi.

Dans `android/app/build.gradle` (Groovy, défaut Capacitor) — chargement du fichier dans le bloc `android {` :

```groovy
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Puis :

```groovy
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']

            enableV1Signing true
            enableV2Signing true
            enableV3Signing true
        }
    }
}

buildTypes {
    release {
        if (keystorePropertiesFile.exists()) {
            signingConfig signingConfigs.release
        }
    }
}
```

Ajoutez à `android/.gitignore` : `keystore.properties`, `*.keystore`, `*.jks`.

## Build et vérification

```bash
npx cap sync
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
apksigner verify -v --print-certs android/app/build/outputs/apk/release/app-release.apk
```

## Alternative CLI : `npx cap build` (attention au défaut)

```bash
npx cap build android \
  --keystorepath /chemin/release.keystore \
  --keystorepass motDePasseKeystore \
  --keystorealias capacitor-key \
  --keystorealiaspass motDePasseCle \
  --androidreleasetype APK \
  --signing-type apksigner
```

Deux drapeaux critiques :

- **`--androidreleasetype APK`** : précisez le type explicitement — la plateforme attend un `.apk`, jamais de `.aab`.
- **`--signing-type apksigner`** : le défaut est `jarsigner`, qui signe **uniquement en v1** — binaire conforme Android ancien, non conforme moderne. Avec `apksigner`, les schémas par défaut dépendent de `minSdk` (comme partout) : si vous ne maîtrisez pas le résultat, préférez la config Gradle avec les trois `enableV…Signing` explicites.

## Les pièges de cette fiche

- **`npx cap build` sans `--signing-type`** : le défaut est `jarsigner`, v1 uniquement — refusé de fait. Et sans `--androidreleasetype APK`, c'est un `.aab` qui risque de sortir : les deux refus de la plateforme d'un coup.
- **Fichier `keystore.properties` manquant au build CI** : le garde `exists()` ci-dessus évite le crash — avec garde, le build sort « unsigned » quand les secrets ne sont pas disponibles ; sans garde, le build casse net. Choisissez consciemment votre politique.
- Vérification détaillée, refus plateforme, keystore perdu : [fiche dépannage](/guides/signature-apk/depannage).
