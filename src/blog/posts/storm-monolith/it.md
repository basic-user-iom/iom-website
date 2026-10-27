Uno studio ambientale indipendente di IOM riunisce monoliti scuri, mare e nuvole in una scena da esplorare e modificare in tempo reale.

## Sfida — mantenere la scena modificabile

I monoliti emergono dall’acqua in movimento mentre i banchi di nuvole passano tra le strutture. L’obiettivo era conservare quel senso di scala consentendo al visitatore di cambiare camera, illuminazione e meteo. È uno studio visivo indipendente, non un progetto commissionato da un cliente.

## Soluzione — delimitare le nuvole

Un raggio nello spazio della scena concentra le nuvole intorno ai monoliti, con un margine sfumato. Le nuvole vicine usano un campionamento volumetrico più fine, che diventa gradualmente più grossolano con la distanza. Cambia il dettaglio del ray marching; l’impostazione di qualità determina la risoluzione del rendering. Nuvole visibili e calcolo delle ombre condividono lo stesso limite spaziale.

## Soluzione — aggiungere dettagli conservando gli originali

I monoliti conservano le mappe originali di colore, normali e metallicità/rugosità. Uno strato Dark Concrete condiviso, con mappe di normali e rugosità da 1K, aggiunge dettagli regolabili. Il motivo delle normali si ripete con frequenza doppia rispetto a prima: forme più piccole, con la stessa intensità. Un interruttore di confronto ripristina la superficie originale.

![Primo piano della superficie di un monolito e dei dettagli della normal map](/assets/blog/storm-monolith-studio/detail.webp)

## Risultato — uno studio autonomo nel browser

L’applicazione autonoma offre camere orbitale e libera, controlli meteo ed esportazione della scena in JSON o come pacchetto portatile. I modelli ottimizzati condividono le risorse; trasformazioni statiche e pianificazione delle ombre delle nuvole riducono i calcoli ripetuti. La fluidità dipende comunque da dispositivo, inquadratura e qualità. Un’immagine statica sulla homepage apre lo studio senza avviare un altro renderer 3D nella pagina.

## Prova la scena

Parti dall’inquadratura prevista, poi apri WEATHER → VOLUMETRIC CLOUDS per modificare Cloud radius o Near detail distance. Seleziona Near left monolith e apri MATERIALS per confrontare Dark Concrete detail. Cambia un’impostazione alla volta: nuvole più estese e dettagli più fini possono aumentare il lavoro della GPU. Scene JSON conserva le impostazioni; il pacchetto include anche le risorse necessarie alla scena.

[Apri lo studio](https://storm-monolith-studio.vercel.app/) · [Scopri il caso di studio](/it/case-studies/storm-monolith-studio)
