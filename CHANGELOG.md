# Change Log

All notable changes to the "har-auto-analyzer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.15]

- Open HAR entries that omit `response.content.mimeType` instead of failing during analysis.
- Avoid logging complete response bodies when a response marked as JSON contains invalid JSON.

## [0.0.14]

- Open HAR files through a read-only custom editor by default.
- Load HAR content directly in the WebView without VS Code's text-document size limit.

## [0.0.13]

- Configure the fork as `yeceen.har-auto-analyzer`.
- Update packaging and GitHub Release-based Marketplace publishing.

## [0.0.12]

- Configure the fork as `yeceen.har-analyzer`.
- Update packaging and GitHub Release-based Marketplace publishing.
