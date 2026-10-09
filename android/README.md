# HighFi Player for Android (and Android Auto)

Android Auto only lists native Android apps that provide a media service, so
the web app can't appear there on its own. This folder wraps it in a
[Capacitor](https://capacitorjs.com) app that adds one.

## How it works

- The web app runs inside the Android app exactly as in the browser, and does
  the playing (so the equalizer, stereo width and the rest still apply).
- `car/PlaybackService` is a Media3 `MediaLibraryService`. Android Auto
  connects to it to browse the library (Songs, Albums, Artists, Playlists,
  plus Favorites and Recently added under Playlists) and to search.
- `car/BridgePlayer` plays nothing itself: it mirrors what the web app is
  playing for the car screen, the phone's media notification and the lock
  screen, and forwards their buttons (play, pause, next, previous, seek,
  shuffle, repeat, picking a song, voice search) back to the web app.
- `car/CarMediaPlugin` is the Capacitor plugin between the two;
  `src/services/carMedia.ts` is its web side.

The phone app has to be running (open, or in the background) for the car to
start playback. If it was closed, the car can still browse the last library it
was sent, and shows "Open HighFi on your phone to start playback."

Songs are imported with the file picker; linking a folder is a browser-only
feature (Android's WebView has no folder picker).

## Get the APK

Every push that touches the app builds a debug APK in GitHub Actions
("Android app" workflow, artifact `highfi-player-debug-apk`). Or build it
locally with the Android SDK installed:

```sh
npm ci
npm run android            # build the web app and copy it into android/
cd android && ./gradlew assembleDebug
# -> android/app/build/outputs/apk/debug/app-debug.apk
```

## See it in the car

Android Auto hides apps that weren't installed from the Play Store until you
allow them:

1. Install the APK on the phone and open HighFi once; import some music.
2. Phone Settings → Apps → Android Auto → Additional settings in the app (or
   open Android Auto's settings), scroll to **Version** and tap it about ten
   times to unlock developer settings.
3. In the ⋮ menu choose **Developer settings** and turn on
   **Unknown sources**.
4. Under **Customize launcher**, make sure HighFi Player is ticked.
5. Connect to the car (or the Desktop Head Unit emulator). HighFi Player is in
   the app launcher.

Publishing on Google Play (internal testing is enough) removes steps 2–3.
