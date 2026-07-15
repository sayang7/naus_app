import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      bg:     'var(--color-bg)',
      panel:  'var(--color-panel)',
      border: 'var(--color-border)',
      text:   'var(--color-text)',
      muted:  'var(--color-muted)',
      gold:   'var(--color-gold)',
      red:    'var(--color-red)',
    },
    fontFamily: {
      sans:  ['Inter', 'system-ui', 'sans-serif'],
      mono:  ['JetBrains Mono', 'monospace'],
    },
    fontSize: {
      10: ['10px', { lineHeight: '16px' }],
      11: ['11px', { lineHeight: '16px' }],
      13: ['13px', { lineHeight: '20px' }],
      14: ['14px', { lineHeight: '22px' }],
      16: ['16px', { lineHeight: '26px' }],
      20: ['20px', { lineHeight: '28px' }],
      32: ['32px', { lineHeight: '38px' }],
    },
    spacing: {
      0: '0',
      1: '8px',
      2: '16px',
      3: '24px',
      4: '32px',
      5: '40px',
      6: '48px',
      7: '56px',
      8: '64px',
      10: '80px',
      12: '96px',
    },
    borderRadius: {
      none: '0',
      sm: '8px',
      DEFAULT: '16px',
      full: '9999px',
    },
    extend: {},
  },
  plugins: [],
} satisfies Config;
