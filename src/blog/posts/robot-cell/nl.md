Een fabrieksproces wordt begrijpelijker als je kunt volgen wat er tussen de machines gebeurt. Robot Cell 01 brengt die opeenvolging naar een vrij te verkennen 3D-scène: dozen komen aan via een transportband, een robot bouwt een palletlading op en een autonome heftruck verzorgt de wissel.

[Open Robot Cell 01](/demos/robot-cell/?lang=nl)

## Volg de volledige cyclus

De transportband brengt elke doos naar de oppakpositie. De vacuümgrijper nadert, pakt de doos op en verplaatst deze naar de pallet. Door dit te herhalen ontstaat de lading. De transportfase verbindt dat werk vervolgens met de rest van de hal: de volle pallet vertrekt en een lege komt terug voor de volgende cyclus.

Het gaat om de samenhang. Een grijper kan een doos pas dragen nadat deze is opgepakt, de vorken hebben ruimte nodig om de pallet in te rijden en de poort verandert de beschikbare doorgang. Door die momenten samen te zien wordt het proces duidelijker dan met losse afbeeldingen.

De scène gebruikt één actieve palletpositie, één robot en één autonome heftruck. Zo blijft de route overzichtelijk en heeft elke machine een herkenbare taak.

## Drie knoppen en een vrij gezichtspunt

Met **Start** begint de reeks. **Pauze** houdt de huidige houding vast, terwijl je de scène kunt draaien of op een detail kunt inzoomen. **Herstart** zet de animatie terug naar het begin en speelt deze opnieuw af.

Sleep om rond de scène te draaien; gebruik het muiswiel of een knijpbeweging om te zoomen. De animatie begint gepauzeerd, zodat je eerst een gezichtspunt kunt kiezen. Aan het einde wordt de cyclus herhaald.

De lus is in de geëxporteerde scène gecontroleerd door de transformaties van objecten en bones aan het begin en einde te vergelijken. De houdingen komen overeen. Daarmee is de aansluiting van de posities gecontroleerd; het is geen natuurkundige simulatie.

## Van Blender naar de browser

De scène is gemaakt in Blender en geëxporteerd als GLB, de binaire vorm van glTF. Geometrie, materialen en animatie zitten samen in één bestand. De webviewer gebruikt Three.js om dat bestand te laden en de gecoördineerde animatie af te spelen.

Ook de verlichting moet behouden blijven. Deze versie exporteert zes plafondspots en twee gerichte lichtbronnen. De browser voegt omgevingslicht toe, zodat metaal, gelakte vlakken en donkere machineonderdelen vanuit verschillende hoeken zichtbaar blijven.

Kleine vaste onderdelen worden voor de weergave samengevoegd waar hun animatiehiërarchie dat toelaat. Bewegende assemblages behouden hun eigen transformaties. Dat vermindert het aantal tekenaanroepen, zonder de gezamenlijke afspeelbediening op te splitsen.

## Industriële beweging zichtbaar maken

Robot Cell 01 is bedoeld om een proces te presenteren en te bespreken: de samenhang tussen machines, bewegingsvolgorden, toegang en ruimtelijke indeling. Je kunt een belangrijk moment pauzeren en vanuit verschillende richtingen bekijken.

Het is een illustratieve 3D-animatie, geen live verbinding met fabrieksapparatuur en geen gevalideerd technisch model. De keuze van machines, het bereik, de belastingen, vrije ruimte en beveiliging van een echte installatie vragen afzonderlijke technische controles.

[Verken de interactieve scène](/demos/robot-cell/?lang=nl) of bekijk meer werk in [de 3D-sectie van IOM](/nl/#3d).

## Technische bronnen

- [Blender-documentatie over glTF-export](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
