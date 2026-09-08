# Publishing HAR Auto Analyzer

The extension identity is `yeceen.har-auto-analyzer`:

- Marketplace publisher ID: `yeceen`.
- Extension name: `har-auto-analyzer`.
- Source repository: <https://github.com/ceendev/har-auto-analyzer>.

The old publishers are unrelated to this extension identity. Removing them is
not required to publish under `yeceen`.

## One-time setup

Enable GitHub Actions for the fork, and create a GitHub environment named
`marketplace` under **Settings > Environments**. If deployment restrictions are
configured, allow the version tags used for releases, such as `v0.0.13`.

Configure one of the following authentication methods. Merely signing in to the
Marketplace in a browser does not authenticate GitHub Actions.

### Microsoft Entra ID with GitHub OIDC

This is the preferred long-term method. It requires an Azure/Entra tenant and
permission to configure an identity in that tenant. The user-assigned managed
identity setup below also requires an Azure subscription.

1. Create a user-assigned managed identity in Azure and record its client ID,
   tenant ID, and Azure resource ID.
2. Add a federated credential to that identity with these exact values:
   - Issuer: `https://token.actions.githubusercontent.com`
   - Subject: `repo:ceendev@325867239/har-auto-analyzer@1359690326:environment:marketplace`
   - Audience: `api://AzureADTokenExchange`
   Enable immutable OIDC subjects for this repository and include the `repo`
   and `context` claims. The numeric organization and repository IDs remain
   stable if either is renamed.
3. Add the managed identity to the Azure DevOps organization that owns the
   Marketplace publisher. Open **Organization settings > Users**, add
   `yeceen-har-auto-analyzer-publisher` with **Stakeholder** access, and leave it out
   of all projects. Azure DevOps must create a profile for the service
   principal before Marketplace can recognize it.
4. For this setup, the managed identity's Azure DevOps profile ID is
   `d1293f52-f554-6e55-bff9-72b38df5cfca`. In Marketplace, open publisher
   `yeceen` > **Members**, enter that profile ID as **User Id**, and grant
   **Contributor** access. Do not enter the Azure ARM resource ID or managed
   identity client ID. If the identity is recreated, resolve its new profile ID
   with the Azure DevOps Profiles API before adding it to Marketplace.
5. Add GitHub Actions variables `AZURE_CLIENT_ID` and `AZURE_TENANT_ID` at the
   repository or `marketplace` environment level.

The publish job requests a GitHub OIDC token, signs in through `azure/login`, and
uses `vsce publish --azure-credential`. No stored PAT is needed. Setting
`AZURE_CLIENT_ID` selects this method; failures do not fall back to a PAT.

References: [Marketplace authentication](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#secure-automated-publishing-to-visual-studio-marketplace)
and [Azure Login with OIDC](https://github.com/Azure/login#login-with-openid-connect-oidc-recommended).

### PAT transition option

As of September 2026, the official publishing documentation still supports Azure
DevOps global PATs, but announces their retirement on **December 1, 2026**.
Use this option only as a transition to Entra ID authentication.

If you do not already have access to an Azure DevOps organization, the current
[organization creation requirements](https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/create-organization?view=azure-devops)
include an active Azure subscription. Creating a Marketplace publisher alone
does not satisfy this prerequisite. Existing Azure DevOps organizations and
their free tier limits are not affected by this new-organization requirement.

1. In Azure DevOps, create a PAT using an account authorized to publish under
   `yeceen`. Select **All accessible organizations** and **Marketplace > Manage**.
2. In GitHub **Settings > Secrets and variables > Actions**, add a repository
   secret named `VSCE_PAT`. An environment secret in `marketplace` also works.
3. Leave `AZURE_CLIENT_ID` unset so the workflow selects PAT authentication.

Do not commit credentials. A GitHub token is not a Marketplace PAT, and secrets
from the upstream repository are not inherited by a fork.

## Release a version

1. Update `version` in `package.json` and synchronize `package-lock.json` with
   `npm install --package-lock-only`. Add release notes to `CHANGELOG.md`.
2. Run `npm ci`, `npm run check`, and `npm run package`. Test the generated
   `har-auto-analyzer.vsix` in VS Code before publishing. The automated check covers
   JavaScript syntax and packaging, not full extension behavior.
3. Commit and push the changes, including this workflow and the lockfile, to
   `ceen` or `main`. Ensure the build succeeds.
4. Create a GitHub Release whose tag is exactly `v` plus the package version,
   initially `v0.0.13`, targeting the commit containing the changes. Publish it
   as a regular release, not a draft or prerelease.
5. Check **Actions > Build and Publish**. The build validates the identity and
   tag, packages the extension, and uploads a VSIX artifact. The publish job
   downloads and publishes that exact artifact to Marketplace.

If a GitHub Release is already published but no `release` workflow run appears,
retry explicitly from the release tag (the input is required to prevent an
accidental publish):

```bash
gh workflow run actions.yml --repo ceendev/har-auto-analyzer --ref v0.0.13 \
  -f publish=true -f release_tag=v0.0.13
```

Normal pushes and pull requests build only. GitHub prereleases also build but
do not publish to Marketplace. An already published version cannot be reused;
increment the version for the next release. Do not use inherited upstream tags
that point to commits with the old publisher.

The first successful publication creates the new listing at
<https://marketplace.visualstudio.com/items?itemName=yeceen.har-auto-analyzer>.

## Name conflict

Marketplace extension names are globally unique. The old `har-analyzer` name is
owned by `MattFoulks.har-analyzer`, so this fork uses the available
`yeceen.har-auto-analyzer` name instead.
