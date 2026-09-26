# EAS Update

Finn is linked to `@adinath-codes/Finn` and uses Expo SDK 57's `expo-updates`
runtime. Preview and production builds are isolated on matching EAS channels.

## First builds

An installed binary must contain the updates URL, runtime version, and channel
before it can receive an OTA update:

```bash
npx eas-cli build --profile preview --platform android
npx eas-cli build --profile production --platform android
```

Use `--platform ios` for the iOS builds. Test updates on preview before
publishing them to production.

## Publish JavaScript and asset updates

SDK 55 and later require an EAS environment when publishing:

```bash
npx eas-cli update --channel preview --message "Describe the change" --environment preview
npx eas-cli update --channel production --message "Describe the change" --environment production
```

The app checks on launch, downloads a compatible update, and applies it on the
next restart. A force close and second open is the clearest release-build test.

## Native compatibility rule

The runtime policy is `appVersion`. Bump `expo.version` before distributing any
binary with native dependency or native configuration changes. OTA updates may
change JavaScript, TypeScript, and bundled assets, but must not introduce native
modules absent from the installed binary.

Never publish directly to `production` merely to test an update. Roll out on the
`preview` channel first and use the EAS dashboard to roll back a bad update.
