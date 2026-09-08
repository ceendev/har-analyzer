A first-class HAR file viewer for VS Code. Run the `Analyze` command while viewing a har file to open the analyzer.

This fork is maintained by [CeenMobi](https://github.com/ceendev), based on
[Matt Foulks' original HAR Analyzer](https://github.com/mfoulks3200/har-analyzer).
Its Marketplace extension ID is `yeceen.har-auto-analyzer`. It is a separate extension
from the original, so existing users need to install this fork explicitly after
its first Marketplace publication. The project retains its GPL license.

![Demo GIF](demo.gif)

_Note: VS Code disallows loading files over 5MB via the API. Unfortunately that means this extension will only work with files smaller than that. There is a [GitHub issue](https://github.com/microsoft/vscode/issues/31078) open to allow workarounds, but it is not yet implemented._

## Development and publishing

Use Node.js 22 or later, then run `npm ci`, `npm run check`, and `npm run package`
to create `har-auto-analyzer.vsix` locally. Install that file using VS Code's
**Extensions: Install from VSIX...** command.

GitHub Actions builds pushes and pull requests targeting `ceen` or `main`.
Publishing a non-prerelease GitHub Release triggers Marketplace publication
after the build succeeds. See [Publishing](PUBLISHING.md) for authentication
setup and release instructions.
