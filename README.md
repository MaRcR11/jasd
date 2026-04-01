<p align="center">
  <svg width="80" height="80" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5b7cf6"/>
        <stop offset="100%" stop-color="#7c5cf6"/>
      </linearGradient>
    </defs>
    <rect width="32" height="32" rx="7" fill="url(#g)"/>
    <path d="M10 8l14 8-14 8V8z" fill="white"/>
  </svg>
</p>

# JASD — Just A Simple Downloader

A fast, clean desktop app for downloading videos from YouTube and hundreds of other sites.

https://github.com/user-attachments/assets/ee5b6517-b436-40d7-adb2-4cb2bc11f0ee

---

## Features

- **Video + Audio** or **audio only** download
- **Download queue** management
- **15 languages** with auto-detection

---

## Quick Start

### 1. Install dependencies

- **yt-dlp** — [github.com/yt-dlp/yt-dlp](https://github.com/yt-dlp/yt-dlp)
- **ffmpeg** — [ffmpeg.org](https://ffmpeg.org/download.html)

Both must be available on your system PATH.

### 2. Install & Run

```bash
npm install
npm start
```

### 3. Build distributables

```bash
npm run build          # current platform
npm run build:win      # Windows NSIS installer
npm run build:mac      # macOS DMG (universal)
npm run build:linux    # AppImage + deb
```

Built files go to `dist/`.

---

## Download Options

| Option | Description |
|--------|-------------|
| **Video Quality** | Best, or specific resolution (populated after fetch) |
| **Container** | MP4, MKV, WebM, MOV |
| **Audio Quality** | VBR 0 (best) to 5, or fixed bitrate (128K / 192K / 320K) |
| **Prefer Opus Audio** | Use Opus stream instead of native AAC (higher source quality, re-encoded to AAC) |
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

