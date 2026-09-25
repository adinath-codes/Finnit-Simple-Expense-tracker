const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname, {
  annotateReactComponents: true,
});

// The supplied SF Pro files use uppercase extensions; Metro matches case exactly.
config.resolver.assetExts.push("OTF");

module.exports = config;
