// ============================================
// vitest.setup.js - Real @titanpl/core via @tgrv/microgravity
// ============================================
// No mocks needed - @tgrv/microgravity provides the real titanpl runtime

import { beforeEach } from 'vitest';
import { ls } from '@titanpl/core';

// ============================================
// Clear storage before each test
// ============================================

beforeEach(() => {
    ls.clear();
});
