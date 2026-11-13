# Terra

An interactive atlas of seven miniature 3D dioramas, built with [Three.js](https://threejs.org/) and [Vite](https://vite.dev/).

**Live demo:** https://3d-dioramas-fable.vercel.app

## Worlds

Pine forest, desert oasis, alpine peaks, tropical coast, volcanic island, sakura garden and lunar outpost. Each is a small tabletop world on a base, generated entirely from code geometry (no downloaded models or images), with its own lighting and colour mood.

## Controls

- Drag to orbit, scroll or pinch to zoom
- Toggle auto-rotate, reset the camera, enter fullscreen
- Switch worlds from the collection selector or with the arrow keys
- On narrow screens the collection becomes a horizontally scrolling strip

## Development

```bash
npm install
npm run dev      # start the dev server
npm run build    # production build to dist/
npm run preview  # preview the production build
```

## The prompt

This project was built from the following prompt:

> Build "Terra", an interactive atlas of seven miniature 3D dioramas, with Three.js and Vite: pine forest, desert oasis, alpine peaks, tropical coast, volcanic island, sakura garden and lunar outpost.
>
> - Each diorama is a small tabletop world on a base, generated entirely from code geometry: no downloaded models or images.
> - A collection selector lets you switch worlds; arrow keys move between exhibits.
> - Drag to orbit, scroll or pinch to zoom, toggle auto-rotate, reset the camera, and enter fullscreen.
> - Give each world its own lighting and colour mood, with a polished museum-exhibit interface.
> - Responsive: on narrow screens the collection becomes a horizontally scrolling strip.
