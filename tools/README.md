# Optional leaflet utilities

These utilities preserve an earlier farmer-information leaflet. They are separate from the website and are not run during installation, builds, or deployment.

## Review the content before distribution

The saved leaflet text is historical. Both generators describe only the ₹500 membership and include share-certificate ownership and company voting claims that were removed from the homepage. Review these statements against the approved current membership terms before producing or distributing a leaflet. The current website also offers a ₹2,500 Focused Value Chain membership; these utilities do not yet describe that option.

No generated leaflets are included in this change. Generated files are local working artifacts and are ignored by Git.

## Requirements

- `build_farmer_leaflet.py`: Python 3, `python-docx`, and Pillow. Install optional Python packages in your own virtual environment with `python -m pip install python-docx Pillow`.
- `build_farmer_leaflet_pdf.cjs`: the project's Playwright development dependency installed by `npm ci`, plus Chromium installed with `npx playwright install chromium`. Set `PLAYWRIGHT_EXECUTABLE` only when using an existing compatible browser.
- Both templates use the Windows `Nirmala UI` font for Marathi. A machine without that font needs an installed Devanagari font and an updated template font declaration before rendering; inspect the output for missing glyphs and changed page breaks.
- Both utilities read `public/brand/logo-icon.png` and `public/images/about-farm.jpg`. They resolve these paths relative to the repository, so the shell working directory does not determine the asset location.

## Outputs

After reviewing the content and dependencies, run the utility from the repository root:

```sh
python tools/build_farmer_leaflet.py
node tools/build_farmer_leaflet_pdf.cjs
```

The Python utility writes `output/documents/Ganpati_Agro_Farmer_Information_Leaflet.docx` and a cropped image under `tmp/leaflet/`. The PDF utility writes `output/pdf/Ganpati_Agro_Farmer_Information_Leaflet.pdf` and a local HTML preview under `tmp/leaflet/`. Each run replaces the utility's existing output files; preserve any manually edited copies first.

Inspect every generated page before sharing. These scripts do not change application or database records.
