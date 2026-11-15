# Fahrzeugmodelle und Vorschauen

Die Kart- und GT3-Modelle sind prozedurale Eigenmodelle aus kart_racer.html und gt3.js. Version 1.1.3 ersetzt die GT3-Geometrie durch neu modellierte Karosserien: ausgeformte Kotflügel und Radkästen, unterschiedliche Dachlinien, Fensterrahmen, Zehnspeichenfelgen, Bremssättel, Lufteinlässe und modellabhängige Leuchten/Spoiler. Statische Bauteile werden pro Material zusammengeführt. Die PNG-Vorschauen unter previews/ sind direkte Renderings dieser Spielmodelle und werden erst beim Öffnen von Garage oder Shop geladen.

Porsche 911 GT3 RS, Mercedes-AMG GT3 und Ferrari 296 GT3 bleiben auf Wunsch als Fahrzeugauswahl erhalten. Es wurden noch keine externen Markenmodelle eingebunden. Die Modellrecherche ist kein Nachweis einer bereits heruntergeladenen oder übernommenen Datei.

Kandidat für eine spätere Prüfung: Porsche 911 GT3 RS (991.1), Mona x Supercars, auf Sketchfab als CC Attribution angeboten, ca. 33.600 Dreiecke:
https://sketchfab.com/3d-models/porsche-911-gt3-rs-9911-16-c08b312e73754d0db8ab1e266eca8a28

Vor einer Übernahme sind die konkrete Datei, Lizenz, Attribution und Spielleistung zu prüfen. Keine generischen Fahrzeuge als Markenmodelle ausgeben.

Erneute Recherche am 10.11.2026: Der genannte Porsche-Download war nicht zugänglich. Ferrari 296 GT3 von MattDoesBlender (CC Attribution, 411.800 Dreiecke) war für die unmittelbare mobile Nutzung zu umfangreich; keine Datei übernommen:
https://sketchfab.com/3d-models/ferrari-296-gt3-e6760847bb2d4b579d43cf916f348526

Die Eigenmodelle sind stilisierte Annäherungen, keine offiziellen Hersteller-Assets. Keine extrahierten Modelle aus kommerziellen Rennspielen verwendet.

## Big November Update — Original, Apex, Rally, Vector

Original hand-authored Three.js kart and driver geometry in `kart-models.js`. No downloaded car geometry or brand logos. Image-generated surface atlas: `liveries/kart-materials-v1.png` (source) / `.webp` (runtime); exact prompt and provenance in `liveries/PROMPT-kart-materials.md`. Includes body panels, carbon, rubber, aluminum, visor and suit. Previews render the actual models. All four designs retain Kart handling; rankings separate models.

1.2.2: v2 atlas and rounded geometry update matching the singleplayer lobby artwork. Exact prompt: liveries/PROMPT-kart-v2.md. New materials affect the four Kart designs and shared driver. GT3 identities and race physics are unchanged. Previous atlas retained.

1.2.3: Additional BMW M4 GT3, Aston Martin Vantage GT3, Audi R8 LMS GT3, Lamborghini Huracán GT3 Evo2 and McLaren 720S GT3 meshes supplied by the user in files.zip (gt3-extra.js). Hand-authored procedural approximations without downloaded manufacturer geometry or logos. Integrated and refined headlight placement and colour-space handling; preview PNGs rendered from the in-game geometry. Vehicle names identify the intended inspirations, not official licensed assets.

1.2.4: GT3 cockpit uses original procedural dashboard, roll cage, racing wheel, gloves and a live canvas instrument display; it is a stylized shared racing interior, not a manufacturer-specific scan. 320×180 WebP previews derive from the retained PNG renders (88,018 bytes total versus 1,117,608 bytes, about 92% smaller).


## 1.2.6 – original GT3 refinements and Christmas sleigh
GT3 bodies, cockpit and selectable steering wheels are generated from original geometry; no third-party car mesh or reference photo is distributed. Visual references: Porsche https://newsroom.porsche.com/en_US/2022/products/porsche-911-gt3-rs-world-premiere-29439.html and https://www.porschedrive.jp/car/19450 ; Mercedes-AMG https://www.mercedes-amg.com/en/mercedes-amg-gt3 . Ferrari model reference: https://www.ferrari.com/en-EN/competizioni-gt/296-gt3 (official page access restricted during research). These are stylized approximations, not exact licensed reproductions.
Christmas sleigh surface: OpenAI image generation, assets/vehicles/liveries/christmas-sleigh-v2.png and .webp, prompt in PROMPT-christmas-sleigh-v2.md. Original geometry adds curved red sides, gold runners, gifts and a Santa hat. No external mesh required.

## 1.2.7 — The Tuning-Update
Original procedural geometry in tuning-visuals.js: single/twin kart engines, inline-six, flat-six boxer, V6, V8 and V10 layouts, with car-specific accents and front/mid/rear placement. Porsche rear boxer, AMG front V8, Ferrari mid V6 twin-turbo are stylized inspirations specified by the user, not manufacturer CAD or exact technical replicas. Intake/turbo, gearbox, suspension, rims, tyres, calipers/discs, aero and lightweight trim are built from original primitives, batched by part/material. No downloaded meshes, logos, photographs, new textures or external licenses required. Low quality reduces segments; the workshop uses a clipping cutaway instead of transparent layers on Low. Tuning changes neither wheelbase nor collision geometry.
