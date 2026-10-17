# Expo — signer son APK release

> Procédure vérifiée le 2026-10-17 — sources : docs officielles [App credentials](https://docs.expo.dev/app-signing/app-credentials), [Using local credentials](https://docs.expo.dev/app-signing/local-credentials), [Configuration with eas.json](https://docs.expo.dev/eas/json). Complément vérification : [fiche dépannage](/guides/signature-apk/depannage).

## Deux voies pour signer

1. **EAS Build géré** (`credentialsSource: "remote"`, le défaut) : EAS crée et héberge votre keystore, le build sort signé. Le plus simple — et vous récupérez le keystore quand vous voulez.
2. **Local** (`credentialsSource: "local"`) : vous créez le keystore, EAS l'utilise depuis un `credentials.json`.

Que vous choisissiez l'une ou l'autre, vous aurez besoin du keystore local un jour ou l'autre : la plateforme contrôle l'empreinte du certificat, donc gardez la clé, quelle que soit la voie (voir plus bas « récupérer et sauvegarder son keystore »).

## Voie gérée (défaut)

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile production
```

EAS crée le keystore, signe et stocke. Pour choisir entre `.apk` et `.aab`, le profil d'`eas.json` :

```json
{
  "build": {
    "production": {
      "android": {
        "buildType": "apk"
      }
    }
  }
}
```

`buildType: "apk"` produit un `.apk` signé — celui qu'attend la plateforme (les `.aab` ne sont pas acceptés ici).

## Voie locale

Créez le keystore vous-même :

```bash
keytool -genkey -v -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass MOT_DE_PASSE_KEYSTORE -keypass MOT_DE_PASSE_CLE \
  -alias KEY_ALIAS -keystore release.keystore \
  -dname "CN=com.expo.votre.package,OU=,O=,L=,S=,C=MG"
```

Placez-le dans `android/keystores/` (convention Expo) et git-ignorez le répertoire, puis créez un `credentials.json` à la racine du projet :

```json
{
  "android": {
    "keystore": {
      "keystorePath": "android/keystores/release.keystore",
      "keystorePassword": "MOT_DE_PASSE_KEYSTORE",
      "keyAlias": "KEY_ALIAS",
      "keyPassword": "MOT_DE_PASSE_CLE"
    }
  }
}
```

Git-ignorez `credentials.json` lui aussi. Déclarez la source dans `eas.json` :

```json
{
  "build": {
    "production": {
      "android": {
        "credentialsSource": "local",
        "buildType": "apk"
      }
    }
  }
}
```

Puis, comme pour la voie gérée : `eas build --platform android --profile production`.

## Récupérer et sauvegarder son keystore (obligatoire)

Quel que soit le mode :

```bash
eas credentials -p android
# sélectionnez le profil, puis « Download credentials from EAS to credentials.json »
```

Le `.jks` téléchargé + le `credentials.json` : copie hors repo immédiatement. Vous pouvez exporter le certificat pour Google via :

```bash
keytool -export -rfc -alias KEY_ALIAS -file certificat.pem -keystore ./chemin/vers/keystore.jks
```

## Cas `expo prebuild` (CNG)

Si vous générez le projet natif (`npx expo prebuild`, dossier `android/` commité ou non), le projet devient un projet Android standard : suivez la [fiche React Native](/guides/signature-apk/react-native) (variables `MYAPP_UPLOAD_*` + `build.gradle`). Peut aussi servir pour construire en local via `./gradlew assembleRelease` sans EAS.

## Les pièges de cette fiche

- **Keystore uniquement sur les serveurs EAS** : un jour de besoin imprévu (autre store, CI, soumission à la plateforme) il sera trop tard. Téléchargez-le une fois, copie hors repo.
- **`credentials.json` commité** : mots de passe en clair — le git-ignore est non négociable.
- **`.aab` uploadé sur Mada-Made** : non accepté, `buildType: "apk"` requis.
- Vérification détaillée, refus plateforme, keystore perdu : [fiche dépannage](/guides/signature-apk/depannage).
