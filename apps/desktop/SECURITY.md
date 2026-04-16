# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability within ViClip, please send an e-mail to vaibhav@viclip.tech. All security vulnerabilities will be promptly addressed.

### Privacy

ViClip is designed to sync your clipboard data.
- **Local Storage**: Sensitive tokens are encrypted using `electron-safe-storage`.
- **Cloud Storage**: Clipboard data is currently stored in Firebase Realtime Database. We are working on End-to-End Encryption (E2EE) to ensure that only you can read your data.
- **Opt-out**: You can disable syncing at any time from the application settings.

Please do not report security vulnerabilities through public GitHub issues.
