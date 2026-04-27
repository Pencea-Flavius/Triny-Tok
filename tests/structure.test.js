'use strict';

const path = require('path');
const fs = require('fs');

describe('Project structure', () => {
    const root = path.join(__dirname, '..');

    test('package.json exists and has required fields', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        expect(pkg.name).toBeDefined();
        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts.start).toBeDefined();
        expect(pkg.scripts.test).toBeDefined();
    });

    test('server entry point exists', () => {
        expect(fs.existsSync(path.join(root, 'src', 'server.js'))).toBe(true);
    });

    test('database manager exists', () => {
        expect(fs.existsSync(path.join(root, 'src', 'database', 'db_manager.js'))).toBe(true);
    });

    test('limiter utility exists', () => {
        expect(fs.existsSync(path.join(root, 'src', 'utils', 'limiter.js'))).toBe(true);
    });

    test('views directory has required templates', () => {
        expect(fs.existsSync(path.join(root, 'views', 'index.ejs'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'views', 'app.ejs'))).toBe(true);
    });

    test('public css files exist', () => {
        expect(fs.existsSync(path.join(root, 'public', 'css', 'app.css'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'public', 'css', 'homepage.css'))).toBe(true);
    });
});
