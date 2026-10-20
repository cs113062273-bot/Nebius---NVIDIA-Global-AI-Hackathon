# Accessibility methodology

The tested unit is an explicit user task under specified interaction conditions. Keyboard runs use browser keyboard events, never locator focus/click shortcuts. Seek is bounded sequential Tab navigation. The oracle includes task outcomes and functional observations; it is frozen before model access. A successful event dispatch without its expected state never establishes completion.

Profiles are distinct: keyboard, pointer functional control, AX semantics, 640/320 CSS-pixel reflow equivalence, reduced-motion preference and forced-colors emulation. A profile only establishes the assertions actually listed in that journey. Capturing AX data does not imply every semantic property was asserted. Capturing a screenshot does not imply a human reviewed it.

Chromium's CDP AX tree and Playwright ARIA snapshots provide role/name/state/hierarchy evidence. Focus graph names are explicitly DOM-derived hints; the AX artifacts hold browser semantics. The graph shows observed edges, and cannot prove global reachability or absence of all traps. Center-point obstruction and offscreen geometry are heuristics; do not present them as a full focus-visibility conformance test.

axe runs WCAG A/AA tagged rules. Violations, incomplete/manual-review findings, passes and inapplicable rules remain in artifacts. It does not establish all WCAG criteria. A journey can complete while a rule violation remains; reports distinguish these. Repair verification additionally rejects newly introduced automated findings.

[WCAG 2.2](https://www.w3.org/TR/WCAG22/) is normative. [Understanding documents](https://www.w3.org/WAI/WCAG22/Understanding/) explain criteria. [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) is non-normative implementation guidance. Mappings include Keyboard 2.1.1, focus order 2.4.3, focus visible 2.4.7, focus not obscured 2.4.11, reflow 1.4.10, error identification 3.3.1, Name Role Value 4.1.2 and status messages 4.1.3. These references do not mean each criterion is completely tested.

[axe-core](https://github.com/dequelabs/axe-core) documents incomplete results and automation limits; [Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots) document semantic snapshot assertions. Real screen-reader evaluation would require a named reader, OS/browser versions, actual reading/navigation modes and task review by people. None has occurred. Meaningful labels, content quality, cognitive usability and complete conformance still require human evaluation. No legal certification or WCAG compliance certificate is produced.
