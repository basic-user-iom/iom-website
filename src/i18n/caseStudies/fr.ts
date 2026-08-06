import type { CaseStudiesLocalePack } from './types'

export const frCaseStudies: CaseStudiesLocalePack = {
  studies: {
    '3d-viewer': {
      eyebrow: 'Étude de cas · Logiciel',
      title: '3D Viewer — du brief au WebGL',
      lead: 'Comment IOM transforme un problème de revue en produit livrable : câbler le chrome, durcir le pipeline, puis remettre aux clients un lien qu’ils peuvent ouvrir en appel.',
      impact:
        'Les parties prenantes examinent des modèles complexes dans le navigateur — sans licence CAD — pour que les décisions design et sales avancent en appel partagé plutôt que de bloquer sur des échanges de fichiers.',
      primaryCtaLabel: 'Ouvrir le viewer live',
      secondaryCtaLabel: 'Article technique',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Les parties prenantes doivent revoir le 3D sans licence CAD.',
          detail:
            'Le problème central : partager un modèle en appel, pas un ZIP. Les formats varient (GLTF, FBX, OBJ, IFC), et l’éclairage ou le contexte urbain vendent souvent le pitch autant que le mesh lui-même.',
          mediaAlt: 'Affiche produit 3D Viewer — chrome d’orbite autour d’un modèle éclairé',
        },
        wire: {
          title: 'Layout & chrome de revue',
          summary: 'Panneaux, orbite et un parcours ouvrir → comprendre → décider.',
          detail:
            'Nous façonnons l’interface autour de la revue, pas de l’authoring : cadrer l’asset, changer d’environnements, garder hotspots et chemins d’export évidents. Desktop et web partagent le même modèle mental.',
          mediaAlt: 'Parcours produit — orbite, éclairage HDR et chrome du viewer',
        },
        engineering: {
          title: 'Ingénierie',
          summary: 'Pipeline Three.js, projection au sol HDR, pont Streets GL.',
          detail:
            'Les pipelines clients réels exigent la couverture des formats, une sync fiable du contexte urbain et la restauration des textures en quittant Product ↔ City. L’histoire d’ingénierie, c’est la fiabilité face à des assets salissants — pas un vide de démo.',
          mediaAlt: 'Contexte urbain OSM 3D / Streets GL dans le viewer',
        },
        final: {
          title: 'WebGL final',
          summary: 'Revue navigateur partageable et builds desktop Windows.',
          detail:
            'En ligne sur 3dbviewer.com — orbite sous HDR 360° avec projection au sol, ou Streets GL quand le lieu porte l’histoire. Le même langage craft que nos expériences, emballé pour décider.',
          mediaAlt: 'HDR 360° avec projection au sol — produit éclairé par la plaque d’environnement',
        },
      },
    },
    'black-witness': {
      eyebrow: 'Étude de cas · 360°',
      title: 'The Black Witness — du brief au 360°',
      lead: 'Comment une série photo devient une visite panorama WebGPU guidée — hotspots, calques d’effets et une preview visiteur que les clients peuvent partager.',
      impact:
        'Les clients partagent une visite 360° guidée par URL — sans installation — pour que les parties prenantes vivent le récit sur n’importe quel appareil et donnent leur retour avant le prochain shoot ou lancement.',
      primaryCtaLabel: 'Ouvrir la visite visiteur',
      secondaryCtaLabel: 'Article technique',
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Une histoire de corbeau que les invités peuvent parcourir, pas seulement regarder.',
          detail:
            'The Black Witness a commencé comme une série photographique. Le problème côté client : transformer cette atmosphère en expérience 360° guidée — regarder autour, cliquer pour apprendre, partager un lien sans installer d’app.',
          mediaAlt: 'The Black Witness — still du corbeau sur le toit qui amorce le récit 360°',
        },
        wire: {
          title: 'Structure de la visite',
          summary: 'Hotspots, arrêts guidés et parcours de preview visiteur.',
          detail:
            'Nous concevons les beats caméra et les types de hotspots (info, liens de scène, popups) pour que la visite se lise comme un storyboard. Éditeur et preview visiteur partagent un même fichier projet — construire une fois, partager une URL de preview propre.',
          mediaAlt: 'Étape 1 de la visite guidée — hotspot corbeau et popup sur The Black Witness',
        },
        engineering: {
          title: 'Ingénierie',
          summary: 'Sphère équirectangulaire, calques d’effets WebGPU, format de sauvegarde projet.',
          detail:
            'Les panoramas se mappent sur une caméra sphère ; les étapes guidées empilent particules, spout/eau et oiseaux compute synchronisés aux hotspots. `.360project` garde scènes, arrêts et effets portables entre sessions.',
          mediaAlt: 'Étape 2 — beat hotspot particules / feu dans la visite panorama',
        },
        final: {
          title: '360° final',
          summary: 'Preview visiteur partageable — sans chrome d’éditeur.',
          detail:
            'Les clients ouvrent une preview deep-linkée (yaw / pitch verrouillés pour un premier frame partagé), jouent la visite guidée ou explorent les hotspots librement. Le même moteur que l’éditeur — emballé pour les invités.',
          mediaAlt: 'Étape 4 — calque d’oiseaux et beat ciel d’orage sur The Black Witness',
        },
      },
    },
    'message-in-a-bottle': {
      eyebrow: 'Étude de cas · WebGPU',
      title: 'Message in a Bottle — du brief à la mer ouverte',
      lead: 'Comment IOM construit un souvenir navigateur sur une mer vivante : mettre en scène bouteille et parchemin, durcir océan et ciel WebGPU, puis livrer une démo que les invités ouvrent sans installation.',
      impact:
        'Clients et invités vivent un souvenir interactif dans le navigateur — mer jour/nuit, notes scellées et qualité adaptée à l’appareil — pour que les démos narratives soient assez réelles à présenter, pas seulement à décrire.',
      primaryCtaLabel: 'Ouvrir la démo live',
      secondaryCtaLabel: 'Parcourir les expériences',
      deliverables: [
        'Démo WebGPU mer ouverte partageable (sans installation)',
        'Compositeur bouteille + parchemin avec notes scellées / chiffrées',
        'Océan Gerstner TSL avec écume, flottabilité et vie marine',
        'Ciel jour/nuit avec nuages volumétriques adaptés à la qualité',
        'Presets Low / Medium / High pour de vrais appareils',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Un souvenir qui doit sentir la mer ouverte — pas un skybox plat.',
          detail:
            'Message in a Bottle exigeait une expérience navigateur où écrire et sceller une note s’inscrit dans une mer crédible : lumière jour/nuit, météo et une bouteille à trouver et ouvrir — sans installation.',
          mediaAlt: 'Ambiance d’horizon en mer ouverte — le brief atmosphérique de Message in a Bottle',
        },
        wire: {
          title: 'Mise en scène',
          summary: 'Bouteille, parchemin et contrôles du ciel dans une composition calme.',
          detail:
            'Nous cadrons le premier viewport autour de la bouteille et de l’horizon, puis empilons l’UI compositeur, les niveaux de qualité et les contrôles d’heure pour garder le récit au premier plan.',
          mediaAlt: 'Mise en page du message — lettre sur parchemin au-dessus de la mer ouverte, contrôles mer et ciel sur le côté',
        },
        engineering: {
          title: 'Ingénierie',
          summary: 'Océan WebGPU TSL, radiance du ciel et nuages selon la qualité.',
          detail:
            'Houle Gerstner, chop domain-warped et ciel TSL avec lods de nuages volumétriques qui baissent en Medium/Low. Flottabilité, vie marine et messages chiffrés restent dans le même budget de frame que l’eau.',
          mediaAlt: 'Rendu WebGPU mer ouverte — eau Gerstner, brume et contrôles de densité nuageuse',
        },
        final: {
          title: 'Mer ouverte finale',
          summary: 'Une démo WebGPU partageable que les invités ouvrent dans le navigateur.',
          detail:
            'En ligne sous /demos/message-in-a-bottle/ — écrire ou recevoir une note scellée en mer ouverte, avec ciel jour/nuit, presets de qualité pour de vrais appareils, et le langage craft de nos expériences emballé en souvenir.',
          mediaAlt: 'Message in a Bottle — scène finale mer ouverte avec écume, brume et ciel',
        },
      },
    },
    'labelled-custom-cursor': {
      eyebrow: 'Étude de cas · Interaction',
      title: 'Curseur personnalisé labellisé — du brief au lab',
      lead: 'Comment IOM conçoit un pointeur contextuel : déclarer l’intention en markup, animer tip et anneau avec une boucle rAF légère, puis parker un lab labellisé pendant que le site live reste calme.',
      impact:
        'Les visiteurs reçoivent des affordances hover claires sur les médias interactifs — VIEW, PLAY, LOOK, ENTER 3D — pour que démos et CTA communiquent avant le clic, sans gêner les champs texte natifs ni le tactile.',
      primaryCtaLabel: 'Ouvrir le lab live',
      secondaryCtaLabel: 'Parcourir les expériences',
      deliverables: [
        'Lab curseur labellisé partageable (playground + panneau d’usage live)',
        'Vocabulaire markup data-cursor / data-cursor-label',
        'Tip de précision + anneau inertiel (lerp rAF, sans GSAP)',
        'Fallback natif pour tactile, formulaires et pointeurs grossiers',
        'Orbe focus calme sur les cartes d’accueil ; modes labellisés pour CTA & médias',
      ],
      stages: {
        brief: {
          title: 'Brief',
          summary: 'Les médias interactifs ont besoin d’un pointeur qui parle intention — pas d’une flèche générique.',
          detail:
            'Sur un portfolio 3D, vidéo et 360°, le hover doit suggérer la suite : VIEW un projet, PLAY un média, LOOK un panorama, ENTER 3D. Le curseur système ne porte pas ce vocabulaire sans labels et motion alignés à la marque.',
          mediaAlt: 'Lab curseur labellisé — cibles playground et panneau d’usage idle',
        },
        wire: {
          title: 'Design d’interaction',
          summary: 'Modes pilotés par le markup : data-cursor et labels optionnels.',
          detail:
            'Les cibles déclarent l’intention en HTML — explore, view, play, look, drag, start, external, link, native. Les labels custom (ENTER 3D) remplacent les défauts. Le lab reflète le markup de production : survoler met à jour un panneau d’usage live avec le snippet correspondant.',
          mediaAlt: 'Survol ENTER 3D — le panneau d’usage montre le markup data-cursor explore',
        },
        engineering: {
          title: 'Ingénierie',
          summary: 'Tip de précision, anneau inertiel, lerp rAF — sans GSAP.',
          detail:
            'Une boucle requestAnimationFrame légère suit le pointeur avec un tip rapide (~0.55) et un anneau plus doux (~0.16). La résolution de cible parcourt le DOM pour data-cursor / ancres / inputs ; tactile et formulaires retombent sur le curseur natif.',
          mediaAlt: 'Mode LOOK actif — le panneau code se synchronise au markup panorama',
        },
        final: {
          title: 'Livrables',
          summary: 'Un lab labellisé partageable — et une orbe focus plus calme sur le site live.',
          detail:
            'En ligne sous /demos/custom-cursor-labelled/ avec un snapshot source parké. Les cartes d’accueil utilisent une orbe focus cyan calme ; le set labellisé reste pour démos, CTA, transport et liens externes.',
          mediaAlt: 'Démo curseur labellisé — playground et panneau code d’usage live',
        },
      },
    },
  },
}
