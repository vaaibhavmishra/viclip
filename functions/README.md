# ViClip Firebase Cloud Functions

This package provides serverless backend functions for ViClip to send push notifications to devices when new clipboard clips are added.

## Prerequisites

1. Install the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Log in to Firebase:
   ```bash
   firebase login
   ```
3. Set your active Firebase project:
   ```bash
   firebase use viclip-4c869-test
   ```

## Deploying

From the repository root or inside the `functions` directory, run:
```bash
firebase deploy --only functions
```

Whenever any client (Desktop, Web, or another Phone) writes a new clip to Firebase Realtime Database, this function triggers and delivers an instant FCM push notification to all target mobile devices.
