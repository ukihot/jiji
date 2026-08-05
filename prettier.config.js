/** @type {import('prettier').Config} */
export default {
	plugins: [
		'prettier-plugin-svelte',
		'prettier-plugin-tailwindcss'
	],

	printWidth: 100,
	singleQuote: true,
	semi: true,
	useTabs: true,

	svelteStrictMode: true
};