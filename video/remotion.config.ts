/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);
// On this machine (macOS 26, Apple silicon) the default headless shell never fires requestAnimationFrame,
// so every render stopped at "Waiting for root component to load". Chrome for Testing renders fine.
Config.setChromeMode("chrome-for-testing");
// Several render tabs at once garbled some frames here (one raster tile repeated across the frame);
// one tab at a time renders every frame correctly.
Config.setConcurrency(1);
