Een onafhankelijke omgevingsstudie van IOM brengt donkere monolieten, zee en wolken samen in een scène die je in realtime kunt verkennen en aanpassen.

## Uitdaging — de scène bewerkbaar houden

Monolieten rijzen op boven bewegend water, terwijl wolkenbanken tussen de bouwwerken trekken. Het doel was dat gevoel van schaal te behouden en bezoekers tegelijk de camera, verlichting en het weer te laten aanpassen. Dit is een onafhankelijke visuele studie, geen opdracht voor een klant.

## Oplossing — wolken met een begrensd bereik

Een radius in de wereldruimte begrenst de wolken rond de monolieten, met een zachte overgang aan de rand. Nabije wolken krijgen fijnere volumetrische bemonstering; verder weg wordt die geleidelijk grover. Dit verandert het detail van ray marching. De kwaliteitsinstelling bepaalt de renderresolutie. Zichtbare wolken en hun schaduwberekening gebruiken dezelfde ruimtelijke grens.

## Oplossing — meer detail met behoud van de originelen

De monolieten behouden hun oorspronkelijke kleur-, normal- en metallic/roughness-maps. Een gedeelde Dark Concrete-laag met normal- en roughness-maps van 1K voegt instelbaar oppervlaktedetail toe. Het normalpatroon herhaalt zich twee keer zo vaak als voorheen: kleinere vormen met dezelfde sterkte. Met een vergelijkingsschakelaar keer je terug naar het originele oppervlak.

![Close-up van het monolietoppervlak met fijne normalmap-details](/assets/blog/storm-monolith-studio/detail.webp)

## Resultaat — een zelfstandige browserstudio

De zelfstandige toepassing bevat orbit- en vliegcamera’s, weerinstellingen en scène-export als JSON of draagbaar pakket. Geoptimaliseerde modellen delen middelen; statische transformaties en de planning van wolkenschaduwen beperken herhaalde berekeningen. De beeldsnelheid hangt nog steeds af van apparaat, aanzicht en kwaliteit. Een statische afbeelding op de homepage verwijst naar de studio zonder daar een extra 3D-renderer te starten.

## Probeer de scène

Begin bij het ingestelde camerastandpunt en open WEATHER → VOLUMETRIC CLOUDS om Cloud radius of Near detail distance te wijzigen. Selecteer Near left monolith en open MATERIALS om Dark Concrete detail te vergelijken. Verander één instelling tegelijk: meer wolken of fijnere details kunnen meer GPU-werk vragen. Scene JSON bewaart de instellingen; een pakket bevat ook de benodigde scènebestanden.

[Open de studio](https://storm-monolith-studio.vercel.app/) · [Bekijk de casestudy](/nl/case-studies/storm-monolith-studio)
