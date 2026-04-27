import js from '@eslint/js';

export default [
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
                clearInterval: 'readonly',
                Buffer: 'readonly',
            }
        },
        rules: {
            'no-unused-vars': 'warn',
            'no-undef': 'error',
        }
    },
    {
        ignores: ['node_modules/**', 'public/**']
    }
];
