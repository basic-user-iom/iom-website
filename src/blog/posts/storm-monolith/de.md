Eine unabhängige Umgebungsstudie von IOM verbindet dunkle Monolithen, Meer und Wolken zu einer Szene, die sich in Echtzeit erkunden und verändern lässt.

## Aufgabe — eine editierbare Szene

Die Monolithen ragen über bewegtem Wasser auf, während Wolken zwischen den Bauwerken vorbeiziehen. Ihr Größenverhältnis sollte erhalten bleiben, auch wenn Besucher Kamera, Licht und Wetter verändern. Das Projekt ist eine unabhängige visuelle Studie, kein Kundenauftrag.

## Lösung — Wolken mit begrenzter Ausdehnung

Ein Radius in Weltkoordinaten begrenzt die Wolken um die Monolithen, mit einem weichen Übergang am Rand. Nahe Wolken werden feiner abgetastet; mit zunehmender Entfernung wird die Abtastung stufenlos gröber. Das verändert die Raymarching-Details. Die Qualitätsstufe bestimmt die Renderauflösung. Sichtbare Wolken und ihre Schattenberechnung nutzen dieselbe räumliche Grenze.

## Lösung — Details ergänzen, Originale erhalten

Die Monolithen behalten ihre ursprünglichen Farb-, Normal- und Metallic/Roughness-Maps. Eine gemeinsam genutzte 1K-Ebene aus Dark-Concrete-Normal- und Roughness-Maps ergänzt regelbare Oberflächendetails. Das Normalmuster wiederholt sich doppelt so häufig wie zuvor: Die Strukturen werden kleiner, ihre Stärke bleibt erhalten. Ein Vergleichsschalter zeigt wieder die Originaloberfläche.

![Nahaufnahme der Monolithoberfläche mit feinen Normalmap-Details](/assets/blog/storm-monolith-studio/detail.webp)

## Ergebnis — ein eigenständiges Browserstudio

Die eigenständige Anwendung bietet Orbit- und Flugkamera, Wettersteuerung sowie Szenenexport als JSON oder portables Paket. Optimierte Modelle teilen Ressourcen; statische Transformationen und die Planung der Wolkenschatten reduzieren wiederholte Berechnungen. Die Bildrate hängt weiterhin von Gerät, Ansicht und Qualität ab. Ein statisches Vorschaubild auf der Startseite verlinkt das Studio, ohne dort einen weiteren 3D-Renderer zu starten.

## Die Szene ausprobieren

Beginne mit der vorgesehenen Kameraansicht. Unter WEATHER → VOLUMETRIC CLOUDS lassen sich Cloud radius und Near detail distance ändern. Wähle Near left monolith und öffne MATERIALS für den Vergleich mit Dark Concrete detail. Ändere jeweils nur eine Einstellung: Größere Wolkenflächen und feinere Darstellung können mehr GPU-Leistung benötigen. Scene JSON speichert die Einstellungen; ein Paket enthält auch die benötigten Laufzeit-Assets.

[Studio öffnen](https://storm-monolith-studio.vercel.app/) · [Fallstudie ansehen](/de/case-studies/storm-monolith-studio)
