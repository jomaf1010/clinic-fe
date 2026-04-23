# Tooth SVG Attribution

The SVG files in this directory (`11.svg`, `13.svg`, `14.svg`, `14_occl.svg`,
`16.svg`, `16_occl.svg`) were created by **Zoltán Dul** in 2026 and released
under the **MIT license** via a per-file grant inside each SVG's header
comment.

Source: <https://github.com/ZoliQua/React-Odontogram-Modul>

## MIT License

```
Copyright (c) 2026 Zoltán Dul

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Group-id contract

These SVGs expose named `<g id="…">` groups that represent clinical states.
Toggling `data-active="0"` hides the group (via the embedded CSS rule
`[data-active="0"] { display: none }`). Key layers consumed by
`ToothSvg.vue`:

- `base`, `tooth`, `milktooth` — the tooth outline
- `surfaces > caries-{mesial,distal,occlusal,buccal,lingual}` — per-surface caries overlays
- `fillings > {amalgam,composite,gic,temporary}` — filling material overlays
- `restorations > {implant,prosthesis,telescope,zircon,metal,emax,crown-prep}` — restorations
- `endos` — endodontic states (RCT, posts, resection)
- `specials > {missing-closed,extraction-plan,crown-needed,crown-replace}`
- `mods > {inflammation,mobility}`

## In-house extensions (2026-04-21)

### `11_occl.svg` and `13_occl.svg` (new — anterior incisal views)

ZoliQua ships occlusal SVGs only for premolars (14_occl) and molars
(16_occl). Anterior teeth had no top-down view, so lingual/palatal
surfaces could not be rendered anywhere. These new files provide an
incisal view for incisors (template 11) and canines (template 13),
with the same group-id contract as ZoliQua's posterior occlusal
templates (`#base`, `#tooth`, `#milktooth`,
`#surfaces > #fillings > #{amalgam,composite,gic,temporary} > #filling-{material}-{surface}`,
`#surfaces > #caries > #caries-{mesial,distal,buccal,lingual,occlusal}`,
`#specials > #missing-closed`).

**All geometry is original** — tooth outline, caries blob shapes,
filling shapes, white highlight patches. Designed to pair visually
with ZoliQua's posteriors while remaining independent vector work.
The only shared assets are ZoliQua's gum-line (`gum-line-1`,
`gum-line-2`) paths, which are licensed under the same MIT terms.

Released under the MIT license.

## Phase-2 plan

Replace each file with an in-house original once we have bandwidth for
custom vector work. Keep the group-id contract identical so `ToothSvg.vue`
doesn't need to change.
