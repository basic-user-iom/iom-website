# Marini Made Harps — configuration study

Standalone browser prototype. Uses a **generic harp model** to demonstrate a future product configurator. It is not a Marini Made Harps production instrument.

## Start

```bash
npm install
npm run process-assets
npm run dev
```

Open `http://localhost:5177`.

## Build

```bash
npm run build
```

Output: `dist/`

The build is relative (`base: './'`), so the folder can be hosted on its own and embedded in Squarespace with an iframe.

## Source model

Copies of the inspected source live in `public/models/`. Originals in `C:\Users\Mirjan\Downloads\harf` are never modified.
