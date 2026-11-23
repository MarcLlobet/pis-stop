# Third-party notices

## Untitled UI React

The files below are copied unmodified from [untitleduico/react](https://github.com/untitleduico/react) at commit `bff7606f3ce705f0ba5984f383f11f865024e1f7` (2026-11-18). They are kept byte-identical so that updating them is a plain diff against upstream, and they are excluded from this project's lint and format rules for the same reason.

```
components/application/loading-indicator/loading-indicator.tsx
components/application/modals/modal.tsx
components/application/tabs/tabs.tsx
components/base/avatar/avatar.tsx
components/base/avatar/base-components/avatar-add-button.tsx
components/base/avatar/base-components/avatar-badge.ts
components/base/avatar/base-components/avatar-company-icon.tsx
components/base/avatar/base-components/avatar-count.tsx
components/base/avatar/base-components/avatar-online-indicator.tsx
components/base/avatar/base-components/index.tsx
components/base/avatar/base-components/verified-tick.tsx
components/base/badges/badge-types.ts
components/base/badges/badges.tsx
components/base/buttons/button.tsx
components/base/buttons/close-button.tsx
components/base/input/hint-text.tsx
components/base/input/input.tsx
components/base/input/label.tsx
components/base/tooltip/tooltip.tsx
components/foundations/dot-icon.tsx
components/foundations/featured-icon/featured-icon.tsx
styles/theme.css
utils/cx.ts
utils/is-react-component.ts
```

Check that they still match upstream:

```sh
git clone https://github.com/untitleduico/react /tmp/untitledui && git -C /tmp/untitledui checkout bff7606f3ce705f0ba5984f383f11f865024e1f7
for f in $(cd src && find components utils styles/theme.css -type f); do cmp "src/$f" "/tmp/untitledui/$f"; done
```

```text
MIT License

Copyright (c) 2025 Untitled UI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
