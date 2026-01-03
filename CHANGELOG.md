# Changelog

All notable changes to Yojimbo will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Instance management UX polish: status tooltips, skeleton loading, timestamps, copy button for working directory
- Global Tasks feature for task capture and dispatch to Claude Code instances
- Drag-to-reorder for tasks
- Task animations and visual feedback

### Changed
- Extracted `generateShortName` utility for reuse across components

## [0.1.0] - 2024-12-01

### Added
- **Core Features**
  - Multi-instance Claude Code orchestration
  - Real-time terminal with xterm.js
  - Plans panel for viewing/editing markdown files
  - Mockups panel for live HTML preview
  - Activity feed for tracking instance status changes
  - Work summary generation with SSE streaming

- **Mobile Support**
  - Mobile-responsive layout with gesture navigation
  - Mobile-optimized home, history, and activity pages
  - Speech-to-text input workaround for iOS

- **Remote Instances**
  - SSH-based remote instance support
  - Port forwarding management
  - Remote keychain unlock for macOS
  - Hooks-based status tracking for remote machines

- **UI/UX**
  - Nord/Ghostty-inspired dark theme
  - Keyboard shortcuts for common actions
  - Resizable panels
  - Instance pinning and reordering
  - Session resume capability

- **Developer Experience**
  - Comprehensive E2E test suite with Playwright
  - Unit tests for critical services
  - CI/CD pipeline with GitHub Actions
  - Knip for unused code detection

### Security
- Gitleaks integration for secret scanning
- Secure keychain storage for remote passwords

---

## Version History

- `0.1.0` - Initial release with core orchestration features
