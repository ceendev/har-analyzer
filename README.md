# Har Editor

**A visual HAR workspace for VS Code with automatic file opening, fast request filtering, resizable tables, and split request/response inspection.**

> **Independent project:** Har Editor is independently maintained by
> [ceendev](https://github.com/ceendev) and published by **yeceen**. It is based
> on the GPL-licensed [HAR Analyzer by Matt Foulks](https://github.com/mfoulks3200/har-analyzer)
> and is **not affiliated with, endorsed by, or published by Matt Foulks**.

<img src="resources/har-editor-icon.png" alt="Har Editor icon" width="128" height="128">

Open a `.har` file and Har Editor takes over automatically. The file opens as a
dedicated read-only network workspace instead of raw JSON, including large HAR
files that exceed VS Code's normal text-document size limit.

## Highlights

- Open `.har` files directly with a first-class VS Code custom editor.
- Filter by domain, application, protocol, method, content type, status, or text.
- Inspect complete request URLs in a resizable request table.
- Keep the selected request URL in the top Inspector bar and drag horizontally
  to reveal long paths and query strings; hover the bar to reveal its copy
  button, with pointer-local success feedback.
- Open request and response details in a draggable split inspector.
- Resize columns throughout the request list and inspector tables.
- Collapse either the request or response inspector while keeping one visible.
- Parse HAR data directly in the WebView, with available memory as the practical
  file-size limit.

## Development

Use Node.js 22 or later:

```bash
npm ci
npm run check
npm run package
```

The package command creates `har-editor.vsix`. Install it with VS Code's
**Extensions: Install from VSIX...** command.

GitHub Actions builds pushes and pull requests targeting `ceen` or `main`.
Publishing a non-prerelease GitHub Release triggers Marketplace publication after
the build succeeds. See [Publishing](PUBLISHING.md) for the release setup.

## License and attribution

Har Editor is released under GPL-3.0 and retains the original project's license
and copyright notices. The current extension has a new identity, original icon,
automatic custom-editor integration, large-file loading, a redesigned filtering
toolbar, a split request/response inspector, and resizable tables.

The Har Editor icon was created specifically for this project without using the
upstream artwork as an input or reference. See
[Artwork provenance](ARTWORK-PROVENANCE.md).
