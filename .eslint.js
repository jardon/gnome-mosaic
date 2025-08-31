module.exports = {
  // ... other ESLint configurations
  rules: {
    "padding-line-between-statements": [
      "error",
      { blankLine: "always", prev: "function", next: "function" },
      { blankLine: "always", prev: "function", next: "block" },
      { blankLine: "always", prev: "block", next: "function" },
    ],
  },
};