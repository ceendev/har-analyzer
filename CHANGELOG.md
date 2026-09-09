# Change Log

All notable changes to the "har-auto-analyzer" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [0.0.20]

- Remove collapsible sections from request and response inspector tabs while preserving the main panel controls.

## [0.0.19]

- Add request sequence, application, full URL, duration, and status columns to the request list.
- Rework the Inspector into collapsible request and response panels with Reqable-style tabs and raw Text/Hex views.

## [0.0.18]

- Add individual quick filters for standard HTTP methods and replace the placeholder method label.

## [0.0.17]

- Move the domain, application, and search controls above the quick filters.
- Fix the search box border so it renders as one continuous control.

## [0.0.16]

- Add a Reqable-style filter toolbar with domain and application selectors.
- Show the Inspector on demand with a close button and draggable split pane.

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
