/**
 * The app's version and build date. They are filled in when the app is built
 * (see vite.config.ts). They are plain constants, not properties of `window`,
 * and are missing when the code runs outside a build, e.g. in tests.
 */
export const APP_VERSION: string = typeof __APP_VERSION__ !== "undefined" ? __APP_VERSION__ : "dev";

export const BUILD_DATE: Date | null =
  typeof __BUILD_DATE__ !== "undefined" && !Number.isNaN(new Date(__BUILD_DATE__).getTime())
    ? new Date(__BUILD_DATE__)
    : null;
