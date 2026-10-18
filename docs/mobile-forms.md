# Touch form text and iOS focus zoom

Safari on iPhone may zoom a text control when its font is below 16 CSS pixels.
`src/mobile-forms.css`, loaded from the root entry, supplies a 16 px baseline to
text inputs, textareas, selects and editable content on touch devices. A WebKit
touch-callout feature query covers iPadOS when a trackpad changes pointer type.
Checkboxes, radios, files, sliders and buttons are excluded. No runtime platform
sniffing, autofocus/blur trick or viewport mutation is used.

Most app/dialog fields already had 16 px styles. The root rule also covers
standalone forms and new controls outside those wrappers. It has no `!important`;
larger explicit sizes remain possible. `max(16px, 1rem)` follows a larger root font
where supported, with a plain 16 px fallback. Focus scroll margins provide some
room around a field. Labels and body text retain their existing sizes.

The viewport keeps `width=device-width, initial-scale=1.0, viewport-fit=cover`.
There is no `user-scalable=no` or maximum-scale lock; pinch zoom remains available.
Existing story-editor visual-viewport sizing and safe areas are preserved.

`scripts/mobile_forms_ui_smoke.py` checks actual computed field sizes in six form
scenes with touch emulation, plus unclassed input types and a larger-size control.
It checks viewport zoom is unrestricted and performs no submissions. These are
Chromium CSS/layout checks, not a native iOS keyboard or focus-zoom test. A real
iPhone/iPad must verify Safari's native zoom and keyboard presentation.
