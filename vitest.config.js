// ============================================
// vitest.config.js
// ============================================

import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./vitest.setup.js'],
        // Importante: forzar a vitest a transformar el módulo
        deps: {
            inline: [/@titanpl\/core/]
        }
    }
});