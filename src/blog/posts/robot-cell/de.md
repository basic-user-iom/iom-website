Ein Fabrikprozess wird verständlicher, wenn sich auch die Übergänge zwischen den Maschinen verfolgen lassen. Robot Cell 01 zeigt diese Abfolge in einer frei erkundbaren 3D-Szene: Kartons kommen über ein Förderband, ein Roboter belädt eine Palette und ein autonomer Stapler übernimmt den Palettenwechsel.

[Robot Cell 01 öffnen](/demos/robot-cell/?lang=de)

## Den gesamten Zyklus verfolgen

Das Förderband bringt jeden Karton zur Aufnahmeposition. Der Vakuumgreifer nähert sich, nimmt den Karton auf und transportiert ihn zur Palette. Durch wiederholtes Ablegen entsteht die Ladung. Anschließend verbindet der Transport diesen Arbeitsschritt mit der Halle: Die volle Palette wird abgeholt und eine leere für den nächsten Zyklus bereitgestellt.

Entscheidend ist das Zusammenspiel. Der Greifer kann einen Karton erst nach der Aufnahme tragen, die Gabeln benötigen Platz zum Einfahren und das Tor verändert den verfügbaren Transportweg. Diese Übergänge gemeinsam zu sehen erklärt mehr als eine Reihe einzelner Bilder.

Die Szene enthält einen aktiven Palettenplatz, einen Roboter und einen autonomen Stapler. So bleiben der Weg übersichtlich und die Aufgaben der Maschinen eindeutig.

## Drei Bedienelemente und eine freie Ansicht

**Starten** setzt die Abfolge in Gang. **Pause** hält die aktuelle Stellung, während sich die Ansicht drehen oder ein Detail vergrößern lässt. **Neustart** setzt die Animation an den Anfang zurück und startet sie erneut.

Zum Drehen ziehen Sie in der Szene; mit dem Mausrad oder einer Zwei-Finger-Geste zoomen Sie. Die Animation beginnt pausiert. So lässt sich zuerst ein Blickwinkel wählen. Nach dem Ende wiederholt sich die Wiedergabe.

Für den exportierten Loop wurden die Transformationen der Objekte und Bones am Anfang und Ende verglichen. Die Stellungen stimmen überein. Das belegt den Anschluss der Posen am Übergang, ersetzt aber keine physikalische Simulation.

## Von Blender in den Browser

Die Szene entsteht in Blender und wird als GLB exportiert, der binären Form von glTF. Geometrie, Materialien und Animation werden in einer Datei zusammengefasst. Der Webviewer lädt sie mit Three.js und spielt den abgestimmten Ablauf ab.

Auch die Beleuchtung muss beim Export erhalten bleiben. Diese Version enthält sechs Deckenstrahler und zwei gerichtete Lichtquellen. Im Browser ergänzt eine Umgebungsbeleuchtung die Szene, damit Metall, lackierte Flächen und dunkle Maschinenteile aus verschiedenen Blickwinkeln erkennbar bleiben.

Kleine starre Teile werden für die Darstellung zusammengefasst, soweit ihre Animationshierarchie das zulässt. Bewegliche Baugruppen behalten ihre eigenen Transformationen. So sinkt die Zahl der Zeichenaufrufe, während der gesamte Prozess gemeinsam steuerbar bleibt.

## Industrielle Bewegung anschaulich erklären

Robot Cell 01 dient dazu, Abläufe zu präsentieren und zu besprechen: das Verhältnis der Maschinen zueinander, Bewegungsfolgen, Zugänge und räumliche Anordnung. Interessante Momente lassen sich anhalten und von mehreren Seiten betrachten.

Es handelt sich um eine illustrative 3D-Animation, nicht um eine Live-Verbindung zu Anlagen oder ein validiertes Engineering-Modell. Maschinenauswahl, Reichweite, Lasten, Freiräume und Schutzmaßnahmen einer realen Anlage benötigen eigene technische Prüfungen.

[Die interaktive Szene erkunden](/demos/robot-cell/?lang=de) oder weitere Arbeiten im [3D-Bereich von IOM ansehen](/de/#3d).

## Technische Referenzen

- [Blender: glTF-Export](https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html)
- [Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html)
- [Three.js AnimationMixer](https://threejs.org/docs/pages/AnimationMixer.html)
