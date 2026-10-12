# Laganea

Laganea is a browser-based multiplayer drawing party game. This restoration is in progress.

## Local development

Requirements: Node.js 20 or newer.

```sh
npm install
npm run dev
```

Create a production build with `npm run build` and preview it with `npm run preview`.

## Firebase setup

The current lobby uses Firebase Authentication (anonymous sign-in) and Realtime Database. The existing web app configuration identifies the Firebase project, but it does not grant database access by itself.

Before testing multiplayer, confirm that **Anonymous** sign-in is enabled in Firebase Authentication and that Realtime Database rules require authentication and validate writes. Do not use public read/write rules for a deployed game.

The lobby and round engine are still being restored; the current playing screen is a placeholder and is not yet a complete multiplayer game.

## Deployment

The Vite app can be hosted on a static web host such as GitHub Pages or Firebase Hosting. If using GitHub Pages, configure Vite's `base` to match the repository path before deploying. Firebase Cloud Functions will be needed for trusted scoring, secret-word handling, and round transitions.
