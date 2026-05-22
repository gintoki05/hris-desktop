# App Updates

HRIS Payroll Klinik uses the Tauri v2 updater with a static manifest hosted on Cloudflare Pages.

## Endpoint

The app checks this manifest:

```text
https://hris-desktop-updates.pages.dev/latest.json
```

Change `src-tauri/tauri.conf.json` if the production Cloudflare Pages domain is different.

## Signing Key

The updater public key is stored in `src-tauri/tauri.conf.json`.

The local private key was generated at:

```text
.tauri/keys/hris-updater.key
```

This folder is ignored by Git. Back up the private key somewhere secure. If the private key is lost, installed apps cannot receive future signed updates from a new key.

For production releases, prefer generating a password-protected key and updating the public key before distributing the first updater-enabled installer.

## Release Checklist

1. Update the app version in `package.json`, `package-lock.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Build the Tauri app with updater signing enabled.
3. Upload the generated updater artifact and its signature content to Cloudflare Pages.
4. Publish `/updates/latest.json`.
5. Open the installed app and use `Pengaturan > Update Aplikasi > Cek Update`.

## Local Prepare Script

After the version is updated and the signed Tauri bundle has been built locally, prepare the static updater folder:

```powershell
.\scripts\prepare-updater-release.ps1
```

This reads the version from `src-tauri/tauri.conf.json`, expects the matching MSI or NSIS installer and `.sig` in `src-tauri\target\release\bundle`, then writes:

```text
release-updates\<date>\updates\
release-updates\_deploy_desktop\
```

To prepare and deploy the update-only folder to Cloudflare Pages:

```powershell
.\scripts\prepare-updater-release.ps1 -Deploy
```

The default Cloudflare Pages project is `hris-desktop-updates`, matching the updater endpoint in `src-tauri/tauri.conf.json`.

## Static Manifest Shape

Use the signature content itself, not a URL to the `.sig` file.

```json
{
  "version": "0.2.0",
  "pub_date": "2026-05-17T00:00:00Z",
  "url": "https://hris-desktop-updates.pages.dev/windows-x86_64/hris_0.2.0_x64-setup.nsis.zip",
  "signature": "PASTE_SIGNATURE_FILE_CONTENT_HERE",
  "notes": "Ringkasan perubahan untuk admin payroll."
}
```

For a no-update response, a dynamic update server may return HTTP 204. With this static Cloudflare Pages setup, keep `latest.json` pointing to the latest production version and let Tauri compare it to the installed version.
