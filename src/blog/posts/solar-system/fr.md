**[Ouvrir Solar System — Living Observatory](/demos/solar-system/)**

À quoi ressemble le Système solaire lorsque les distances restent linéaires, que les tailles planétaires respectent l’échelle et que le temps peut avancer ou reculer ? Living Observatory réunit éphémérides, images planétaires, lunes, sondes et expériences pédagogiques dans un environnement 3D interactif accessible depuis un navigateur. Pour un amateur d’astronomie, son intérêt principal est de relier un objet visible à son état numérique et à la provenance des données.

La couverture montre la Terre dans la démo. Les huit illustrations de cet article sont de véritables captures de l’application, réalisées pour ce guide, et non des observations télescopiques. Les commandes citées conservent les noms de l’interface anglaise.

## 1. Lire le Système solaire à travers ses données

Dans l’observatoire normal, les mouvements proviennent d’**éphémérides [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) intégrées à l’application**. Le navigateur interpole les positions et les vitesses échantillonnées par interpolation cubique d’Hermite. Il exploite une description précalculée du mouvement plutôt que de résoudre un nouveau problème à N corps à chaque clic sur Run.

Le jeu principal de données planétaires couvre **2000–2100**. L’horloge accepte une date UTC, la convertit en TDB en interne et permet pause, marche arrière et lecture accélérée. Les positions sont géométriques, dans le repère écliptique J2000 du projet. Il ne s’agit pas d’une carte du ciel apparente et topocentrique destinée au pointage d’un télescope : temps de propagation de la lumière, horizon local et réfraction atmosphérique ne font pas partie du modèle de coordonnées affiché.

Sélectionnez un corps pour consulter rayon, masse, période de rotation, distance au Soleil, vitesse héliocentrique et éclairement énergétique solaire. On peut ainsi comparer la variation de vitesse sur une orbite ou la diminution du flux solaire avec le carré de la distance entre la Terre et les planètes externes.

![La vue de l’écliptique relie les positions aux trajectoires échantillonnées des éphémérides. Une couverture limitée produit un arc incomplet, pas une ellipse fermée inventée.](/assets/blog/solar-system/orbits.webp)

## 2. Échelle, orbites et caméra

**True scale** est le mode initial. Les distances sont linéaires, avec une unité de scène pour une unité astronomique ; les rayons physiques sont donc très petits. À l’échelle du système entier, étiquettes et repères de sélection localisent des objets parfois plus petits qu’un pixel. Ces repères ne représentent pas leur diamètre réel.

**Presentation** agrandit les corps pour faciliter leur lecture tout en conservant leurs positions orbitales. Comparez les deux modes avant d’évaluer des séparations sur une capture. Les trajectoires suivent les éphémérides plutôt que des ellipses idéales. Un siècle de données ne contient pas la révolution complète de Neptune, d’environ 165 ans : son avertissement de couverture a donc un sens. Les sondes et certains objets du catalogue peuvent avoir des fenêtres temporelles différentes.

Choisissez un corps dans le navigateur d’objets, faites glisser pour tourner et utilisez la molette pour zoomer. Les caméras proposent notamment une vue perpendiculaire à l’écliptique, le suivi d’un corps et une poursuite selon la vitesse. Des cadrages prédéfinis montrent la Terre et la Lune, la Grande Tache rouge de Jupiter et les anneaux de Saturne. La caméra change le point de vue, pas l’échelle des distances.

## 3. Les cartes planétaires ont leur propre histoire

La Terre associe cartes des continents et des océans, nuages et lumières nocturnes à la diffusion atmosphérique. Mars utilise des images couleur Viking et des détails de normales dérivés de MOLA. Jupiter et Saturne s’appuient sur des images datées, notamment du programme Hubble OPAL. Les anneaux de Saturne ajoutent structure radiale, divisions et ombres mutuelles entre planète et anneaux. Les normales suggèrent le relief par l’éclairage ; elles ne correspondent pas partout à un terrain géométriquement résolu.

![Le cadrage des anneaux de Saturne révèle leurs divisions radiales et les relations entre planète, plan des anneaux et lumière. Il s’agit d’un rendu de modèle, pas d’une photographie de Cassini.](/assets/blog/solar-system/saturn.webp)

**La date de l’horloge ne transforme pas ces cartes en météo historique.** Composites nuageux, mosaïques de surface et détails des tempêtes ont leurs propres dates d’acquisition. Uranus et Neptune utilisent des sommets nuageux procéduraux aux couleurs visibles discrètes, pas des cartes météorologiques globales mesurées. Leur aspect subtil doit être distingué des forts contrastes d’images infrarouges traitées. Le Soleil combine également photosphère et couronne procédurales avec des détails issus d’images datées ; ce n’est pas un flux solaire en direct.

Ouvrez **Data & provenance** pour consulter les attributions et les limites des modèles. Cette distinction est indispensable lorsqu’une belle image sert à expliquer l’astronomie réelle.

## 4. Lunes, comètes et sondes

Les catalogues consultables dépassent les huit planètes : satellites naturels, satellites terrestres, comètes nommées et sondes interplanétaires. Présence au catalogue, représentation détaillée et couverture des éphémérides sont trois choses différentes. Une entrée ne signifie pas que chaque lune possède une carte de surface observée.

Voyager 1 et 2 utilisent un modèle NASA détaillé que l’on peut examiner en zoomant. Leurs trajectoires reposent sur des positions ; l’orientation de l’antenne est illustrative, pas reconstruite à partir de télémesures d’attitude. Les satellites terrestres sont propagés à partir d’éléments OMM intégrés, avec SGP4/SDP4, dans la fenêtre de validité déclarée, plutôt que suivis par un flux en direct.

![Voyager 1 dans l’observatoire : un modèle détaillé, une position sur sa trajectoire et une caméra permettant de passer du contexte de la mission à l’inspection rapprochée.](/assets/blog/solar-system/voyager.webp)

Les cinq comètes sont Halley, Encke, 67P, Hale–Bopp et NEOWISE. La queue ionique s’éloigne du Soleil ; la queue de poussières se courbe selon un historique d’émission illustratif. Ces effets expliquent la géométrie, pas une prévision mesurée de l’activité cométaire. De même, les particules des ceintures d’astéroïdes et de Kuiper sont un contexte statistique, non des petits corps suivis individuellement. Le ciel d’arrière-plan donne un contexte visuel, pas un champ astrométrique dépendant de la date.

## 5. Impact Lab : comparer causes et conséquences

Impact Lab isole un événement de l’horloge de l’observatoire. Choisissez cible, diamètre, densité, vitesse, angle d’entrée, direction et lieu ; examinez ensuite entrée atmosphérique, fragmentation ou explosion en altitude, puis effets au sol. La Terre distingue continents et océans avec des comportements simplifiés pour cratère, panache, cavité dans l’eau et vagues.

Une expérience instructive consiste à ne changer **qu’un paramètre à la fois**. À densité constante, doubler le diamètre d’un impacteur sphérique multiplie sa masse initiale par huit. Doubler sa vitesse multiplie son énergie cinétique initiale par quatre : **E = ½mv²**. Pertes atmosphériques et fragmentation empêchent de confondre énergie initiale et énergie transmise à la surface.

![Une expérience d’impact océanique dans Impact Lab. Panache et réponse de l’eau sont des approximations pédagogiques ; une visibilité renforcée des effets ne modifie pas les valeurs physiques annoncées.](/assets/blog/solar-system/impact.webp)

Comparez les résultats numériques au réglage de visibilité : agrandir un effet à l’écran n’agrandit pas l’événement calculé. Ce n’est ni une évaluation de défense planétaire, ni un modèle de victimes, ni une prévision de tsunami. Pause, répétition et remise à zéro permettent de discuter mécanismes et sensibilité sans présenter ces simplifications comme des prédictions.

## 6. Solar Fate : distinguer science et fiction

La séquence d’évolution scientifique condense plusieurs étapes : Soleil actuel, expansion en géante rouge, chauffage du système interne, perte des couches externes, puis naine blanche qui refroidit. La navigation par phases et les choix de caméra permettent de comparer l’étoile à la matière environnante.

![La phase de géante rouge dans Solar Fate. L’évolution est comprimée dans le temps ; les planètes fournissent un contexte, pas des trajectoires futures prédites.](/assets/blog/solar-system/solar-red-giant.webp)

Il s’agit d’une séquence évolutive illustrée, non d’un calcul de structure stellaire. Durées, variations de taille et transitions sont simplifiées ; la démo ne tranche pas la survie finale de la Terre et ne calcule pas toutes les orbites futures. Une distinction astrophysique est essentielle : **le Soleil n’est pas assez massif pour finir en supernova par effondrement du cœur**.

![Les couches externes éjectées dans la séquence scientifique. Le cadrage large révèle la structure nébulaire autour du cœur stellaire mis à nu.](/assets/blog/solar-system/solar-nebula.webp)

L’option distincte **Fictional Solar Supernova** est explicitement impossible pour notre Soleil. C’est une expérience cinématographique, qui doit rester identifiée comme telle lors du partage d’images ou d’une présentation.

## 7. Black-Hole Encounter : gravitation et capture cinématographique

**Physics Flyby** copie les états actuels du Soleil, de la Lune et des planètes dans une simulation newtonienne à N corps indépendante. Position initiale, vitesse et masse peuvent produire différents résultats ; la capture n’est pas garantie. Les diagnostics numériques aident à examiner l’expérience, mais ne constituent pas une estimation d’incertitude de niveau recherche.

![Commandes et vue de rencontre de Physics Flyby. Les trajectoires utilisent un modèle pédagogique newtonien ; lentille gravitationnelle, disque et signes de dislocation sont des approximations visuelles.](/assets/blog/solar-system/black-hole.webp)

Ce modèle ne calcule ni relativité générale ni hydrodynamique. Les effets visuels de lentille n’agissent pas sur l’intégrateur des trajectoires. Le mode séparé **Complete Consumption — Cinematic** ajoute volontairement un amortissement artificiel pour imposer la chute. Un trou noir n’aspire pas automatiquement les planètes lointaines : masse, distance et état orbital initial restent déterminants.

## 8. Une première exploration utile

1. Comparez la Terre et la Lune en True scale puis en Presentation. Observez comment le changement des rayons modifie l’impression d’espace vide.
2. Sélectionnez une planète externe, lisez sa couverture temporelle et inversez l’horloge. Distinguez un arc incomplet d’une anomalie orbitale.
3. Cadrez Voyager, approchez le modèle puis retrouvez sa trajectoire. Vérifiez source et fenêtre temporelle avant d’interpréter sa position.
4. Comparez les résultats de deux expériences Impact Lab ne différant que par un seul paramètre.
5. Explorez les étapes scientifiques de Solar Fate avant son alternative fictive.

Un navigateur sur ordinateur laisse plus de place aux commandes et aux graphismes. Réduisez la qualité visuelle si nécessaire : détail graphique et données d’éphémérides sont indépendants. Les scénarios disposent de leurs propres horloges et reviennent à l’observatoire après réinitialisation. L’usage le plus instructif consiste à passer régulièrement de l’image aux chiffres, puis aux hypothèses.

## Sources et lectures complémentaires

- [Manuel JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) : repères, échelles de temps et grandeurs géométriques ou apparentes.
- [NASA : types d’étoiles](https://science.nasa.gov/universe/stars/types/) : contexte évolutif des géantes rouges, naines blanches et supernovae.
- [Université d’Oxford : les couleurs d’Uranus et de Neptune](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0) : pourquoi certaines images traitées faussent les comparaisons de couleur.
- **Data & provenance** dans la démo : sources et limites de cette implémentation.

Captures : IOM, réalisées dans la démo publiée le 27 septembre 2026. Les images et modèles sous-jacents conservent les crédits indiqués dans la démo. Ce guide décrit cette version ; les données intégrées et modèles visuels pourront évoluer.

**[Explorer Living Observatory](/demos/solar-system/)**
