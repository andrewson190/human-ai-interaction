/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/App.js", "./src/index.js"],
  daisyui: {
    themes: false,
  },
  theme: {
    extend: {},
  },
  plugins: [require('daisyui'),],
}

