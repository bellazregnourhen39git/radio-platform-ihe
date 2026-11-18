/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace']
      },
      colors: {
        app: 'var(--bg-app)',
        surface: 'var(--bg-surface)',
        'surface-subtle': 'var(--bg-surface-subtle)',
        border: 'var(--border-default)',
        accent: 'var(--accent)',
        'accent-hover': 'var(--accent-hover)',
        'accent-light': 'var(--accent-light)',
        // status backgrounds
        'status-demande': 'var(--status-demande-bg)',
        'status-planifie': 'var(--status-planifie-bg)',
        'status-realise': 'var(--status-realise-bg)',
        'status-termine': 'var(--status-termine-bg)',
        'status-annule': 'var(--status-annule-bg)',
        // priority backgrounds
        'priority-routine': 'var(--priority-routine-bg)',
        'priority-urgent': 'var(--priority-urgent-bg)',
        'priority-vital': 'var(--priority-vital-bg)'
      },
      borderRadius: {
        md: '8px',
        lg: '8px',
        xl: '16px',
        '2xl': '16px'
      }
    }
  },
  plugins: []
};