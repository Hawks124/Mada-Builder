# React Native — signer son APK release

> Procédure vérifiée le 2026-10-17 — source : [Publishing to Google Play Store](https://reactnative.dev/docs/signed-apk-android) (React Native 0.87). Avec Expo, allez directement à la [fiche Expo](/guides/signature-apk/expo).

## Créer le keystore

```bash
keytool -genkeypair -v -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Sous Windows, si `keytool` n'est pas dans le PATH, lancez-le depuis `C:\Program Files\Java\jdk<X>\bin`. Placez le `.keystore` hors du repo (dossier utilisateur par exemple) et notez l'alias plus les deux mots de passe.

## Les variables Gradle

La doc officielle passe les secrets par Gradle, au niveau global utilisateur pour ne jamais les commiter. Dans `~/.gradle/gradle.properties` (ou `%USERPROFILE%\.gradle\gradle.properties` sous Windows) :

```properties
MYAPP_UPLOAD_STORE_FILE=my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=motDePasseKeystore
MYAPP_UPLOAD_KEY_PASSWORD=motDePasseCle
```

`MYAPP_UPLOAD_STORE_FILE` se résout relativement au module `android/app` : soit un chemin absolu vers votre keystore, soit le nom d'un fichier placé dans `android/app`.

## `android/app/build.gradle` (Groovy)

```groovy
android {
    // …

    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE')) {
                storeFile file(MYAPP_UPLOAD_STORE_FILE)
                storePassword MYAPP_UPLOAD_STORE_PASSWORD
                keyAlias MYAPP_UPLOAD_KEY_ALIAS
                keyPassword MYAPP_UPLOAD_KEY_PASSWORD

                enableV1Signing true
                enableV2Signing true
                enableV3Signing true
            }
        }
    }

    buildTypes {
        release {
            // … vos minifyEnabled / proguard habituels …
            signingConfig signingConfigs.release
        }
    }
}
```

Le garde `if (project.hasProperty(...))` : sans variables configurées, le build reste validable ; avec, il signe. Sans les trois lignes `enableV…Signing`, la v1 est désactivée par défaut dès que `minSdk` ≥ 24.

## Build et vérification

```bash
npx react-native build-android --mode=release
# ou : cd android && ./gradlew assembleRelease
# APK : android/app/build/outputs/apk/release/app-release.apk
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

Les trois lignes `Verified using vN scheme` doivent être à `true`.

## Les pièges de cette fiche

- **AAB ou APK ?** `bundleRelease` (ou `--mode=release` avec `build-android`) produit un `.aab` pour Google Play ; `assembleRelease` produit un `.apk`, celui qu'attend la plateforme.
- **Secrets commités par mégarde** : plusieurs projets legacy mettent les variables dans `android/gradle.properties`. Ça marche aussi, mais alors ce fichier doit être git-ignoré — sinon tous vos mots de passe sont publics.
- **`org.gradle.configureondemand=true`** dans `gradle.properties` peut court-circuiter l'assemblage JS : retirez-la si le bundle est absent du binaire.
- Vérification détaillée, refus plateforme, keystore perdu : [fiche dépannage](/guides/signature-apk/depannage).
