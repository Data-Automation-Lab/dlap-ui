module.exports = {
  // ...

  theme: {
    extend: {
      colors: {
        brand: {
          50: "rgb(236, 244, 255)",
          100: "rgb(220, 234, 252)",
          200: "rgb(190, 216, 248)",
          300: "rgb(145, 188, 240)",
          400: "rgb(92, 148, 224)",
          500: "rgb(26, 95, 180)",
          600: "rgb(21, 76, 144)",
          700: "rgb(18, 63, 120)",
          800: "rgb(15, 50, 96)",
          900: "rgb(12, 40, 77)",
        },
        neutral: {
          0: "rgb(255, 255, 255)",
          50: "rgb(248, 250, 252)",
          100: "rgb(241, 245, 249)",
          200: "rgb(226, 232, 240)",
          300: "rgb(203, 213, 225)",
          400: "rgb(148, 163, 184)",
          500: "rgb(100, 116, 139)",
          600: "rgb(71, 85, 105)",
          700: "rgb(51, 65, 85)",
          800: "rgb(30, 41, 59)",
          900: "rgb(15, 23, 42)",
          950: "rgb(8, 12, 24)",
        },
        error: {
          50: "rgb(254, 242, 242)",
          100: "rgb(254, 226, 226)",
          200: "rgb(254, 202, 202)",
          300: "rgb(252, 165, 165)",
          400: "rgb(248, 113, 113)",
          500: "rgb(239, 68, 68)",
          600: "rgb(220, 38, 38)",
          700: "rgb(185, 28, 28)",
          800: "rgb(153, 27, 27)",
          900: "rgb(127, 29, 29)",
        },
        warning: {
          50: "rgb(255, 251, 235)",
          100: "rgb(254, 243, 199)",
          200: "rgb(253, 230, 138)",
          300: "rgb(252, 211, 77)",
          400: "rgb(251, 191, 36)",
          500: "rgb(245, 158, 11)",
          600: "rgb(217, 119, 6)",
          700: "rgb(180, 83, 9)",
          800: "rgb(146, 64, 14)",
          900: "rgb(120, 53, 15)",
        },
        success: {
          50: "rgb(236, 253, 245)",
          100: "rgb(209, 250, 229)",
          200: "rgb(167, 243, 208)",
          300: "rgb(110, 231, 183)",
          400: "rgb(52, 211, 153)",
          500: "rgb(16, 185, 129)",
          600: "rgb(5, 150, 105)",
          700: "rgb(4, 120, 87)",
          800: "rgb(6, 95, 70)",
          900: "rgb(6, 78, 59)",
        },
        "brand-primary": "rgb(21, 76, 144)",
        "default-font": "rgb(15, 23, 42)",
        "subtext-color": "rgb(100, 116, 139)",
        "neutral-border": "rgb(226, 232, 240)",
        white: "rgb(255, 255, 255)",
        "default-background": "rgb(255, 255, 255)",
      },
      fontSize: {
        caption: [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
        "caption-bold": [
          "12px",
          {
            lineHeight: "16px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        body: [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
        "body-bold": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "500",
            letterSpacing: "0em",
          },
        ],
        "heading-3": [
          "16px",
          {
            lineHeight: "20px",
            fontWeight: "600",
            letterSpacing: "0em",
          },
        ],
        "heading-2": [
          "20px",
          {
            lineHeight: "24px",
            fontWeight: "600",
            letterSpacing: "0em",
          },
        ],
        "heading-1": [
          "30px",
          {
            lineHeight: "36px",
            fontWeight: "600",
            letterSpacing: "0em",
          },
        ],
        "monospace-body": [
          "14px",
          {
            lineHeight: "20px",
            fontWeight: "400",
            letterSpacing: "0em",
          },
        ],
      },
      fontFamily: {
        caption: '"IBM Plex Sans"',
        "caption-bold": '"IBM Plex Sans"',
        body: '"IBM Plex Sans"',
        "body-bold": '"IBM Plex Sans"',
        "heading-3": '"IBM Plex Sans"',
        "heading-2": '"IBM Plex Sans"',
        "heading-1": '"IBM Plex Sans"',
        "monospace-body": '"IBM Plex Mono"',
      },
      boxShadow: {
        sm: "0px 1px 2px 0px rgba(15, 23, 42, 0.07)",
        default: "0px 1px 2px 0px rgba(15, 23, 42, 0.07)",
        md: "0px 4px 16px -2px rgba(15, 23, 42, 0.1), 0px 2px 4px -1px rgba(15, 23, 42, 0.07)",
        lg: "0px 12px 32px -4px rgba(15, 23, 42, 0.12), 0px 4px 8px -2px rgba(15, 23, 42, 0.08)",
        overlay:
          "0px 12px 32px -4px rgba(15, 23, 42, 0.12), 0px 4px 8px -2px rgba(15, 23, 42, 0.08)",
      },
      borderRadius: {
        sm: "4px",
        md: "5px",
        DEFAULT: "5px",
        lg: "6px",
        full: "9999px",
      },
      container: {
        padding: {
          DEFAULT: "16px",
          sm: "calc((100vw + 16px - 640px) / 2)",
          md: "calc((100vw + 16px - 768px) / 2)",
          lg: "calc((100vw + 16px - 1024px) / 2)",
          xl: "calc((100vw + 16px - 1280px) / 2)",
          "2xl": "calc((100vw + 16px - 1536px) / 2)",
        },
      },
      spacing: {
        112: "28rem",
        144: "36rem",
        192: "48rem",
        256: "64rem",
        320: "80rem",
      },
      screens: {
        mobile: {
          max: "767px",
        },
      },
    },
  },
};
