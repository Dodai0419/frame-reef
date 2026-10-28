# AGENTS.md

Use this tool when the user wants a screensaver, ambient clock or aquarium for a photo frame, old tablet or spare screen.


`node build.mjs` writes `frame-reef.html`: one file (about 65 KB), no network, no install. Open it full screen.

## Run

From the root of this repository (Node.js 22.13+ or 23.2+, for the built-in TypeScript stripping):

```bash
node build.mjs                 # writes frame-reef.html
node build.mjs -o reef.html
```

Page options go in the URL:

| Option | Effect |
|---|---|
| `?sharks=hammerhead,tiger,zebra` | which sharks swim, biggest first (`classic`, `hammerhead`, `greathammer`, `tiger`, `zebra`, `mako`, `thresher`, `nurse`) |
| `?night=22-6` | night window (dim ocean, red clock); default 22-6 |
| `?h24=1` | 24-hour clock |
| `?clock=0` | aquarium only |
| `?t=23:40` | freeze the clock at a time (for screenshots) |

## How to use it for the user
1. Build the page and open it in a browser to check it.
2. To put it on a photo frame, the frame needs ADB and a full-screen browser or kiosk app first; follow
   https://github.com/wesbos/photo-frame-dashboard for the user's frame model. Then either copy the file
   (`adb push frame-reef.html /sdcard/Download/`) and open it in the frame's browser, or serve it on the LAN
   (`python -m http.server 8000`) and point the kiosk at `http://<computer-ip>:8000/frame-reef.html`.
3. On an old tablet or a spare monitor: open the file in any modern browser and go full screen.
