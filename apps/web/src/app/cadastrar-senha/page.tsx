import type { Metadata } from "next";
import type { ReactNode } from "react";

import LoginPage from "../login/page";

export const metadata: Metadata = { title: "Cadastrar senha", robots: { index: false, follow: false } };
export { viewport } from "../login/page";

/** The emailed, single-use token authorizes choosing a password for an existing identity. */
export default async function PasswordRegistrationPage({ searchParams }: {
  searchParams: Promise<{ token?: string; error?: string }>;
}): Promise<ReactNode> {
  const params = await searchParams;
  return <LoginPage searchParams={Promise.resolve({ ...params, mode: "set-password" })} />;
}
