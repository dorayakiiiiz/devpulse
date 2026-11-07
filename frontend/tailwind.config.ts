import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
      },
      colors: {
        cream: '#f5efe3',
        coral: '#ff6b6b',
        'coral-soft': '#ffc5c2',
        mint: '#78d8c5',
        'retro-blue': '#79a7d3',
        'retro-lilac': '#b8a1d9',
        'retro-orange': '#e89b55',
        'retro-olive': '#a8ad65',
        'retro-night': '#171a24',
        'retro-panel': '#252a38',
        'retro-sage': '#d9ef9f',
      },
      boxShadow: {
        retro: '3px 3px 0 #18181b',
        'retro-md': '4px 4px 0 #18181b',
        'retro-lg': '10px 10px 0 #18181b',
        'retro-dark': '4px 4px 0 #090b10',
        'retro-focus': '4px 4px 0 #65d6c4',
      },
    },
  },
  plugins: [],
};

export default config;
