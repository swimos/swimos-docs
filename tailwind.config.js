module.exports = {
  content: [
    './_drafts/**/*.html',
    './_includes/**/*.html',
    './_layouts/**/*.html',
    './_posts/*.md',
    './*.md',
    './*.html',
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['"Sora"', 'sans-serif']
      },
      colors: {
        'vermillion-orange': '#FE3B1E',
        'deep-kaimurasaki': '#221C34',
        'magenta': '#D2007D',
        'deep-magenta': '#740049',
        'eggshell': '#F0E5D0',
        'alabastor': '#FCF9EC'
      },
    },
  },
  plugins: [
      require('@tailwindcss/forms'),
      require('@tailwindcss/typography'),
  ]
}
