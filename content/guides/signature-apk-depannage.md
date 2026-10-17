# Vérifier et dépanner — signature APK

> Procédure vérifiée le 2026-10-17 — source : [apksigner](https://developer.android.com/tools/apksigner), docs signatures Android. La section « refus de la plateforme » reprend exactement les messages que l'analyseur de Mada-Made affiche à l'écran de soumission.

## Où est apksigner ?

`$ANDROID_HOME/build-tools/<dernière_version>/apksigner` — sous Windows, `apksigner.bat`. Le chemin du SDK s'affiche dans Android Studio (Settings → Languages & Frameworks → Android SDK). Sans variable d'environnement :

```powershell
& "C:\Users\vous\AppData\Local\Android\Sdk\build-tools\36.0.0\apksigner.bat" verify -v --print-certs app-release.apk
```

## Lire `apksigner verify -v --print-certs`

```text
Signer #1:
Certificate DN: CN=Votre Nom, OU=…, O=…, L=…, ST=…, C=MG
… empreintes SHA-256 / SHA-1 …
Verified using v1 scheme (JAR): true
Verified using v2 scheme: true
Verified using v3 scheme: true
```

Versions plus anciennes d'`apksigner` : lignes légèrement différentes, même lecture.

| Ligne    | Attendu                                                             |
| -------- | ------------------------------------------------------------------- |
| v1 (JAR) | `true` — l'installation sur Android 6 et moins (API < 24) en dépend |
| v2       | `true`                                                              |
| v3       | recommandé (coût zéro, rotation de clé)                             |

Un `false` sur v1 alors que vous pensiez l'avoir activé ? Relisez la note « minSdk ≥ 24 » de la [vue d'ensemble](/guides/signature-apk) : les trois `enableV…Signing` doivent être explicites dans la `signingConfig release` effectivement utilisée par `buildTypes.release`.

## Empreinte du certificat

La plateforme enregistre l'empreinte SHA-256 du certificat signataire et la vérifie à chaque upload. Pour la connaître depuis votre keystore :

```bash
keytool -list -v -keystore release.keystore -alias MON_ALIAS
```

Repérez la ligne `SHA256:` — c'est cette chaîne qui doit rester stable d'une release à l'autre. Une empreinte différente du dépôt historique sera refusée à l'upload (protection anti-tamper).

## Les refus de la plateforme, message par message

L'analyseur de Mada-Made lit le bloc de signature v2/v3 et les entrées `META-INF` ; sans certificat lisible, il refuse — avec un message spécifique pour que vous sachiez quoi faire :

- **« APK non signé — signature requise. »** (`UNSIGNED`) — aucun bloc de signature, aucune entrée JAR : l'APK n'a jamais été signé ou a été ré-empaqueté après signature. Reprenez votre fiche framework depuis le début.
- **« Signature v2/v3 présente mais illisible — activez v1, v2 et v3… »** (`BLOCK_UNREADABLE`) — le bloc de signature existe, mais aucun certificat exploitable à l'intérieur. Cas typiques : un signer non-standard, ou un conteneur avec un format non lu (par exemple une paire de schéma inconnue seule). Un APK signé **uniquement en v2/v3 lisibles passe** (un avertissement « sans v1 » peut apparaître, pas de refus) ; ce message vise le cas où le contenu est bien là mais illisible. Action : re-signez avec les trois schémas explicites, puis contrôlez avec `apksigner verify`.
- **« Fichiers de signature (v1) présents mais illisibles — re-signez… »** (`V1_UNREADABLE`) — des entrées `META-INF/*.RSA/.DSA/.EC` existent mais aucun bloc de certificat n'a pu être lu. Re-signez, les trois schémas.
- **« Aucun certificat X.509 lisible — re-signez l'APK avec votre keystore release. »** (`CERT_FAILED`) — des blocs de certificat ont été collectés, mais aucun n'a pu être décodé en certificat X.509. Re-signez avec votre keystore release.
- **Refus avec empreinte différente** — le certificat reconnu est la clé de debug ou un certificat qui n'est pas celui du dépôt historique. Re-signez avec votre keystore release.

Dans tous les cas, un refus au parse ne touche pas la fiche : le binaire est simplement en attente tant que l'empreinte ne correspond pas à la clé attendue.

## Clé debug : le piège n°1

Un build qui tombe sur la config de debug sort un APK signé avec le keystore debug local — tout se passe bien jusqu'à l'upload. Trois repères :

- le certificat est `CN=Android Debug`, issu de `%USERPROFILE%\.android\debug.keystore` (ou `~/.android/debug.keystore`) ;
- à retenir : chaque fiche framework le rappelle — le `buildTypes.release` des templates pointe explicitement le signingConfig debug, le swap est obligatoire ;
- la prévention est dans la fiche : les trois `enableV…Signing` dans votre `signingConfigs.release` reliant `buildTypes.release`.

## J'ai perdu mon keystore

- **Google Play** : un reset existe via le programme Play App Signing (clé d'upload perdue ≠ clé de signature perdue ; la marche à suivre est détaillée côté Google, et la [doc Expo](https://docs.expo.dev/app-signing/app-credentials) décrit l'export du certificat pour le support). Processus long, par dossier — la prévention reste la sauvegarde.
- **Distribution hors Play (dont la plateforme)** : l'empreinte est l'identité. Sans keystore, aucune ré-signature conforme : l'app doit repartir sous une nouvelle empreinte.
- La défense tient en une habitude : **sauvegarde immédiate** du keystore et des mots de passe, hors VCS, plusieurs copies — le jour même de sa création.

## JKS → PKCS12

PKCS12 est le type de keystore par défaut depuis Java 9 ; les anciens `.jks` restent lisibles et certains outils proposent une conversion à la première ouverture. Migration volontaire :

```bash
keytool -importkeystore -srckeystore ancien.jks -destkeystore nouveau.p12 -srcalias MON_ALIAS \
  -srcstoretype JKS -deststoretype PKCS12
```

L'empreinte du certificat est conservée (seul le conteneur change) — ni vos dépôts, ni la plateforme, ne voient la différence.
