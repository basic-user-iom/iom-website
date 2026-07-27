/* Auto-assembled by scripts/assemble-blog-locale-packs.mjs — do not hand-edit large blocks */
import type { DemoPostLocalePack } from './types'

export const frDemoBlogPosts: DemoPostLocalePack = {
  "3d-viewer": {
    pageTitle: "3D Viewer — modèles produit dans le navigateur",
    demoLabel: "3D Viewer",
    heroVideoCaption: "Visite produit — orbite, éclairage HDR et chrome du viewer",
    excerpt: `Version desktop v3.19.2 : fiabilité et qualité texture Streets GL, restauration texture mode Product après teardown City, en-têtes de panneau unifiés — plus revue GLTF/FBX/OBJ/IFC avec projection sol HDR et Streets GL.`,
    seo_title: "3D Viewer v3.19.2 — textures & fiabilité Streets GL — IOM",
    seo_description: `3D Viewer v3.19.2 pour Windows (Setup + Portable) : correctifs vertex-budget/simplify Streets GL, textures 4k préservant les UV, restauration texture mode Product, en-têtes FloatingPanelHeader unifiés. Revue navigateur GLTF/FBX/OBJ/IFC avec HDR et Streets GL.`,
    hook: `Les clients ne devraient pas avoir besoin d’un poste CAD pour revoir un modèle. Notre 3D Viewer place GLTF, FBX, OBJ et IFC dans une fenêtre navigateur (et desktop) partageable — orbite, inspection des matériaux, éclairage 360° HDR et projection sol, ou dépose du mesh dans le contexte ville OSM / Streets GL quand le lieu raconte l’histoire.`,
    coverNote: `Une courte visite ouvre l’article ; les stills ci-dessous montrent la projection sol HDR 360° et le contexte ville OSM 3D / Streets GL dans le même viewer.`,
    whatYouSeeIntro: `Deux capacités qui vendent le modèle au-delà du vide gris — éclairage HDR cinématique, puis tissu urbain réel :`,
    whyBullets: [
      `- **Partager un lien, pas un ZIP** — les parties prenantes ouvrent le modèle sur un laptop pendant un appel`,
      `- **Un viewer pour plusieurs formats** — moins d’e-mails « quelle app ouvre ça ? »`,
      `- **360° HDR + projection sol** — éclairage réel et ombres de contact pour ancrer le produit sur la plate`,
      `- **OSM 3D / Streets GL dans le viewer** — combiner contexte ville et vos modèles quand la rue vend le pitch`,
    ],
    whyUses: `configurateurs produit, placements architecture et extérieur, tablettes salon, validations client asynchrones et présentations web autonomes exportées depuis la même pipeline.`,
    beginner: `Un viewer 3D, c’est comme une photo de votre produit que l’on peut faire tourner. Au lieu d’images plates, le vrai modèle est dans la page — glisser pour tourner, zoomer les détails, l’envelopper de lumière HDR, ou le placer sur une vraie ville OpenStreetMap quand vous avez besoin de « où ça se situe ? ». Pas d’installation pour la version web ; un build desktop Windows couvre offline ou assets lourds.`,
    glossary: [
      {
        term: "GLTF / GLB",
        def: "formats 3D web courants ([Khronos glTF](https://www.khronos.org/gltf/))",
      },
      {
        term: "Orbit",
        def: "glisser pour faire tourner la caméra autour du modèle",
      },
      {
        term: "Environnement HDR 360°",
        def: "enveloppe haute dynamique qui éclaire le modèle depuis un vrai ciel/scène",
      },
      {
        term: "Projection sol",
        def: "projection du HDR sur le plan du sol pour ombres et reflets cohérents",
      },
      {
        term: "OSM 3D / Streets GL",
        def: `contexte ville 3D dérivé d’OpenStreetMap combinable avec vos modèles dans le viewer ([streets.gl](https://streets.gl/))`,
      },
      {
        term: "Hotspot",
        def: "marqueur cliquable sur le modèle avec info ou lien",
      },
    ],
    trySteps: [
      `Ouvrir le [site 3D Viewer](https://3dbviewer.com/) ou récupérer Setup / Portable Windows depuis la [release v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
      "Charger un échantillon ou votre propre GLTF/GLB si le build autorise l’import",
      `Essayer un environnement HDR 360° avec projection sol — voir les ombres de contact ancrer le produit`,
      `Ouvrir OSM 3D / Streets GL et imaginer (ou placer) votre modèle dans le tissu urbain réel`,
    ],
    requirements: [
      "**Navigateur :** Chrome, Edge ou Firefox moderne pour la version web",
      `**Desktop Windows :** Setup ou Portable depuis [GitHub Releases v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2) (Electron 41)`,
      `**Fichiers :** privilégier GLB/GLTF pour le web ; CAD lourd peut nécessiter conversion`,
      `**GPU :** path tracing et couches ville denses veulent un GPU correct — modes légers sur appareils modestes`,
    ],
    viewA: {
      caption: `HDR 360° avec projection sol — produit éclairé par la plate, ombres lisibles sur l’asphalte`,
    },
    viewB: {
      caption: "OSM 3D / Streets GL dans le viewer — contexte ville combinable avec vos modèles",
    },
    alsoCan: [
      "Changer environnements HDR et heure du jour pour différentes ambiances",
      "Utiliser le path tracing pour des stills quand la qualité prime sur la vitesse",
      "Mélanger modes Product / City / Hybrid pour revues extérieur ou urbain",
      "Exporter une présentation web autonome pour remise client",
    ],
    howWorks: `Le viewer repose sur la famille [Three.js](https://threejs.org/) avec un focus revue pratique : charger meshes, cadrer, éclairer HDR + projection sol, et — quand le brief demande une rue — ouvrir le contexte ville OSM 3D / Streets GL dans le même chrome. Les builds desktop étendent la même idée offline ou pour gros assets. Le support format suit les pipelines client réels — le but reste « ouvrir, comprendre, décider ». Produit live : [3dbviewer.com](https://3dbviewer.com/).`,
    whatsNew: {
      heading: "Nouveautés v3.19.2",
      body: `Fiabilité bridge Streets GL et qualité texture, plus polish mode Product :

- **Sync Streets GL** — simplify vertex-budget préservant les UV pour voitures et gros meshes fiables en contexte ville
- **Meilleures textures en City** — transfert texture binaire jusqu’à 4k avec ajustement payload pour grandes maps Meshy
- **Restore mode Product** — les textures ne disparaissent plus après teardown Streets GL / City
- **En-têtes panneau unifiés** — chrome FloatingPanelHeader partagé sur les panneaux éditeur

**Téléchargement (Windows x64) :** [Setup](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Setup-3.19.2-x64.exe) | [Portable](https://github.com/basic-user-iom/3d/releases/download/v3.19.2/3D-Viewer-Portable-3.19.2-x64.exe) | [Notes de release](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2)`,
    },
    faq: [
      {
        q: "Les clients ont-ils besoin de logiciel CAD ?",
        a: `Non pour la revue — un lien navigateur suffit à la plupart des parties prenantes.`,
      },
      {
        q: "Peut-on montrer le modèle sur une vraie rue ?",
        a: `Oui — OSM 3D / Streets GL tourne dans le viewer pour combiner contexte ville et votre GLB/GLTF.`,
      },
      {
        q: "Où obtenir le build desktop Windows ?",
        a: `Installateurs Setup et Portable sur la [release GitHub v3.19.2](https://github.com/basic-user-iom/3d/releases/tag/v3.19.2), aussi liée depuis [3dbviewer.com](https://3dbviewer.com/).`,
      },
      {
        q: "Peut-on le brander ?",
        a: `Oui. Chrome viewer, environnements et contenu hotspot peuvent suivre votre marque.`,
      },
    ],
    reading: [
      {
        label: "3D Viewer live",
        url: "https://3dbviewer.com/",
      },
      {
        label: "Téléchargements Windows v3.19.2",
        url: "https://github.com/basic-user-iom/3d/releases/tag/v3.19.2",
      },
      {
        label: "Aperçu glTF — Khronos",
        url: "https://www.khronos.org/gltf/",
      },
      {
        label: "Carte live Streets GL",
        url: "https://streets.gl/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
    ],
    related: [
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
      {
        label: "Éclairage volumétrique",
        url: "/blog/volume-lighting",
      },
    ],
  },
  "streets-gl-bridge": {
    pageTitle: "Streets GL Bridge — contexte ville OSM pour modèles 3D",
    demoLabel: "Streets GL Bridge",
    hook: `Un beau modèle a quand même besoin d’un sol. Streets GL Bridge explore le contexte ville 3D OpenStreetMap comme couche de sol — pour que les assets géolocalisés se tiennent dans une rue reconnaissable plutôt qu’un vide.`,
    coverNote: "La couverture montre le cadrage carte/bridge de la carte portfolio.",
    whyBullets: [
      `- **Le lieu vend l’histoire** — les clients reconnaissent le pâté de maisons, pas seulement le mesh`,
      "- **Données carto ouvertes** — OSM comme couche ville vivante sous votre asset",
      "- **Esprit bridge** — relier votre pipeline modèle à un sol navigable",
      "- **ADN open source** — construit autour de l’écosystème Streets GL",
    ],
    whyUses: `propositions urbaines, slides contexte site, previews produit ou architecture géolocalisées, et conversations « où ça se situe dans la rue ? » avant un build GIS complet.`,
    beginner: `Pensez aux vibes Google Earth, mais pour mettre votre objet 3D dans une vraie grille de rues. La carte est la scène ; le modèle l’acteur. Vous orbitez et explorez au lieu de fixer un sol gris infini.`,
    glossary: [
      {
        term: "OSM",
        def: `OpenStreetMap — données cartographiques communautaires ([openstreetmap.org](https://www.openstreetmap.org/))`,
      },
      {
        term: "Couche sol",
        def: "ville, routes et terrain sous votre modèle",
      },
      {
        term: "Géolocalisé",
        def: "placé à une latitude/longitude réelle sur Terre",
      },
      {
        term: "WebGL",
        def: `API GPU navigateur qui dessine la carte 3D ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API))`,
      },
    ],
    trySteps: [
      "Ouvrir la [démo Streets GL Bridge](/demos/streets-gl/)",
      "Attendre que l’embed carte se stabilise",
      `Pan/zoom le contexte ville (ou comparer avec la [carte live Streets GL](https://streets.gl/))`,
      "Imaginer déposer un bâtiment client ou un kiosque sur un coin connu",
    ],
    requirements: [
      "**Réseau :** tuiles et embed nécessitent une connexion",
      "**Navigateur :** Chromium moderne recommandé pour vues carte WebGL",
      `**Performance :** villes denses plus lourdes — zoomer pour exploration plus fluide`,
    ],
    viewA: {
      caption: "Tissu urbain — rues et volumétrie comme contexte",
    },
    viewB: {
      caption: "Lecture urbaine rapprochée — où un modèle se placerait",
    },
    alsoCan: [
      "Utiliser comme couche référence en plaçant des GLB géolocalisés",
      `Diriger les parties prenantes vers la carte live [streets.gl](https://streets.gl/)`,
      "Associer aux concepts Simple 3D Buildings d’OSM",
    ],
    howWorks: `Streets GL rend la structure ville 3D dérivée d’OSM dans le navigateur. Notre page bridge héberge ce contexte pour les workflows IOM — une couche pratique « où ça se situe ? » plutôt qu’une suite GIS complète. Projet upstream : [StrandedKitty/streets-gl](https://github.com/StrandedKitty/streets-gl) ; carte live sur [streets.gl](https://streets.gl/).`,
    faq: [
      {
        q: "Est-ce Google Maps ?",
        a: "Non — cela s’appuie sur OpenStreetMap et les outils ouverts Streets GL.",
      },
      {
        q: "Peut-on déposer notre bâtiment ?",
        a: `C’est l’intention du bridge : modèles géolocalisés sur contexte ville. Demandez-nous une intégration cadrée.`,
      },
    ],
    reading: [
      {
        label: "Carte live Streets GL",
        url: "https://streets.gl/",
      },
      {
        label: "streets-gl sur GitHub",
        url: "https://github.com/StrandedKitty/streets-gl",
      },
      {
        label: "OSM Simple 3D Buildings",
        url: "https://wiki.openstreetmap.org/wiki/Simple_3D_Buildings",
      },
      {
        label: "WebGL — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGL",
      },
    ],
    related: [
      {
        label: "Artist Globe",
        url: "/blog/artist-globe",
      },
      {
        label: "3D Viewer",
        url: "/blog/3d-viewer",
      },
    ],
  },
  "panorama-360-tour": {
    pageTitle: "360° Panorama Tour Editor — créer des parcours guidés dans le navigateur",
    demoLabel: "360° Panorama Tour Editor",
    hook: `Les visiteurs salon se souviennent des expériences. Cet éditeur charge des panoramas équirectangulaires, place des hotspots, enchaîne des tours multi-scènes et sauve une \`.360project\` — tout dans le navigateur, ouvrant sur The Black Witness par défaut.`,
    coverNote: `La couverture est l’étape 1 de la visite guidée sur The Black Witness — hotspot corbeau + popup.`,
    whyBullets: [
      `- **Éditeur + visiteur dans une stack** — construire la tour, puis partager un lien preview`,
      "- **Hotspots explicatifs** — info, liens de scène et popups iframe optionnels",
      "- **Tours multi-scènes** — mener les invités du stand à la gamme produit au lieu",
      `- **Fichiers projet conservés** — sauver et recharger \`.360project\` entre sessions`,
    ],
    whyUses: `compagnons salon, walkthroughs de lieux, récits gamme produit, soft launches musée et validations client avant un build tour production.`,
    beginner: `Un panorama 360° est une photo qui vous entoure — comme au centre d’une pièce. L’éditeur transforme ces photos en tour : marqueurs cliquables (hotspots), liens entre pièces, et un parcours que les invités suivent sans télécharger d’app.`,
    glossary: [
      {
        term: "Équirectangulaire",
        def: "disposition d’image 360° courante (sphère complète aplatie en rectangle)",
      },
      {
        term: "Hotspot",
        def: "marqueur cliquable — info, saut de scène ou URL/iframe",
      },
      {
        term: "Visite guidée",
        def: "séquence scriptée d’arrêts caméra, popups et effets optionnels",
      },
      {
        term: ".360project",
        def: "fichier de sauvegarde IOM pour panoramas, hotspots et réglages tour",
      },
      {
        term: "WebGPU birds",
        def: "effet vol optionnel sur la tour (GPU)",
      },
    ],
    trySteps: [
      `Ouvrir le [360° Panorama Tour Editor](/demos/panorama-360/) (ou [preview visiteur](/demos/panorama-360/?mode=preview))`,
      "Cliquer **Play guided tour** et suivre les quatre étapes Black Witness",
      "Arrêter la tour et cliquer les hotspots — corbeau, feu, eau, oiseaux",
      `Dans l’éditeur, sélectionner chaque ligne STEPS pour sauter la caméra et éditer le beat`,
    ],
    requirements: [
      `**Navigateur :** Chrome ou Edge moderne recommandé ; WebGPU nécessite un GPU capable`,
      `**Images :** JPG, PNG, WebP équirectangulaires ; HDR/EXR/KTX2 si la pipeline le supporte`,
      "**Mobile :** consultation OK ; édition plus confortable sur desktop",
    ],
    viewA: {
      caption: "Étape 2 — hotspot feu animé et popup particules",
    },
    viewB: {
      caption: "Étape 3 — beat eau / spout sur le toit",
    },
    viewC: {
      caption: "Étape 4 — popup Animated birds avec la volée contre le ciel d’orage",
    },
    alsoCan: [
      "Enchaîner plusieurs panoramas en tour multi-scènes guidée",
      "Ajouter popups URL ou iframe sur hotspots pour pages produit ou embeds",
      `Superposer [particules](/blog/webgpu-particles), [spout](/blog/spout) et [oiseaux](/blog/webgpu-compute-birds) sur étapes guidées 2–4`,
    ],
    howWorks: `Les panoramas sont mappés sur une sphère (ou pipeline cube) pour centrer la caméra — l’approche web 360 classique avec [Three.js](https://threejs.org/) et APIs navigateur modernes ([WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) / [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) optionnel). Les hotspots sont métadonnées scène : position, type, cible. Les étapes guidées sur The Black Witness câblent les mêmes démos effet en beats interactifs — Étape 2 \`+particles\` ([WebGPU Particles](/blog/webgpu-particles)), Étape 3 \`+particles/spout\` ([Spout](/blog/spout)), Étape 4 \`+birds\` ([WebGPU Compute Birds](/blog/webgpu-compute-birds)) — chacune avec \`hotspot+popup\`. Preview visiteur = même moteur sans chrome éditeur — voir [tour The Black Witness](/blog/panorama-suite).`,
    faq: [
      {
        q: "Les invités ont-ils besoin d’une app ?",
        a: "Non. Partagez un lien navigateur. Le mode preview masque l’éditeur.",
      },
      {
        q: "Peut-on utiliser nos panoramas ?",
        a: `Oui — chargez des stills équirectangulaires et construisez hotspots autour de votre lieu ou produit.`,
      },
      {
        q: "Comment particules, spout et oiseaux se connectent à la tour ?",
        a: `Couches effet optionnelles sur étapes guidées 2–4. Chaque étape associe arrêt caméra, effet et popup hotspot — explorez les démos standalone, puis Play guided tour dans /demos/panorama-360/.`,
      },
    ],
    reading: [
      {
        label: "Éditeur tour live",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Projection équirectangulaire — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Equirectangular_projection",
      },
    ],
    related: [
      {
        label: "The Black Witness — Tour 360°",
        url: "/blog/panorama-suite",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "crm-demo": {
    pageTitle: "CRM Demo — essayer le bac à sable client IOM",
    demoLabel: "CRM Demo",
    hook: `Envie de voir comment IOM gère leads, projets et temps sans toucher aux données client live ? La CRM Demo est un bac à sable interactif avec des entreprises fictives — pipeline, boards, idées et brouillons blog qui restent dans cet onglet.`,
    coverNote: "La couverture montre l’UI sandbox CRM de la carte portfolio.",
    whyBullets: [
      `- **Cliquer partout sans risque** — les edits ne touchent jamais les bases production`,
      `- **Vraie sensation workspace** — leads, projets, temps, idées et posts blog exemple`,
      "- **Pitcher en réunion** — ouvrir `/crm-demo` et parcourir le flux live",
      "- **Même famille produit** — reflète le vrai CRM client sur `/client-login`",
    ],
    whyUses: `démos commerciales, walkthroughs onboarding, formation parties prenantes et conversations « à quoi ressemblerait notre pipeline ? » avant provisionnement d’un vrai workspace.`,
    beginner: `Un CRM (customer relationship management) est là où un studio suit qui a demandé, quels projets sont actifs et comment le temps est passé. Cette démo est une cuisine d’entraînement : recettes réelles, ingrédients fictifs, rien de ce que vous tapez ne quitte l’onglet sauf export volontaire.`,
    glossary: [
      {
        term: "Sandbox",
        def: "copie d’entraînement de l’app avec fausses données qui reset en sécurité",
      },
      {
        term: "Pipeline",
        def: "étapes qu’un lead traverse avant de devenir projet",
      },
      {
        term: "In-memory",
        def: "données dans cette session navigateur, pas sur le serveur live",
      },
      {
        term: "Client login",
        def: "le vrai CRM sur `/client-login` avec données Supabase",
      },
    ],
    trySteps: [
      "Ouvrir la [CRM Demo](/crm-demo)",
      "Parcourir Leads ou Projects — ouvrir une fiche entreprise fictive",
      `Faire une petite modification (statut, note ou carte board) pour sentir le sandbox`,
      "Optionnel : ouvrir Blog dans la demo CRM et prévisualiser un post exemple",
    ],
    requirements: [
      `**Navigateur :** tout navigateur desktop moderne ; fenêtre large utile pour les boards`,
      `**Confidentialité :** données sandbox locales à l’onglet — refresh peut reset le store`,
      `**Pas production :** ne jamais entrer de secrets client réels ; \`/client-login\` pour le travail live`,
    ],
    viewA: {
      caption: "Vue pipeline — leads fictifs en colonnes d’étapes",
    },
    viewB: {
      caption: "Board projet — tâches et contexte pour une entreprise demo",
    },
    alsoCan: [
      "Explorer suivi du temps et cartes d’idées avec entrées exemple",
      "Reset le workspace demo pour repartir propre",
      "Comparer le ressenti sandbox avec le vrai CRM après login",
    ],
    howWorks: `La [CRM demo](/crm-demo) publique utilise un store in-memory pour que chaque clic soit jetable. Le CRM production sur \`/client-login\` parle à Supabase pour données staff et client réelles. Même langage UI, backend différent — un pitch ne risque jamais un enregistrement live.`,
    faq: [
      {
        q: "Mes modifications apparaissent-elles pour d’autres visiteurs ?",
        a: `Non. Le sandbox est par onglet / session. Chacun voit sa copie des données fictives.`,
      },
      {
        q: "Est-ce la même chose que client login ?",
        a: `Même famille produit et écrans, mais \`/crm-demo\` ne touche jamais les bases live. Le vrai travail est sur \`/client-login\`.`,
      },
    ],
    reading: [
      {
        label: "CRM Demo",
        url: "/crm-demo",
      },
      {
        label: "Client login",
        url: "/client-login",
      },
      {
        label: "Accueil IOM",
        url: "/",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "Image Prep",
        url: "/blog/image-prep",
      },
    ],
  },
  "image-prep": {
    pageTitle: "Image Prep — redimensionner, compresser et retirer EXIF dans le navigateur",
    demoLabel: "Image Prep",
    hook: `Les images portfolio et web doivent être nettes, légères et privées. Image Prep redimensionne aux presets courants, compresse JPEG/WebP/PNG et retire EXIF caméra/GPS — les fichiers restent sur votre appareil jusqu’au téléchargement.`,
    coverNote: "La couverture montre l’UI outil Image Prep de la carte logiciel.",
    whyBullets: [
      `- **Rester on-device** — pas d’upload sur un serveur inconnu pour un resize rapide`,
      "- **Presets web-ready** — tailles portfolio et site sans acrobaties Photoshop",
      `- **Confidentialité par défaut** — retirer EXIF pour ne pas fuiter GPS et métadonnées caméra`,
      `- **Moins de poids, même histoire** — compresser pour pages plus rapides et factures CDN plus légères`,
    ],
    whyUses: `préparer stills hero, uploads galerie, couvertures CRM/blog et packs remise client avant CMS ou page demo.`,
    beginner: `Avant qu’une photo aille sur un site, elle a souvent besoin de trois services : la bonne taille en pixels, un fichier plus petit, moins de données personnelles dans l’en-tête. Image Prep le fait dans le navigateur — glisser une image, choisir un preset, télécharger une version plus propre.`,
    glossary: [
      {
        term: "EXIF",
        def: "métadonnées embarquées par les appareils (réglages, horodatage, parfois GPS)",
      },
      {
        term: "Compresser",
        def: "réduire la taille fichier, souvent avec curseur qualité",
      },
      {
        term: "WebP",
        def: "format image moderne souvent plus petit que JPEG à qualité similaire",
      },
      {
        term: "On-device",
        def: "traitement dans le navigateur ; vous choisissez quand télécharger",
      },
    ],
    trySteps: [
      "Ouvrir [Image Prep](/tools/image-prep)",
      "Déposer un JPG ou PNG depuis votre machine",
      "Choisir preset resize et format (JPEG / WebP / PNG)",
      "Activer retrait EXIF si besoin, puis télécharger le résultat",
    ],
    requirements: [
      "**Navigateur :** Chrome, Edge ou Firefox moderne avec support canvas",
      "**Confidentialité :** traitement local — éviter de coller des secrets ailleurs",
      `**Limites :** très gros RAW peuvent nécessiter un premier passage éditeur desktop`,
    ],
    viewA: {
      caption: "Disposition outil — image source et contrôles prep",
    },
    viewB: {
      caption: "Après prep — sortie taille web prête à télécharger",
    },
    alsoCan: [
      "Traiter en lot quelques stills portfolio au même preset",
      "Exporter WebP si le site destination le supporte",
      "Utiliser avant upload de couvertures pour posts blog ou demo CRM",
    ],
    howWorks: `L’outil utilise les APIs navigateur (canvas / décodage image) pour resize et ré-encoder sur votre machine. Le retrait EXIF supprime les métadonnées embarquées pour que les fichiers publiés ne portent pas GPS ou numéros de série par accident. Contexte format : [MDN — Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) et [EXIF — Wikipedia](https://en.wikipedia.org/wiki/Exif).`,
    faq: [
      {
        q: "Mes photos sont-elles uploadées sur les serveurs IOM ?",
        a: `Non en prep normale — le travail reste dans le navigateur jusqu’au téléchargement.`,
      },
      {
        q: "La qualité sera-t-elle dégradée ?",
        a: `La compression échange toujours taille et fidélité. Commencez haute qualité ; baissez seulement si le fichier reste lourd.`,
      },
    ],
    reading: [
      {
        label: "Outil Image Prep",
        url: "/tools/image-prep",
      },
      {
        label: "EXIF — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Exif",
      },
      {
        label: "WebP — Google developers",
        url: "https://developers.google.com/speed/webp",
      },
      {
        label: "File API — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/File_API",
      },
    ],
    related: [
      {
        label: "3D Viewer",
        url: "/blog/3d-viewer",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
    ],
  },
  "raven-path": {
    pageTitle: "Raven Path Animation — vol spline dans le navigateur",
    demoLabel: "Raven Path Animation",
    hook: `Parfois, l'histoire, c'est le mouvement, pas l'image fixe. Raven Path place un GLB ailé sur une spline Catmull-Rom — faites glisser les points de contrôle, réglez vitesse et easing, inversez la route et laissez l'animation de battement d'ailes jouer pendant que l'oiseau suit le chemin.`,
    excerpt: `Animez un corbeau (ou votre propre GLB) le long d'une spline éditable — exportez le JSON du chemin pour d'autres logiciels, réimportez à la prochaine visite et ajustez le timing dans le navigateur.`,
    seo_title: "Raven Path Animation — vol spline et export de chemin — IOM",
    seo_description: `Essayez la démo Raven Path d'IOM : vol Catmull-Rom éditable, import GLB/GLTF/FBX, export/réimport JSON du chemin et guide débutant dans la section 3D.`,
    coverNote: "La couverture montre le corbeau sur son chemin de vol éditable.",
    whyBullets: [
      `- **Le chemin comme outil de design** — remodeler le vol avec des points de contrôle visibles`,
      "- **Apportez votre modèle** — importez GLB, GLTF ou FBX sur le même chemin",
      `- **Exporter et réimporter le chemin** — JSON pour d'autres logiciels ou votre prochaine session`,
      "- **Un timing ressenti** — vitesse, ease-in/out, reverse et tangente vs cap fixe",
    ],
    whyUses: `boucles hero pour films de marque, attract loops de stand, chapitres web narratifs, prototypage de chemins de « voyage » créature ou produit avant une passe d'animation complète, et transmission d'un JSON de chemin réutilisable à d'autres pipelines.`,
    beginner: `Une spline est une courbe lisse définie par quelques poignées — comme un fil flexible dans l'espace. Ici, un corbeau (ou votre modèle importé) chevauche ce fil. Vous tirez les poignées, et le vol se met à jour en direct. Pas de montage vidéo ; le chemin est le montage. Quand la route vous convient, exportez-la en JSON et rechargez-la plus tard — ou utilisez les points dans d'autres outils.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: `une courbe lisse passant par les points de contrôle ([Wikipedia](https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline))`,
      },
      {
        term: "GLB / GLTF / FBX",
        def: "formats de modèles 3D courants importables sur le chemin",
      },
      {
        term: "Path JSON",
        def: `points de contrôle exportés (et options) réimportables sur le site ou utilisables ailleurs`,
      },
      {
        term: "Tangent-aligned",
        def: `le modèle s'oriente le long de la direction du chemin`,
      },
      {
        term: "Skeletal animation",
        def: `les os pilotent le mouvement secondaire (comme le battement d'ailes) pendant que la racine suit la courbe`,
      },
    ],
    trySteps: [
      "Ouvrez la [démo Raven Path](/demos/raven-path/)",
      `Regardez un tour, puis faites glisser un point de contrôle de la spline et voyez la route se remodeler`,
      `Dans **Path** : **Export path JSON**, puis **Import path JSON** (ou glissez le fichier sur la scène)`,
      `Optionnel : **Import GLB / GLTF / FBX**, puis réglez vitesse, ease, reverse ou orientation tangente`,
    ],
    requirements: [
      "**Navigateur :** Chrome, Edge ou Firefox moderne avec WebGL",
      "**GPU :** graphiques intégrés suffisent généralement pour cette scène",
      `**Saisie :** souris ou trackpad facilitent l'édition de points vs téléphone`,
      `**Fichiers :** privilégiez GLB autonome pour les modèles ; les fichiers de chemin sont en JSON`,
    ],
    viewA: {
      caption: "Vue large du chemin — courbe et corbeau dans un même cadre",
    },
    viewB: {
      caption: `Vol rapproché — pose d'aile le long de la spline`,
    },
    alsoCan: [
      `Copier l'extrait THREE.Vector3 du panneau Path pour vos outils Three.js`,
      `Comparer avec l'expérience [éditeur de spline](/demos/spline-editor/) associée`,
      `Étudier les modificateurs de courbe dans la [démo WebGPU curve](/demos/webgpu-modifier-curve/)`,
      `Réutiliser l'idée de chemin pour des « tours » produit ou des fly-through caméra`,
    ],
    howWorks: `La démo utilise [Three.js](https://threejs.org/) pour échantillonner une courbe Catmull-Rom à chaque frame, placer la racine du modèle sur cet échantillon et, optionnellement, aligner son axe avant sur la tangente de la courbe pendant qu'un clip squelettique (s'il existe) pilote le mouvement secondaire. Path JSON stocke points de contrôle, boucle fermée et transform du chemin pour réimporter sur la [démo live](/demos/raven-path/) ou alimenter d'autres logiciels. Même famille d'idées que les exemples courbes et animation three.js — ici calibrée pour une boucle créature lisible avec import et export.`,
    faq: [
      {
        q: "Peut-on remplacer le corbeau par notre mascotte ?",
        a: `Oui — utilisez **Import GLB / GLTF / FBX** dans la démo pour tester votre modèle sur le chemin immédiatement. Pour une version de production brandée, demandez-nous une version scoped.`,
      },
      {
        q: `Comment réutiliser un chemin plus tard ou dans d'autres logiciels ?`,
        a: `Utilisez **Export path JSON** dans le panneau Path. Réimportez ce fichier lors d'une prochaine visite sur le site, ou utilisez les champs \`points\` / \`threeJsSnippet\` dans Blender, Three.js ou vos propres outils.`,
      },
      {
        q: "Est-ce de la vidéo ou du temps réel ?",
        a: `WebGL temps réel. Vous pouvez enregistrer l'écran ou exporter ailleurs, mais la démo elle-même est une scène live.`,
      },
    ],
    reading: [
      {
        label: "Démo Raven Path",
        url: "/demos/raven-path/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "Spline Catmull–Rom — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
      {
        label: "Éditeur de spline (associé)",
        url: "/demos/spline-editor/",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "Dream — Ocean scroll",
        url: "/blog/iom-three",
      },
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
    ],
  },
  "artist-globe": {
    pageTitle: "Artist Globe — une carte vivante de la pratique créative",
    demoLabel: "Artist Globe",
    hook: `Les portfolios se dispersent sur le web ; la géographie compte encore. Artist Globe est une Terre WebGL interactive de photographes, peintres, sculpteurs, artistes sonores et plus — filtrez par pratique, ouvrez des profils, mettez des pays en évidence et soumettez une fiche pour examen.`,
    coverNote: `La couverture montre le globe avec les marqueurs d'artistes de la carte 3D.`,
    whyBullets: [
      `- **Découvrir par le lieu** — faire tourner le monde au lieu de défiler des grilles infinies`,
      "- **Filtrer par pratique** — photographes, peintres, sculpteurs, son, et plus",
      `- **Ouvrir de vrais portfolios** — passer d'un marqueur aux liens d'un artiste`,
      `- **Boucle communautaire** — soumettre un profil pour examen quand vous voulez apparaître`,
    ],
    whyUses: `découverte culturelle, repérage de résidences et festivals, réseautage en studio, et mises en avant portfolio qui ont besoin d'une couche spatiale « qui est où ? ».`,
    beginner: `Imaginez un globe de bureau avec des épingles pour les artistes. Vous le faites tourner, filtrez qui apparaît, et cliquez une épingle pour en savoir plus. C'est une carte de personnes et de pratiques, pas une caisse de boutique.`,
    glossary: [
      {
        term: "WebGL globe",
        def: `une Terre 3D dessinée dans le navigateur avec des graphismes de type [Three.js](https://threejs.org/)`,
      },
      {
        term: "Practice filter",
        def: `n'afficher que certaines disciplines (ex. photographie)`,
      },
      {
        term: "Profile",
        def: "une fiche artiste avec liens et surbrillance de pays",
      },
      {
        term: "Submit for review",
        def: "demander à être ajouté ; les éditeurs approuvent avant publication",
      },
    ],
    trySteps: [
      "Ouvrez [Artist Globe](/artist-globe)",
      "Glissez pour faire tourner ; scrollez ou pincez pour zoomer vers une région",
      "Utilisez les filtres de pratique pour affiner qui apparaît",
      `Cliquez un marqueur pour ouvrir un profil, ou suivez le flux de soumission si vous voulez postuler`,
    ],
    requirements: [
      "**Navigateur :** navigateur desktop ou mobile moderne avec WebGL",
      "**Réseau :** profils et assets de carte nécessitent une connexion",
      `**Performance :** réduisez les autres onglets GPU si le globe semble lourd sur les vieux portables`,
    ],
    viewA: {
      caption: "Globe complet — marqueurs sur les continents",
    },
    viewB: {
      caption: "Focus régional — surbrillance de pays et pratique sélectionnée",
    },
    alsoCan: [
      "Mettre un pays en évidence en pitchant une cohorte régionale",
      `Partager \`/artist-globe\` comme page d'accueil de découverte`,
      "Mode embed-friendly pour des cadres portfolio plus serrés (`?embed=1`)",
    ],
    howWorks: `Le globe est une scène [Three.js](https://threejs.org/) / [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) : une sphère texturée, contrôles caméra, et sprites ou meshes marqueurs liés à lat/lon. Données de profil et soumissions passent par la stack web IOM pour que la carte reste curatée plutôt qu'un free-for-all non modéré.`,
    faq: [
      {
        q: `N'importe qui peut-il apparaître sur le globe ?`,
        a: `Les fiches passent par un parcours soumettre-et-examiner pour que la carte reste utile et fiable.`,
      },
      {
        q: "Est-ce un réseau social ?",
        a: `Non — c'est une carte de découverte de pratiques créatives avec liens vers les portfolios.`,
      },
    ],
    reading: [
      {
        label: "Artist Globe",
        url: "/artist-globe",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
      {
        label: "Section 3D IOM",
        url: "/#3d",
      },
    ],
    related: [
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
      {
        label: "Art Gallery — SSR + Denoise",
        url: "/blog/ssr-denoise",
      },
    ],
  },
  "ssr-denoise": {
    pageTitle: "Art Gallery — WebGPU SSR + Denoise",
    demoLabel: "Art Gallery — WebGPU SSR + Denoise",
    hook: `Les sols brillants et le verre ne semblent réels que si les reflets tiennent. Cette démo galerie exécute des réflexions screen-space WebGPU avec débruitage spatiotemporel — importez GLTF/FBX, changez les ciels HDR/EXR, marchez en third person et comparez reflets bruts vs nettoyés.`,
    coverNote: `La couverture montre l'espace galerie avec reflets débruités.`,
    whyBullets: [
      `- **Des reflets qui tiennent** — SSR avec denoise au lieu d'une traînée floue`,
      `- **Apportez votre modèle** — chargez GLTF/FBX dans l'enveloppe galerie`,
      `- **Changez le ciel** — panoramas HDR/EXR changent l'ambiance en secondes`,
      `- **Parcourez l'espace** — exploration third person pour une lecture à l'échelle client`,
    ],
    whyUses: `viz produit intérieur, pitches galerie et showroom, revues de matériaux, et conversations R&D WebGPU sur qualité de réflexion vs framerate.`,
    beginner: `Les réflexions screen-space (SSR) simulent miroirs et sols brillants en réutilisant ce que la caméra voit déjà, au lieu de rendre un second monde complet. Ça peut paraître bruité. Denoise est la passe de nettoyage qui transforme le bruit scintillant en réflexion stable — plus proche de l'éclairage cinéma, toujours en direct.`,
    glossary: [
      {
        term: "WebGPU",
        def: `API GPU navigateur moderne ([Wikipedia](https://en.wikipedia.org/wiki/WebGPU), [MDN](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API))`,
      },
      {
        term: "SSR",
        def: `screen-space reflections — miroirs brillants à partir de ce qui est à l'écran`,
      },
      {
        term: "Denoise",
        def: `un filtre qui lisse les échantillons de réflexion bruités dans l'espace et le temps`,
      },
      {
        term: "HDR / EXR",
        def: `cartes d'environnement haute plage dynamique pour éclairage et ciel`,
      },
      {
        term: "Third-person walk",
        def: "déplacer un personnage dans la galerie au lieu du free-fly seul",
      },
    ],
    trySteps: [
      "Ouvrez la [démo SSR + Denoise](/demos/ssr-denoise/) dans Chrome ou Edge",
      `Orbitez ou marchez jusqu'à voir une réflexion de sol brillant`,
      `Basculez ou comparez reflets bruts vs débruités si l'UI expose l'interrupteur`,
      `Optionnel : importez un petit GLTF/FBX ou changez un HDR pour ré-éclairer la pièce`,
    ],
    requirements: [
      "**Navigateur :** Chrome ou Edge avec WebGPU activé (113+ recommandé)",
      "**Matériel :** GPU discret ou intégré récent ; baissez la qualité si ça saccade",
      "**Mobile :** limité — traitez le desktop comme première expérience",
    ],
    viewA: {
      caption: `Galerie large — murs d'art et sol réfléchissant`,
    },
    viewB: {
      caption: "Détail de réflexion — brillance débruitée sous les lumières",
    },
    alsoCan: [
      `Charger des modèles custom pour voir comment une pièce client se lit dans la pièce`,
      `Comparer la qualité de réflexion en mouvement — le denoise montre sa valeur en direct`,
      `Associer à d'autres études WebGPU comme le volumetric lighting sur le même site`,
    ],
    howWorks: `Le point de départ est l'exemple officiel three.js [WebGPU SSR + denoise](https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise) ([source sur GitHub](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html)). IOM enveloppe ce pipeline dans une coque galerie avec import de modèle, swap HDR/EXR et mode walk pour que l'effet soit lisible client, pas seulement un échantillon tech.`,
    faq: [
      {
        q: `Pourquoi la page est-elle vide ou m'avertit-elle ?`,
        a: `Cette démo nécessite WebGPU. Utilisez une version récente de Chrome ou Edge ; Safari et les vieux Firefox n'exposent peut-être pas encore l'API.`,
      },
      {
        q: "SSR, est-ce la même chose que le ray tracing ?",
        a: `Non. SSR réutilise l'image à l'écran ; les reflets path-traced ou ray-traced matériel sont une voie plus lourde. Denoise rend SSR plus présentable en temps réel.`,
      },
    ],
    reading: [
      {
        label: "Démo live SSR + Denoise",
        url: "/demos/ssr-denoise/",
      },
      {
        label: "Exemple three.js SSR denoise",
        url: "https://threejs.org/examples/#webgpu_postprocessing_ssr_denoise",
      },
      {
        label: `Source de l'exemple sur GitHub`,
        url: `https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_postprocessing_ssr_denoise.html`,
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
    ],
  },
  "iom-three": {
    pageTitle: "Dream — récit scroll océan",
    demoLabel: "Dream — Ocean scroll",
    hook: `Toute pièce 3D ne devrait pas être un cube en orbite. Dream est un récit au scroll à travers eau sombre et calme, pluie, terre lointaine et rivage — distorsion procédurale, audio ambiant optionnel et runtime météo avec ciel, nuages et sync jour/nuit. Chapitre 1 sur 9 ; work in progress.`,
    coverNote: `La couverture est l'écran de départ Dream — titre, ligne calme et contrôle play avant le début du scroll.`,
    whyBullets: [
      `- **Le scroll comme caméra** — le mouvement de page raconte le chapitre, pas seulement un drag en orbite`,
      `- **L'atmosphère d'abord** — eau, pluie et météo posent le beat émotionnel`,
      "- **Un audio qui suit** — crossfade ambiant optionnel avec les chapitres visuels",
      "- **Esprit série** — chapitre 1 sur 9 signale un arc narratif plus long",
    ],
    whyUses: `landings de story de marque, compagnons web d'exposition, ouvertures de folio, et expériences où ambiance et rythme comptent autant que la fidélité du modèle.`,
    beginner: `Au lieu d'une caméra libre que vous pilotez, vous scrollez — et la scène avance comme des pages dans un livre d'images. Les shaders eau et météo font le gros du visuel ; vous lisez avec le pouce ou la molette.`,
    glossary: [
      {
        term: "Scroll narrative",
        def: "beats narratifs liés à la position de scroll",
      },
      {
        term: "Procedural distortion",
        def: "mouvement shader qui déforme la surface sans fichier vidéo",
      },
      {
        term: "Weather runtime",
        def: "ciel, nuages et jour/nuit pilotés par paramètres",
      },
      {
        term: "Crossfade audio",
        def: "couches ambiantes se mélangent au changement de chapitre",
      },
    ],
    trySteps: [
      "Ouvrez la [démo Dream — Ocean scroll](/demos/dreams-iom/)",
      `Appuyez play sur l'écran de départ, puis scrollez lentement à travers les premiers beats d'eau`,
      "Pausez sur la figure flottante — observez ondulations, ciel et ambiance météo",
      `Si l'audio est activé dans votre build, unmutez et scrollez à nouveau pour le crossfade`,
    ],
    requirements: [
      "**Navigateur :** Chrome/Edge/Firefox moderne avec WebGL",
      "**Mouvement :** scroll desktop ou trackpad donne le rythme prévu",
      "**Audio :** optionnel — certains navigateurs exigent un clic avant le son",
    ],
    viewA: {
      caption: "Écran de départ — DREAM., ligne calme et play pour entrer dans le scroll",
    },
    viewB: {
      caption: "Après play — figure flottante sur eau sombre et calme",
    },
    alsoCan: [
      `L'utiliser comme mood board pour un lancement multi-chapitres plus long`,
      `Associer à l'étude [Three.js Ocean](/blog/threejs-ocean) pour contraster les techniques de surface`,
      "Scoper un chapitre brandé avec copy et bed audio custom",
    ],
    howWorks: `L'expérience est un canvas [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) piloté par la position de scroll : eau shader et passes atmosphériques se mettent à jour avec la valeur de progression narrative. Météo (ciel, nuages, jour/nuit) est un runtime de paramètres plutôt qu'une vidéo baked. Live sur [/demos/dreams-iom/](/demos/dreams-iom/).`,
    faq: [
      {
        q: "Est-ce terminé ?",
        a: `Chapitre 1 sur 9 est le beat public — un récit work-in-progress, pas un film clos.`,
      },
      {
        q: "Peut-on y placer notre story de marque ?",
        a: `Oui en adaptation scoped : copy, rythme, audio et grade visuel. Contactez-nous avec le plan du chapitre.`,
      },
    ],
    reading: [
      {
        label: "Dream — Ocean scroll",
        url: "/demos/dreams-iom/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGL — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGL",
      },
      {
        label: "Section 3D IOM",
        url: "/#3d",
      },
    ],
    related: [
      {
        label: "Three.js Ocean",
        url: "/blog/threejs-ocean",
      },
      {
        label: "Raven Path Animation",
        url: "/blog/raven-path",
      },
    ],
  },
  "threejs-ocean": {
    pageTitle: "Three.js Ocean — vagues Gerstner, ciel et export",
    demoLabel: "Three.js Ocean",
    hook: `Besoin d'une assiette eau hero brandable en minutes ? Cette démo océan exécute de l'eau à vagues Gerstner avec ciel procédural et preset sunset — déposez du texte 3D verre (Google Fonts), icônes décoratives, capturez des wallpapers ou exportez jusqu'à 30 secondes de vidéo WebGL.`,
    coverNote: "La couverture montre le cadrage océan sunset de la carte 3D.",
    whyBullets: [
      "- **Eau lisible vite** — vagues Gerstner et ciel sans ferme de rendu film",
      `- **Typo sur l'eau** — texte 3D verre avec Google Fonts pour les titres`,
      "- **Preset sunset** — une ambiance one-click pour pitches et lockups",
      "- **Livrables** — stills wallpaper ou court export vidéo WebGL",
    ],
    whyUses: `heroes de landing, assiettes key art d'événement, wallpapers sociaux, et comps rapides « moment marque océan » avant une passe R&D eau custom.`,
    beginner: `Les vagues Gerstner sont un classique pour simuler des houles océan en temps réel — crêtes et creux qui ressemblent plus à de l'eau qu'à une texture ripple plate. Ici elles sont sous un ciel procédural pour composer un titre ou une icône et le capturer.`,
    glossary: [
      {
        term: "Gerstner wave",
        def: "un modèle mathématique de houle utilisé dans les océans temps réel",
      },
      {
        term: "Procedural sky",
        def: "couleur de ciel et soleil calculées en shader, pas seulement un dôme photo",
      },
      {
        term: "Glass 3D text",
        def: "typo extrudée avec shading réfractif/transparent",
      },
      {
        term: "WebGL video export",
        def: "enregistrement de frames du canvas en clip court",
      },
    ],
    trySteps: [
      "Ouvrez la [démo Three.js Ocean](/demos/ocean/)",
      `Orbitez jusqu'à ce que l'horizon et le soleil se lisent clairement (essayez le preset sunset)`,
      `Ajoutez ou éditez texte 3D verre / icônes si l'UI les propose`,
      "Capturez un screenshot wallpaper ou lancez un court export vidéo (≤30s)",
    ],
    requirements: [
      "**Navigateur :** Chrome/Edge moderne recommandé pour capture et export",
      `**GPU :** graphiques intégrés suffisent généralement ; baissez la qualité si les ventilateurs tournent`,
      `**Export :** la capture vidéo est plus lourde — fermez les autres onglets pour un take propre`,
    ],
    viewA: {
      caption: "Océan sunset — horizon et houle",
    },
    viewB: {
      caption: `Lockup titre — texte verre sur l'eau`,
    },
    alsoCan: [
      "Générer des stills social/wallpaper sans quitter le navigateur",
      `Prototyper des titres d'événement avant handoff au motion design`,
      "Comparer la technique avec le récit scroll dans [Dream](/blog/iom-three)",
    ],
    howWorks: `Construit sur la lignée océan/eau three.js ([source exemple webgl_shaders_ocean](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html)) avec UI IOM pour texte, presets, screenshots et courte capture canvas. [WebGL](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API) pilote eau et ciel à chaque frame ; l'export est une capture temporisée du même canvas.`,
    faq: [
      {
        q: "Peut-on utiliser le clip commercialement ?",
        a: `Traitez la démo publique comme un aperçu. Demandez-nous un pack d'export licencié ou brandé pour les campagnes.`,
      },
      {
        q: "Est-ce la même chose que Dream — Ocean scroll ?",
        a: `Non. C'est une assiette océan orbitable avec outils d'export ; Dream est un chapitre narratif scroll sur [/demos/dreams-iom/](/demos/dreams-iom/).`,
      },
    ],
    reading: [
      {
        label: "Démo Ocean",
        url: "/demos/ocean/",
      },
      {
        label: "Source exemple océan three.js",
        url: "https://github.com/mrdoob/three.js/blob/dev/examples/webgl_shaders_ocean.html",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "Vague Gerstner — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Trochoidal_wave",
      },
    ],
    related: [
      {
        label: "Dream — Ocean scroll",
        url: "/blog/iom-three",
      },
      {
        label: "Art Gallery — SSR + Denoise",
        url: "/blog/ssr-denoise",
      },
    ],
  },
  "panorama-suite": {
    pageTitle: "The Black Witness — visite 360° visiteur",
    demoLabel: "The Black Witness — Tour 360°",
    hook: `Le même corbeau, de nombreux mondes — ville, forêt, montagne, brume. Cet aperçu visiteur ouvre la tour The Black Witness sans chrome d'éditeur, cadré à yaw −84,7° et pitch −6°, avec hotspots, étapes guidées et atmosphère WebGPU optionnelle.`,
    coverNote: `La couverture est l'étape 1 de la visite guidée — hotspot corbeau The Black Witness avec popup ouvert.`,
    whyBullets: [
      `- **Lien visiteur d'abord** — pas d'UI éditeur ; les invités ne voient que la tour`,
      `- **Étapes guidées** — un parcours dans l'histoire, pas seulement le regard libre`,
      "- **Hotspots porteurs de sens** — info et sauts qui enseignent en explorant",
      `- **Cadrage partageable** — deep-link yaw/pitch pour une première vue intentionnelle`,
    ],
    whyUses: `compagnons d'exposition, lancements de séries photo, boucles d'attraction stand et preuves client de ce qu'une histoire 360° finie ressent sur téléphone ou laptop.`,
    beginner: `Vous êtes debout dans une photographie 360°. Glissez pour regarder ; touchez les marqueurs pour apprendre ou aller au lieu suivant. Le mode preview est le « billet invité » — l'éditeur sert à construire ; ce lien est comment le public vit l'expérience.`,
    glossary: [
      {
        term: "Aperçu visiteur",
        def: `mode tour sans outils d'édition (\`mode=preview\`)`,
      },
      {
        term: "Yaw / pitch",
        def: "angles de regard horizontal et vertical pour la vue de départ",
      },
      {
        term: "Visite guidée",
        def: `arrêts ordonnés que l'expérience peut enchaîner`,
      },
      {
        term: "Hotspot",
        def: "un marqueur cliquable pour info ou la scène suivante",
      },
    ],
    trySteps: [
      "Ouvrir la [tour visiteur Black Witness](/demos/panorama-360/?mode=preview)",
      "Cliquer **Play guided tour** — quatre arrêts caméra avec popups et effets",
      "Ouvrir un hotspot vous-même après avoir arrêté la tour",
      `Partager l'URL preview pour que les collègues arrivent dans la même expérience`,
    ],
    requirements: [
      `**Navigateur :** navigateur mobile ou desktop moderne ; les effets WebGPU demandent un appareil capable`,
      `**Réseau :** panoramas lourds en images — préférer le Wi‑Fi au premier chargement`,
      "**Entrée :** glisser tactile ou souris ; casque non requis",
    ],
    viewA: {
      caption: "Étape 2 — hotspot feu animé et popup particules",
    },
    viewB: {
      caption: "Étape 3 — beat eau / spout sur le toit",
    },
    viewC: {
      caption: `Étape 4 — popup oiseaux animés avec la volée contre le ciel d'orage`,
    },
    alsoCan: [
      `Aller à l'[éditeur](/demos/panorama-360/) quand vous devez authorer des hotspots`,
      `Réutiliser le pattern deep-link pour des premières vues brandées sur d'autres projets`,
      `Suivre la pile d'effets : [particles](/blog/webgpu-particles) → [spout](/blog/spout) → [birds](/blog/webgpu-compute-birds)`,
    ],
    howWorks: `Preview réutilise le même moteur panorama que l'[éditeur de tour 360°](/blog/panorama-360-tour), mais les flags URL masquent le chrome d'authoring et fixent la caméra initiale (\`yaw\`, \`pitch\`). Hotspots et étapes guidées sont des données projet sur scènes équirectangulaires — [Three.js](https://threejs.org/) pour la sphère caméra, couches [WebGPU](https://en.wikipedia.org/wiki/WebGPU) optionnelles pour l'atmosphère. Sur The Black Witness, l'étape 2 superpose [particles](/blog/webgpu-particles), l'étape 3 [spout](/blog/spout) et l'étape 4 [birds](/blog/webgpu-compute-birds) — chacune avec hotspot+popup pour que les invités aient du mouvement calé sur un beat narratif cliquable.`,
    faq: [
      {
        q: "Pourquoi ma vue démarre dans une direction précise ?",
        a: `Le lien fixe yaw −84,7° et pitch −6° pour que tout le monde partage la même composition d'ouverture.`,
      },
      {
        q: "Puis-je éditer les hotspots depuis cette URL ?",
        a: `Pas en preview. Utilisez l'[éditeur de tour](/demos/panorama-360/) (ou demandez-nous un build d'authoring production).`,
      },
      {
        q: `Quelles sont les couches d'effet aux étapes 2–4 ?`,
        a: `Étape 2 particles, étape 3 spout/eau, étape 4 birds — chacune avec popup hotspot. Les pages d'expérience standalone documentent la même tech.`,
      },
    ],
    reading: [
      {
        label: "Lien tour visiteur",
        url: "/demos/panorama-360/?mode=preview&yaw=-84.7&pitch=-6",
      },
      {
        label: "Éditeur de tour",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — Wikipedia",
        url: "https://en.wikipedia.org/wiki/WebGPU",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "css3d-sprites": {
    pageTitle: `CSS3D Sprites — HTML dans l'espace 3D`,
    demoLabel: "CSS3D Sprites",
    hook: `Cinq cent douze éléments HTML flottant comme sprites — puis morphant entre plan, cube, nuage et sphère. C'est Three.js CSS3DRenderer : de vrais nœuds DOM dans l'espace caméra, pas seulement des quads texturés.`,
    coverNote: `La couverture montre le nuage de sprites en plein morph — tuiles HTML lisibles comme formation 3D.`,
    whyBullets: [
      `- **DOM rencontre la profondeur** — vrai contenu HTML/CSS qui orbite quand même en 3D`,
      `- **Storytelling morph** — plan → cube → nuage → sphère vend « les données deviennent forme »`,
      `- **Mouvement sans moteur de jeu** — pulsation d'échelle et transitions dans le navigateur`,
      `- **Prototype UI dans l'espace** — cartes, labels ou photos en layouts spatiaux`,
    ],
    whyUses: `croquis UI spatiaux, moments portfolio « particule de cartes » et démos client où le contenu doit rester du HTML lisible.`,
    beginner: `Imaginez des vignettes photo ou tuiles colorées disposées dans une pièce que vous faites tourner. Chaque tuile reste un élément web normal — juste positionné en 3D. Quand la forme change, les tuiles volent vers de nouvelles places comme une volée chorégraphiée.`,
    glossary: [
      {
        term: "CSS3DRenderer",
        def: "voie Three.js qui positionne les éléments HTML avec des transforms CSS 3D",
      },
      {
        term: "Sprite",
        def: `un élément plat qui fait face ou se tient dans la scène comme unité type billboard`,
      },
      {
        term: "Morph",
        def: `transition animée des positions d'une formation à une autre`,
      },
      {
        term: "WebGL camera",
        def: "la même math caméra 3D que les scènes WebGL, pilotant les transforms CSS",
      },
    ],
    trySteps: [
      "Ouvrir la [démo CSS3D Sprites](/demos/css3d-sprites/)",
      "Glisser pour orbiter ; observer la formation pulser",
      `Déclencher les changements de forme (plan, cube, aléatoire, sphère) si boutons ou UI présents`,
      `Zoomer jusqu'à ce que les sprites HTML individuels restent nets — c'est l'avantage DOM`,
    ],
    requirements: [
      "**Navigateur :** Chrome, Edge, Firefox ou Safari moderne avec transforms CSS 3D",
      `**GPU :** charge légère comparée au compute WebGPU lourd — OK sur la plupart des laptops`,
      "**Note :** CSS3D + math caméra Three.js, pas une démo compute WebGPU",
    ],
    viewA: {
      caption: "Formation sphère ou cube — sprites lisibles comme volume solide",
    },
    viewB: {
      caption: "Nuage / dispersion aléatoire — profondeur et parallaxe des tuiles HTML",
    },
    alsoCan: [
      "Remplacer le contenu sprite par images, labels ou couleurs de marque",
      "Utiliser les morphs comme transitions de section dans un site pitch",
      `Comparer avec l'exemple upstream [three.js css3d_sprites](https://threejs.org/examples/#css3d_sprites)`,
    ],
    howWorks: `Three.js pilote une caméra partagée ; [CSS3DRenderer](https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer) mappe les matrices objet sur \`transform\` CSS des nœuds DOM. Les formations sont des positions cibles ; l'animation interpole chaque sprite vers la disposition suivante. Référence upstream : [css3d_sprites](https://threejs.org/examples/#css3d_sprites) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/css3d_sprites.html)). Contrairement aux systèmes de particules WebGPU, le travail ici est layout + compositing CSS plutôt que compute shaders.`,
    faq: [
      {
        q: "Est-ce WebGL ou WebGPU ?",
        a: `Ni l'un ni l'autre comme voie principale — les sprites sont du HTML via CSS3D. Three.js utilise quand même la math caméra 3D familière des scènes WebGL.`,
      },
      {
        q: "Pouvons-nous mettre de vraies cartes produit dans le nuage ?",
        a: `Oui en principe — chaque sprite peut contenir du HTML plus riche. Nous cadrons performance et lisibilité pour les builds client.`,
      },
    ],
    reading: [
      {
        label: "three.js — css3d_sprites",
        url: "https://threejs.org/examples/#css3d_sprites",
      },
      {
        label: "CSS3DRenderer docs",
        url: "https://threejs.org/docs/#examples/en/renderers/CSS3DRenderer",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "BufferGeometry Draw Range",
        url: "/blog/buffergeometry-drawrange",
      },
      {
        label: "WebGPU TSL Linked Particles",
        url: "/blog/webgpu-tsl-linked-particles",
      },
    ],
  },
  "compute-particles": {
    pageTitle: "Shape Particles — physique compute WebGPU",
    demoLabel: "Shape Particles",
    hook: `Des milliers de particules s'alignent en cube, sphère, tore, cœur — puis Release les lâche sous gravité GPU avec rebond au sol. WebGPU compute garde la simulation sur la carte graphique.`,
    coverNote: "La couverture montre un preset de forme maintenu en formation avant la chute.",
    whyBullets: [
      `- **Formation → chaos → reforme** — une histoire claire pour motion produit ou marque`,
      "- **Compute sur GPU** — étapes physique sans bloquer le thread principal",
      "- **Presets de forme** — cube, sphère, tore, cône, pyramide, anneau, cœur",
      `- **Preuve interactive** — Release et Reset vendent l'idée en un clic`,
    ],
    whyUses: `teasers de lancement, boucles stand et moments pitch « nos données deviennent cette forme ».`,
    beginner: `Pensez à du sable magnétique qui peut tenir une forme type logo, puis tomber quand vous lâchez — et revenir en forme au reset. La différence est la vitesse : le GPU met à jour chaque particule pour rester fluide.`,
    glossary: [
      {
        term: "WebGPU",
        def: "API GPU navigateur moderne (plus récente que WebGL) pour compute et rendu",
      },
      {
        term: "Compute shader",
        def: `programme GPU qui met à jour les données (positions, vitesses) sans dessiner de triangles`,
      },
      {
        term: "TSL",
        def: "Three.js Shading Language — logique GPU basée nœuds en JS",
      },
      {
        term: "Formation",
        def: "positions cibles qui font lire les particules comme une forme solide",
      },
    ],
    trySteps: [
      "Ouvrir la [démo Shape Particles](/demos/compute-particles/)",
      "Choisir un preset de forme et orbiter la formation",
      "Appuyer Release — observer gravité et rebond au sol",
      "Appuyer Reset pour reformer ; essayer une autre forme",
    ],
    requirements: [
      "**Navigateur :** Chrome ou Edge avec WebGPU activé (versions récentes)",
      "**GPU :** GPU discret ou intégré récent recommandé pour des counts denses",
      `**Fallback :** sans WebGPU vous verrez un message de capacité — pas de port WebGL`,
    ],
    viewA: {
      caption: "Formation maintenue — particules lisibles comme preset solide",
    },
    viewB: {
      caption: "Après Release — spray et rebond sur le plan au sol",
    },
    alsoCan: [
      "Cycler les presets pour une courte boucle marque",
      "Ajuster count / look pour perf stand vs laptop",
      `Comparer avec [three.js webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles)`,
    ],
    howWorks: `Un pass compute [WebGPU](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API) met à jour l'état particules chaque frame ; le renderer dessine le résultat. Three.js expose cela via son renderer WebGPU et nœuds compute TSL. Upstream : [webgpu_compute_particles](https://threejs.org/examples/#webgpu_compute_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_particles.html)). WebGL peut aussi dessiner des particules, mais la boucle gravité/reforme de cette démo est construite pour compute WebGPU.`,
    faq: [
      {
        q: "Pourquoi mon navigateur dit que WebGPU manque ?",
        a: `Cette expérience nécessite WebGPU. Utilisez Chrome ou Edge à jour ; le support Safari/Firefox varie selon la version.`,
      },
      {
        q: "Les particules peuvent-elles former notre logo ?",
        a: `Meshes cibles ou nuages de points custom sont une suite naturelle — demandez-nous un build cadré.`,
      },
    ],
    reading: [
      {
        label: "three.js — compute particles",
        url: "https://threejs.org/examples/#webgpu_compute_particles",
      },
      {
        label: "WebGPU API — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "webgpu-spotlight": {
    pageTitle: "WebGPU Spotlight — faisceaux texturés et ombres",
    demoLabel: "WebGPU Spotlight",
    hook: `Un spot light qui se comporte comme un projecteur théâtral — texture projetée dans le cône, penumbra douce, decay et ombres focalisées — sur Three.js WebGPU avec le scan classique Lucy comme sujet.`,
    coverNote: "La couverture montre Lucy sous le spotlight mobile sur sol recevant les ombres.",
    whyBullets: [
      "- **Langage lumière showroom** — cône, falloff et texture maps type gobo",
      `- **Vraies ombres** — contact au sol vend la profondeur pour produit et sculpture`,
      "- **Voie matériaux WebGPU** — éclairage Three.js moderne, pas un GIF pré-calculé",
      "- **Helpers à la demande** — visualiser la lumière en réglage",
    ],
    whyUses: `turntables produit, études galerie et pitches éclairage avant une scène production complète.`,
    beginner: `Un spotlight est un cône de lumière, comme une lampe de scène. Ici vous voyez le bord doux du cône, comment la luminosité décroît avec la distance, et comment l'ombre de la sculpture repose sur le sol — tout en live dans le navigateur.`,
    glossary: [
      {
        term: "Spotlight",
        def: `une lumière avec angle de cône, direction et texture optionnelle dans le faisceau`,
      },
      {
        term: "Penumbra",
        def: "le bord doux du cône lumineux",
      },
      {
        term: "Decay",
        def: `vitesse de chute d'intensité avec la distance`,
      },
      {
        term: "WebGPU",
        def: `l'API GPU navigateur plus récente utilisée par cette voie renderer Three.js`,
      },
    ],
    trySteps: [
      "Ouvrir la [démo WebGPU Spotlight](/demos/webgpu-spotlight/)",
      `Orbiter autour de Lucy ; observer le spot mobile et l'ombre au sol`,
      "Basculer les helpers lumière si disponibles pour voir le cône",
      "Noter penumbra et focus — bord doux vs ombre nette comme compromis",
    ],
    requirements: [
      `**Navigateur :** Chrome ou Edge avec WebGPU (pas l'ancien exemple lights WebGL)`,
      "**GPU :** tout GPU laptop récent suffit en général pour cette scène",
      `**Modèle :** Lucy PLY inclus — meshes custom lourds peuvent nécessiter optimisation`,
    ],
    viewA: {
      caption: "Trois-quarts — cône lumineux lisible sur Lucy et sol",
    },
    viewB: {
      caption: "Focus ombre — ombre de contact et penumbra au sol",
    },
    alsoCan: [
      "Échanger textures gobo / projection pour motifs de marque",
      `Associer à des démos volumétriques pour ambiance « faisceau dans l'air »`,
      `Étudier l'exemple upstream [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight)`,
    ],
    howWorks: `Three.js \`WebGPURenderer\` évalue les spot lights avec maps, penumbra, decay et shadow maps dans le pipeline WebGPU. La scène orbite un spot animé au-dessus de Lucy PLY sur un plan receveur. Exemple officiel : [webgpu_lights_spotlight](https://threejs.org/examples/#webgpu_lights_spotlight) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_lights_spotlight.html)). WebGL a aussi des exemples spotlight classiques ; cette page suit spécifiquement la voie lights WebGPU.`,
    faq: [
      {
        q: "Est-ce la même chose que les god rays volumétriques ?",
        a: `Non — c'est éclairage de surface et ombres. Pour des faisceaux dans l'air, voir notre travail d'éclairage volumétrique.`,
      },
      {
        q: "Pouvons-nous éclairer notre propre produit ?",
        a: `Oui. Remplacer Lucy par un GLB et matcher l'exposition est une suite client typique.`,
      },
    ],
    reading: [
      {
        label: "three.js — WebGPU spotlight",
        url: "https://threejs.org/examples/#webgpu_lights_spotlight",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
      {
        label: "WebGPU Custom Fog Scattering",
        url: "/blog/webgpu-custom-fog-scattering",
      },
    ],
  },
  "webgpu-compute-birds": {
    pageTitle: "WebGPU Compute Birds — flocking GPU",
    demoLabel: "WebGPU Compute Birds",
    hook: `Huit mille oiseaux en vol en essaim dans le navigateur — separation, alignment et cohesion calculés sur GPU. Bougez la souris pour perturber la volée ; ajustez le comportement en live.`,
    coverNote: "La couverture montre la volée instanciée comme murmuration cohérente.",
    whyBullets: [
      `- **Boids classiques, GPU moderne** — règles style Reynolds à échelle interactive`,
      `- **Instancing** — un mesh, des milliers d'oiseaux`,
      `- **Perturbation pointeur** — les parties prenantes ressentent l'agency en secondes`,
      "- **WebGPU compute** — simulation hors thread principal CPU",
    ],
    whyUses: `moments marque inspirés nature, UI explicatives science et stress tests pour pipelines compute GPU.`,
    beginner: `Les oiseaux en volée suivent des règles simples : ne pas s'écraser, aligner les voisins, rester avec le groupe. Multipliez par des milliers et vous obtenez une murmuration. Ici ces règles tournent sur la carte graphique pour que le mouvement reste fluide.`,
    glossary: [
      {
        term: "Boids",
        def: "modèle flocking classique : separation, alignment, cohesion",
      },
      {
        term: "Instancing",
        def: `dessiner efficacement de nombreuses copies d'un mesh`,
      },
      {
        term: "Compute",
        def: "travail GPU qui met à jour positions/vitesses oiseaux chaque frame",
      },
      {
        term: "WebGPU",
        def: "API utilisée ici au lieu des anciens tricks GPGPU WebGL-only",
      },
    ],
    trySteps: [
      "Ouvrir la [démo WebGPU Compute Birds](/demos/webgpu-compute-birds/)",
      "Observer la volée se stabiliser en mouvement cohérent",
      "Passer la souris dans la volée pour la perturber",
      "Ouvrir Birds settings et ajuster separation / alignment / cohesion",
    ],
    requirements: [
      "**Navigateur :** Chrome ou Edge WebGPU-capable recommandé",
      "**GPU :** milieu de gamme ou mieux pour 8k instances à frame rates fluides",
      "**Not WebGL :** la voie flocking compute cible WebGPU",
    ],
    viewA: {
      caption: "Large murmuration — volée lisible comme un volume",
    },
    viewB: {
      caption: "Passage plus proche — oiseaux instanciés et direction de vol",
    },
    alsoCan: [
      "Retuner les forces pour humeurs marque plus calmes vs chaotiques",
      "Utiliser comme couche de fond derrière UI (attention au contraste)",
      `Superposer la volée dans un beat ciel de [360° guided tour](/demos/panorama-360/) (Étape 4)`,
      `Comparer [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) sur threejs.org`,
    ],
    howWorks: `Chaque frame un pass compute WebGPU applique les forces flocking et écrit de nouveaux transforms ; le dessin instancié rend les oiseaux. Upstream : [webgpu_compute_birds](https://threejs.org/examples/#webgpu_compute_birds) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_compute_birds.html)). D'anciens exemples WebGL « GPGPU birds » existent dans l'histoire three.js ; cette page IOM suit l'édition compute WebGPU.`,
    tourBridge: {
      step: 4,
      stepLabel: "Visite guidée Étape 4 — couche birds + popup hotspot sur The Black Witness",
      body: `Dans la [360° Panorama Tour](/demos/panorama-360/), **l'Étape 4** est authorée comme \`cam · +birds · hotspot+popup\` : la caméra bascule vers le ciel, la couche WebGPU birds donne vie à l'atmosphère, et un hotspot/popup garde l'histoire cliquable.

Le flocking standalone prouve la tech ; la tour prouve le **pattern produit** — couches GPU vivantes calées sur un arrêt guidé pour que les invités ressentent le mouvement *et* puissent toujours glisser pour regarder et toucher pour apprendre. Les beats précédents utilisent [WebGPU Particles](/blog/webgpu-particles) (Étape 2) et [Spout](/blog/spout) (Étape 3) de la même façon.`,
    },
    faq: [
      {
        q: `Pourquoi autant d'oiseaux ?`,
        a: `L'échelle est le point — compute + instancing montrent ce que WebGPU peut soutenir interactivement.`,
      },
      {
        q: "Les oiseaux peuvent-ils suivre un chemin ou logo ?",
        a: `Champs guides et attracteurs sont des extensions courantes pour histoires client.`,
      },
      {
        q: "Où apparaissent les oiseaux dans la tour 360 ?",
        a: `Étape 4 visite guidée sur The Black Witness — couche birds avec popup hotspot. Ouvrir /demos/panorama-360/ et Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "three.js — compute birds",
        url: "https://threejs.org/examples/#webgpu_compute_birds",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/demos/panorama-360/",
      },
      {
        label: "Boids — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Boids",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
    ],
  },
  "webgpu-parallax-uv": {
    pageTitle: "WebGPU Parallax UV — profondeur dans une texture plate",
    demoLabel: "WebGPU Parallax UV",
    hook: `De la glace qui paraît plus épaisse qu'un simple plan — le parallax UV TSL décale des maps ambientCG en couches avec displacement, normales et rugosité sous éclairage HDR.`,
    coverNote: `La couverture montre le sol de glace avec profondeur parallax alors que la caméra effleure la surface.`,
    whyBullets: [
      `- **Fausse épaisseur, vraies économies** — sensation de profondeur sans mesh sculpté lourd`,
      "- **Matériaux TSL** — matériaux nœuds Three.js modernes sur WebGPU",
      "- **Stack PBR** — albedo, normale, rugosité et displacement travaillent ensemble",
      "- **Environnement HDR** — reflets qui vendent un matériau gelé",
    ],
    whyUses: `études de matériaux, plans au sol pour prises produit et revues « ce shader se lit-il ? ».`,
    beginner: `Une photo normale de glace est plate. Le parallax UV trompe l'œil : en déplaçant la caméra, la texture se décale légèrement comme s'il y avait de la profondeur sous la surface — comme regarder dans de la glace claire sans modéliser chaque fissure.`,
    glossary: [
      {
        term: "Parallax mapping",
        def: `décalage UV basé sur l'angle de vue et une map hauteur/displacement`,
      },
      {
        term: "TSL",
        def: "Three.js Shading Language pour matériaux GPU basés sur nœuds",
      },
      {
        term: "PBR",
        def: "physically based rendering — modèle matériau rugosité/métal",
      },
      {
        term: "HDR environment",
        def: "image haute plage dynamique éclairant les reflets de la scène",
      },
    ],
    trySteps: [
      "Ouvrir la [démo WebGPU Parallax UV](/demos/webgpu-parallax-uv/)",
      `Orbiter bas sur la glace — observer le décalage de profondeur selon l'angle`,
      "Comparer vues rasantes et plongées",
      "Noter comment normales et rugosité changent le rendu gelé sous HDR",
    ],
    requirements: [
      "**Navigateur :** WebGPU (Chrome/Edge recommandé)",
      `**Textures :** maps style ambientCG incluses ; réseau utile au premier chargement`,
      `**GPU :** léger à modéré — plus lourd qu'un plan plat non éclairé, plus léger que des essaims compute complets`,
    ],
    viewA: {
      caption: "Angle ras — profondeur parallax dans le plan de glace",
    },
    viewB: {
      caption: "Vue plus haute — maps en couches et reflet HDR lisibles",
    },
    alsoCan: [
      "Retargeter les maps vers pierre, bois ou matériaux de marque",
      "Utiliser comme sol sous un GLB produit",
      "Étudier [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv)",
    ],
    howWorks: `Un matériau TSL échantillonne hauteur/displacement pour décaler les UV selon la direction de vue (parallax), puis superpose couleur, normale et rugosité. WebGPURenderer exécute le graphe de nœuds. Upstream : [webgpu_parallax_uv](https://threejs.org/examples/#webgpu_parallax_uv) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_parallax_uv.html)). Des shaders parallax WebGL classiques existent ; cette démo suit la voie WebGPU + TSL.`,
    faq: [
      {
        q: "La glace est-elle un vrai volume 3D ?",
        a: `Non — c'est un plan ombré. Le parallax simule la profondeur dans le matériau.`,
      },
      {
        q: "Pouvons-nous utiliser notre propre set de textures ?",
        a: "Oui. Correspondance des noms de maps et intensité = échange matériau standard.",
      },
    ],
    reading: [
      {
        label: "three.js — parallax UV",
        url: "https://threejs.org/examples/#webgpu_parallax_uv",
      },
      {
        label: "ambientCG",
        url: "https://ambientcg.com/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU TSL Raging Sea",
        url: "/blog/webgpu-tsl-raging-sea",
      },
      {
        label: "WebGPU Custom Fog Scattering",
        url: "/blog/webgpu-custom-fog-scattering",
      },
    ],
  },
  "webgpu-tsl-raging-sea": {
    pageTitle: "WebGPU TSL Raging Sea — vagues procédurales",
    demoLabel: "TSL Raging Sea",
    hook: `Une mer déchaînée sans simulateur océanique — sinus en couches et bruit fractal déforment un plan dense, avec normales calculées et crêtes émissives, le tout en TSL sur WebGPU.`,
    coverNote: "La couverture montre une haute mer avec reflets lumineux sur les crêtes.",
    whyBullets: [
      `- **Eau procédurale** — pas de flipbook pré-calculé ; les paramètres pilotent l'ambiance`,
      "- **Displacement TSL** — la math des vagues vit dans le graphe matériau",
      `- **Énergie des crêtes** — highlights émissifs vendent écume et embruns sans particules`,
      "- **Voie WebGPU** — croquis océan Three.js moderne pour pitches et R&D",
    ],
    whyUses: `fonds d'environnement, contexte produit maritime et R&D shader avant systèmes océan FFT.`,
    beginner: `La « mer » est une grille plate que le GPU soulève et abaisse chaque frame avec des maths — grosses houles plus petit clapoti. L'éclairage sur les pentes la fait ressembler à de l'eau plutôt qu'à une feuille froissée.`,
    glossary: [
      {
        term: "Displacement",
        def: "déplacement des sommets de mesh (ou du shading) via une fonction de hauteur",
      },
      {
        term: "Fractal noise",
        def: "bruit en couches pour un détail naturel",
      },
      {
        term: "TSL",
        def: "Three.js Shading Language pour authorer le graphe de vagues",
      },
      {
        term: "Normals",
        def: `directions de surface pour l'éclairage ; recalculées depuis les vagues`,
      },
    ],
    trySteps: [
      "Ouvrir la [démo TSL Raging Sea](/demos/webgpu-tsl-raging-sea/)",
      "Orbiter et observer grosses houles vs petit clapoti",
      "Repérer les crêtes émissives au sommet des vagues",
      `Comparer l'ambiance avec nos autres expériences océan sur le site`,
    ],
    requirements: [
      "**Navigateur :** WebGPU requis pour cet exemple TSL WebGPU",
      "**GPU :** plans plus denses coûtent plus — baisser le pixel ratio si saccades",
      "**Pas océan WebGL :** distinct des démos eau/FFT WebGL classiques",
    ],
    viewA: {
      caption: "Mer orageuse large — houles en couches lisibles au loin",
    },
    viewB: {
      caption: "Détail de crête — normales et highlights émissifs",
    },
    alsoCan: [
      "Retuner amplitude et bruit pour port calme vs tempête",
      "Utiliser comme fond proche skybox sous un produit",
      `Ouvrir [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) upstream`,
    ],
    howWorks: `Le displacement vertex (ou TSL équivalent) somme de grands sinus avec bruit fractal ; les normales sont dérivées pour que l'éclairage réagisse aux pentes ; les crêtes reçoivent un lift émissif. Tourne sur Three.js WebGPU + TSL. Upstream : [webgpu_tsl_raging_sea](https://threejs.org/examples/#webgpu_tsl_raging_sea) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_raging_sea.html)). Pour mers basées spectre, voir travail océan FFT ailleurs chez IOM — technique différente, souvent WebGL ou hybride.`,
    faq: [
      {
        q: "Est-ce une simulation océan complète ?",
        a: "Non — displacement procédural. Idéal pour look dev ; pas de CFD.",
      },
      {
        q: "WebGL ou WebGPU ?",
        a: `WebGPU via Three.js TSL. Couverture appareils plus large peut encore préférer océans WebGL.`,
      },
    ],
    reading: [
      {
        label: "three.js — TSL raging sea",
        url: "https://threejs.org/examples/#webgpu_tsl_raging_sea",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "WebGPU Parallax UV",
        url: "/blog/webgpu-parallax-uv",
      },
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
    ],
  },
  "webgpu-tsl-linked-particles": {
    pageTitle: "WebGPU TSL Linked Particles — traînées VFX dessinées",
    demoLabel: "TSL Linked Particles",
    hook: `Déplacez le pointeur pour faire apparaître une traînée de particules lumineuses — compute GPU, turbulence, rubans de liens voisins, rotation de teinte et bloom. Un croquis VFX TSL que l'on ressent.`,
    coverNote: "La couverture montre des rubans de particules liées avec bloom.",
    whyBullets: [
      "- **Pointeur comme pinceau** — « essayez » instantané pour clients en visio",
      "- **Liens entre voisins** — langage réseau / synapse / constellation",
      "- **Compute + TSL** — spawn, turbulence et vie sur le GPU",
      "- **Finition bloom** — glow doux premium sur UI sombres",
    ],
    whyUses: "fonds hero, moments interactifs stand et systèmes visuels marque tech.",
    beginner: `Vous dessinez avec la lumière : des particules apparaissent sous le curseur, dérivent avec la turbulence, et de fines lignes relient les points proches — comme une constellation qui retient votre geste un instant.`,
    glossary: [
      {
        term: "Nearest-neighbor links",
        def: `lignes tracées entre particules proches dans l'espace`,
      },
      {
        term: "Turbulence",
        def: "champ de force bruité qui enroule le mouvement des particules",
      },
      {
        term: "Bloom",
        def: "glow post-process autour des pixels lumineux",
      },
      {
        term: "TSL VFX",
        def: "effets authorés avec nœuds Three.js Shading Language",
      },
    ],
    trySteps: [
      "Ouvrir la [démo TSL Linked Particles](/demos/webgpu-tsl-linked-particles/)",
      "Déplacer le pointeur sur le canvas pour dessiner des traînées",
      "Pause et observer liens et décalage de teinte pendant la vie des particules",
      "Orbiter si activé ; noter le bloom sur clusters lumineux",
    ],
    requirements: [
      "**Navigateur :** WebGPU (Chrome/Edge recommandé)",
      `**GPU :** bloom + compute veulent un peu de marge — fermer onglets lourds si besoin`,
      "**Entrée :** souris ou trackpad ; touch variable selon appareil",
    ],
    viewA: {
      caption: "Cluster dense à gauche — liens magenta avec accents cyan",
    },
    viewB: {
      caption: "Mesh rapproché — nœuds bloomés et rubans voisins",
    },
    alsoCan: [
      "Mapper le pointeur vers touch / baguette pour installations",
      "Recolorer le cycle de teinte vers palette de marque",
      `Comparer [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles)`,
    ],
    howWorks: `Le compute WebGPU spawn et advecte les particules ; matériaux TSL rendent sprites/rubans ; une passe de liens connecte particules proches ; bloom post-traite la frame. Upstream : [webgpu_tsl_vfx_linkedparticles](https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_tsl_vfx_linkedparticles.html)). Réseaux de lignes WebGL (voir draw-range) = idée visuelle proche, pipeline différent plus largement supporté.`,
    faq: [
      {
        q: "Est-ce la même démo que shape particles ?",
        a: `Non — celle-ci forme des presets solides et gravité. Ici VFX dessiné au pointeur avec liens et bloom.`,
      },
      {
        q: "Peut-on ralentir pour un film de marque calme ?",
        a: "Oui — taux de spawn, turbulence et seuils bloom sont des réglages typiques.",
      },
    ],
    reading: [
      {
        label: "three.js — TSL linked particles",
        url: "https://threejs.org/examples/#webgpu_tsl_vfx_linkedparticles",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "BufferGeometry Draw Range",
        url: "/blog/buffergeometry-drawrange",
      },
    ],
  },
  "webgpu-custom-fog-scattering": {
    pageTitle: "WebGPU Custom Fog Scattering — marcher dans la brume",
    demoLabel: "Custom Fog Scattering",
    hook: `Une promenade à la première personne parmi des silhouettes de pins procédurales dans un brouillard exponentiel frais — blur de diffusion TSL basé sur la densité qui adoucit la distance comme l'air humide.`,
    coverNote: "La couverture montre des formes de pins se dissolvant dans le brouillard diffus.",
    whyBullets: [
      `- **Atmosphère comme sujet** — ambiance d'abord, géométrie ensuite`,
      `- **Blur de diffusion** — la distance s'adoucit comme l'air humide`,
      "- **Densité réglable** — brouillard et diffusion comme curseurs de design",
      `- **WebGPU + TSL** — brouillard custom au-delà d'une seule couleur scene.fog`,
    ],
    whyUses: "pitches environnement, walkthroughs type jeu et études « météo comme marque ».",
    beginner: `Le brouillard n'est pas qu'une teinte grise. Dans l'air humide, les arbres lointains paraissent plus doux et laiteux. Cette démo vous fait vivre cette sensation — silhouettes de pins s'effaçant dans une brume fraîche que vous pouvez épaissir ou clarifier.`,
    glossary: [
      {
        term: "Exponential fog",
        def: `brouillard qui s'épaissit progressivement avec la distance`,
      },
      {
        term: "Scattering",
        def: "rebond de lumière dans le milieu — ici approximé par blur/adoucissement",
      },
      {
        term: "First-person",
        def: "caméra se déplace comme si vous marchiez dans la scène",
      },
      {
        term: "TSL",
        def: "shading nœuds pour personnaliser le brouillard sur WebGPU",
      },
    ],
    trySteps: [
      "Ouvrir la [démo Custom Fog Scattering](/demos/webgpu-custom-fog-scattering/)",
      "Marcher ou regarder autour du champ de pins",
      "Augmenter la densité du brouillard — voir la distance se fondre dans la brume",
      "Ajuster le facteur de diffusion et comparer pins lointains nets vs doux",
    ],
    requirements: [
      "**Navigateur :** Chrome ou Edge compatible WebGPU",
      `**Contrôles :** clavier / pointeur comme implémenté dans l'UI démo`,
      `**GPU :** confortable sur laptops modernes ; baisser résolution si flou de mouvement`,
    ],
    viewA: {
      caption: "Avancer — troncs plus denses alors que la brume se referme",
    },
    viewB: {
      caption: "Tronc proche — diffusion adoucit la forêt derrière",
    },
    alsoCan: [
      "Retinter le brouillard pour ambiances marque aube / nuit",
      "Remplacer silhouettes par masses architecturales",
      `Lire [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering)`,
    ],
    howWorks: `Silhouettes procédurales type arbre dans une scène WebGPU ; TSL implémente brouillard sensible à la densité et blur de diffusion pour adoucir la structure lointaine. Upstream : [webgpu_custom_fog_scattering](https://threejs.org/examples/#webgpu_custom_fog_scattering) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_custom_fog_scattering.html)). WebGL \`FogExp2\` standard est plus simple ; cette expérience montre un traitement diffusion custom sur la stack WebGPU.`,
    faq: [
      {
        q: `Est-ce de l'éclairage volumétrique ?`,
        a: `Ambiance proche, technique différente — ici focus brouillard/diffusion dans une forêt traversable, pas god rays rect-area.`,
      },
      {
        q: "Peut-on utiliser un vrai modèle de site ?",
        a: `Oui en intégration ciblée — remplacer silhouettes par LODs architecture simplifiés.`,
      },
    ],
    reading: [
      {
        label: "three.js — custom fog scattering",
        url: "https://threejs.org/examples/#webgpu_custom_fog_scattering",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Spotlight",
        url: "/blog/webgpu-spotlight",
      },
      {
        label: "Volumetric Lighting",
        url: "/blog/volume-lighting",
      },
    ],
  },
  "webgpu-modifier-curve": {
    pageTitle: `WebGPU Curve Modifier — texte le long d'une spline`,
    demoLabel: "WebGPU Curve Modifier",
    hook: `Texte extrudé qui coule le long d'une spline Catmull-Rom fermée — tirez les poignées de contrôle et le mesh se déforme avec le chemin. Une approche WebGPU des modificateurs de courbe pour logos et typo.`,
    coverNote: "La couverture montre des lettres courbées le long de la courbe éditable.",
    whyBullets: [
      "- **Typo comme géométrie** — logos et titres qui vivent sur un chemin",
      `- **Poignées live** — remodeler l'histoire devant le client`,
      "- **Spline fermée** — boucles pour mouvement stand infini",
      `- **S'accorde aux outils de chemin** — même famille qu'éditeurs spline et rails caméra`,
    ],
    whyUses: `logos animés, titres d'exposition et callouts produit pilotés par chemin.`,
    beginner: `Imaginez des lettres magnétiques flexibles collées le long d'un fil courbé. Déplacez les points de contrôle du fil et les lettres glissent et se plient en conséquence. C'est un modificateur de courbe — ici dans le navigateur sur WebGPU.`,
    glossary: [
      {
        term: "Catmull-Rom spline",
        def: "courbe lisse passant par les points de contrôle",
      },
      {
        term: "Curve modifier",
        def: "déforme un mesh pour suivre un chemin",
      },
      {
        term: "Extruded text",
        def: "géométrie de lettres 3D construite depuis un contour de police",
      },
      {
        term: "Control handle",
        def: "point draggable qui remodèle la spline",
      },
    ],
    trySteps: [
      "Ouvrir la [démo WebGPU Curve Modifier](/demos/webgpu-modifier-curve/)",
      "Cliquer une poignée de contrôle pour la sélectionner",
      "Tirer pour remodeler le chemin fermé — observer le flux du texte",
      "Orbiter pour vérifier épaisseur et silhouette des lettres",
    ],
    requirements: [
      "**Navigateur :** WebGPU (Chrome/Edge recommandé)",
      "**Entrée :** souris pour sélection et drag des poignées",
      "**GPU :** modeste — polices lourdes / extrusion fine augmentent le coût",
    ],
    viewA: {
      caption: "Boucle complète — texte extrudé suivant la spline fermée",
    },
    viewB: {
      caption: "Édition poignée — courbure locale des lettres sur le chemin",
    },
    alsoCan: [
      "Remplacer la chaîne par un wordmark de marque",
      "Exporter idées de chemin vers workflows rails caméra",
      `Comparer [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve)`,
    ],
    howWorks: `Une courbe Catmull-Rom fermée définit le chemin ; un modificateur échantillonne la courbe pour transformer la géométrie texte extrudée à chaque update. WebGPURenderer dessine le résultat. Upstream : [webgpu_modifier_curve](https://threejs.org/examples/#webgpu_modifier_curve) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_modifier_curve.html)). Pour édition pure de chemin sans modificateur, voir l'[éditeur spline](https://threejs.org/examples/#webgl_geometry_spline_editor) WebGL — outils complémentaires.`,
    faq: [
      {
        q: "Peut-on utiliser notre police ?",
        a: `En général oui avec une police licenciée meshable pour le web — nous gérons la conversion en builds production.`,
      },
      {
        q: "WebGPU requis ?",
        a: `Pour cette page démo, oui. Les idées de courbe peuvent aussi partir en WebGL selon le projet.`,
      },
    ],
    reading: [
      {
        label: "three.js — curve modifier",
        url: "https://threejs.org/examples/#webgpu_modifier_curve",
      },
      {
        label: "three.js — spline editor",
        url: "https://threejs.org/examples/#webgl_geometry_spline_editor",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "Catmull Spline Editor",
        url: "/blog/spline-editor",
      },
      {
        label: "Shape Particles",
        url: "/blog/compute-particles",
      },
    ],
  },
  "webgpu-particles": {
    pageTitle: "WebGPU Particles — sprites feu et fumée",
    demoLabel: "WebGPU Particles",
    hook: `Sprites feu et fumée instanciés avec cycles de vie TSL — UV fumée rotatives, feu additif et grille au sol simple. VFX WebGPU compact pour ambiance et chaleur produit.`,
    coverNote: `La couverture montre le même langage particules feu/fumée que Guided Tour Step 2 sur The Black Witness — chaleur rooftop avec popup hotspot « Animated fire » dans https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      "- **VFX élémentaire lisible** — feu + fumée sans package FX complet",
      "- **Sprites instanciés** — beaucoup de particules, une stratégie de draw",
      "- **Cycles de vie TSL** — spawn, vieillissement et fade sur la voie GPU",
      "- **Feu additif** — glow qui composite proprement sur scènes sombres",
      `- **Branché aux tours 360°** — Step 2 sur [Panorama 360](https://iobjectm.com/demos/panorama-360/) associe particules et popup hotspot`,
    ],
    whyUses: `ambiances forge / lancement, croquis camp et industriel, boucles hero légères et beats chaleur dans tours guidées 360° interactives.`,
    beginner: `Feu et fumée ici sont de petites images (sprites) qui s'estompent et tourbillonnent dans le temps. Le blending additif rend les flammes lumineuses ; la fumée utilise des textures plus douces. Ensemble ils vendent la chaleur sans simuler une vraie combustion. Dans notre [tour 360°](https://iobjectm.com/demos/panorama-360/), ce même langage devient Guided Tour Step 2 — un arrêt que les visiteurs peuvent regarder autour et cliquer.`,
    glossary: [
      {
        term: "Sprite particle",
        def: "quad texturé, souvent face caméra, pour fumée/feu",
      },
      {
        term: "Additive blending",
        def: `les couleurs s'additionnent — lumineux pour le feu, facile à sur-exposer`,
      },
      {
        term: "Life cycle",
        def: "naissance, vieillissement et mort de chaque particule",
      },
      {
        term: "Instancing",
        def: "dessiner efficacement beaucoup de particules depuis un modèle",
      },
      {
        term: "Guided tour Step 2",
        def: "sur /demos/panorama-360/ — cam · +particles · hotspot+popup",
      },
    ],
    trySteps: [
      "Ouvrir la [démo WebGPU Particles](/demos/webgpu-particles/)",
      "Orbiter la colonne — séparer cœur de feu et corps de fumée",
      "Observer rotation sprite / mouvement UV dans la fumée",
      `Ouvrir [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, et regarder Step 2 (particules + hotspot)`,
    ],
    requirements: [
      `**Navigateur :** WebGPU via Three.js (pas seulement les anciens exemples particules WebGL)`,
      "**GPU :** correct sur la plupart des laptops modernes aux counts par défaut",
      "**Affichage :** fonds UI sombres mettent le feu additif en valeur",
    ],
    viewA: {
      caption: "Walkthrough feu rooftop — panache animé sur la ville",
    },
    viewB: {
      caption: "Chaleur rapprochée — panache particules sur skyline urbain",
    },
    alsoCan: [
      "Recolorer flammes pour chaleur safe marque",
      "Superposer sous silhouette produit pour films lancement",
      `Déposer le même langage particules dans un beat [tour guidée 360°](/demos/panorama-360/) (Step 2)`,
      "Ouvrir [webgpu_particles](https://threejs.org/examples/#webgpu_particles)",
    ],
    howWorks: `Sprites instanciés échantillonnent textures feu/fumée ; matériaux nœuds TSL animent vie, rotation et blending ; WebGPURenderer composite la frame. Upstream : [webgpu_particles](https://threejs.org/examples/#webgpu_particles) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgpu_particles.html)). Systèmes particules WebGL restent largement utilisés pour support plus large — choisir l'API selon les appareils audience.`,
    tourBridge: {
      step: 2,
      stepLabel: "Guided tour Step 2 — particules + popup hotspot sur The Black Witness",
      body: `Feu/fumée standalone n'est que la moitié de l'histoire. Dans la [360° Panorama Tour](/demos/panorama-360/), **Step 2** est authoré comme \`cam · +particles · hotspot+popup\` : la caméra atterrit sur un beat rooftop, une couche particules vend chaleur/ambiance, et un hotspot ouvre un popup pour que les visiteurs aient histoire + agency en un arrêt.

Cette connexion est le bénéfice interactivité — les particules ne sont pas un fond wallpaper ; elles marquent un **moment où l'on peut s'arrêter, regarder autour et cliquer**. Le même craft VFX exploré ici devient un beat guidé dans une tour partageable. Voir aussi [Spout](/blog/spout) (Step 3) et [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4).`,
    },
    faq: [
      {
        q: "Est-ce une vraie simulation fluide ?",
        a: `Non — VFX sprites avec mouvement authoré. Bon marché, contrôlable, pitch-friendly.`,
      },
      {
        q: "En quoi diffère-t-il des linked particles ?",
        a: `Ici ce sont sprites feu/fumée. Linked particles mettent l'accent sur traînées pointeur et rubans voisins.`,
      },
      {
        q: "Où apparaissent ces particules dans la tour 360 ?",
        a: `Guided-tour Step 2 sur The Black Witness — particules avec popup hotspot. Ouvrir /demos/panorama-360/ et Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "three.js — WebGPU particles",
        url: "https://threejs.org/examples/#webgpu_particles",
      },
      {
        label: "360° Panorama Tour Editor",
        url: "/demos/panorama-360/",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "WebGPU — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "Spout",
        url: "/blog/spout",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
  "buffergeometry-drawrange": {
    pageTitle: "BufferGeometry Draw Range — réseaux particules WebGL",
    demoLabel: "BufferGeometry Draw Range",
    hook: `Un réseau particules vivant avec lignes de proximité — \`BufferGeometry.setDrawRange()\` ne dessine que points et segments actifs. Three.js WebGL classique, toujours un workhorse pour visuels look data.`,
    coverNote: "La couverture montre le nuage particules nœuds-liens avec connexions actives.",
    whyBullets: [
      "- **Esthétique réseau** — nœuds et arêtes qui sentent la data",
      "- **Contrôle draw range** — ne render que ce qui vit cette frame",
      "- **Graphe réglable** — count, distance et connexions max",
      "- **Portée appareils large** — WebGL, pas WebGPU-only",
    ],
    whyUses: "fonds marque tech, métaphores « système connecté » et embeds WebGL légers.",
    beginner: `Des points flottent ; quand deux se rapprochent, une fine ligne apparaît — comme des gens devenant un réseau. L'astuce est l'efficacité : le moteur ne dessine que les points et lignes actifs au lieu de tout tout le temps.`,
    glossary: [
      {
        term: "BufferGeometry",
        def: "données mesh Three.js stockées dans buffers GPU",
      },
      {
        term: "Draw range",
        def: "limiter quelle tranche de buffer est dessinée cette frame",
      },
      {
        term: "Proximity link",
        def: "ligne quand particules sont dans une distance",
      },
      {
        term: "WebGL",
        def: "API 3D navigateur largement supportée utilisée par cette démo",
      },
    ],
    trySteps: [
      "Ouvrir la [démo BufferGeometry Draw Range](/demos/buffergeometry-drawrange/)",
      "Orbiter le nuage particules",
      `Monter ou baisser count particules et distance liens dans l'UI`,
      "Observer lignes apparaître/disparaître quand voisins changent",
    ],
    requirements: [
      "**Navigateur :** tout navigateur moderne avec WebGL",
      `**GPU :** scale avec counts particules et connexions — baisser sur appareils faibles`,
      "**Note API :** voie WebGL — utile quand WebGPU indisponible",
    ],
    viewA: {
      caption: "Réseau complet — particules avec segments proximité",
    },
    viewB: {
      caption: "Graphe rapproché — liens actifs draw-range lisibles",
    },
    alsoCan: [
      "Mapper couleurs vers catégories ou force signal",
      "Utiliser comme fond atténué sous copy UI",
      `Étudier [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange)`,
    ],
    howWorks: `Particules updatent en JS (ou buffers GPU-friendly simples) ; segments ligne rebuild ou rangés pour paires proches ; \`setDrawRange\` limite draws au sous-ensemble actif. Upstream : [webgl_buffergeometry_drawrange](https://threejs.org/examples/#webgl_buffergeometry_drawrange) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_buffergeometry_drawrange.html)). Pour essaims compute WebGPU et rubans liens TSL, voir expériences plus récentes — même famille visuelle, API différente.`,
    faq: [
      {
        q: "Pourquoi pas WebGPU ici ?",
        a: `WebGL gagne encore pour couverture appareils max. WebGPU quand compute ou matériaux TSL le demandent.`,
      },
      {
        q: "Les liens peuvent-ils représenter de vraies data ?",
        a: "Oui — remplacer proximité aléatoire par vos arêtes graphe en build production.",
      },
    ],
    reading: [
      {
        label: "three.js — buffergeometry drawrange",
        url: "https://threejs.org/examples/#webgl_buffergeometry_drawrange",
      },
      {
        label: "Three.js BufferGeometry",
        url: "https://threejs.org/docs/#api/en/core/BufferGeometry",
      },
      {
        label: "WebGL — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API",
      },
    ],
    related: [
      {
        label: "CSS3D Sprites",
        url: "/blog/css3d-sprites",
      },
      {
        label: "WebGPU TSL Linked Particles",
        url: "/blog/webgpu-tsl-linked-particles",
      },
    ],
  },
  "spline-editor": {
    pageTitle: "Catmull Spline Editor — chemins à faire glisser",
    demoLabel: "Catmull Spline Editor",
    hook: `Chemins Catmull-Rom interactifs avec gizmos transform — comparer uniform, centripetal et chordal, tuner tension, exporter tableaux \`Vector3\` pour rails caméra et chemins objets.`,
    coverNote: `La couverture montre la spline éditable avec points de contrôle et contraste type courbe.`,
    whyBullets: [
      `- **Authorer chemins visuellement** — pas de listes coordonnées tapées d'abord`,
      `- **Comparaison type courbe** — uniform vs centripetal vs chordal au même endroit`,
      "- **Prêt export** — tableaux Vector3 pour rails, fly-throughs et modifiers",
      "- **Fiabilité WebGL** — fonctionne où WebGPU pas encore dispo",
    ],
    whyUses: "planification chemins caméra, rails turntable produit et outils briefing motion.",
    beginner: `Une spline est une courbe lisse guidée par quelques points de contrôle — comme une règle flexible. Tirez les points, le chemin se met à jour. Cinéastes et jeux utilisent la même idée pour mouvements caméra ; ici vous éditez dans le navigateur.`,
    glossary: [
      {
        term: "Catmull-Rom",
        def: "famille spline interpolant à travers points de contrôle",
      },
      {
        term: "Centripetal",
        def: "paramétrisation évitant souvent mieux boucles/cuspides que uniform",
      },
      {
        term: "Tension",
        def: "à quel point la courbe se courbe vers les contrôles",
      },
      {
        term: "Gizmo",
        def: `poignée translate/rotate/scale à l'écran pour un point`,
      },
    ],
    trySteps: [
      "Ouvrir la [démo Spline Editor](/demos/spline-editor/)",
      "Tirer points de contrôle avec le gizmo",
      "Basculer uniform / centripetal / chordal et comparer la courbure",
      `Exporter ou copier data Vector3 si l'UI le propose — rail caméra`,
    ],
    requirements: [
      "**Navigateur :** navigateur WebGL moderne (Chrome, Edge, Firefox, Safari)",
      "**Entrée :** souris pour drags gizmo ; desktop plus facile",
      "**API :** famille exemple Three.js WebGL — pas WebGPU",
    ],
    viewA: {
      caption: "Chemin complet — points contrôle et courbe Catmull-Rom lisse",
    },
    viewB: {
      caption: "Edit gizmo — reshape local du rail",
    },
    alsoCan: [
      "Alimenter exports dans caméras fly-through",
      "Associer au WebGPU curve modifier pour type-on-path",
      `Utiliser upstream [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor)`,
    ],
    howWorks: `Points contrôle définissent une \`CatmullRomCurve3\` ; l'éditeur visualise polyligne/courbe et permet transformer points. Type courbe et tension changent paramétrisation. Upstream : [webgl_geometry_spline_editor](https://threejs.org/examples/#webgl_geometry_spline_editor) ([source](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_geometry_spline_editor.html)). Exporter points connecte aux outils chemin IOM et au [WebGPU curve modifier](/demos/webgpu-modifier-curve/).`,
    faq: [
      {
        q: "Quel type de courbe choisir ?",
        a: `Centripetal est un default sûr contre cuspides ; comparer dans l'UI pour votre chemin.`,
      },
      {
        q: "Peut-il piloter une vraie caméra sur site client ?",
        a: "Oui — nous câblons points exportés dans un contrôleur caméra production.",
      },
    ],
    reading: [
      {
        label: "three.js — spline editor",
        url: "https://threejs.org/examples/#webgl_geometry_spline_editor",
      },
      {
        label: "Catmull–Rom spline — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Centripetal_Catmull%E2%80%93Rom_spline",
      },
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
    ],
    related: [
      {
        label: "WebGPU Curve Modifier",
        url: "/blog/webgpu-modifier-curve",
      },
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
    ],
  },
  "terrain-sandbox": {
    pageTitle: "Terrain Sandbox — peindre un monde depuis le bruit",
    demoLabel: "Terrain Sandbox",
    hook: `Bruit en couches devient collines à orbiter — placer arbres, rochers et marqueurs, régénérer seeds, tuner hauteur et rugosité. Un MVP sandbox WebGL IOM vers brushes, GLTF et vraies data DEM.`,
    coverNote: "La couverture montre un patch terrain seedé avec props dispersés.",
    whyBullets: [
      "- **Paysage jouable** — stakeholders comprennent mood site vite",
      "- **Seed + knobs** — variantes reproductibles pour direction artistique",
      `- **Props sur surface** — arbres/rochers/marqueurs pour histoires d'échelle`,
      "- **Roadmap-friendly** — MVP vers sculpt, GLTF, MapTiler DEM",
    ],
    whyUses: `pitches environnement précoces, previews type jeu et outils atelier pour talks layout.`,
    beginner: `Le sol n'est pas encore sculpté à la main — des maths (bruit) inventent collines. Vous changez hauteur et rugosité, plantez quelques objets pour que l'échelle paraisse réelle, et tournez comme en repérage.`,
    glossary: [
      {
        term: "Procedural terrain",
        def: `paysage généré par algorithmes au lieu d'un mesh scanné`,
      },
      {
        term: "Seed",
        def: "nombre rendant le même paysage aléatoire reproductible",
      },
      {
        term: "DEM",
        def: "digital elevation model — data hauteur réelle (voie future)",
      },
      {
        term: "WebGL",
        def: "API 3D navigateur utilisée par cette sandbox",
      },
    ],
    trySteps: [
      "Ouvrir la [démo Terrain Sandbox](/demos/terrain-sandbox/)",
      "Orbiter le terrain ; régénérer seed pour nouveau relief",
      "Tuner hauteur et rugosité",
      "Placer arbres, rochers ou marqueurs et revoir silhouette",
    ],
    requirements: [
      "**Navigateur :** navigateur WebGL moderne",
      `**GPU :** grilles plus grandes coûtent plus — réduire résolution sur appareils légers`,
      "**Réseau :** non requis pour terrain bruit core (props locaux à la démo)",
    ],
    viewA: {
      caption: "Relief large — collines bruit avec crêtes lisibles",
    },
    viewB: {
      caption: "Pass props — arbres/rochers donnant échelle humaine",
    },
    alsoCan: [
      "Sauver seeds favoris comme références direction artistique",
      "Planifier suite avec brushes sculpt ou props GLTF",
      "Comparer avec vraies tuiles dans Procedural GL",
    ],
    howWorks: `Échantillons bruit en couches construisent heightmap ; mesh displaced et ombré ; props raycast ou height-sample sur surface. Stack Three.js sur **WebGL** pour support large. MVP sandbox IOM — pas exemple stock three.js — avec voie vers brushes, import assets et MapTiler DEM optionnel pour vrais sites.`,
    faq: [
      {
        q: "Est-ce vraie géographie ?",
        a: `Pas encore — bruit procédural. Vrai DEM / MapTiler sur roadmap pour travail site-true.`,
      },
      {
        q: "WebGL ou WebGPU ?",
        a: `WebGL pour cette sandbox afin que plus d'appareils ouvrent le lien.`,
      },
    ],
    reading: [
      {
        label: "Three.js",
        url: "https://threejs.org/",
      },
      {
        label: "MapTiler",
        url: "https://www.maptiler.com/",
      },
      {
        label: "Procedural noise (intro)",
        url: `https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web/Building_up_a_basic_demo_with_Three.js`,
      },
    ],
    related: [
      {
        label: "Procedural GL Terrain",
        url: "/blog/procedural-gl",
      },
      {
        label: "WebGPU TSL Raging Sea",
        url: "/blog/webgpu-tsl-raging-sea",
      },
    ],
  },
  "procedural-gl": {
    pageTitle: "Procedural GL Terrain — tuiles monde réel en 3D",
    demoLabel: "Procedural GL Terrain",
    hook: `Paysages réels streamés en terrain GPU LOD — notre page embed la [procedural.eu](https://www.procedural.eu/map/) map officielle powered by procedural-gl.js (MPL-2.0). Première étape : démo upstream live ; build MapTiler self-hosted peut suivre.`,
    coverNote: `La couverture est un still live de l'embed procedural.eu — vraies tuiles élévation/imagerie MapTiler en 3D, pas sandbox bruit.`,
    whyBullets: [
      "- **Vrais lieux** — élévation depuis tuiles map, pas seulement bruit",
      "- **GPU LOD** — détail où vous regardez, meshes plus légers au loin",
      "- **Cœur open-source** — procedural-gl.js sous MPL-2.0",
      `- **Pont vers production** — embed maintenant ; self-host plus tard avec votre clé`,
    ],
    whyUses: "contexte site architecture, pitches location et geo storytelling web.",
    beginner: `Au lieu d'inventer collines, ce viewer charge vraies tuiles terrain pour survoler géographie réelle en 3D — plus proche d'une Earth view légère qu'un niveau jeu fait de bruit.`,
    glossary: [
      {
        term: "LOD",
        def: "level of detail — plus de détail mesh près caméra",
      },
      {
        term: "Map tiles",
        def: "morceaux image/élévation streamés pour vue actuelle",
      },
      {
        term: "procedural-gl.js",
        def: "bibliothèque open-source terrain GPU depuis data map",
      },
      {
        term: "MapTiler",
        def: "fournisseur tuiles souvent utilisé pour clés production (hors repo)",
      },
    ],
    trySteps: [
      "Ouvrir la [démo Procedural GL](/demos/procedural-gl/)",
      `Attendre chargement de la [procedural.eu map](https://www.procedural.eu/map/) embed`,
      "Pan et zoom sur vrai terrain",
      "Imaginer déposer bâtiment client ou chemin sur une crête connue",
    ],
    requirements: [
      "**Réseau :** requis — tuiles et embed procedural.eu demandent connectivité",
      "**Navigateur :** Chromium moderne recommandé pour terrain WebGL",
      "**Clés :** clés MapTiler production restent server-side / env — jamais commitées",
    ],
    viewA: {
      caption: "Vue régionale — terrain LOD depuis tuiles streamées",
    },
    viewB: {
      caption: "Relief rapproché — crêtes et vallées lisibles en 3D",
    },
    alsoCan: [
      `Utiliser comme contexte à côté d'un GLB géolocalisé`,
      "Planifier fork MapTiler self-hosted",
      "Lire docs sur [procedural.eu](https://www.procedural.eu/)",
    ],
    howWorks: `Notre page \`/demos/procedural-gl/\` embed l'expérience map officielle sur [procedural.eu/map](https://www.procedural.eu/map/). Sous le capot, [procedural-gl-js](https://github.com/felixpalmer/procedural-gl-js) construit meshes GPU LOD depuis tuiles élévation/imagerie (WebGL). Prochaine étape IOM : build self-hosted avec MapTiler — clés API hors repo git. Terrain géographique, complémentaire au bruit procédural [Terrain Sandbox](/demos/terrain-sandbox/).`,
    faq: [
      {
        q: "La map est-elle hébergée par IOM ?",
        a: `Cette première étape embed procedural.eu. Variante self-hosted = tâche production séparée.`,
      },
      {
        q: "WebGL ou WebGPU ?",
        a: `Streaming terrain WebGL via procedural-gl.js — choisi pour stack bibliothèque et écosystème tuiles.`,
      },
    ],
    reading: [
      {
        label: "procedural.eu map",
        url: "https://www.procedural.eu/map/",
      },
      {
        label: "procedural.eu docs",
        url: "https://www.procedural.eu/",
      },
      {
        label: "procedural-gl-js on GitHub",
        url: "https://github.com/felixpalmer/procedural-gl-js",
      },
    ],
    related: [
      {
        label: "Terrain Sandbox",
        url: "/blog/terrain-sandbox",
      },
      {
        label: "Streets GL Bridge",
        url: "/blog/streets-gl-bridge",
      },
    ],
  },
  spout: {
    pageTitle: "Spout — eau de tuyau en raymarching",
    demoLabel: "Spout",
    hook: `Un tuyau chromé versant de l'eau raymarchée — réfraction, transparence et réflexions dans un port WebGL2 self-hosted du Shadertoy classique de P_Malin. Glissez pour orbiter la sculpture fluide — puis le même beat eau intégré dans notre [360° Panorama Tour](https://iobjectm.com/demos/panorama-360/) (guided Step 3).`,
    coverNote: `La couverture montre le bec avec eau réfractive capturant l'environnement. Le même langage d'effet apparaît comme Step 3 (\`+particles/spout\`) dans https://iobjectm.com/demos/panorama-360/.`,
    whyBullets: [
      `- **Pedigree Shadertoy** — pièce d'étude connue, maintenant sur iobjectm.com`,
      `- **Eau raymarchée** — pas de mesh splash particules ; distance fields font le travail`,
      `- **Réfraction & réflexion** — langage matériau que clients reconnaissent des pubs`,
      "- **Port WebGL2** — portée temps réel large sans WebGPU",
      `- **Branché aux tours 360°** — Step 3 sur [Panorama 360](https://iobjectm.com/demos/panorama-360/) associe spout/eau et popup hotspot`,
    ],
    whyUses: `démos craft shader, moodboards branding liquide, enseigner look-dev raymarching et beats eau dans tours guidées 360° interactives.`,
    beginner: `L'eau n'est pas un splash filmé. Le GPU avance des rayons dans une forme mathématique jusqu'à toucher « eau » ou « métal », puis courbe la vue comme une lentille. C'est pourquoi tuyau et fluide paraissent si propres sous tous les angles. Dans notre [tour 360°](https://iobjectm.com/demos/panorama-360/), ce même langage liquide devient un arrêt guidé que visiteurs peuvent regarder autour et cliquer.`,
    glossary: [
      {
        term: "Raymarching",
        def: `pas le long d'un rayon dans un distance field jusqu'à trouver une surface`,
      },
      {
        term: "SDF",
        def: "signed distance function — maths décrivant formes pour raymarchers",
      },
      {
        term: "Refraction",
        def: "courbure de la vue à travers eau transparente",
      },
      {
        term: "Shadertoy",
        def: "playground en ligne shaders pixel/raymarch (original P_Malin)",
      },
      {
        term: "Guided tour Step 3",
        def: "sur /demos/panorama-360/ — cam · +particles/spout · hotspot+popup",
      },
    ],
    trySteps: [
      "Ouvrir la [démo Spout](/demos/spout/)",
      "Glisser pour orbiter tuyau et eau",
      `Observer réfraction décaler l'arrière-plan à travers le fluide`,
      `Ouvrir [Panorama 360](https://iobjectm.com/demos/panorama-360/), Play guided tour, et regarder Step 3 (spout / eau + hotspot)`,
      `Comparer avec la [vue Shadertoy](https://www.shadertoy.com/view/lsXGzH) originale`,
    ],
    requirements: [
      "**Navigateur :** Chrome, Edge, Firefox ou Safari compatible WebGL2",
      "**GPU :** coût raymarch léger à modéré — réduire résolution si besoin",
      "**API :** port shader WebGL2 — pas compute WebGPU",
    ],
    viewA: {
      caption: "Spout hero — métal tuyau et colonne eau réfractive",
    },
    viewB: {
      caption: "Détail orbite — réflexions et transparence dans le fluide",
    },
    alsoCan: [
      "Retuner palette pour métaux marque et teinte fluide",
      "Utiliser stills comme références look-dev liquides produit",
      `Déposer le beat eau dans un arrêt [tour guidée 360°](/demos/panorama-360/) (Step 3)`,
      `Créditer et étudier le [Shadertoy](https://www.shadertoy.com/view/lsXGzH) de P_Malin`,
    ],
    howWorks: `Un shader fragment WebGL2 plein écran (ou lié mesh) raymarche SDFs pour tuyau et eau, appliquant réfraction, transparence et réflexions. IOM héberge un port de l'expérience Shadertoy [lsXGzH](https://www.shadertoy.com/view/lsXGzH) de P_Malin sous \`/demos/spout/\`. C'est shader art classique sur **WebGL2**, complémentaire aux démos scène Three.js et distinct de l'eau WebGPU TSL.`,
    tourBridge: {
      step: 3,
      stepLabel: `Guided tour Step 3 — spout / particules eau + popup hotspot sur The Black Witness`,
      body: `Spout n'est pas qu'une expérience standalone. Sur [https://iobjectm.com/demos/panorama-360/](https://iobjectm.com/demos/panorama-360/), **Step 3** de la tour guidée The Black Witness est authoré comme \`cam · +particles/spout · hotspot+popup\` : la caméra atterrit sur le beat eau rooftop, la couche spout/eau vend mouvement liquide sur place, et un popup hotspot garde le récit interactif.

C'est le bénéfice interactivité — visiteurs ne regardent pas seulement réfraction ; ils arrivent à un **arrêt temporisé**, peuvent encore regarder autour et cliquer hotspot pour le sens. Ouvrir l'éditeur ou [aperçu visiteur](https://iobjectm.com/demos/panorama-360/?mode=preview), **Play guided tour**, et aller à Step 3. Associer avec [WebGPU Particles](/blog/webgpu-particles) (Step 2) et [WebGPU Compute Birds](/blog/webgpu-compute-birds) (Step 4) pour la stack effets complète.`,
    },
    faq: [
      {
        q: `L'eau est-elle simulée avec physique ?`,
        a: "Non — géométrie/animation shader raymarchée, pas sim particules fluide.",
      },
      {
        q: "Peut-il tourner dans une scène produit Three.js ?",
        a: `Souvent en pass écran ou effet localisé — intégration scoped par projet. La tour panorama sur https://iobjectm.com/demos/panorama-360/ est un exemple production.`,
      },
      {
        q: "Où Spout apparaît-il dans la tour 360 ?",
        a: `Guided-tour Step 3 sur The Black Witness — spout/eau avec popup hotspot. Ouvrir https://iobjectm.com/demos/panorama-360/ et Play guided tour.`,
      },
    ],
    reading: [
      {
        label: "Panorama 360 (live)",
        url: "https://iobjectm.com/demos/panorama-360/",
      },
      {
        label: "Panorama 360 — visitor preview",
        url: "https://iobjectm.com/demos/panorama-360/?mode=preview",
      },
      {
        label: "Shadertoy — Spout (P_Malin)",
        url: "https://www.shadertoy.com/view/lsXGzH",
      },
      {
        label: "Ray marching — Wikipedia",
        url: "https://en.wikipedia.org/wiki/Ray_marching",
      },
      {
        label: "WebGL2 — MDN",
        url: "https://developer.mozilla.org/en-US/docs/Web/API/WebGL2RenderingContext",
      },
    ],
    related: [
      {
        label: "360° Panorama Tour Editor",
        url: "/blog/panorama-360-tour",
      },
      {
        label: "The Black Witness — 360° Tour",
        url: "/blog/panorama-suite",
      },
      {
        label: "WebGPU Particles",
        url: "/blog/webgpu-particles",
      },
      {
        label: "WebGPU Compute Birds",
        url: "/blog/webgpu-compute-birds",
      },
    ],
  },
}
