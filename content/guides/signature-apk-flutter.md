# Flutter — signer son APK release

> Procédure vérifiée le 2026-10-17 — source : docs officielles `deployment/android` (page « Build and release an Android app », Flutter 3.47, màj 2026-09-10). Complément vérification : [fiche dépannage](/guides/signature-apk/depannage).

## Créer le keystore

`keytool` vient du JDK : si absent du PATH, `flutter doctor` affiche la ligne « Java binary at: » — remplacez `java` par `keytool` dans ce chemin.

macOS / Linux :

```bash
keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -storetype JKS -keysize 2048 -validity 10000 -alias upload
```

Windows (PowerShell) :

```powershell
keytool -genkey -v -keystore $env:USERPROFILE\upload-keystore.jks -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Le `-storetype JKS` n'est requis que pour Java 9+ (sinon le défaut serait PKCS12). Chez Flutter, suivez la doc au pied de la lettre : JKS. Gardez le fichier hors du repo et notez alias + les deux mots de passe.

## `key.properties`

Créez `<projet>/android/key.properties` (sans crochets, ce sont des repères) :

```properties
storePassword=<motDePasseChoisiALaQuestion>
keyPassword=<motDePasseChoisiALaQuestion>
keyAlias=upload
storeFile=<cheminDuKeystore>
```

Exemple Windows : `storeFile=C:/Users/vous/upload-keystore.jks`. Ajoutez `key.properties`, `*.jks` et `*.keystore` au `.gitignore` de `<projet>/android/`.

## Kotlin DSL (`build.gradle.kts`, défaut des projets récents)

Avant le bloc `android {` :

```kotlin
import java.util.Properties
import java.io.FileInputStream

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}
```

Dans le bloc `android {` — attention, le template pointe le `debug` signingConfig, il faut remplacer :

```kotlin
buildTypes {
    release {
        // À remplacer : signingConfig = signingConfigs.getByName("debug")
        signingConfig = signingConfigs.getByName("release")
    }
}

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
```

## Groovy (`build.gradle`)

Avant `android {` :

```groovy
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

Dans `android {` :

```groovy
buildTypes {
    release {
        // À remplacer : signingConfig signingConfigs.debug
        signingConfig signingConfigs.release
    }
}

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
```

## Build et vérification

```bash
flutter clean
flutter build apk --release
# build/app/outputs/flutter-apk/app-release.apk
apksigner verify --list-certs app-release.apk
```

Le `flutter clean` n'est pas anodin : la doc précise que les builds en cache peuvent conserver l'ancienne signature. Puis vérifiez les trois lignes `Verified using vN scheme`.

## Les pièges de cette fiche

- **`app-release.apk` signé en debug** : c'est le template. Le bloc `buildTypes.release` par défaut dit littéralement « TODO: Add your own signing config » et pointe le `debug` — le swap ci-dessus est obligatoire.
- **`Keystore file not set`** : `key.properties` absent ou pas à la racine de `android/` (racine Gradle pas le module).
- **APK final non conforme alors que tout est bon** : le cache Gradle/Flutter. `flutter clean` puis relancez.
- Chemins avec espaces (Program Files…) : guillemets ou notation d'échappement de la plateforme.
- Vérification détaillée, refus plateforme, keystore perdu : [fiche dépannage](/guides/signature-apk/depannage).
