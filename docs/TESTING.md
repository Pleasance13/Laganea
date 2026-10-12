# Testing Laganea

## Fastest local test

1. Install [Node.js 20 or newer](https://nodejs.org/).
2. Download or clone the `restore/multiplayer-foundation` branch.
3. In the project folder, run:

   ```sh
   npm install
   npm run dev -- --host 0.0.0.0
   ```

4. Open the local URL Vite prints (normally `http://localhost:5173`).

To test the lobby with two players on one computer, open the URL in two separate browser windows or profiles. A second device on the same Wi-Fi can use your computer's LAN IP and Vite's printed network URL.

## Firebase prerequisites

The lobby depends on the configured Firebase project. Confirm:
- Anonymous sign-in is enabled in Firebase Authentication.
- Realtime Database is provisioned and its rules allow the intended authenticated room operations.
- The domain used for testing is listed in Firebase Authentication's authorized domains if required.

Do not use public read/write database rules. If Firebase initialization or room operations fail, read the status message in the lobby and check the browser developer console.

## What is testable right now?

The current milestone is the React/Vite conversion and lobby foundation: create/join a room, see room membership update, and persist host settings. The drawing game itself is not implemented yet; the playing screen remains a placeholder. Full end-to-end drawing/guessing/scoring tests will be added with the playable vertical slice.

## Production build check

```sh
npm run build
npm run preview
```

GitHub Actions also runs the production build for pushes to the restoration branch and pull requests targeting `main`.
