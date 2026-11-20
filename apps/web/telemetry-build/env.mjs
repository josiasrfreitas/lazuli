const token = process.env.SENTRY_AUTH_TOKEN;

export const sentryBuildSettings = {
  authToken: token,
  silent: !process.env.CI,
  sourcemaps: { disable: !token, deleteSourcemapsAfterUpload: true },
  release: { name: process.env.SENTRY_RELEASE },
};
