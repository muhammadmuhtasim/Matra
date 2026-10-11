# Matra Web Presentation

A complete, modular, browser-based presentation for Matra IME. Built with semantic HTML, CSS, vanilla JavaScript, and GSAP + ScrollTrigger. On desktop, scroll advances cinematic scenes in a pinned viewport rather than moving through a conventional long page.

## Run it

**Quick start:** open `index.html` in a modern browser. GSAP and web fonts are loaded from CDNs, so an internet connection is needed for animations/fonts. The content remains scrollable if the animation libraries fail to load.

**Recommended local server:** from this folder run:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

## Controls

- Mouse wheel / trackpad: scrub through the pinned cinematic scene sequence on desktop; mobile and reduced-motion use normal document scrolling
- `←` / `→`, `Page Up` / `Page Down`, or `Space`: previous / next chapter
- `Home` / `End`: first / last chapter
- `F`: toggle fullscreen
- Bottom arrows: chapter navigation
- Left rail: jump directly to a chapter (desktop)
- Header Motion control: pause/resume motion
- Header Fullscreen control: enter/exit fullscreen

## Structure

```text
matra-web-presentation/
├── index.html
├── css/
│   ├── reset.css
│   ├── theme.css
│   ├── layout.css
│   ├── animations.css
│   └── responsive.css
├── js/
│   ├── navigation.js
│   ├── scroll-scenes.js
│   ├── interactions.js
│   └── main.js
└── assets/
```

## Chapters

1. Language is freedom
2. The problem
3. Meet Matra
4. One keyboard, multiple scripts
5. Inside the engine
6. Privacy by design
7. System architecture
8. Performance under the hood
9. Testing and evaluation
10. Limitations and roadmap
11. The bigger picture
12. Closing

## Grounding and claim discipline

The supplied Matra report describes a local-first Android IME, phonetic matching, regional profiles, clipboard encryption, a sensitive-data TTL purge, ONNX-based local prediction, optional user-controlled Gemini assistance, text expansion, glide typing, and a layered Android architecture.

The presentation intentionally distinguishes reported design from verified outcomes:
- The report mentions a sub-15 ms prediction target, but supplies no benchmark results.
- Encryption and clipboard purge behavior are presented as described architecture, not as an independent security audit.
- The report describes a zero-network default stance alongside optional Gemini cloud assistance and opt-in diagnostics. Verify the shipped defaults and data flows before making absolute network-isolation claims.
- Script support is described in the report; quality and coverage should be validated with representative corpora and fluent speakers.

## Customize

- Edit chapter content in `index.html`.
- Adjust colors and typography in `css/theme.css`.
- Adjust layouts in `css/layout.css` and `css/responsive.css`.
- Add or tune GSAP timelines in `js/scroll-scenes.js`.
- Navigation and keyboard controls live in `js/navigation.js` and `js/interactions.js`.

## Dependencies

GSAP 3.12.5 and ScrollTrigger are loaded from jsDelivr CDN in `index.html`. If you want a fully offline copy, download the library files and point the script tags to local copies.


## Cinematic stage

On desktop with GSAP available and reduced motion disabled, the 12-scene stage pins to the viewport. Scrolling crossfades, shifts, scales, and blurs panels as they trade places. Chapter controls map to the same scene timeline. Smaller screens and reduced-motion settings use regular scrolling for accessibility and content fit.


## Interactive elements

- Choose a sample sequence in the transliteration scene to see the illustrative input/match/output update. These examples are explanatory, not a live IME or verified mapping test.
- Select a language profile to update the large sample preview.
- Activate the local vault graphic to inspect the documented protection path.
- Select an architecture layer to read its responsibility.

All controls are keyboard accessible; the existing chapter controls, fullscreen toggle, motion toggle, and arrow-key navigation remain available.
