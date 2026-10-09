import type { CapacitorConfig } from "@capacitor/cli";

/** The Android app (needed for Android Auto). See android/README.md. */
const config: CapacitorConfig = {
  appId: "com.highfi.player",
  appName: "HighFi Player",
  webDir: "dist",
  backgroundColor: "#0b0b0e",
};

export default config;
