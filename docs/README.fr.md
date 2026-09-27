<p align="center">
  <img src="assets/cicada-logo.svg" alt="CICADA-1 logo" width="152" height="152">
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/ninedrive-logo.jpg" alt="玖驱科技 · NINEDRIVE TECH SHANGHAI" width="152" height="152">
</p>

<h1 align="center">知了1号 · CICADA-1</h1>

<p align="center">
  <a href="../README.md"><img src="https://img.shields.io/badge/语言-简体中文-22314E?style=for-the-badge" alt="简体中文"></a>
  <a href="README.en.md"><img src="https://img.shields.io/badge/Language-English-3776AB?style=for-the-badge" alt="English documentation"></a>
  <a href="README.fr.md"><img src="https://img.shields.io/badge/Langue-Français-0055A4?style=for-the-badge" alt="Documentation française"></a>
</p>

<p align="center">
  Une application open source de communication série pour le module de synthèse vocale CICADA-1
</p>

<p align="center">
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&amp;logo=tauri&amp;logoColor=white" alt="Tauri 2"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-000000?style=flat-square&amp;logo=rust&amp;logoColor=white" alt="Rust"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&amp;logo=react&amp;logoColor=white" alt="React 19"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5.8"></a>
  <img src="https://img.shields.io/badge/Version-1.0.0-22314E?style=flat-square" alt="Version 1.0.0">
  <a href="../LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue?style=flat-square&amp;logo=apache&amp;logoColor=white" alt="Apache License 2.0"></a>
</p>

CICADA-1 se connecte à un module de synthèse vocale par UART et réunit dans une même fenêtre la saisie du texte, les réglages de voix, les sons intégrés et le journal des échanges bruts. L’application de bureau utilise Tauri, Rust et React/TypeScript. Le son est produit par le module et son haut-parleur.

## Fonctionnalités

- **Connexion série** : recherche par nom de périphérique ou de port, saisie manuelle du port et débits de 9600 / 57600 / 115200 / 460800 bauds.
- **Lecture vocale** : encodages GB2312, GBK, UTF-16LE, UTF-16BE et UTF-8 ; découpage automatique et lecture successive des segments ; pause, reprise et arrêt.
- **Réglages de voix** : huit voix, volume, vitesse, hauteur et options de lecture du chinois ; enregistrement, relecture et restauration des paramètres.
- **Outils de texte** : 13 sons intégrés, balises de commande, import de texte UTF-8 et sauvegarde locale des brouillons.
- **Journal de communication** : échanges HEX bruts, recherche, filtrage par direction, export et aperçu des trames de chaque segment.
- **Périphérique et apparence** : délais de l’amplificateur, veille, réveil, réponse brute de version, quatre thèmes et interface en chinois ou en anglais.

<p align="center"><img src="screenshots/dashboard-night.png" alt="Interface CICADA-1 : éditeur de texte, réglages de voix et journal de communication" width="960"></p>

## Quatre thèmes

First Song, Grove, Nocturne et Clearwing proposent des palettes blanc chaud, vert doux, bleu-vert profond et à contraste élevé. Changez de thème dans les paramètres ; votre préférence est enregistrée automatiquement.

<p align="center">
  <a href="screenshots/themes-overview.png"><img src="screenshots/themes-overview.png" alt="Quatre thèmes : First Song, Grove, Nocturne et Clearwing" width="1200"></a>
</p>

## Prise en main

### Prérequis

Les instructions de bureau concernent Windows 10/11. Installez Node.js 20 ou une version LTS plus récente, Rust stable avec la chaîne d’outils MSVC, Microsoft C++ Build Tools avec la charge de travail **Développement Desktop en C++** et le SDK Windows, ainsi que Microsoft Edge WebView2 Runtime. Consultez les [prérequis de Tauri](https://v2.tauri.app/start/prerequisites/) pour les détails d’installation.

### Démarrer depuis les sources

À la racine du projet :

```powershell
npm ci
npm run desktop
```

Pour parcourir l’interface dans un navigateur :

```powershell
npm run dev
```

Ouvrez <http://127.0.0.1:1430> et sélectionnez un périphérique simulé. Le mode navigateur n’accède pas aux ports série physiques et ne produit aucun son.

### Connecter le module et lancer la lecture

1. Reliez TX de l’adaptateur USB-UART à RX du module, RX à TX, et GND à GND. Utilisez l’alimentation adaptée au module et branchez un haut-parleur.
2. Sélectionnez le port série réel et le débit correspondant aux broches BAUD0/BAUD1 du module, puis connectez-vous.
3. Saisissez le texte, choisissez l’encodage, vérifiez le nombre d’octets et l’aperçu des segments, puis lancez la lecture.
4. Ajustez les paramètres de voix et enregistrez-les dans le module. Consultez le journal pour examiner les données envoyées et reçues.

Les niveaux électriques UART doivent correspondre à ceux du module. Le choix du débit dans l’application configure uniquement le port de l’ordinateur ; il ne modifie pas les broches du module. Le module prend en charge les caractères chinois et les lettres anglaises, mais ne synthétise pas les mots anglais. Les caractères des plans Unicode supplémentaires, dont la plupart des émojis, ne peuvent pas être envoyés.

## Documentation

| Document | Contenu |
| --- | --- |
| [Guide d’utilisation (en chinois)](USER_GUIDE.md) | Câblage, connexion, lecture, réglages de voix, sons, journaux et dépannage |
| [Protocole de communication (en chinois)](PROTOCOL.md) | Paramètres UART, structure des trames, commandes, réponses, encodages et balises |

Chaque segment de texte est limité à **400 octets**. L’application attend la réponse de fin `4F` du segment précédent avant d’envoyer le suivant. Les balises de commande s’appliquent globalement et leurs réglages sont conservés après la mise hors tension. Utilisez `[d][m3]` pour rétablir tous les paramètres par défaut.

Ce README est disponible en [chinois](../README.md), en [anglais](README.en.md) et en [français](README.fr.md). Le guide détaillé et le protocole sont en chinois. L’interface de l’application est disponible en chinois et en anglais.

## Licence

Ce projet est distribué sous [licence Apache 2.0](../LICENSE). Les licences et mentions des composants tiers figurent dans [THIRD-PARTY-NOTICES.txt](../THIRD-PARTY-NOTICES.txt).
