# Story spacing research — 17 October 2026

The selected 1080×1920 export layout reserves **150px at the top and 200px at the bottom**, with the existing 80px side gutters. This recovers 150px compared with version 0.2.4’s 250px at each end. Every existing card element remains; artwork/font sizes are retained, sections spread apart, and the weekly poster grows to 1320px. Square layouts are unchanged.

## Source evidence supplied by the user

Direct requests from this environment to Meta, Hootsuite, Buffer, Adobe, Canva and search engines returned network-tunnel HTTP 403. The user opened the pages and pasted the following guidance. These are user-provided excerpts, not pages independently fetched by the agent.

- [Meta’s Instagram Story image ad guide](https://www.facebook.com/business/ads-guide/image/instagram-story): 9:16, 1440×2560; roughly 14% top, 35% bottom and 6% sides free of key creative elements. The excerpt explicitly describes **image ads between organic Stories**, with allowance for profile controls and ad calls to action. At 1080×1920 these percentages are about 269px, 672px and 65px respectively. The 35% ad allowance is not a measurement of organic Story reply controls.
- [Hootsuite’s Instagram Story size guide](https://blog.hootsuite.com/instagram-story-dimensions/): the supplied table gives ordinary **Stories at 1080×1920**, a 1080×1620 safe zone, and **100–250px top / 200–250px bottom** UI ranges. The table’s separate Reels figures (108px top, 310–320px bottom) are not used for Story exports. The chosen 150/200px allowances fall within the Story ranges; their combined usable height is 1570px.

The initial no-bottom-padding experiment was withdrawn after the user observed different controls on another device. The final layout retains protection at both ends. No design allowance guarantees identical controls on every phone or app version.

## Validation

The browser checks actual canvas glyph/bitmap bounds against the selected margins and rejects intersecting text bounds. Cases cover all six card types, long names, 100-character captions, empty/single/full weekly counts and both image formats. A contact sheet uses simulated account/reply bands at the chosen margins for visual review. These are QA guides, not screenshots or measurements of Instagram itself. Preview, PNG download and native sharing continue to use the same rendered PNG bytes.
