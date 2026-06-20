# KTV Finder

Static browser app for searching the scraped SoundKing song database.

The app loads the generated `data/songs.js` index in a web worker and supports
fast Chinese and English fuzzy matching across song titles and singers.

## Run

```sh
python3 -m http.server 5177 --bind 127.0.0.1
```

Open `http://127.0.0.1:5177/`.

## Regenerate Data

```sh
node scripts/build-data.mjs data/songs.db
```

The generated `data/songs.js` file is loaded by `search-worker.js`, so the app stays static after generation.
