# Bilingual village directory — 14 September 2026

Source: owner-supplied `maharashtra_5_districts_village_directory_bilingual.xlsx`, **All Villages**, rows 5–4879. The workbook labels its access date as 13 September 2026. Its district sheets reconcile to the combined sheet; all 4,875 village codes are unique and all nine fields are populated. Names are retained from the workbook, without asserting independent verification of its source claims.

| District | Talukas | Villages |
| --- | ---: | ---: |
| Dharashiv | 8 | 728 |
| Solapur | 11 | 1,155 |
| Beed | 11 | 1,299 |
| Sangli | 10 | 765 |
| Latur | 10 | 928 |
| Total | 50 | 4,875 |

The registration and authorized farmer-profile forms use the updated district/taluka list and searchable village suggestions. District changes clear the dependent taluka and village; taluka changes clear the village. Selecting a taluka opens its village list automatically. It initially renders 30 options and appends another 30 near the end of scrolling, with a Load more button as a fallback. Every village in that taluka is reachable without typing. Optional search accepts Marathi, case-insensitive English and village codes and prioritizes prefix matches. Reopening a selected village shows the full list again. Arrow keys, Enter, Escape, mouse and touch are supported. Existing free-text village entry remains available for missing entries and historical records. The two Malegaon villages in Barshi are displayed with their distinct LGD codes; selecting either stores its code with the name to preserve the distinction.

The directory is split into 50 compact JSON packs with content-hashed URLs. Only the selected taluka's pack loads, and successful loads are cached across form mounts. Changing taluka aborts the prior request and prevents stale results. Typing performs no database/network calls. Village names are absent from initial JavaScript bundles. Total data is 241,773 bytes, with a largest pack of 12,599 bytes and at most 236 villages per pack. A local 3,000-search benchmark on that largest pack measured 0.11 ms median and 0.22 ms at the 95th percentile; this excludes rendering and download time.

`scripts/import-village-directory.py` regenerates the packs, typed metadata and geography seed from the workbook. The CLI-generated migration `20260914173625_village_directory_geography.sql` updates labels and adds Latur's ten talukas. Existing internal codes such as `umarga`, `ambajogai`, `parli_vaijnath`, `sangola` and `solapur_north` remain stable despite source spelling differences. No permissions, financial records or saved registrations are changed.

The homepage coverage section uses a Maharashtra district map: Dharashiv, Solapur, Beed, Sangli and Latur have distinct brand colors and bilingual external labels with leader lines; the other districts remain neutral and unlabeled. Three counters below the map derive the five districts, 50 talukas and 4,875 villages directly from directory metadata. The registration link remains below the counters.

The map is a static Server Component SVG, with no map SDK, tile requests or additional client JavaScript. `src/features/geography/maharashtra-paths.json` contains 36 district paths (46,453 bytes; 15,985 bytes gzip). Geometry comes from [Guneet Narula's district boundary dataset](https://github.com/guneetnarula/indian-district-boundaries/blob/master/topojson/state-wise/maharashtra.json), under MIT; the complete notice is retained in `public/data/maharashtra-map-LICENSE.txt`. Shared TopoJSON arcs were projected using an equirectangular projection at 19 degrees and simplified together at a 1.2 SVG-unit tolerance before assembling polygons, retaining matching district edges. Source names Osmanabad and Bid map to Dharashiv and Beed. The source is a visualization dataset with 2019-era administrative coverage, not a cadastral map. Workbook counts are independent of the boundary dataset.

Map verification: all 36 paths are present and all five leader-line anchors are inside their respective district polygons. Desktop and 390px mobile layouts were inspected for labels, counters and horizontal overflow. Lint, typecheck, 22 tests and the isolated production build passed. Preview: `http://localhost:3103/#coverage`; production deployment remains pending.

Verification: the earlier directory release passed geography SQL assertions. The incremental-picker update passes lint, TypeScript, all 22 application tests (including completeness checks across every village pack) and the production build. Browser checks cover automatic opening, 30 → 60 loading by scrolling, all 126 Dharashiv villages via progressive loading, selecting the final village, reopening the full list, optional Marathi search, keyboard selection, taluka resets and the mobile layout. Earlier checks also covered English search, district resets and duplicate names. The geography migration is applied to the isolated local preview database; production release still requires applying the migration with the updated application. The separate preview at `http://localhost:3103/register` tests the form without connecting to live payments.
