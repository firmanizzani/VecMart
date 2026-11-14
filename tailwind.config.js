/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			fontFamily: { sans: ['Public Sans', 'Segoe UI', 'sans-serif'] },
			colors: {
				sky: {
					50: '#edf5ff', 100: '#dcecff', 200: '#bcd8fa', 300: '#8ebcef',
					400: '#5396e2', 500: '#2a79d1', 600: '#1764bf', 700: '#1454a1',
					800: '#154780', 900: '#183f6f', 950: '#112b4d'
				},
				slate: { 50: '#f5f9ff', 100: '#edf5ff', 200: '#dbe6f3', 300: '#bdcee2', 500: '#52677d', 600: '#4b627e', 700: '#334e70', 800: '#253c58', 900: '#20262e' },
				emerald: { 600: '#247b50', 700: '#1b6340' },
				amber: { 600: '#96620a', 700: '#80500a' },
				border: 'hsl(var(--border) / <alpha-value>)',
				input: 'hsl(var(--input) / <alpha-value>)',
				ring: 'hsl(var(--ring) / <alpha-value>)',
				background: 'hsl(var(--background) / <alpha-value>)',
				foreground: 'hsl(var(--foreground) / <alpha-value>)',
				primary: {
					DEFAULT: '#1764bf',
					foreground: '#ffffff'
				},
				accent: {
					DEFAULT: '#f59e0b',
					foreground: '#ffffff'
				}
			}
		}
	},
	plugins: []
};
