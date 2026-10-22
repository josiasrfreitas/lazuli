/** Disposable workshop routes are available only in the local development server. */
export const workshopEnabled = process.env.NODE_ENV === "development";
