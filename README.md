# KTV Finder

Static browser app for searching the scraped SoundKing song database.

Click a result row to queue that song on the SoundKing server at
`https://your-song-server.example/demo/CommandServlet` using `cmd=Add1`.
Click the same row again to queue another copy of the same song.

The control panel sends the same playback commands as the original mobile app:
`Skip`, `Play`, `Reset`, `Mute`, `MuOr`, `Music_down`, `Music_up`, `Tone_down`,
and `Tone_up`.

The Selected tab reads `PlaylistServlet`. Per-song `Next` uses `cmd=Pro2`, and
`Remove` uses `cmd=Del1`. Randomize promotes a shuffled order sequentially.

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
