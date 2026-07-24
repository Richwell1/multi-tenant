/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Kinetic Enterprise — finalized tokens
        background: '#F8F9FF',
        surface: {
          DEFAULT: '#FFFFFF',
          subtle: '#F8FAFC',
        },
        content: {
          DEFAULT: '#0B1C30',
          variant: '#464555',
        },
        border: '#E2E8F0',
        // Platform Super Admin (Indigo)
        platform: {
          DEFAULT: '#3525CD',
          accent: '#312E81',
          container: '#4F46E5',
        },
        // Company Workspace (Emerald)
        company: {
          DEFAULT: '#005338',
          hover: '#006E4B',
        },
        // Semantic status
        status: {
          healthy: '#10B981',
          degraded: '#F59E0B',
          offline: '#EF4444',
          suspended: '#6366F1',
        },
        danger: '#BA1A1A',
      },
      borderRadius: {
        DEFAULT: '8px',
        md: '8px',
        lg: '12px',
        pill: '9999px',
      },
      spacing: {
        sidebar: '260px',
        'sidebar-collapsed': '64px',
      },
      maxWidth: {
        container: '1440px',
      },
      fontSize: {
        'label-caps': ['11px', { lineHeight: '16px', letterSpacing: '0.1em', fontWeight: '700' }],
        'label-bold': ['12px', { lineHeight: '16px', letterSpacing: '0.05em', fontWeight: '600' }],
      },
    },
  },
  plugins: [],
};
