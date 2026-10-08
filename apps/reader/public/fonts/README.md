# Bundled UI fonts

These unmodified WOFF2 assets replace the reader's runtime Google Fonts imports.
They are checked into source and copied by the existing static export pipeline;
building or opening the extension does not need to download them.

- Inter: copyright 2020 The Inter Project Authors. SIL Open Font License 1.1;
  see `Inter-OFL.txt`.
- Material Symbols Outlined: Google Material Design Icons project. Apache 2.0;
  see `Material-Symbols-LICENSE.txt`.

Downloaded on 2026-10-07 from the existing CSS families, with a modern Chromium
user agent. Inter's seven language subsets are variable-weight fonts; the CSS
for 400, 500 and 700 returned the same file for each respective subset.
Symbols use the original default (outlined, normal weight) including all
ligatures, not an app-specific glyph subset.

## Original asset URLs

All Inter URLs use `https://fonts.gstatic.com/s/inter/v20/`:

| Local file               | Original filename                             |
| ------------------------ | --------------------------------------------- |
| inter-cyrillic-ext.woff2 | UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7SUc.woff2 |
| inter-cyrillic.woff2     | UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa0ZL7SUc.woff2 |
| inter-greek-ext.woff2    | UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2ZL7SUc.woff2 |
| inter-greek.woff2        | UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1pL7SUc.woff2 |
| inter-vietnamese.woff2   | UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa2pL7SUc.woff2 |
| inter-latin-ext.woff2    | UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa25L7SUc.woff2 |
| inter-latin.woff2        | UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2    |

Material Symbols source:
`https://fonts.gstatic.com/s/materialsymbolsoutlined/v375/kJF1BvYX7BgnkSrUwT8OhrdQw4oELdPIeeII9v6oDMzByHX9rA6RzaxHMPdY43zj-jCxv3fzvRNU22ZXGJpEpjC_1v-p_4MrImHCIJIZrDCvHOej.woff2`

License sources:

- `https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt`
- `https://github.com/google/material-design-icons/blob/master/LICENSE`
