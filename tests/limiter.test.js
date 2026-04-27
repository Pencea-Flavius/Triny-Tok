'use strict';

const { clientBlocked } = require('../src/utils/limiter');

function makeSocket(ip, forwarded) {
    return {
        handshake: {
            address: ip,
            headers: forwarded ? { 'x-forwarded-for': forwarded } : {}
        }
    };
}

function makeIo(sockets = []) {
    return {
        of: () => ({
            sockets: { forEach: (fn) => sockets.forEach(fn) }
        })
    };
}

describe('clientBlocked', () => {
    test('returns false for a new external IP', () => {
        const socket = makeSocket('1.2.3.4');
        const io = makeIo([socket]);
        expect(clientBlocked(io, socket)).toBe(false);
    });

    test('returns false when IP count is invalid (non-string)', () => {
        const socket = { handshake: { address: 12345, headers: {} } };
        const io = makeIo([socket]);
        expect(clientBlocked(io, socket)).toBe(false);
    });

    test('blocks when too many connections from same IP', () => {
        const ip = '5.5.5.5';
        const sockets = Array.from({ length: 12 }, () => makeSocket(ip));
        const io = makeIo(sockets);
        expect(clientBlocked(io, makeSocket(ip))).toBe(true);
    });

    test('resolves localhost to x-forwarded-for header', () => {
        const socket = makeSocket('::1', '9.9.9.9');
        const io = makeIo([socket]);
        // Should not block (first request), just return false
        expect(clientBlocked(io, socket)).toBe(false);
    });
});
