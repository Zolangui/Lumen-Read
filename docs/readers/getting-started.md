# How to read an EPUB in Firefox with Lumen Read

[Português brasileiro](primeiros-passos.md)

Lumen Read is a free, open-source reader for local EPUB books. Start with one
book; you do not need to move your library or create a Lumen account to read.
An AI key is not required. This guide targets desktop Firefox. Control labels
may vary with your installed version and language.

## Open your first book

1. [Install Lumen Read from Firefox Add-ons](https://addons.mozilla.org/firefox/addon/lumen-read/?utm_source=github&utm_medium=guide&utm_content=getting-started-en&utm_campaign=reader-first).
   Use the Firefox version required by the store listing.
2. Click Lumen Read's toolbar icon. If it is hidden, look in Firefox's
   extensions menu. The reader opens in a browser tab.
3. In the library, choose **Add New Book**, select your `.epub` file and click
   the imported book to read it. You can also drop an EPUB into the library.

Use a book you have permission to read. Lumen is a reader, not a bookstore or
PDF converter. It does not remove DRM; store/library books that need a special
authorized application are not necessarily compatible.

## Make the page comfortable

Open **Typography** in the reader's sidebar to adjust fonts, size, spacing and
single/double-page view. Start with the size and layout you need, rather than
configuring every option. A narrow window may not have room for a useful spread.

Choose **Book** to set preferences for this book or **Global** for defaults.
Book-specific overrides can take precedence over global defaults; use
**Reset to Global** when you want the book to follow those defaults again.

Use **Theme** for reading colours. The general Settings page also lets you
choose a light, dark or system colour scheme. For focus, try Zen Mode;
press **Esc** to leave it. Full screen and Zen are different controls.

Some books include their own fonts, coloured panels and illustrations. A
reflowable EPUB can change its page breaks when typography or window dimensions
change; it need not share page numbers with the printed edition. EPUB also
supports fixed layouts. See the [W3C layout specification](https://www.w3.org/TR/epub-33/#sec-layout).

### If text is hard to read in a dark theme

In versions offering **Adaptive presentation (Beta)** under Theme, you can
enable it to try improving readability while retaining meaningful book styling.
It is optional and does not guarantee a repair for every EPUB. Disable it to
compare reading without Adaptive. If the control is absent, check your
installed version; this guide is not a promise that a new release is already live.

## Keep a passage and return to it

Select text to open the selection menu and create a highlight or note. Open
**Annotations** to see the book's saved entries; click one to return to its
passage. This is not a claim of annotation interchange with other readers.

## Understand local storage before relying on it

Books and ordinary reading data stay in this browser profile by default.
Keep your original EPUB files separately. Removing the extension, deleting
profile data or using its **clear cache** action can remove local reading data.
Do not use clear cache as a harmless fix for a display problem.

Downloading the original EPUB is not a demonstrated export of your highlights
and notes. Do not assume another reader or computer will receive them. Dropbox
sync is optional; check the documented behaviour and verify your data before
relying on it as a backup or migration route.

Remote AI and Dropbox require separate choices and permissions. If enabled,
they send the selected data to their respective services. Ordinary reading
does not require configuring either feature.

## If a book does not work as expected

[Open a GitHub issue](https://github.com/Zolangui/Lumen-Read/issues/new) with:

- Firefox, operating system and Lumen versions.
- The steps, expected result and what happened.
- Theme, window/layout and whether Adaptive was enabled, if available.
- A redacted screenshot or a public sample you are allowed to share.

Do not upload a commercial EPUB, private notes, API key or account token.
You can report a problem without sharing the whole book. Reading statistics
are estimates, not evidence of reading comprehension or exact print pagination.

[Return to the project](../../README.md)
