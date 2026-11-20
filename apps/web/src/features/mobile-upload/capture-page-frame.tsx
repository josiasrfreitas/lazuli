import type { ReactElement, ReactNode } from "react";
import { BrandSignature } from "~/components/app-shell/brand-signature";
import styles from "./mobile-upload.module.css";

/** The QR capture experience shared by enrollment documents and staff uploads. */
export function CapturePageFrame({
  back,
  children,
}: {
  back?: ReactNode;
  children: ReactNode;
}): ReactElement {
  return (
    <main className={styles.mobile}>
      <div className={styles.actions}>
        {back}
        <BrandSignature expanded />
      </div>
      {children}
    </main>
  );
}
