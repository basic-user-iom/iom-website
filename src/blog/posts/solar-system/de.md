**[Solar System — Living Observatory öffnen](/demos/solar-system/)**

Wie sieht das Sonnensystem aus, wenn Entfernungen linear bleiben, Planetengrößen maßstabsgerecht sind und die Zeit vorwärts wie rückwärts laufen kann? Living Observatory verbindet Ephemeriden, Planetenbilder, Monde, Raumsonden und astronomische Lernexperimente in einer interaktiven 3D-Umgebung im Browser. Für Astronomiebegeisterte liegt der besondere Nutzen darin, das sichtbare Objekt mit seinen Zahlenwerten und der Herkunft dieser Daten zu verbinden.

Das Titelbild zeigt die Erde im Demo. Alle acht Abbildungen dieses Artikels sind echte, für diesen Leitfaden angefertigte Bildschirmaufnahmen der Anwendung, keine Teleskopbeobachtungen. Die genannten Bedienelemente entsprechen der englischen Benutzeroberfläche.

## 1. Das Sonnensystem als Datensatz lesen

Im normalen Observatorium stammt die Bewegung aus **mitgelieferten Ephemeriden von [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html)**. Der Browser interpoliert abgetastete Positionen und Geschwindigkeiten mit kubischer Hermite-Interpolation. Er liest eine vorberechnete Bewegungsbeschreibung, statt bei jedem Klick auf Run ein neues Vielkörperproblem zu lösen.

Der zentrale Planetendatensatz deckt **2000–2100** ab. Die Uhr nimmt UTC entgegen, rechnet intern in TDB um und erlaubt Pause, Rückwärtslauf und Zeitraffung. Die geometrischen Positionen werden im ekliptikalen J2000-Bezugssystem des Projekts dargestellt. Die Anwendung ist kein topozentrischer Himmelsatlas für die Teleskopausrichtung: Lichtlaufzeit, lokaler Horizont und atmosphärische Refraktion gehören nicht zum dargestellten Koordinatenmodell.

Nach Auswahl eines Körpers erscheinen Radius, Masse, Rotationsperiode, Sonnenabstand, heliozentrische Geschwindigkeit und solare Bestrahlungsstärke. So lassen sich Geschwindigkeitsänderungen entlang einer Bahn oder die Abnahme des Sonnenlichts mit dem Quadrat der Entfernung vergleichen.

![Die Ansicht senkrecht zur Ekliptik verbindet Objektpositionen mit abgetasteten Ephemeridenbahnen. Begrenzte Datenabdeckung ergibt einen offenen Bogen, keine erfundene geschlossene Ellipse.](/assets/blog/solar-system/orbits.webp)

## 2. Maßstab, Bahnen und Kamera

Die Anwendung startet mit **True scale**. Entfernungen sind linear; eine Szeneneinheit entspricht einer astronomischen Einheit. Physische Radien sind entsprechend klein. Bei einer Gesamtansicht markieren Beschriftungen und Auswahlpunkte auch Körper, die kleiner als ein Pixel wären. Diese Markierungen sind keine Darstellung des tatsächlichen Planetendurchmessers.

**Presentation** vergrößert Körper zur besseren Lesbarkeit, behält aber ihre Bahnpositionen bei. Vergleichen Sie beide Modi, bevor Sie Abstände anhand eines Bildes beurteilen. Bahnlinien folgen Ephemeridenpunkten statt idealisierten Ellipsen. Ein Jahrhundert Daten umfasst Neptuns rund 165 Jahre dauernden Umlauf nicht vollständig: Deshalb ist seine Abdeckungswarnung relevant. Raumsonden und einzelne Katalogobjekte können andere Zeitfenster haben.

Wählen Sie ein Objekt im Navigator, drehen Sie die Ansicht durch Ziehen und zoomen Sie mit dem Mausrad. Kameramodi umfassen Ekliptik-Draufsicht, Körperverfolgung und Verfolgung entlang der Geschwindigkeit. Voreinstellungen zeigen Erde und Mond, Jupiters Großen Roten Fleck oder Saturns Ringe. Die Kamera verändert den Blickwinkel, nicht den zugrunde liegenden Entfernungsmaßstab.

## 3. Planetenoberflächen haben eine Datengeschichte

Die Erde verbindet kartierte Land- und Meeresflächen, Wolken und Nachtlichter mit atmosphärischer Streuung. Mars nutzt Viking-Farbbilder und aus MOLA abgeleitete Normalendetails. Jupiter und Saturn verwenden datierte Aufnahmen, darunter Produkte des Hubble-OPAL-Programms. Saturns Ringe ergänzen radiale Strukturen, Teilungen und gegenseitige Schatten von Planet und Ringen. Normalendetails erzeugen einen Reliefeindruck durch Beleuchtung; sie bedeuten nicht überall geometrisch aufgelöstes Gelände.

![Die Ringansicht von Saturn zeigt radiale Teilungen und das Zusammenspiel von Planet, Ringebene und Beleuchtung. Dies ist eine Modellansicht, kein Cassini-Foto.](/assets/blog/solar-system/saturn.webp)

**Das Datum der Simulationsuhr macht diese Karten nicht zu historischem Wetter.** Wolkenkomposite, Oberflächenmosaike und Sturmdetails besitzen eigene Aufnahmedaten. Uranus und Neptun haben prozedural gestaltete Wolkenoberseiten mit zurückhaltenden Farben im sichtbaren Licht, keine gemessenen globalen Wetterkarten. Ihr dezentes Erscheinungsbild ist von den starken Kontrasten bearbeiteter Infrarotbilder zu unterscheiden. Auch die Sonne verbindet prozedurale Photosphäre und Korona mit datierten Bilddetails; sie ist kein Live-Sonnenbild.

Unter **Data & provenance** finden Sie Quellen und Modellgrenzen. Diese Unterscheidung ist unverzichtbar, wenn eine schöne Nahaufnahme reale Astronomie erklären soll.

## 4. Monde, Kometen und Raumsonden

Die durchsuchbaren Kataloge reichen über die acht Planeten hinaus: natürliche Satelliten, Erdsatelliten, benannte Kometen und interplanetare Sonden. Katalogeintrag, detaillierter dargestellter Körper und verfügbare Ephemeridenabdeckung sind verschiedene Dinge. Ein Eintrag bedeutet nicht, dass von jedem Mond eine beobachtete Oberflächenkarte vorliegt.

Voyager 1 und 2 nutzen ein detailliertes NASA-Modell, das sich durch Heran- und Herauszoomen untersuchen lässt. Die Bahnlinien beziehen sich auf Positionsdaten; die Antennenausrichtung ist illustrativ und keine Rekonstruktion von Lagetelemetrie. Erdsatelliten werden mit mitgelieferten OMM-Elementen und SGP4/SDP4 innerhalb des angegebenen Gültigkeitsfensters propagiert, nicht anhand eines Live-Tracking-Datenstroms.

![Voyager 1 im Observatorium: detailliertes Sondenmodell, Position auf der Flugbahn und eine Kamera für den Wechsel zwischen Missionskontext und Nahansicht.](/assets/blog/solar-system/voyager.webp)

Die fünf benannten Kometen sind Halley, Encke, 67P, Hale–Bopp und NEOWISE. Ein Ionenschweif weist von der Sonne weg; der Staubschweif folgt einer illustrativen Emissionsgeschichte. Die Effekte erklären Geometrie, nicht eine gemessene Aktivitätsprognose. Ebenso sind Partikel im Asteroiden- und Kuipergürtel statistischer Kontext statt einzeln verfolgter Kleinplaneten. Der Sternhintergrund dient der Orientierung, nicht als datumsabhängiges astrometrisches Sternfeld.

## 5. Impact Lab: Ursachen und Folgen vergleichen

Impact Lab trennt ein Ereignis von der Uhr des Observatoriums. Wählen Sie Zielkörper, Durchmesser, Dichte, Geschwindigkeit, Eintrittswinkel, Richtung und Einschlagsort. Untersuchen Sie anschließend Atmosphäreneintritt, Fragmentierung oder Luftzerplatzen und Oberflächeneffekte. Die Erde unterscheidet Land und Ozean mit vereinfachten Modellen für Krater, Auswurfwolken, Wasserhohlräume und Wellen.

Verändern Sie **jeweils nur einen Parameter**. Bei gleicher Dichte vervielfacht ein doppelter Durchmesser die Anfangsmasse eines kugelförmigen Impaktors um den Faktor acht. Doppelte Geschwindigkeit vervierfacht seine anfängliche kinetische Energie: **E = ½mv²**. Wegen atmosphärischer Verluste und Fragmentierung sind Anfangsenergie und an der Oberfläche ankommende Energie nicht gleichzusetzen.

![Ein Ozeaneinschlag in Impact Lab. Wolke und Wasserreaktion sind didaktische Näherungen; verbesserte Sichtbarkeit der Effekte ist von den physikalischen Ergebniswerten zu unterscheiden.](/assets/blog/solar-system/impact.webp)

Vergleichen Sie Messwerte und Sichtbarkeitseinstellung: Ein vergrößerter dargestellter Effekt vergrößert nicht das berechnete Ereignis. Die Anwendung liefert weder planetare Gefahrenabwehrbewertungen noch Opferzahlen oder Tsunamiprognosen. Pause, Wiederholung und Zurücksetzen helfen, Mechanismen und Empfindlichkeiten zu diskutieren, ohne die Vereinfachungen als Vorhersagen auszugeben.

## 6. Solar Fate: die Zukunft der Sonne richtig einordnen

Die wissenschaftliche Entwicklungssequenz verdichtet mehrere Phasen: heutige Sonne, Expansion zum Roten Riesen, Erwärmung des inneren Systems, Abstoßung äußerer Schichten und ein abkühlender Weißer Zwerg. Phasenwahl und Kameramodi ermöglichen den Vergleich zwischen Stern und umgebender Materie.

![Die Phase des Roten Riesen in Solar Fate. Die Entwicklung ist zeitlich komprimiert; die Planeten zeigen den räumlichen Kontext und keine vorhergesagten zukünftigen Bahnen.](/assets/blog/solar-system/solar-red-giant.webp)

Dies ist eine veranschaulichte Entwicklungsfolge, keine Berechnung des Sternaufbaus. Zeiten, Größenänderungen und Übergänge sind vereinfacht; weder das endgültige Überleben der Erde noch zukünftige Planetenbahnen werden damit bestimmt. Entscheidend ist: **[Die Sonne besitzt nicht genug Masse, um als Kernkollaps-Supernova zu enden.](https://science.nasa.gov/universe/stars/types/)**

![Abgestoßene äußere Schichten in der wissenschaftlichen Sequenz. Die weite Kameraansicht zeigt die Nebelstruktur um den freigelegten Sternkern.](/assets/blog/solar-system/solar-nebula.webp)

Die separate Option **Fictional Solar Supernova** beschreibt ausdrücklich ein für unsere Sonne unmögliches Ereignis. Sie ist ein filmisches Experiment und sollte auch beim Teilen von Bildern oder in Vorträgen so gekennzeichnet bleiben.

## 7. Black-Hole Encounter: Gravitation und filmischer Einfang

**Physics Flyby** kopiert die aktuellen Zustände von Sonne, Mond und Planeten in eine eigene Newtonsche Vielkörpersimulation. Anfangsposition, Geschwindigkeit und Masse können unterschiedliche Ergebnisse erzeugen; Einfang ist nicht garantiert. Numerische Diagnosen helfen beim Prüfen des Experiments, liefern jedoch keine wissenschaftlich belastbare Unsicherheitsabschätzung.

![Bedienelemente und Ansicht von Physics Flyby. Die Bahnen beruhen auf einem Newtonschen Lehrmodell; Linseneffekte, Scheibe und Zerreißungsdarstellung sind visuelle Näherungen.](/assets/blog/solar-system/black-hole.webp)

Das Modell ist weder allgemein relativistisch noch hydrodynamisch. Die visuelle Lichtablenkung wirkt nicht auf den Bahnintegrator zurück. **Complete Consumption — Cinematic** fügt dagegen absichtlich künstliche Dämpfung hinzu, um den Einfall zu erzwingen. Ein Schwarzes Loch saugt ferne Planeten nicht automatisch auf: Masse, Entfernung und anfänglicher Bahnzustand bleiben entscheidend.

## 8. Eine sinnvolle erste Erkundung

1. Betrachten Sie Erde und Mond in True scale und vergleichen Sie Presentation. Achten Sie darauf, wie vergrößerte Radien den Eindruck des leeren Raums verändern.
2. Wählen Sie einen äußeren Planeten, lesen Sie die Abdeckungsangabe und lassen Sie die Uhr rückwärts laufen. Unterscheiden Sie einen unvollständigen Datenbogen von einer Bahnanomalie.
3. Fokussieren Sie Voyager, zoomen Sie zum Modell und zurück zur Bahn. Prüfen Sie Quelle und Zeitfenster, bevor Sie die Position interpretieren.
4. Vergleichen Sie zwei Impact-Lab-Experimente mit genau einem veränderten Eingangswert.
5. Erkunden Sie zunächst die wissenschaftlichen Solar-Fate-Phasen, anschließend die fiktionale Alternative.

Ein Desktop-Browser bietet mehr Platz für Steuerung und Grafik. Bei Bedarf lässt sich die Darstellungsqualität reduzieren; Bilddetails und Ephemeridendaten sind getrennte Aspekte. Szenarien besitzen eigene Uhren und kehren beim Zurücksetzen zum Observatorium zurück. Am aufschlussreichsten ist der wiederholte Wechsel zwischen Bild, Zahlen und Annahmen.

## Quellen und weiterführende Lektüre

- [JPL-Horizons-Handbuch](https://ssd.jpl.nasa.gov/horizons/manual.html): Bezugssysteme, Zeitskalen sowie geometrische und scheinbare Größen.
- [NASA: Sterntypen](https://science.nasa.gov/universe/stars/types/): Entwicklung von Roten Riesen, Weißen Zwergen und Supernovae.
- [Universität Oxford: die Farben von Uranus und Neptun](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0): warum bekannte bearbeitete Bilder Farbvergleiche verfälschen können.
- **Data & provenance** im Demo: Quellen und Einschränkungen dieser Implementierung.

Bildschirmaufnahmen: IOM, aus dem veröffentlichten Demo vom 27. September 2026. Für zugrunde liegende Bilder und Modelle gelten die Quellenangaben im Demo. Dieser Leitfaden beschreibt diese Version; Datenpakete und visuelle Modelle können sich mit späteren Veröffentlichungen ändern.

**[Living Observatory erkunden](/demos/solar-system/)**
