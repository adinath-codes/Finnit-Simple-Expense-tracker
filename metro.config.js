const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// The supplied SF Pro files use uppercase extensions; Metro matches case exactly.
config.resolver.assetExts.push("OTF");

module.exports = config;
