module.exports = {
  content: [
    './_drafts/**/*.html',
    './_includes/**/*.html',
    './_layouts/**/*.html',
    './_posts/*.md',
    './_meta/*.md',
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
        'swim-body-text': '#3A3C3E',
        'swim-blue': '#32C5FF', // Apatite?
        'swim-dark-blue': '#042256',
        'swim-darker-blue': '#111827',
        'swim-teal': '#66FFDD',
        'swim-dark-teal': '#44D7B6', // Amazonite?
        'swim-darker-teal': 'RGBA(4, 42, 43, 0.85)', // This is greyish-green and used as header/body text in the features section
        'swim-purple': '#BA62FF',
        'swim-dark-purple': '#D651FF',
        'swim-grey': '#C1C1C1',
        'swim-lighter-grey': '#E9EFF0',
        'swim-darker-grey': '#A9A9A9', // Footer links
        'swim-darkerish-grey': '#6D7278', // Footer headings
        "kaimurasaki": {
          100: "#E8E8EA",
          200: "#D3D2D6",
          300: "#BCBAC2",
          400: "#A7A4AE",
          500: "#918E9A",
          600: "#7A7785",
          700: "#646071",
          800: "#4E495D",
          900: "#383248",
          950: "#2C273E",
          DEFAULT: "#221C34",
        },
        "eggshell": {
          100: "#FEFCFA",
          200: "#FCFAF6",
          300: "#FBF7F1",
          400: "#F9F5EC",
          500: "#F7F2E7",
          600: "#F6EFE3",
          700: "#F5EDDE",
          800: "#F3EAD9",
          900: "#F2E8D5",
          DEFAULT: "#F0E5D0",
        },
        "amaranth": {
          100: "#F1E6ED",
          200: "#E3CCDB",
          300: "#D6B3C9",
          400: "#C799B6",
          500: "#BA80A4",
          600: "#AC6692",
          700: "#9D4C7F",
          800: "#90336D",
          900: "#821A5C",
          950: "#7B0D52",
          DEFAULT: "#740049",
        },
        "callout": {
          "info": {
            "fill": "transparent",
            "border": "#00A9A5",
            "icon": "#00A9A5",
            "text": "#0A1215",
            "text-accent": "#02372F",
          },
          "ok": {
            "fill": "#00A9A5",
            "border": "#00896A",
            "icon": "#FFFFFF",
            "text": "#0A1514",
            "text-accent": "#66FFDD",
          },
          "warning": {
            "fill": "#F9DB6D",
            "border": "#F7B500",
            "icon": "#FFFFFF",
            "text": "#15120A",
            "text-accent": "#FFFFFF",
          },
          "bad": {
            "fill": "#FF8552",
            "border": "#BC571A",
            "icon": "#FFFFFF",
            "text": "#150A0A",
            "text-accent": "#FFE3E3",
          },
        },
      },
    },
  },
  safelist: [
    // include all possible tailwind color and border options in production build; supports passing custom styles to callout-base.html
    { pattern: /bg-+/ },
    { pattern: /border-+/ },
    { pattern: /text-+/ },
  ],
  plugins: [
      require('@tailwindcss/forms'),
      require('@tailwindcss/typography'),
  ]
}
