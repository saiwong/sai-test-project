# KTV Finder

Static browser app for searching the scraped SoundKing song database.
Traditional Chinese query characters are normalized to Simplified Chinese for
matching against the generated song database.

Click a result row to queue that song on the SoundKing server using `cmd=Add1`.
Click the same row again to queue another copy of the same song.

In Singer search mode, matching singers are shown first. Click a singer row to
show that singer's full song list.

For Latin-letter artist searches such as `Sandy Lam`, the app can resolve public
Wikidata/Wikipedia Chinese labels at query time and use those names as extra
local search aliases. Resolved aliases are cached in the browser for 30 days.

Singer thumbnails are resolved dynamically from Wikidata and Wikimedia Commons
for visible results, then cached in the browser. If no public thumbnail is found,
the row keeps the compact original layout without placeholder art.

The control panel sends the same playback commands as the original mobile app:
`Skip`, `Play`, `Reset`, `Mute`, `MuOr`, `Music_down`, `Music_up`, `Tone_down`,
and `Tone_up`.

The Playlist tab reads `PlaylistServlet`. Per-song `Next` uses `cmd=Pro2`, and
`Remove` uses `cmd=Del1`. Randomize promotes a shuffled order sequentially.

## Song Server Host

Command and playlist calls require a `songServerHost` query parameter:

```text
https://your-name.github.io/ktvapp/?songServerHost=https%3A%2F%2Fyour-song-server.example
```

The app sends calls to `/demo/CommandServlet` and `/demo/PlaylistServlet` on the
supplied host. Without `songServerHost`, the static app still searches locally
but does not control a KTV server.

## Run

```sh
python3 -m http.server 5177 --bind 127.0.0.1
```

Open `http://127.0.0.1:5177/`.

## Update Song Data

```sh
npm run update:songs -- --host https://your-song-server.example --concurrency 12
```

The scraper writes the SQLite database to `data/songs.db`, then rebuilds
`data/songs.js` for the static app. `data/songs.js` is loaded by
`search-worker.js`, so the app stays static after generation.

Singer thumbnails are normally resolved dynamically by the browser. If you want a
local static image override, thumbnails can still be scraped from
`/demo/SingerServlet`:

```sh
npm run scrape:singers -- --host https://your-song-server.example --concurrency 12 --image-concurrency 24
```

That command stores singer image files under `data/singer-images/`, writes the
`singer_images` table in `data/songs.db`, and generates `data/singers.js` for
the static app.

For a quick scrape smoke test without changing the database:

```sh
npm run scrape:songs -- --host https://your-song-server.example --limit-pages 3 --dry-run
npm run scrape:singers -- --host https://your-song-server.example --limit-pages 2 --dry-run
```

The scraper uses the same `/demo/SearchServlet` paging flow as the old
`songscrape/song-scrape.js`, but it is faster because it fetches pages
concurrently and replaces SQLite rows in a single transaction. Tune
`--concurrency` down if the KTV server starts timing out.
