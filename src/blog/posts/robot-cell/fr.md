Un processus industriel devient plus clair lorsqu’on peut suivre les passages d’une machine à l’autre. Robot Cell 01 présente cette séquence dans une scène 3D que l’on peut explorer : des cartons arrivent sur un convoyeur, un robot constitue une palette et un chariot autonome assure son remplacement.

[Ouvrir Robot Cell 01](/demos/robot-cell/?lang=fr)

## Suivre le cycle complet

Le convoyeur amène chaque carton au point de prise. Le préhenseur à ventouses s’approche, saisit le carton et le transporte vers la palette. Les dépôts successifs forment le chargement. La phase de transport relie ensuite cette opération au reste du hall : la palette pleine est évacuée et une palette vide revient pour le cycle suivant.

L’intérêt réside dans la coordination. Un préhenseur ne peut transporter un carton avant de l’avoir saisi, les fourches ont besoin d’espace pour entrer sous la palette et l’ouverture du portail modifie le passage disponible. Voir ces transitions ensemble explique mieux le processus qu’une série d’images fixes.

La scène comporte un poste de palettisation actif, un robot et un chariot autonome. Le parcours reste ainsi lisible et chaque machine a un rôle précis.

## Trois commandes et un point de vue libre

**Lecture** lance la séquence. **Pause** fige la pose actuelle, tout en permettant de tourner autour de la scène ou de zoomer sur un détail. **Recommencer** revient au début et relance l’animation.

Faites glisser la vue pour la faire pivoter ; utilisez la molette ou un geste de pincement pour zoomer. L’animation est initialement en pause, afin de laisser le temps de choisir son point de vue. La lecture se répète une fois le cycle terminé.

La boucle a été vérifiée dans la scène exportée en comparant les transformations des objets et des os au début et à la fin. Les poses correspondent. Ce contrôle vérifie la continuité des positions à la jonction ; il ne constitue pas une simulation physique.

## De Blender au navigateur

La scène est créée dans Blender puis exportée en GLB, la forme binaire de glTF. Géométrie, matériaux et animation sont réunis dans un seul fichier. Le visualiseur utilise Three.js pour charger ce fichier et jouer la séquence coordonnée.

L’éclairage doit lui aussi passer d’un environnement à l’autre. Cette version exporte six spots au plafond et deux lumières directionnelles. Le navigateur ajoute un éclairage d’environnement pour préserver la lisibilité du métal, des surfaces peintes et des pièces sombres sous différents angles.

Les petites pièces rigides sont regroupées pour le rendu lorsque leur hiérarchie d’animation le permet. Les ensembles mobiles conservent leurs transformations propres. Cela réduit les appels de dessin tout en gardant une commande unique pour l’ensemble du processus.

## Rendre le mouvement industriel compréhensible

Robot Cell 01 sert à présenter et à discuter un processus : relations entre machines, enchaînement des mouvements, accès et organisation de l’espace. On peut arrêter un moment pertinent et l’examiner de plusieurs côtés.

Il s’agit d’une animation 3D illustrative, sans liaison directe avec une usine ni validation comme modèle d’ingénierie. Le choix des équipements, les portées, les charges, les dégagements et les protections d’une installation réelle demandent des vérifications spécifiques.

[Explorer la scène interactive](/demos/robot-cell/?lang=fr) ou découvrir d’autres projets dans [la section 3D d’IOM](/fr/#3d).

## Références techniques

- [Documentation de l’export glTF de Blender](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
