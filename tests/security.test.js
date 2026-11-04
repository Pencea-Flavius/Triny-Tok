'use strict';

const { isTrusted, publicConfig, mergeMinecraft, applyConfigUpdate } = require('../src/auth/access');

const req = (over = {}) => ({
    socket: { remoteAddress: '127.0.0.1' },
    headers: { host: 'localhost:8081' },
    ...over,
});

describe('isTrusted', () => {
    test('the same machine is trusted', () => {
        expect(isTrusted(req())).toBe(true);
        expect(isTrusted(req({ headers: { host: 'localhost:8081', origin: 'http://localhost:8081' } }))).toBe(true);
    });
    test('another machine is not, unless it is an admin', () => {
        const remote = { socket: { remoteAddress: '192.168.1.20' }, headers: { host: '192.168.1.5:8081' } };
        expect(isTrusted(req(remote))).toBe(false);
        expect(isTrusted(req({ ...remote, session: { user: { isAdmin: false } } }))).toBe(false);
        expect(isTrusted(req({ ...remote, session: { user: { isAdmin: true } } }))).toBe(true);
    });
    test('another site in the browser is refused, even from the same machine', () => {
        expect(isTrusted(req({ headers: { host: 'localhost:8081', origin: 'https://evil.example' } }))).toBe(false);
    });
    test('a rebinding hostname or a proxy does not count as local', () => {
        expect(isTrusted(req({ headers: { host: 'evil.example:8081' } }))).toBe(false);
        expect(isTrusted(req({ headers: { host: 'localhost:8081', 'x-forwarded-for': '8.8.8.8' } }))).toBe(false);
    });
});

describe('RCON password', () => {
    const config = { minecraft: { host: 'h', password: 'secret' }, targetPlayers: [] };
    test('is never in the public config', () => {
        const pub = publicConfig(config);
        expect(JSON.stringify(pub)).not.toContain('secret');
        expect(pub.minecraft.hasPassword).toBe(true);
    });
    test('an empty password keeps the saved one, a new one replaces it', () => {
        expect(mergeMinecraft(config.minecraft, { host: 'x', password: '' })).toEqual({ host: 'x', password: 'secret' });
        expect(mergeMinecraft(config.minecraft, { password: 'new' }).password).toBe('new');
    });
});

describe('applyConfigUpdate', () => {
    test('writes known settings and ignores everything else', () => {
        const config = { targetPlayers: [], minecraft: { password: 'secret' } };
        applyConfigUpdate(config, JSON.parse('{"targetPlayers":["a"],"nope":1,"__proto__":{"x":1},"minecraft":{"host":"h"}}'));
        expect(config.targetPlayers).toEqual(['a']);
        expect(config.nope).toBeUndefined();
        expect({}.x).toBeUndefined();
        expect(config.minecraft).toEqual({ host: 'h', password: 'secret' });
    });
});
