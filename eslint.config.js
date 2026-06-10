// ESLint flat config — 挙動非破壊の静的衛生チェックのみ（整形は行わない）
export default [
  {
    files: ['src/**/*.js', 'tools/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly',
        location: 'readonly', performance: 'readonly', requestAnimationFrame: 'readonly',
        addEventListener: 'readonly', innerWidth: 'readonly', innerHeight: 'readonly',
        devicePixelRatio: 'readonly', matchMedia: 'readonly', setTimeout: 'readonly',
        setInterval: 'readonly', clearTimeout: 'readonly', clearInterval: 'readonly',
        console: 'readonly', AudioContext: 'readonly', KeyboardEvent: 'readonly',
        ImageData: 'readonly', Image: 'readonly', Buffer: 'readonly', process: 'readonly', fetch: 'readonly',
        URL: 'readonly', URLSearchParams: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-constant-condition': ['error', { checkLoops: false }],
    },
  },
];
