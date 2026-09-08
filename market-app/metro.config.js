const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// react-native-webview's package.json has a "react-native" field pointing to
// src/index.ts, but Metro can't resolve the platform-specific WebView.tsx
// from the src/ folder during JS bundling.
// Force Metro to use the pre-compiled index.js (which imports from lib/).
config.resolver = config.resolver || {};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react-native-webview') {
    return {
      filePath: path.resolve(
        __dirname,
        'node_modules/react-native-webview/index.js'
      ),
      type: 'sourceFile',
    };
  }
  // Fall through to default resolver for everything else
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css' });
