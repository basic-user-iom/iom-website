**[Open Solar System — Living Observatory](/demos/solar-system/)**

Hoe ziet het zonnestelsel eruit wanneer afstanden lineair blijven, planeetgroottes op schaal zijn en de tijd zowel vooruit als achteruit kan lopen? Living Observatory combineert efemeriden, planeetbeelden, manen, ruimtevaartuigen en leerzame experimenten in een interactieve 3D-omgeving in de browser. Voor een astronomieliefhebber is vooral de verbinding tussen een zichtbaar object, zijn numerieke toestand en de herkomst van die gegevens waardevol.

De omslag toont de aarde in de demo. Alle acht afbeeldingen zijn echte schermafbeeldingen van de toepassing, gemaakt voor deze gids; het zijn geen telescoopwaarnemingen. De namen van bedieningselementen volgen de Engelse interface van de demo.

## 1. Het zonnestelsel als gegevens lezen

In de gewone sterrenwacht komt de beweging uit **meegeleverde efemeriden van [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html)**. De browser interpoleert bemonsterde posities en snelheden met kubische Hermite-interpolatie. Hij leest een vooraf berekende beschrijving van de beweging, in plaats van bij elke klik op Run een nieuw veeldeeltjesprobleem op te lossen.

De belangrijkste planeetbundel beslaat **2000–2100**. De klok accepteert UTC, rekent intern om naar TDB en ondersteunt pauzeren, achteruitlopen en versneld afspelen. De posities zijn geometrisch en staan in het eclipticale J2000-referentiestelsel van het project. Dit is geen schijnbare, topocentrische hemelkaart om een telescoop te richten: lichtlooptijd, de plaatselijke horizon en atmosferische refractie maken geen deel uit van het weergegeven coördinatenmodel.

Selecteer een hemellichaam voor straal, massa, rotatieperiode, afstand tot de zon, heliocentrische snelheid en ontvangen zonnestraling. Vergelijk bijvoorbeeld snelheidsveranderingen langs een baan of de afname van zonnestraling met het kwadraat van de afstand, van de aarde tot de buitenplaneten.

![Het bovenaanzicht van de ecliptica verbindt objectposities met bemonsterde efemeridenbanen. Een beperkte dekking levert een onvolledige boog op, geen verzonnen gesloten ellips.](/assets/blog/solar-system/orbits.webp)

## 2. Schaal, banen en camera

**True scale** is de beginstand. Afstanden zijn lineair: één scène-eenheid staat voor één astronomische eenheid. Fysieke stralen zijn daardoor zeer klein. In een overzicht van het hele stelsel helpen labels en selectiemarkeringen objecten te vinden die kleiner kunnen zijn dan een pixel. Die markeringen geven niet de werkelijke diameter van een planeet weer.

**Presentation** vergroot hemellichamen voor de leesbaarheid, maar behoudt hun baanposities. Vergelijk beide standen voordat je afstanden uit een afbeelding afleidt. Baanlijnen volgen efemeridenpunten, geen verzameling ideale ellipsen. Honderd jaar gegevens omvat niet de volledige omloop van Neptunus van ongeveer 165 jaar: daarom is de dekkingswaarschuwing relevant. Ruimtevaartuigen en afzonderlijke catalogusobjecten kunnen andere tijdvensters hebben.

Kies een lichaam in de navigator, sleep om rond te draaien en gebruik het muiswiel om te zoomen. Camerastanden omvatten een bovenaanzicht van de ecliptica, het volgen van een lichaam en volgen in de snelheidsrichting. Voorinstellingen tonen aarde en maan, Jupiters Grote Rode Vlek en Saturnus’ ringen. De camera verandert het gezichtspunt, niet de onderliggende afstandsschaal.

## 3. Planeetkaarten hebben hun eigen geschiedenis

De aarde combineert kaarten van land en oceaan, wolken en nachtverlichting met atmosferische verstrooiing. Mars gebruikt Viking-kleurenbeelden en normaalkaartdetails afgeleid van MOLA. Jupiter en Saturnus gebruiken gedateerde opnamen, waaronder Hubble OPAL-producten. De ringen van Saturnus voegen radiale structuur, scheidingen en wederzijdse schaduwen van planeet en ringen toe. Normaalkaarten suggereren reliëf via belichting; ze betekenen niet dat overal geometrisch uitgewerkt terrein aanwezig is.

![De ringvoorinstelling van Saturnus toont radiale scheidingen en de samenhang tussen planeet, ringvlak en belichting. Dit is een modelweergave, geen Cassini-foto.](/assets/blog/solar-system/saturn.webp)

**De datum op de simulatieklok maakt van deze kaarten geen historisch weerbericht.** Wolkencomposieten, oppervlaktemozaïeken en stormdetails hebben hun eigen opnamedata. Uranus en Neptunus gebruiken ontworpen procedurele wolkentoppen met [ingetogen kleuren in zichtbaar licht](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0), geen gemeten mondiale weerkaarten. Verwar dat subtiele uiterlijk niet met de sterke contrasten van bewerkte infraroodbeelden. Ook de zon combineert procedurele fotosfeer- en corona-effecten met gedateerde beelddetails; het is geen live zonnebeeld.

Open **Data & provenance** voor bronvermeldingen en modelgrenzen. Dat onderscheid is belangrijk wanneer je met een mooie close-up echte astronomie wilt uitleggen.

## 4. Manen, kometen en ruimtevaartuigen

De doorzoekbare catalogi gaan verder dan de acht planeten. Ze bevatten natuurlijke satellieten, aardsatellieten, benoemde kometen en interplanetaire sondes. Een catalogusvermelding, een gedetailleerd weergegeven lichaam en beschikbare efemeridendekking zijn verschillende zaken. Een vermelding betekent niet dat iedere maan een waargenomen oppervlaktekaart heeft.

Voyager 1 en 2 gebruiken een gedetailleerd NASA-model dat je van dichtbij kunt bekijken door in en uit te zoomen. Hun baanlijnen verwijzen naar positiegegevens; de antennerichting is illustratief en geen reconstructie uit standtelemetrie. Aardsatellieten worden met meegeleverde OMM-elementen en SGP4/SDP4 voortgeplant binnen het opgegeven geldigheidsvenster, niet gevolgd via een live gegevensstroom.

![Voyager 1 in de sterrenwacht: een gedetailleerd model, een positie op de vliegbaan en een camera waarmee je tussen missiecontext en inspectie van dichtbij wisselt.](/assets/blog/solar-system/voyager.webp)

De vijf kometen zijn Halley, Encke, 67P, Hale–Bopp en NEOWISE. Een ionenstaart wijst van de zon af; de stofstaart buigt volgens een illustratieve uitstootgeschiedenis. Deze effecten verklaren geometrie, geen gemeten voorspelling van komeetactiviteit. Ook deeltjes in de asteroïden- en Kuipergordel zijn statistische context, geen afzonderlijk gevolgde kleine planeten. De hemelachtergrond geeft visuele context en is geen datumafhankelijk astrometrisch sterrenveld.

## 5. Impact Lab: oorzaken en gevolgen vergelijken

Impact Lab scheidt een gebeurtenis van de klok van de sterrenwacht. Kies doel, diameter, dichtheid, snelheid, invalshoek, richting en locatie van het inslaande object. Bekijk daarna atmosferische intrede, fragmentatie of een luchtontploffing en effecten aan het oppervlak. De aarde onderscheidt land en oceaan met vereenvoudigde modellen voor krater, pluim, waterholte en golven.

Een nuttig experiment verandert **één parameter tegelijk**. Bij gelijke dichtheid maakt een verdubbelde diameter een bolvormig object aanvankelijk achtmaal zo zwaar. Een verdubbelde snelheid verviervoudigt zijn oorspronkelijke kinetische energie: **E = ½mv²**. Door atmosferische verliezen en fragmentatie mag je die beginenergie niet gelijkstellen aan de energie die het oppervlak bereikt.

![Een oceaaninslag in Impact Lab. Pluim en waterreactie zijn educatieve benaderingen; versterkte zichtbaarheid van effecten moet je onderscheiden van de berekende fysieke waarden.](/assets/blog/solar-system/impact.webp)

Vergelijk de getallen met de zichtbaarheidsinstelling: een groter weergegeven effect vergroot de gerapporteerde gebeurtenis niet. Dit is geen beoordeling voor planetaire verdediging, slachtoffermodel of tsunamivoorspelling. Pauzeren, herhalen en herstellen maken het geschikt om mechanismen en gevoeligheden te bespreken zonder de vereenvoudigingen als voorspellingen te presenteren.

## 6. Solar Fate: de toekomst van de zon correct indelen

De wetenschappelijke ontwikkelingsreeks comprimeert verschillende fasen: de huidige zon, uitzetting tot rode reus, opwarming van het binnenste stelsel, verlies van buitenlagen en een afkoelende witte dwerg. Met fasekeuze en camerastanden vergelijk je de ster met het omringende materiaal.

![De rode-reusfase in Solar Fate. De evolutie is versneld weergegeven; de planeten geven ruimtelijke context en geen voorspelde toekomstige banen.](/assets/blog/solar-system/solar-red-giant.webp)

Dit is een geïllustreerde ontwikkelingsreeks, geen berekening van de interne sterstructuur. Tijden, grootteveranderingen en overgangen zijn vereenvoudigd. De demo beslist niet of de aarde uiteindelijk overleeft en berekent niet alle toekomstige planeetbanen. Het fundamentele onderscheid is: **[de zon heeft onvoldoende massa om als kerninstortingssupernova te eindigen](https://science.nasa.gov/universe/stars/types/)**.

![Uitgestoten buitenlagen in de wetenschappelijke ontwikkelingsreeks. De brede camera toont de nevelstructuur rond de blootgelegde sterkern.](/assets/blog/solar-system/solar-nebula.webp)

De afzonderlijke optie **Fictional Solar Supernova** is uitdrukkelijk onmogelijk voor onze zon. Het is een filmisch experiment en moet ook bij gedeelde beelden of presentaties zo benoemd blijven.

## 7. Black-Hole Encounter: zwaartekracht en filmische invang

**Physics Flyby** kopieert de huidige toestanden van zon, maan en planeten naar een afzonderlijke Newtoniaanse N-lichamensimulatie. Beginpositie, snelheid en massa kunnen uiteenlopende uitkomsten geven; invang is niet gegarandeerd. Numerieke diagnostiek helpt het experiment te onderzoeken, maar geeft geen onzekerheidsraming op onderzoeksniveau.

![Bediening en ontmoetingsbeeld van Physics Flyby. Banen gebruiken een Newtoniaans onderwijsmodel; lenseffect, schijf en tekenen van uiteentrekken zijn visuele benaderingen.](/assets/blog/solar-system/black-hole.webp)

Het model bevat geen algemeen-relativistische of hydrodynamische berekening. Het zichtbare lenseffect beïnvloedt de baanintegrator niet. De afzonderlijke stand **Complete Consumption — Cinematic** voegt bewust kunstmatige demping toe om inval af te dwingen. Een zwart gat zuigt niet automatisch verre planeten op: massa, afstand en de oorspronkelijke baantoestand blijven bepalend.

## 8. Een nuttige eerste verkenning

1. Bekijk aarde en maan in True scale en vergelijk Presentation. Let op hoe grotere stralen de indruk van lege ruimte veranderen.
2. Kies een buitenplaneet, lees de dekkingsmelding en draai de klok terug. Onderscheid een onvolledige gegevensboog van een baanafwijking.
3. Richt de camera op Voyager, zoom naar het model en terug naar de baan. Controleer bron en tijdvenster voordat je de positie interpreteert.
4. Vergelijk de numerieke resultaten van twee Impact Lab-experimenten met slechts één gewijzigd invoerveld.
5. Verken eerst de wetenschappelijke fasen van Solar Fate en daarna het fictieve alternatief.

Een desktopbrowser biedt meer ruimte voor bediening en beeld. Verlaag zo nodig de visuele kwaliteit; grafische details en efemeridengegevens zijn afzonderlijke zaken. Scenario’s hebben eigen klokken en keren na herstellen terug naar de sterrenwacht. Wissel voor het meeste inzicht steeds tussen het beeld, de getallen en de aannames.

## Bronnen en verder lezen

- [Handleiding JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html): referentiestelsels, tijdschalen en geometrische versus schijnbare grootheden.
- [NASA: stertypen](https://science.nasa.gov/universe/stars/types/): de ontwikkeling van rode reuzen, witte dwergen en supernovae.
- [Universiteit van Oxford: de kleuren van Uranus en Neptunus](https://www.ox.ac.uk/news/2024-01-05-new-images-reveal-what-neptune-and-uranus-really-look-0): waarom bekende bewerkte beelden kleurvergelijkingen kunnen vertekenen.
- **Data & provenance** in de demo: bronnen en beperkingen van deze implementatie.

Schermafbeeldingen: IOM, gemaakt in de gepubliceerde demo op 27 september 2026. De onderliggende beelden en modellen behouden de bronvermeldingen in de demo. Deze gids beschrijft die versie; meegeleverde gegevens en visuele modellen kunnen later veranderen.

**[Verken Living Observatory](/demos/solar-system/)**
