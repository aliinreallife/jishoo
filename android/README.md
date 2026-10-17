# Jishoo Android TWA

This wrapper opens the live HTTPS Jishoo app through Android Browser Helper. It shares Chrome's web session, installation flow and permissions. No database credentials, Google OAuth secret or website code is bundled into Android. OAuth continues through the website's server callback.

The **Build Jishoo Android TWA** GitHub Actions workflow runs automatically when wrapper/manifest files change on `main`, or manually with **Run workflow**. It synchronizes the app name, icon and theme from the PWA manifest and uploads an installable debug APK, release APK and release AAB under Actions → workflow run → Artifacts. Without signing secrets, release outputs are unsigned; they are not store-ready. No Google Play publishing occurs automatically.

For signed release builds, configure these repository Actions secrets:

- `ANDROID_KEYSTORE_BASE64`: base64 of the private upload keystore.
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Keep the keystore and passwords out of Git. Retain a secure backup. Version codes/names increase with workflow run number. Local builds can use JDK 17, Android SDK platform 36/build-tools 36.0.0 and Gradle 8.13:

```sh
gradle -p android :app:assembleDebug :app:bundleRelease
```

For full-screen trusted mode, publish the SHA-256 certificate fingerprint of the **installed app's signing key** in Vercel's `ANDROID_SHA256_CERTIFICATES` setting (comma-separated for multiple legitimate signing certificates), then redeploy. With Google Play App Signing, use the Play app-signing certificate, not just the upload certificate. `ANDROID_PACKAGE_ID` defaults to `app.jishoo.twa` and must match the Gradle application ID. The website serves `/.well-known/assetlinks.json` from these settings. Without fingerprints it intentionally returns `[]`; the wrapper remains in Chrome's verified-browser fallback instead of claiming trust with a fabricated certificate.

Verify on a physical Android device: install the intended APK, confirm Chrome/TWA loads Jishoo, test Google return-to-app, map permission, Web Share, push and Android back navigation. A successful native build alone does not prove Digital Asset Links or device behavior.
