<p align="center"><img src="assets/logo-text.svg" height="42" alt="JASD"/></p>

<p align="center">JASD is just a simple downloader for videos and audio from YouTube and hundreds of other sites.</p>

https://github.com/user-attachments/assets/5c1850ed-82ea-469e-8da7-43b389c09b85

## Features
- **Video + Audio** or **audio only** download
- **Download queue**
- **30 languages** with auto-detection

---

## Quick Start

### 1. Dependencies

- **yt-dlp** — bundled in releases; for dev builds place the binary in `bin/` or have it on your PATH — [github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **ffmpeg** — must be on your PATH — [ffmpeg.org](https://ffmpeg.org/download.html)

### 2. Run

```bash
npm install
npm start
```

### 3. Build

```bash
npm run build          # current platform
npm run build:win      # Windows NSIS installer
npm run build:mac      # macOS DMG (universal)
npm run build:linux    # AppImage + deb
```

---

## Download Options

| Option | Description |
|--------|-------------|
| **Video Quality** | Best, or specific resolution (populated after fetch) |
| **Container** | MP4, MKV, WebM, MOV |
| **Audio Quality** | VBR 0 (best) to 5, or fixed bitrate (128K / 192K / 320K) |
| **Prefer Opus Audio** | Use Opus stream instead of AAC (re-encoded to AAC for compatibility) |
| **Audio Only** | MP3 / AAC / FLAC / Opus / WAV / M4A |
| **Embed Thumbnail** | Attach cover art to file |
| **Embed Metadata** | Add title, artist, album tags |
| **Rate Limit** | Throttle bandwidth (e.g. `2M`, `500K`) |
| **Playlist Items** | Specific items only: `1-5`, `1,3,7` |
| **Custom Filename** | Override the auto title-based filename |
| **Output Folder** | Per-download override or global default in Settings |
| **Cookies** | Import cookies.txt for restricted content |
| **Parallel Downloads** | Run multiple downloads simultaneously |

---

## License

MIT + Commons Clause

Permission is granted to use, copy, modify, and distribute this software for **non-commercial purposes** free of charge. You may **not** sell this software or offer it as a paid service without explicit written permission from the author.

See the full [Commons Clause](https://commonsclause.com/) for details.

