// ============================================
// vitest.config.js
// ============================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['@tgrv/microgravity/setup'],
        deps: {
            inline: [/@titanpl\/core/]
        }
    }
});