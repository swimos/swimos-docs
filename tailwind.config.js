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
      backgroundImage: {
        'hero-pattern': "url('/assets/images/wave.png')",
        'cta-pattern': "url('/assets/images/wave.png')",
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            '--tw-prose-body': theme('colors.swim-body-text'),
            '--tw-prose-headings': theme('colors.swim-dark-blue'),
            '--tw-prose-lead': theme('colors.swim-darker-teal'),
            '--tw-prose-links': theme('colors.swim-dark-blue'),
            '--tw-prose-bold': theme('colors.swim-dark-blue'),
            '--tw-prose-counters': theme('colors.swim-blue'),
            '--tw-prose-bullets': theme('colors.swim-blue'),
            '--tw-prose-hr': theme('colors.swim-grey'),
            '--tw-prose-quotes': theme('colors.swim-darker-teal'),
            '--tw-prose-quote-borders': theme('colors.swim-blue'),
            '--tw-prose-captions': theme('colors.swim-body-text'),
            '--tw-prose-code': theme('colors.swim-dark-blue'),
            '--tw-prose-pre-code': theme('colors.white'),
            '--tw-prose-pre-bg': theme('colors.swim-dark-blue'),
            '--tw-prose-th-borders': theme('colors.swim-darker-teal'),
            '--tw-prose-td-borders': theme('colors.swim-grey'),
            // '--tw-prose-invert-body': theme('colors.pink[200]'), // These are dark-mode settings.
            // '--tw-prose-invert-headings': theme('colors.white'), // rounded corner radius 13.5
            // '--tw-prose-invert-lead': theme('colors.pink[300]'),
            // '--tw-prose-invert-links': theme('colors.white'),
            // '--tw-prose-invert-bold': theme('colors.white'),
            // '--tw-prose-invert-counters': theme('colors.pink[400]'),
            // '--tw-prose-invert-bullets': theme('colors.pink[600]'),
            // '--tw-prose-invert-hr': theme('colors.pink[700]'),
            // '--tw-prose-invert-quotes': theme('colors.pink[100]'),
            // '--tw-prose-invert-quote-borders': theme('colors.pink[700]'),
            // '--tw-prose-invert-captions': theme('colors.pink[400]'),
            // '--tw-prose-invert-code': theme('colors.white'),
            // '--tw-prose-invert-pre-code': theme('colors.pink[300]'),
            // '--tw-prose-invert-pre-bg': theme('colors.swim-dark-blue'),
            // '--tw-prose-invert-th-borders': theme('colors.pink[600]'),
            // '--tw-prose-invert-td-borders': theme('colors.pink[700]'),
          },
        },
      }),
      colors: {
        'swim-dark-blue': '#042256',
        'swim-darker-blue': '#111827',
        'swim-teal': '#66FFDD',
        'swim-dark-teal': '#44D7B6', // Amazonite?
        'swim-darker-teal': 'RGBA(4, 42, 43, 0.85)', // This is greyish-green and used as header/body text in the features section
        'swim-purple': '#BA62FF',
        'swim-dark-purple': '#D651FF',
        'swim-body-text': '#3A3C3E',
        'swim-blue': '#32C5FF', // Apatite?
        'swim-grey': '#C1C1C1',
        'swim-darker-grey': '#A9A9A9', // Footer links
        'swim-darkerish-grey': '#6D7278', // Footer headings
        'swim-lighter-grey': '#E9EFF0'
      },
    },
  },
  plugins: [
      require('@tailwindcss/forms'),
      require('@tailwindcss/typography'),
  ]
}
