'use strict';

const path = require('path');
const fs = require('fs');

describe('Project structure', () => {
    const root = path.join(__dirname, '..');
    const src  = (...p) => path.join(root, 'src', ...p);
    const view = (...p) => path.join(root, 'views', ...p);

    test('package.json exists and has required fields', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
        expect(pkg.name).toBeDefined();
        expect(pkg.scripts).toBeDefined();
        expect(pkg.scripts.start).toBeDefined();
        expect(pkg.scripts.test).toBeDefined();
    });

    test('core src files exist', () => {
        expect(fs.existsSync(src('server.js'))).toBe(true);
        expect(fs.existsSync(src('context.js'))).toBe(true);
    });

    test('route modules exist', () => {
        const routes = ['auth', 'account', 'admin', 'live', 'gifts', 'commands', 'presets', 'isaac', 'repo', 'goi', 'ai'];
        for (const r of routes) {
            expect(fs.existsSync(src('routes', `${r}.js`))).toBe(true);
        }
    });

    test('socket and event handlers exist', () => {
        expect(fs.existsSync(src('socket', 'index.js'))).toBe(true);
        expect(fs.existsSync(src('events', 'giftHandler.js'))).toBe(true);
    });

    test('tiktok bridges exist', () => {
        const bridges = ['connectionWrapper', 'minecraftBridge', 'isaacBridge', 'repoBridge', 'goiBridge'];
        for (const b of bridges) {
            expect(fs.existsSync(src('tiktok', `${b}.js`))).toBe(true);
        }
    });

    test('database manager exists', () => {
        expect(fs.existsSync(src('database', 'db_manager.js'))).toBe(true);
    });

    test('auth module exists', () => {
        expect(fs.existsSync(src('auth', 'auth.js'))).toBe(true);
    });

    test('limiter utility exists', () => {
        expect(fs.existsSync(src('utils', 'limiter.js'))).toBe(true);
    });

    test('views directory has required templates', () => {
        expect(fs.existsSync(view('index.ejs'))).toBe(true);
        expect(fs.existsSync(view('app.ejs'))).toBe(true);
        expect(fs.existsSync(view('admin.ejs'))).toBe(true);
        expect(fs.existsSync(view('account.ejs'))).toBe(true);
    });

    test('admin partials exist', () => {
        const partials = ['styles', 'tab-gifts', 'tab-accounts', 'tab-donors', 'tab-donations', 'tab-streamers', 'tab-ai-gifts', 'tab-gamedata', 'delete-modal'];
        for (const p of partials) {
            expect(fs.existsSync(view('partials', 'admin', `${p}.ejs`))).toBe(true);
        }
    });

    test('public css files exist', () => {
        expect(fs.existsSync(path.join(root, 'public', 'css', 'app.css'))).toBe(true);
        expect(fs.existsSync(path.join(root, 'public', 'css', 'homepage.css'))).toBe(true);
    });

    test('.env.example exists', () => {
        expect(fs.existsSync(path.join(root, '.env.example'))).toBe(true);
    });
});
