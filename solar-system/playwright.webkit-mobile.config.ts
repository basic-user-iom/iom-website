import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Repeatable mobile WebKit emulation, not a claim of testing on an iOS device.
export default defineConfig({
  ...base,
  projects: [{
    name: 'webkit',
    use: { browserName: 'webkit', isMobile: true, deviceScaleFactor: 3, hasTouch: true },
  }],
});
