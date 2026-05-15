'use strict';

// Preset name normalization logic (mirrors server.js createPreset)
function normalizePresetName(raw) {
    return raw
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

describe('Preset name normalization', () => {
    test('camelCase becomes Title Case', () => {
        expect(normalizePresetName('chaosRun')).toBe('Chaos Run');
    });

    test('snake_case becomes Title Case', () => {
        expect(normalizePresetName('chill_session')).toBe('Chill Session');
    });

    test('kebab-case becomes Title Case', () => {
        expect(normalizePresetName('my-preset-name')).toBe('My Preset Name');
    });

    test('already spaced stays the same', () => {
        expect(normalizePresetName('Epic Chaos Run')).toBe('Epic Chaos Run');
    });

    test('mixed camelCase with underscores', () => {
        expect(normalizePresetName('chaosRun_v2')).toBe('Chaos Run V2');
    });

    test('trims extra whitespace', () => {
        expect(normalizePresetName('  chill  session  ')).toBe('Chill Session');
    });

    test('single word gets capitalized', () => {
        expect(normalizePresetName('chaos')).toBe('Chaos');
    });
});

// Minecraft command normalization (mirrors server.js normalizedGiftCmds logic)
function normalizeMcCommand(val) {
    if (Array.isArray(val))        return { command: val.join('\n'), cooldown: 0 };
    if (typeof val === 'string')   return { command: val, cooldown: 0 };
    if (val && typeof val === 'object') {
        if (typeof val.command === 'string') return val;
        if (Array.isArray(val.commands))     return { command: val.commands.join('\n'), cooldown: val.cooldown || 0 };
    }
    return val;
}

describe('Minecraft command normalization', () => {
    test('array of commands joins with newline', () => {
        const result = normalizeMcCommand(['/give {playername} minecraft:diamond 1', '/effect give {playername} minecraft:speed 10 1 true']);
        expect(result.command).toBe('/give {playername} minecraft:diamond 1\n/effect give {playername} minecraft:speed 10 1 true');
        expect(result.cooldown).toBe(0);
    });

    test('string command wraps correctly', () => {
        const result = normalizeMcCommand('/give {playername} minecraft:diamond 1');
        expect(result.command).toBe('/give {playername} minecraft:diamond 1');
        expect(result.cooldown).toBe(0);
    });

    test('already correct object passes through', () => {
        const input = { command: '/give {playername} minecraft:diamond 1', cooldown: 5 };
        const result = normalizeMcCommand(input);
        expect(result.command).toBe('/give {playername} minecraft:diamond 1');
        expect(result.cooldown).toBe(5);
    });

    test('legacy commands array format gets normalized', () => {
        const result = normalizeMcCommand({ commands: ['/give {playername} minecraft:diamond 1'], cooldown: 3 });
        expect(result.command).toBe('/give {playername} minecraft:diamond 1');
        expect(result.cooldown).toBe(3);
    });

    test('empty array produces empty command', () => {
        const result = normalizeMcCommand([]);
        expect(result.command).toBe('');
        expect(result.cooldown).toBe(0);
    });
});
