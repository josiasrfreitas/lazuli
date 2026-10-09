// A local design workshop is only available in the development runtime.
export const workshopEnabled = process.env.NODE_ENV === "development";
