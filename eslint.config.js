const js = require('@eslint/js');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                require: 'readonly',
                module: 'readonly',
                exports: 'readonly',
                __dirname: 'readonly',
                __filename: 'readonly',
                process: 'readonly',
                console: 'readonly',
                setTimeout: 'readonly',
                setInterval: 'readonly',
                clearTimeout: 'readonly',
                clearInterval: 'readonly',
                Buffer: 'readonly',
                fetch: 'readonly',
                AbortSignal: 'readonly',
                URL: 'readonly',
                URLSearchParams: 'readonly',
                Promise: 'readonly',
                JSON: 'readonly',
                Math: 'readonly',
                Date: 'readonly',
                Error: 'readonly',
                Map: 'readonly',
                Set: 'readonly',
            }
        },
        rules: {
            'no-unused-vars': 'off',
            'no-undef': 'error',
            'no-empty': 'off'
        }
    },
    {
        ignores: ['node_modules/**', 'public/**']
    }
];
