# Comet nucleus sources and display limits

The 67P binary is derived from ESA/Rosetta/NAVCAM MTP019, archived by NASA PDS and ESA PSA. Its credit, complete data citation, original URL, SHA-256 hashes and processing measurements are in source.json. The derived mesh is licensed CC BY-SA 3.0 IGO, as is the ESA NAVCAM release. No ESA endorsement is implied.

Rebuild: `node solar-system/scripts/comets/prepare-navcam-model.mjs [optional-downloaded-obj]`. The script protects thin source features when simplifying to 24,000 triangles, verifies every edge is shared by two faces, and normalizes volume uniformly. The application uses its existing catalog radius; original axis proportions remain intact. The 432 KB asset loads independently and retains an illustrative closed fallback on error. Nothing is fetched from ESA at runtime.

Halley uses an illustrative elongated nucleus informed by Giotto's 15 x 7.2 x 7.2 km proportions. Its terrain is not reconstructed from imaging. The other procedural nuclei are independently seeded illustrations. They are not claimed to be measured maps or verified shapes. Catalog radii, orbital solutions and activity calculations are unchanged.

All five materials add illustrative dust relief, exposure enhancement and restrained camera fill so the dark surfaces can be inspected. The primary light follows the actual Sun direction. This is not calibrated photometry. Rotation remains illustrative. Coma and tail visibility still follows the existing activity model. A display-only gap excludes the solid nucleus bounds from its orbit stroke; ephemeris samples are unchanged.

References:
- ESA NAVCAM release and license: https://blogs.esa.int/rosetta/2015/11/30/new-comet-shape-model/
- Shape reconstruction method: https://blogs.esa.int/rosetta/2015/08/13/a-shape-model-whats-that/
- Archive: https://pds-smallbodies.astro.umd.edu/holdings/ro-c-multi-5-67p-shape-v2.0/dataset.shtml
- Halley Giotto observations: https://www.esa.int/ESA_Multimedia/Images/2016/03/Giotto_approaching_Comet_Halley
- Encke observations: https://science.nasa.gov/solar-system/comets/2p-encke/
- NEOWISE unresolved nucleus: https://science.nasa.gov/asset/hubble/comet-neowise/
- Hale-Bopp remote observations: https://iso.esac.esa.int/iso/iso/iso/outreach/esa_pr/in9708.php
