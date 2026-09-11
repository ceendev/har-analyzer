# Publishing Har Editor

The extension identity is `yeceen.har-editor`:

- Marketplace publisher ID: `yeceen`.
- Extension name: `har-editor`.
- Source repository: <https://github.com/ceendev/har-editor>.

This identity and its Marketplace presentation are independent from the upstream
project. The README retains the required license attribution and states the
non-affiliation prominently.

## One-time setup

Create a GitHub environment named `marketplace` under **Settings > Environments**.
If deployment restrictions are configured, allow the version tags used for
releases.

Har Editor uses Microsoft Entra ID with GitHub OIDC for long-term publishing; no
stored PAT is required.

1. Configure a user-assigned managed identity in Azure and record its client ID
   and tenant ID.
2. Configure its GitHub federated credential with:
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:ceendev@325867239/har-editor@1359690326:environment:marketplace`
   - Audience: `api://AzureADTokenExchange`
3. Add the managed identity to the Azure DevOps organization connected to the
   Marketplace publisher, with **Stakeholder** access.
4. Add its Azure DevOps profile ID to publisher `yeceen` as a **Contributor**.
5. Set GitHub Actions variables `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` at the
   repository or `marketplace` environment level.

The numeric organization and repository IDs in the immutable OIDC subject stay
stable across a GitHub repository rename, but the repository name embedded in the
subject changes. Update the Azure federated credential to the exact subject above
after renaming the repository.

References: [Marketplace authentication](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace)
and [Azure Login with OIDC](https://github.com/Azure/login#login-with-openid-connect-oidc-recommended).

## Release a version

1. Update the version in `package.json` and synchronize `package-lock.json`.
2. Run `npm ci`, `npm run check`, and `npm run package`.
3. Install and verify `har-editor.vsix` locally.
4. Commit and push to `ceen` or `main`.
5. Create a regular GitHub Release whose tag is exactly `v` plus the package
   version, such as `v0.1.0`.

The release or tag triggers the Marketplace publish job. Normal pushes and pull
requests build only. A published version cannot be reused; increment the version
for every release.

To retry a release explicitly:

```bash
gh workflow run actions.yml --repo ceendev/har-editor --ref v0.1.0 \
  -f publish=true -f release_tag=v0.1.0
```

The Marketplace URL will be
<https://marketplace.visualstudio.com/items?itemName=yeceen.har-editor> after the
first approved publication.

Because the publisher was previously restricted by Marketplace enforcement,
contact `VSMarketplace@microsoft.com` and obtain confirmation that the publisher
is unlocked before attempting the first Har Editor release. A new extension ID
must not be used to bypass an unresolved Marketplace restriction.
