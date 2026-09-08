A first-class HAR file viewer for VS Code. Open a `.har` file to launch the analyzer automatically.

This fork is maintained by [CeenMobi](https://github.com/ceendev), based on
[Matt Foulks' original HAR Analyzer](https://github.com/mfoulks3200/har-analyzer).
Its Marketplace extension ID is `yeceen.har-auto-analyzer`. It is a separate extension
from the original, so existing users need to install this fork explicitly after
its first Marketplace publication. The project retains its GPL license.

![Demo GIF](demo.gif)

The analyzer reads HAR files directly instead of loading them through VS Code's
text-document API, so it is not subject to the old 5MB document-size limit. The
practical limit is the memory available to parse and display the HAR JSON.

## Development and publishing

Use Node.js 22 or later, then run `npm ci`, `npm run check`, and `npm run package`
to create `har-auto-analyzer.vsix` locally. Install that file using VS Code's
**Extensions: Install from VSIX...** command.

GitHub Actions builds pushes and pull requests targeting `ceen` or `main`.
Publishing a non-prerelease GitHub Release triggers Marketplace publication
after the build succeeds. See [Publishing](PUBLISHING.md) for authentication
setup and release instructions.
