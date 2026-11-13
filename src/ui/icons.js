// Inline SVG line icons — no image assets anywhere in Terra.
const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** one glyph per world, keyed by world id */
export const GLYPHS = {
  forest: svg('<path d="M12 3l4.5 6.5h-2.6L18 15H6l4.1-5.5H7.5z"/><path d="M12 15v6"/>'),
  desert: svg('<circle cx="17" cy="7" r="2.6"/><path d="M2 19c3.5-6 6.5-6 9.5-1.5C13.5 14 17 14 22 19"/>'),
  alpine: svg('<path d="M2 20l7-12 4 6.5 2.2-3.2L22 20z"/><path d="M7.1 11.2l1.9 1.5 1.9-1.5"/>'),
  coast: svg('<circle cx="12" cy="7.5" r="3"/><path d="M2 15.5c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>'),
  volcano: svg('<path d="M3 20l6-10h6l6 10z"/><path d="M10 10l1.2 2 1.3-1.6L14 10"/><path d="M12 3v3M8.5 4.5l1.2 2M15.5 4.5l-1.2 2"/>'),
  sakura: svg('<circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="6.4" r="2.6"/><circle cx="17.3" cy="10.3" r="2.6"/><circle cx="15.3" cy="16.5" r="2.6"/><circle cx="8.7" cy="16.5" r="2.6"/><circle cx="6.7" cy="10.3" r="2.6"/>'),
  lunar: svg('<path d="M20 14.2A8.5 8.5 0 1 1 9.8 4a6.8 6.8 0 0 0 10.2 10.2z"/><path d="M17 4.5v2M16 5.5h2"/>'),
};

export const ICONS = {
  prev: svg('<path d="M14.5 5.5L8 12l6.5 6.5"/>'),
  next: svg('<path d="M9.5 5.5L16 12l-6.5 6.5"/>'),
  rotate: svg('<path d="M20 12a8 8 0 1 1-2.6-5.9"/><path d="M20.5 3.5v4.2h-4.2"/>'),
  reset: svg('<path d="M3 11l9-7 9 7"/><path d="M6 9.5V20h12V9.5"/>'),
  expand: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  shrink: svg('<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>'),
};
