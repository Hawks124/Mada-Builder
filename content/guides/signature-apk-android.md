# Android natif — signer son APK release

> Procédure vérifiée le 2026-10-17 — sources : [Sign your app](https://developer.android.com/studio/publish/app-signing), [apksigner](https://developer.android.com/tools/apksigner), [référence `SigningConfig`](https://developer.android.com/reference/tools/gradle-api/9.5/com/android/build/api/variant/SigningConfig). La base commune : les autres frameworks font finalement la même chose dans leur propre arborescence Gradle.

## Créer le keystore

`keytool` fait partie du JDK (celui d'Android Studio va très bien). Sans PATH, utilisez le chemin complet affiché par Android Studio, ou celui du JBR : `C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe` sous Windows.

```bash
keytool -genkey -v -keystore release.keystore -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Répondez aux questions (nom, organisation, pays…). Les mots de passe keystore et clé peuvent être identiques. Validité 10 000 jours : plus de 27 ans, c'est voulu.

Gardez `release.keystore` hors du repo (par exemple dans votre dossier utilisateur) et notez l'alias plus les deux mots de passe.

## Les secrets dans `keystore.properties`

Créez `android/keystore.properties` (à la racine du projet Gradle `android/`) :

```properties
storeFile=C:/chemin/vers/release.keystore
storePassword=motDePasseKeystore
keyAlias=upload
keyPassword=motDePasseCle
```

Et ajoutez à `android/.gitignore` :

```gitignore
keystore.properties
*.keystore
*.jks
```

## Kotlin DSL (`android/app/build.gradle.kts`)

Au-dessus du bloc `android {` :

```kotlin
import java.util.Properties
import java.io.FileInputStream

val keystoreProperties = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) load(FileInputStream(f))
}
```

Dans le bloc `android {` :

```kotlin
android {
    // …

    signingConfigs {
        create("release") {
            keyAlias = keystoreProperties["keyAlias"] as String?
            keyPassword = keystoreProperties["keyPassword"] as String?
            storeFile = keystoreProperties["storeFile"]?.let { file(it) }
            storePassword = keystoreProperties["storePassword"] as String?

            enableV1Signing = true
            enableV2Signing = true
            enableV3Signing = true
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}
```

Sans les trois lignes `enableV…Signing`, la v1 est désactivée par défaut dès que `minSdk` ≥ 24 — d'où leur présence obligatoire.

## Groovy (`android/app/build.gradle`)

Même logique en Groovy :

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("keystore.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    // …

    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']

            enableV1Signing true
            enableV2Signing true
            enableV3Signing true
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

## Build et vérification

```bash
./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release.apk
apksigner verify --print-certs android/app/build/outputs/apk/release/app-release.apk
```

Les trois lignes `Verified using vN scheme` doivent être à `true`. Si `apksigner` n'est pas dans le PATH : `<SDK>/build-tools/<version>/apksigner`.

## Les pièges de cette fiche

- **Wizard Android Studio** : « Build → Generate Signed Bundle/APK » propose le même réglage via des checkboxes « Signature Versions » (v1/v2/v3). Pratique ponctuellement, mais la config Gradle est durable et reproductible — préférez-la.
- **Attention `app-release-unsigned.apk`** : votre `buildTypes.release` pointe encore sur le `debug` signingConfig (template par défaut). Changez-le comme ci-dessus.
- **Modification du fichier Gradle sans effet** : une fois l'éditeur ouvert dans Android Studio, faites « Sync Project with Gradle Files » ; sinon le build garde l'ancienne tâche.
- Vérification détaillée, refus plateforme et keystore perdu : [fiche dépannage](/guides/signature-apk/depannage).
