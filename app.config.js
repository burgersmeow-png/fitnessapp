// app.json holds the app's settings. This only adds the web address prefix when building the
// browser version for GitHub Pages (scripts/build-web.mjs sets WEB_BASE_URL).
module.exports = ({ config }) =>
  process.env.WEB_BASE_URL ? { ...config, experiments: { ...config.experiments, baseUrl: process.env.WEB_BASE_URL } } : config;
