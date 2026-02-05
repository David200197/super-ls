import { describe, it, expect } from 'vitest';
import { SuperLocalStorage } from "../index.js"

describe('SuperLocalStorage', () => {
    it('should set and get an item', () => {
        const storage = new SuperLocalStorage();
        storage.set('key', 'value');
        expect(storage.get('key')).toBe('value');
    })
})