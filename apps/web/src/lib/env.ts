export const isDevelopment = process.env.NODE_ENV === "development";
export const classOrganizationEnabled = process.env.LAZULI_CLASS_ORGANIZATION_ENABLED === "true";

export const developmentWebPort = process.env.LAZULI_WEB_PORT ?? "3000";
