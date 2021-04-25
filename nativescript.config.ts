import { NativeScriptConfig } from '@nativescript/core';

export default {
  id: 'at.trialinfo.TrialInfo',
  appPath: 'app',
  appResourcesPath: 'App_Resources',
  webpackConfigPath: 'webpack.config.js',
  android: {
    // discardUncaughtJsExceptions: true,
    v8Flags: '--nolazy --expose_gc',
    "markingMode": "none",
    "suppressCallJSMethodExceptions": false
  }
} as NativeScriptConfig;
