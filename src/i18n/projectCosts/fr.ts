import { PROJECT_COSTS_META } from '../../project-costs/data'
import type { ProjectCostsCopy } from './types'

const specialist = PROJECT_COSTS_META.specialistDayRate
const intro = PROJECT_COSTS_META.specialistIntroDayRate
const studioFrom = PROJECT_COSTS_META.studioTeamFromDayRate
const studioIntro = PROJECT_COSTS_META.studioTeamIntroFromDayRate
const deadline = PROJECT_COSTS_META.augustOfferDeadline

export const frProjectCosts: ProjectCostsCopy = {
  page: {
    print: 'Imprimer / Enregistrer en PDF',
    engageHeading: 'Comment engager IOM',
    engageLead:
      'Choisissez le niveau de capacité de production adapté au projet. Utilisez la capacité spécialiste pour une tâche ciblée, ajoutez de la capacité studio lorsque le travail en parallèle est utile, ou cadrez un projet plus large avec nous.',
    refsHeading: 'Projets de référence détaillés',
    refsLead:
      'Ce qui était inclus dans chaque exemple, les fourchettes de production typiques, et pourquoi la référence peut — ou non — être comparable à une nouvelle demande. Pas des forfaits fixes.',
    factorsHeading: 'Ce qui influe sur le coût et le calendrier',
    factorsLearnLabel: 'En savoir plus sur les facteurs de prix',
    factorsLearnTitle: 'Facteurs techniques qui changent l’effort de production',
    glanceAria: 'Comparaison rapide des projets',
    glanceProject: 'Projet',
    glanceEffort: 'Effort comparable typique',
    glanceDelivery: 'Livraison typique',
    glanceBudget: 'Budget indicatif',
    glanceReference: 'Référence : {title}',
    typicallyIncludes: 'Inclut généralement',
    priceDrivers: 'Le prix change surtout à cause de',
    productAdditions: 'Ajouts possibles au niveau produit',
    viewCaseStudy: 'Voir l’étude de cas →',
    protoHeading: 'Commencer par un prototype ciblé',
    protoLead:
      'La plupart des projets n’ont pas besoin de commencer par la construction de référence complète. Un prototype plus petit et clairement défini peut valider l’interaction centrale, la direction visuelle et le workflow technique avant d’approuver le périmètre de production complet.',
    protoNote:
      'Le travail de prototype est structuré pour que le code, les assets et les décisions de design utiles puissent se poursuivre dans l’étape suivante — via Research (Raven), Form (Fox) et Output (Octopus).',
    protoAria: 'Étapes de prototype · Research Form Output',
    howHeading: 'Petite équipe cœur, production évolutive',
    howLead:
      'IOM adapte la capacité de production aux besoins du projet. Certaines phases peuvent être menées par un spécialiste senior, tandis que les phases intensives peuvent s’élargir lorsque le travail parallèle est vraiment utile.',
    estimateHeading: 'À propos de ces estimations',
    estimateIntro:
      'Tous les chiffres de cette page sont des fourchettes de planification indicatives pour un travail comparable aux études de cas. Ce ne sont pas des prix forfaitaires, des devis contractuels ni le coût historique exact des projets d’origine.',
    estimateQuotes:
      'Les devis pour les périmètres plus larges sont préparés séparément après consultation. Sauf inclusion explicite dans un devis, les postes listés à côté sont généralement estimés à part.',
    estimateHighlightsAria: 'Tarifs clés',
    estimateHighlightsEyebrow: 'Fourchettes de planification',
    estimateExcludes: 'Généralement chiffrés à part',
    checklistLabel: 'Informations utiles à indiquer :',
    viewCaseStudies: 'Voir toutes les études de cas',
    bookConsult: 'Réserver une consultation gratuite',
    requestEstimate: 'Demander une estimation',
    compareOptions: 'Comparer les modes d’engagement',
    startsPanelEyebrow: 'Consultation gratuite de 30 minutes',
    startsPanelAria: 'Prochaines étapes',
    scopedAfterConsultation: 'Cadrage après consultation',
    productionDay: '€{rate} / jour de production',
    fromProductionDay: 'À partir de €{rate} / jour de production',
    fixedTitle: 'Travaux petits et clairement définis',
    fixedBody:
      'Toutes les collaborations n’ont pas besoin de commencer par un grand projet ou un engagement au tarif journalier. De petites interactions, des améliorations de présentation produit, des prototypes et des composants de site clairement définis peuvent aussi être chiffrés au forfait.',
  },
  hero: {
    eyebrow: 'Périmètre · Temps · Budget',
    title: 'Capacité de production flexible',
    lead:
      'IOM peut être engagé pour une production senior ciblée, une capacité studio supplémentaire, ou un projet plus large cadré. Le bon dispositif dépend du travail qui peut vraiment avancer en parallèle.',
    sub:
      'Cette page est un guide transparent, pas un catalogue de forfaits. Les tarifs journaliers qualifient un point de départ ; le travail plus large est cadré après une courte consultation.',
    ctaPrimary: 'Discuter d’un projet',
    ctaSecondary: 'Voir les projets de référence',
  },
  engagement: {
    specialist: {
      title: 'Capacité de spécialiste senior',
      question: 'Besoin d’un spécialiste expérimenté ?',
      summary:
        'Pour une tâche technique, 3D ou temps réel ciblée au sein d’un projet plus large.',
      rateLine: `€${specialist} / jour de production`,
      rateNote: 'Production senior ciblée pour un flux de travail défini.',
      learnMoreLabel: 'En savoir plus sur la capacité de spécialiste senior',
      learnMoreTitle: 'Capacité de spécialiste senior — détail technique',
      learnMoreParagraphs: [
        'Adapté à un travail clairement défini : développement 3D temps réel, composants interactifs navigateur, préparation et optimisation d’assets 3D, production Blender ou Unreal, workflows CAD/BIM vers le temps réel, photogrammétrie, production 360, prototypage, dépannage et R&D technique.',
        'Un seul spécialiste maintient le coût quotidien plus bas, mais offre moins de capacité parallèle. Les plus gros lots peuvent donc demander un délai plus long.',
        'La stack technique exacte est choisie selon le projet, et n’est pas traitée comme le produit lui-même.',
        'Outils et formats typiques lorsqu’ils sont utiles : Three.js · WebGL / WebGPU · Blender · Unreal Engine · CAD / BIM · GLB / FBX / OBJ · photogrammétrie · production 360°.',
      ],
    },
    'studio-capacity': {
      title: 'Capacité studio supplémentaire',
      question: 'Besoin de plus de capacité de production ?',
      summary:
        'Pour des lots de production plus importants ou des flux de travail parallèles où une capacité supplémentaire est réellement utile.',
      rateLine: `À partir de €${studioFrom} / jour de production`,
      rateNote: 'Capacité parallèle supplémentaire lorsque le projet en bénéficie vraiment.',
      learnMoreLabel: 'En savoir plus sur la capacité studio supplémentaire',
      learnMoreTitle: 'Capacité studio supplémentaire — détail technique',
      learnMoreParagraphs: [
        'Pour un travail qui gagne à avancer en parallèle, IOM peut ajouter de la capacité en production 3D, développement temps réel, préparation d’assets, intégration de contenu, optimisation et tests.',
        'Des personnes supplémentaires ne rendent pas automatiquement chaque tâche proportionnellement plus rapide. Certaines phases sont séquentielles, d’autres peuvent avancer en parallèle. Le dispositif de production doit suivre les vraies dépendances du projet.',
        'La capacité peut aussi changer selon la phase : un spécialiste pendant la préparation, davantage de capacité pendant la production, puis une équipe plus petite pour l’intégration finale et la livraison.',
      ],
    },
    'project-scoping': {
      title: 'Projet complet / plus large',
      question: 'Faut-il que nous emmenions le projet plus loin ?',
      summary:
        'Pour un travail de bout en bout dont le périmètre, les sources, le calendrier et la capacité requise doivent être examinés ensemble.',
      rateLine: 'Cadrage après consultation',
      rateNote:
        'La structure de production et le prix suivent le périmètre réel, le matériel, le calendrier et les dépendances.',
      learnMoreLabel: 'En savoir plus sur les projets complets et plus larges',
      learnMoreTitle: 'Projet complet / plus large — détail technique',
      learnMoreParagraphs: [
        'Avant de chiffrer un projet plus large, IOM examine le matériel source disponible, les exigences techniques, les livrables, le calendrier, les responsabilités d’intégration, le processus de revue et les dépendances externes.',
        'L’objectif est de recommander seulement le niveau de capacité studio réellement utile. Les périmètres plus larges peuvent être structurés en jalons, phases ou lots de production définis, plutôt qu’en effectif fixe pour toute la durée.',
      ],
    },
  },
  capacity: {
    title: 'Le prix et le temps sont liés par la capacité de production',
    summary:
      'Un spécialiste a un coût journalier plus bas. Une petite équipe coûte plus par jour mais peut souvent faire avancer plusieurs parties du travail en même temps. Les projets plus larges peuvent utiliser une personne sur certaines phases et deux ou trois seulement lorsque la production parallèle est utile.',
    learnMoreLabel: 'En savoir plus sur les délais et la capacité',
    learnMoreTitle: 'Délais, capacité et production parallèle',
    learnMoreParagraphs: [
      'Les tarifs journaliers décrivent une capacité de production, pas une garantie que chaque tâche se termine proportionnellement plus vite avec plus de personnes. Une partie du travail doit rester séquentielle ; d’autres flux — préparation d’assets, développement, intégration, tests — peuvent avancer en parallèle s’ils sont bien planifiés.',
      'Un seul spécialiste est souvent le point de départ le plus efficace pour une tâche ciblée, ou lorsque votre équipe possède déjà une partie du pipeline. La capacité studio s’ajoute lorsque le calendrier ou le périmètre bénéficie vraiment d’une production parallèle.',
      'Les devis pour les périmètres plus larges restent distincts des tarifs journaliers. La consultation établit les livrables, l’état du matériel source, l’approche technique et le plus petit plan de capacité utile avant le début du travail.',
    ],
  },
  august: {
    eyebrow: 'Août 2026 — disponibilité introductive',
    title: 'Capacité de production spécialiste limitée pour de nouvelles collaborations',
    lines: [
      `Pour les nouvelles collaborations confirmées d’ici le ${deadline}, une quantité limitée de capacité de production spécialiste est disponible à €${intro} / jour de production au lieu du tarif standard de €${specialist} / jour de production.`,
      'Le tarif introductif convenu peut se poursuivre au-delà d’août pour le périmètre initial confirmé.',
    ],
    cta: 'Demander la disponibilité d’août',
    cardBadge: 'Intro août',
    specialistCompare: `€${intro} / jour de production`,
    studioCompare: `À partir de €${studioIntro} / jour de production`,
    untilNotice: 'Disponible jusqu’à fin août',
    standardLabel: 'Tarif standard {rate}',
  },
  examples: {
    title: 'Projets de référence',
    lead:
      'Ces exemples montrent l’ordre de grandeur de travaux précédents. Ce ne sont pas des forfaits ; le périmètre, le calendrier et la capacité de production finaux dépendent du matériel source, des besoins d’interaction et du contexte de livraison.',
    glanceNote:
      'Sélectionnez une ligne pour faire défiler vers la fiche de référence. Les chiffres sont des fourchettes de planification, pas des prix catalogue.',
    rangeNote:
      'Le bas de fourchette suppose généralement un périmètre clairement défini, des assets bien préparés, un calendrier de production standard et une incertitude technique limitée. Des intégrations complexes, un développement spécialisé, un matériel source incomplet ou une livraison accélérée peuvent augmenter le devis final.',
  },
  factorsSimple:
    'L’estimation dépend de ce qu’il faut construire, de l’état de votre matériel source, de la complexité d’interaction et visuelle, et de la vitesse de livraison souhaitée.',
  factors: [
    { title: 'Qualité et état du matériel source', text: 'Assets propres et prêts pour la production, versus des données CAD/BIM/3D incomplètes ou difficiles.' },
    { title: 'Complexité d’interaction', text: 'Présentation simple versus logique temps réel sur mesure, outils, configuration ou comportements en plusieurs étapes.' },
    { title: 'Complexité visuelle', text: 'Nombre d’environnements, d’objets, de matériaux, d’exigences d’éclairage, d’animation et d’états de contenu.' },
    { title: 'Besoins d’intégration', text: 'Module autonome versus intégration dans un site, un logiciel ou un pipeline client existant.' },
    { title: 'Performance et QA', text: 'Navigateurs pris en charge, appareils, cibles mobiles, contraintes GPU et objectifs d’optimisation.' },
    { title: 'Calendrier', text: 'Des délais compressés peuvent exiger davantage de capacité de production parallèle.' },
    { title: 'Structure de feedback et de révisions', text: 'Un décideur et des tours de revue définis diffèrent de changements continus avec de nombreux interlocuteurs.' },
    { title: 'Coûts tiers', text: 'Assets payants, licences, hébergement spécial, services externes, déplacements ou matériel doivent être chiffrés à part lorsque c’est pertinent.' },
    { title: 'Support continu', text: 'Maintenance, mises à jour de contenu ou support après lancement peuvent être structurés séparément si besoin.' },
  ],
  starts: {
    title: 'Comment un projet commence',
    lead: 'Quatre étapes claires de la première conversation à une estimation cadrée. Aucun engagement tant que vous n’avez pas approuvé l’approche et le budget.',
    steps: [
      { title: 'Partager l’idée', text: 'Dites-nous ce que vous cherchez à construire — même si le brief est encore approximatif.' },
      { title: 'Examiner ensemble', text: 'Nous examinons l’objectif, le matériel source disponible, le format de livraison et la date.' },
      { title: 'Associer la capacité', text: 'Nous recommandons si le travail est mieux mené par un spécialiste, une capacité studio supplémentaire, ou une équipe de projet cadrée.' },
      { title: 'Recevoir une estimation claire', text: 'Vous recevez un périmètre, une approche de production et une estimation avant le début du travail.' },
    ],
    footer:
      'Pour les projets plus larges, la capacité peut changer pendant la production afin de ne pas payer une équipe plus grande pendant les phases qui n’en ont pas besoin.',
    consultationNote:
      'Chaque projet potentiel peut commencer par une consultation gratuite de 30 minutes. La recherche technique, l’inspection de fichiers, les tests de workflow, le design et le développement de prototype sont chiffrés à part lorsque c’est nécessaire.',
    cta: 'Réserver une consultation gratuite',
  },
  prototype: [
    { title: 'Définir le défi', text: 'Définit l’objectif central, l’interaction principale et le résultat de projet le plus important.', stage: 'Recherche', stageLine: 'Comprend le client, le public, l’histoire et le défi technique avant de construire quoi que ce soit.' },
    { title: 'Former la solution', text: 'Construit et teste une version de travail ciblée avec un contenu représentatif et des conditions techniques réalistes.', stage: 'Conception', stageLine: 'Transforme la recherche en langage visuel clair, structure d’interaction et approche technique.' },
    { title: 'Livrer le résultat', text: 'Étend la solution approuvée vers l’expérience complète, le contenu supplémentaire et le déploiement de production.', stage: 'Réalisation', stageLine: 'Affine et livre le résultat fini comme une expérience que l’on peut ouvrir, comprendre et utiliser.' },
  ],
  howIomWorks: [
    { title: 'La capacité suit le travail', text: 'IOM adapte la capacité de production aux besoins du projet. Certaines phases peuvent être menées par un spécialiste senior, tandis que les phases intensives peuvent s’élargir lorsque le travail parallèle est vraiment utile.' },
    { title: 'Dispositif de production clair', text: 'Pour les engagements plus larges, le dispositif de production est convenu à l’avance afin que responsabilités, capacité et communication restent claires tout au long du projet.' },
    { title: 'Étapes claires', text: 'Recherche, prototype, production et livraison peuvent être chiffrés comme des étapes séparées, pour revoir le périmètre avant chaque engagement majeur.' },
  ],
  finalCta: {
    title: 'Dites-nous ce que vous cherchez à construire',
    lead: 'Vous n’avez pas besoin d’un brief technique. Envoyez-nous l’objectif, ce que vous avez déjà, et la date visée. Nous aiderons à déterminer le dispositif de production adapté.',
    cta: 'Discuter d’un projet',
  },
  contactChecklist: [
    'Objectif principal du projet',
    'Public visé',
    'Assets 3D, 360° ou médias existants',
    'Livraison souhaitée : site, desktop, mobile, VR ou installation',
    'Date de fin préférée',
    'Budget approximatif, s’il est connu',
  ],
  selectedSupport: {
    title: 'Soutien pour certains projets',
    lead:
      'Des projets à forte valeur créative, technique, culturelle, éducative ou sociale peuvent occasionnellement recevoir un soutien supplémentaire d’IOM. Lorsque le projet convient et que le calendrier le permet, cela peut prendre la forme d’honoraires réduits ou d’un nombre clairement défini d’heures de production offertes.',
    footer: 'Tout soutien de ce type est examiné individuellement et convenu par écrit avant le début de la production.',
  },
  estimate: {
    productionTime:
      'Les calendriers affichés décrivent des périodes de production active approximatives. La livraison calendaire peut aussi dépendre de la disponibilité des matériaux client, d’un feedback consolidé, d’approbations externes, de services tiers et du moment des décisions de projet.',
    blended:
      'Le tarif de production typique d’IOM va de 75 € à 110 € de l’heure, selon la complexité technique, les besoins de spécialiste, la préparation des assets et le délai de livraison. Les projets définis peuvent être chiffrés en étapes de production fixes ou avec un tarif projet mixte. Les budgets de référence ci-dessous sont donc des fourchettes de planification, et non une multiplication directe de chaque heure estimée par le tarif horaire le plus élevé.',
    highlights: [
      { label: 'Capacité de spécialiste senior', value: `€${specialist} / jour de production` },
      { label: 'Capacité studio supplémentaire', value: `à partir de €${studioFrom} / jour de production` },
      { label: 'Projets plus larges / complets', value: 'Cadrage après consultation' },
    ],
    exclusions: ['Voyage', 'Photographie sur site', 'Numérisation 3D', 'Assets payants', 'Licences logicielles tierces', 'Frais d’hébergement', 'Taxes', 'Maintenance continue'],
  },
  references: {
    cursor: {
      category: 'UI · Curseur · Interaction',
      glanceCategory: 'Interaction web sur mesure',
      title: 'Labelled Custom Cursor',
      description:
        'Un curseur contextuel pour un site existant, avec des états d’interaction étiquetés, un comportement au survol, des transitions de pointeur animées et un fallback mobile standard.',
      imageAlt: 'Étude de cas Labelled Custom Cursor',
      learnMoreLabel: 'En savoir plus sur le périmètre et le prix',
      tiers: [{ label: 'Effort comparable typique', hours: '4–7 heures de production', delivery: 'Environ 1 jour ouvrable' }],
      includes: ['Concept visuel du curseur', 'Style de pointeur et d’étiquette', 'États de survol pour liens, boutons et éléments choisis', 'Animation de pointeur de base', 'Intégration dans un site fonctionnel existant', 'Tests navigateurs desktop', 'Fallback mobile standard'],
      priceDrivers: ['Nombre d’états de curseur', 'Complexité de l’animation', 'Framework du site existant', 'État et structure du code', 'Comportement supplémentaire par page', 'Contrôles de configuration ou d’édition', 'Livraison urgente'],
      assumption:
        'Cette fourchette s’applique lorsque le curseur est ajouté à un site existant et fonctionnel, et que les états d’interaction requis sont clairement définis. Une refonte d’interface plus large, des systèmes d’animation étendus, une intégration CMS complexe ou une livraison accélérée sont estimés séparément.',
    },
    'gallery-of-light': {
      "category": "Galerie 3D · Lumière · Son",
      "glanceCategory": "Galerie de sculptures interactive",
      "title": "Gallery of Light",
      "description": "Un concept indépendant d’IOM : treize sculptures réparties dans deux ailes, une visite guidée, une exploration libre, des études de lumière et de matériaux réglables, ainsi que six pistes musicales séparées et un écran réactif au son. Les estimations ci-dessous illustrent l’ampleur de production d’une expérience comparable dans le navigateur.",
      "imageAlt": "Gallery of Light : sculptures classiques sur des socles rouges sous la toiture de la galerie",
      "learnMoreLabel": "Voir le périmètre et le détail indicatif du prix",
      "includes": [
        "Assemblage de la galerie à deux ailes et préparation de treize modèles de sculptures fournis",
        "Parcours de caméra guidé, sélection des sculptures et navigation orbitale libre",
        "Éclairage réglable et sélection d’études de matériaux et d’effets visuels",
        "Lecture et mixage de six pistes musicales fournies, avec un écran réactif au son",
        "Commandes adaptatives, réglages de qualité du rendu et optimisation pour le navigateur",
        "Tests dans les navigateurs, un cycle de retours consolidés et remise pour le déploiement"
      ],
      "priceDrivers": [
        "État, nombre de polygones et taille des textures des modèles fournis",
        "Modifications de l’architecture de la galerie ou du nombre de sculptures",
        "Complexité des matériaux, de l’éclairage et des effets visuels spécifiques",
        "Durée de la visite, chorégraphie de caméra et exigences d’interface",
        "Préparation audio, appareils pris en charge et objectifs de performance",
        "Cycles de retours supplémentaires, langues ou livraison accélérée"
      ],
      "assumption": "L’estimation suppose des modèles de galerie et de sculptures exploitables, avec les droits d’utilisation nécessaires, des textes d’exposition approuvés et six pistes musicales préparées, un cycle de retours consolidés et un calendrier normal. La création de nouveaux modèles, la numérisation, la composition musicale originale, les licences de ressources, les traductions, l’hébergement, les taxes et la maintenance continue sont exclus. Les délais supposent des retours rapides et une capacité de production disponible.",
      "explainer": "L’estimation ciblée couvre une galerie réduite avec un éclairage de base, la navigation et une courte visite. Le mixeur à six pistes, l’écran réactif au son et les études de matériaux avancées font partie de l’expérience complète. Il s’agit d’estimations indicatives pour des travaux comparables, et non d’une facture passée, d’un prix convenu avec un client ou d’un devis forfaitaire.",
      "tiers": [
        {
          "label": "Estimation pour une galerie ciblée",
          "hours": "80-120 heures de production",
          "delivery": "Environ 2-3 semaines"
        },
        {
          "label": "Estimation pour l’expérience complète",
          "hours": "160-240 heures de production",
          "delivery": "Environ 4-6 semaines"
        }
      ],
      "breakdown": {
        "title": "Expérience complète : détail indicatif de la production",
        "rateNote": "Exemple de planification avec un taux horaire moyen de €90, dans la fourchette de production publiée de €75-€110 par heure. Ces heures de projet sont estimées séparément des engagements de capacité au tarif journalier.",
        "phaseLabel": "Phase de production",
        "hoursLabel": "Heures",
        "budgetLabel": "Estimation",
        "totalLabel": "Total indicatif",
        "phases": [
          "Périmètre, parcours de visite et planification technique",
          "Assemblage de la galerie et préparation des modèles de sculptures",
          "Études d’éclairage, de matériaux et d’effets visuels",
          "Visite guidée, navigation et interface adaptative",
          "Mixeur audio à six pistes et écran réactif au son",
          "Optimisation des ressources, du chargement et du rendu",
          "Tests dans les navigateurs, retours et remise pour le déploiement"
        ]
      }
    },
    miab: {
      category: 'WebGPU · Océan · Interaction',
      glanceCategory: 'Expérience navigateur temps réel',
      title: 'Message in a Bottle',
      description:
        'Une expérience navigateur temps réel originale combinant eau et ciel procéduraux, objets animés, design d’interface, conditions jour/nuit, un flux d’écriture de message et une sortie interactive partageable.',
      imageAlt: 'Étude de cas Message in a Bottle',
      learnMoreLabel: 'En savoir plus sur le périmètre et le prix',
      tiers: [
        { label: 'Prototype ciblé', hours: '80–160 heures de production', delivery: '2–4 semaines' },
        { label: 'Niveau étude de cas', hours: '160–320 heures de production', delivery: '4–7 semaines' },
      ],
      includes: ['Concept créatif et technique', 'Environnement océan et ciel temps réel', 'Animation et interaction d’objets', 'Interface d’écriture de message', 'États jour, nuit ou météo', 'Livraison navigateur responsive', 'Optimisation des performances', 'Tests multi-navigateurs'],
      priceDrivers: ['Réalisme visuel requis', 'Nombre d’états d’environnement', 'Partage, stockage ou backend', 'Production d’assets 3D sur mesure', 'Exigences de performance mobile', 'Design sonore et animation supplémentaire', 'Livraison accélérée ou dates de lancement'],
    },
    viewer: {
      category: 'Three.js · WebGL · Produit',
      glanceCategory: 'Logiciel 3D sur mesure',
      title: 'Custom 3D Viewer',
      description:
        'Un viewer 3D navigateur ou desktop sur mesure avec chargement de modèles, architecture d’interface, outils caméra et navigation, éclairage, contexte d’environnement, optimisation, tests et déploiement.',
      imageAlt: 'Étude de cas 3D Viewer',
      learnMoreLabel: 'En savoir plus sur le périmètre et le prix',
      tiers: [
        { label: 'Adaptation ciblée', hours: '120–240 heures de production', delivery: '3–6 semaines' },
        { label: 'Nouvelle plateforme produit', hours: '320–640 heures de production', delivery: '8–16 semaines' },
      ],
      includes: ['Interface viewer spécifique au projet', 'Workflow d’import et de préparation de modèles', 'Contrôles caméra et navigation', 'Sélection d’objets et information', 'Éclairage et environnement', 'Optimisation des performances', 'Interface responsive', 'Déploiement et tests techniques'],
      productAdditions: ['Plusieurs formats de modèles', 'Points de vue enregistrés', 'Mesures', 'Annotations et hotspots', 'Plans de coupe', 'Contrôles de visibilité', 'Sauvegarde de projet', 'Comptes utilisateurs', 'Identité client', 'Livraison desktop Electron', 'Intégration backend ou base de données'],
      explainer:
        'Un viewer spécifique au projet basé sur un framework IOM existant peut être livré nettement plus vite qu’une nouvelle plateforme logicielle. La fourchette haute s’applique lorsque le viewer exige une nouvelle architecture d’interface, des outils sur mesure, de la gestion de données, des intégrations, une livraison accélérée et des tests de niveau produit.',
    },
  },
  inquiry: {
    or: 'ou',
    requestType: 'Type de demande',
    consultation: 'Consultation gratuite',
    estimate: 'Estimation de projet',
    name: 'Nom',
    email: 'E-mail',
    company: 'Entreprise ou organisation',
    timeframe: 'Délai de livraison souhaité',
    budget: 'Budget approximatif',
    message: 'Veuillez inclure une courte description du projet.',
    optional: '(facultatif)',
    timeframePh: 'ex. sous 6 semaines, T4, flexible',
    budgetPh: 'ex. 5 000–15 000 €',
    messagePh: 'Décrivez l’idée principale, le public visé, les matériaux disponibles et ce que l’expérience doit accomplir.',
    sending: 'Envoi…',
    success: 'Message envoyé à projects@iobjectm.com — nous répondons sous deux jours ouvrés.',
    error: 'Impossible d’envoyer le message. Veuillez écrire directement à projects@iobjectm.com.',
    required: 'Veuillez remplir ce champ.',
    invalidEmail: 'Saisissez une adresse e-mail valide.',
    messageShort: 'Veuillez inclure une courte description du projet.',
    emailDirect: 'écrire directement à projects@iobjectm.com',
  },
}
