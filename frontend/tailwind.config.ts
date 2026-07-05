import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0F172A',
        surface: '#1E293B',
        border: '#334155',
        primary: '#6366F1',
        secondary: '#3B82F6',
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        text: '#F8FAFC',
        'text-secondary': '#94A3B8',
      },
    },
  },
  plugins: [],
};

export default config;
