Cette étude d’environnement indépendante d’IOM réunit des monolithes sombres, la mer et les nuages dans une scène à explorer et à modifier en temps réel.

## Défi — conserver une scène modifiable

Les monolithes dominent une mer en mouvement, tandis que des bancs de nuages traversent les structures. Il fallait préserver cette impression d’échelle tout en permettant au visiteur de modifier la caméra, la lumière et la météo. Il s’agit d’une étude visuelle indépendante, sans commande client.

## Solution — délimiter les nuages

Un rayon dans l’espace de la scène centre la couverture nuageuse sur les monolithes, avec une limite progressive. L’échantillonnage volumétrique est plus fin à proximité et devient progressivement plus grossier au loin. Il s’agit du détail du ray marching ; le réglage de qualité détermine la résolution du rendu. Les nuages visibles et le calcul de leurs ombres partagent la même limite spatiale.

## Solution — enrichir les surfaces en gardant les originaux

Les monolithes conservent leurs cartes de couleur, de normales et de métal/rugosité. Une couche Dark Concrete commune en 1K, composée de normales et de rugosité, ajoute un détail réglable. Le motif des normales se répète deux fois plus souvent qu’auparavant : les formes deviennent plus petites sans diminuer leur intensité. Un interrupteur de comparaison rétablit la surface d’origine.

![Vue rapprochée de la surface d’un monolithe et de ses détails de normales](/assets/blog/storm-monolith-studio/detail.webp)

## Livrables — un studio autonome dans le navigateur

L’application autonome propose des caméras orbitale et libre, des commandes météo et l’export de scène en JSON ou en paquet portable. Les modèles optimisés partagent leurs ressources ; les transformations statiques et la planification des ombres nuageuses évitent des calculs répétés. La fluidité dépend toujours de l’appareil, de la vue et de la qualité. Une image fixe sur la page d’accueil ouvre le studio sans y lancer un autre moteur 3D.

## Essayer la scène

Commencez par la vue prévue, puis ouvrez WEATHER → VOLUMETRIC CLOUDS pour modifier Cloud radius ou Near detail distance. Sélectionnez Near left monolith et ouvrez MATERIALS pour comparer Dark Concrete detail. Changez un réglage à la fois : une couverture plus large ou davantage de détails peut solliciter davantage le GPU. Scene JSON conserve les réglages ; le paquet inclut aussi les ressources nécessaires à la scène.

[Ouvrir le studio](https://storm-monolith-studio.vercel.app/) · [Voir l’étude de cas](/fr/case-studies/storm-monolith-studio)
