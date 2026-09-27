Un processo industriale si comprende meglio quando si possono seguire i passaggi tra le macchine. Robot Cell 01 presenta questa sequenza in una scena 3D liberamente esplorabile: le scatole arrivano su un trasportatore, un robot compone un pallet e un carrello autonomo ne gestisce la sostituzione.

[Apri Robot Cell 01](/demos/robot-cell/?lang=it)

## Seguire l’intero ciclo

Il trasportatore porta ogni scatola al punto di prelievo. L’organo di presa a ventose si avvicina, afferra la scatola e la trasferisce sul pallet. Le deposizioni successive formano il carico. La fase di trasporto collega poi questa attività al resto del capannone: il pallet pieno viene portato via e ne arriva uno vuoto per il ciclo seguente.

Conta soprattutto il coordinamento. La presa può trasportare una scatola solo dopo averla afferrata, le forche richiedono spazio per entrare nel pallet e l’apertura del cancello modifica il passaggio disponibile. Vedere questi momenti insieme rende il processo più chiaro di una serie di immagini statiche.

La scena utilizza una postazione pallet attiva, un robot e un carrello autonomo. Il percorso rimane leggibile e ogni macchina svolge una funzione precisa.

## Tre comandi e una vista libera

**Avvia** mette in movimento la sequenza. **Pausa** mantiene la posa corrente mentre si ruota la vista o si ingrandisce un dettaglio. **Riavvia** riporta l’animazione all’inizio e la fa ripartire.

Trascina per ruotare attorno alla scena; usa la rotella del mouse o un gesto con due dita per lo zoom. L’animazione parte in pausa, lasciando il tempo di scegliere il punto di vista. Al termine, la riproduzione si ripete.

Il ciclo esportato è stato controllato confrontando le trasformazioni di oggetti e ossa all’inizio e alla fine. Le pose coincidono. Questo verifica la continuità delle posizioni nel punto di raccordo, ma non equivale a una simulazione fisica.

## Da Blender al browser

La scena è realizzata in Blender ed esportata in GLB, il formato binario di glTF. Geometria, materiali e animazione viaggiano in un unico file. Il visualizzatore web utilizza Three.js per caricarlo e riprodurre la sequenza coordinata.

Anche l’illuminazione deve essere trasferita. Questa versione include nell’esportazione sei faretti a soffitto e due luci direzionali. Nel browser si aggiunge una luce ambientale per mantenere leggibili metalli, superfici verniciate e componenti scuri da diverse angolazioni.

Le piccole parti rigide vengono raggruppate per il rendering quando la gerarchia dell’animazione lo consente. Gli assiemi mobili mantengono le proprie trasformazioni. Si riduce così il numero di chiamate di disegno, conservando un controllo comune dell’intero processo.

## Spiegare il movimento industriale

Robot Cell 01 serve a presentare e discutere un processo: relazioni tra macchine, sequenze di movimento, accessi e disposizione nello spazio. È possibile fermare un momento significativo e osservarlo da più lati.

È un’animazione 3D illustrativa, non un collegamento in tempo reale con un impianto né un modello ingegneristico validato. Scelta delle macchine, portate, carichi, ingombri e protezioni di un’installazione reale richiedono verifiche tecniche specifiche.

[Esplora la scena interattiva](/demos/robot-cell/?lang=it) oppure scopri altri progetti nella [sezione 3D di IOM](/it/#3d).

## Riferimenti tecnici

- [Documentazione sull’esportazione glTF di Blender](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
