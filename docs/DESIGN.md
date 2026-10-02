# Design notes

The product is a calculator that prints, so the design starts from the thing that did this first: the paper tape of an adding machine. These machines printed figures in black, printed totals in red from a two-colour ribbon, and fed the paper out of the top.

Everything below follows from that idea. When a decision was unclear, it was settled in favour of what reads better and works more reliably, not what looks more impressive.

## Principles

1. **Typography instead of decoration.** Numbers are the content. They are set large, in a monospaced face, with a clear hierarchy: the expression is quiet, the result is loud. No gradients, glass, glow or decorative shadows.
2. **One accent, used sparingly.** Ribbon red marks what the machine produces and where to look: results on the tape, the `=` key, the caret, and the wavy underline under an error (the familiar spell-check convention). Error messages themselves are set in ink, so a red number always means a result.
3. **Shape follows role.** Paper is square, controls are slightly rounded (4px), the machine is rounder (10px). Different things look different on purpose.
4. **Motion only where something happens.** A new entry feeds up like paper (200ms). A key darkens when pressed, on screen or on the physical keyboard (70ms). Nothing loops except the caret, and everything stops with `prefers-reduced-motion`.
5. **Nothing jumps.** Every line of the display has a fixed height, long numbers shrink to fit and then scroll inside the display, and the tape never makes the page taller.

## Tokens

All values live in [`src/styles/tokens.css`](../src/styles/tokens.css). Components only use names.

### Colour

Colours are light/dark pairs written with `light-dark()`. The theme switch only changes `color-scheme`, so both themes always use the same set of names.

| Token         | Light     | Dark      | Used for                                |
| ------------- | --------- | --------- | --------------------------------------- |
| `--paper`     | `#f3f0e8` | `#131210` | Page background                         |
| `--sheet`     | `#fbfaf6` | `#1b1a17` | The tape, digit keys, dialog            |
| `--ink`       | `#1c1b18` | `#ece7dc` | Text                                    |
| `--ink-muted` | `#656055` | `#9f998c` | Secondary text, operators, line numbers |
| `--rule`      | `#d6d0c1` | `#38352f` | Hairlines, pending parentheses          |
| `--key-fn`    | `#eae5da` | `#25231f` | Operator and function keys              |
| `--accent`    | `#b23a1e` | `#f07a5a` | Results on the tape, the `=` key        |

Contrast, measured with the WCAG 2 formula. 4.5:1 is the AA minimum for normal text.

| Pair                           | Light  | Dark   |
| ------------------------------ | ------ | ------ |
| Ink on paper                   | 15.1:1 | 15.2:1 |
| Muted ink on paper             | 5.5:1  | 6.6:1  |
| Muted ink on sheet             | 6.0:1  | 6.1:1  |
| Muted ink on a function key    | 5.0:1  | 5.5:1  |
| Accent on sheet (tape results) | 5.7:1  | 6.3:1  |
| Text on the accent (`=` key)   | 5.7:1  | 6.8:1  |

Hairlines (`--rule`) are decorative: keys are identified by their labels, not their borders.

### Type

**IBM Plex Mono** sets every number: display, keys, tape. **IBM Plex Sans** sets words.

- A monospaced face gives every digit the same width, so a number does not shift while you type, and columns on the tape line up. It also suits a printing machine.
- Plex was drawn with IBM's office machines in mind. That fits the tape, and the face has more character than a default system font.
- Both faces cover Cyrillic properly, and they are open source (SIL OFL).
- They are self-hosted, with only the Latin and Cyrillic subsets in two weights (400, 500): about 100 KB of fonts on the first visit, cached afterwards. Both subsets load in either language, because the static HTML is Russian until the interface language is applied. This is the largest item on the page, and a known trade-off for having real typography.

Scale: ratio 1.25 from 16px, rounded to whole pixels: 11, 12, 14, 16, 20, 25, 31, 39, 49. The display uses the top of the scale and shrinks along it as an expression grows. The size is computed from the character count and the container width (`100cqi / (chars × 0.6)`, where 0.6em is the advance width of Plex Mono).

Russian digit groups use a narrow no-break space (`1 234 567,5`), as Russian typography prescribes. A full space takes a whole cell in a monospaced font and would split numbers in two.

### Space, shape, motion

- Spacing is a 4px grid: 4, 8, 12, 16, 24, 32, 48, 64.
- Radii: 4px for controls, 10px for the machine, 0 for paper.
- Easing is `cubic-bezier(0.2, 0.8, 0.2, 1)`, which decelerates and never overshoots. Durations: 70ms for presses, 160ms for fades, 200ms for movement.

## Layout

- **Phone (from 360px):** the tape on top and the machine at the bottom, within reach of the thumb. This is also how paper comes out of an adding machine. Keys shrink a little on short screens (`clamp(3.25rem, 8dvh, 4rem)`) so the tape keeps some room.
- **Tablet and desktop (from 768px):** the machine on the left at a fixed width, and a long tape filling the rest. The asymmetry is deliberate: the tape is the reason the product exists.
- The tape uses `contain: size`: it takes the height of its grid row and scrolls inside, so 500 entries never push the keypad off screen.

## Details

- **States.** Every control has hover, active and keyboard-focus styles. Focus is a 2px ink outline, inset on keys so it does not overlap the neighbours. Keys typed on a physical keyboard light up on screen too.
- **Display.** A caret shows where the next character goes. Parentheses that are still open appear as faint `)` at the end. The live preview shows `=` or `≈`. After `=` the calculation moves up a line and the result takes its place.
- **Errors.** The expression stays on screen, the parser's position is underlined with a red wavy line, and a sentence below says what is wrong. Backspace fixes it; nothing has to be retyped.
- **Empty tape.** Instead of an empty box, the tape explains itself in one sentence and offers three calculations to try. Each one shows something specific: exactness (`0,1 + 0,2`), percentages (`1 200 − 15%`) and honest rounding (`1 ÷ 3`).
- **Toasts** confirm copying and clearing. Clearing can be undone for 8 seconds, and the timer pauses while the pointer or focus is on the toast.
- **404.** The missing address is printed on a slip of tape with `= 404` as the total, in both languages, with a way back.
- **No loading skeletons.** Nothing loads after the first paint: the keypad and the tape frame are in the HTML, and the calculator starts synchronously. A skeleton would only imitate waiting.

## Accessibility

- Landmarks (`header`, `main`, `footer`), one `h1`, labelled groups for the display and the keypad.
- Every key has a spoken name (`÷` is "Divide"/"Разделить"). Tape entries are buttons named by their full calculation and described as "press to use this result".
- Results and errors are announced through a polite live region. Typed characters are not announced, which would be noisy.
- Full keyboard control. Enter after a mouse click means `=`, while a control reached with Tab keeps Enter for itself. Browser shortcuts (zoom, tabs, copy) are never intercepted.
- Touch targets are at least 32px in the header and 52px on the keypad.
- axe-core checks WCAG 2.2 AA in five states in CI.

## Deliberately absent

Purple-blue gradients, gradient text, glow, glassmorphism, emoji in headings, icons added for decoration, testimonials, invented numbers and a "hero → three cards → call to action" landing page. Only three icons are used, each one carrying meaning: backspace, the theme switch and the tab icon.
