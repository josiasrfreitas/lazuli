"use client";
import { createContext, useContext, type ReactNode, type ReactElement } from "react";
import type { UploadContextValue } from "./queue-model";
import { useUploadQueue } from "./use-upload-queue";
import { UploadQueuePanel } from "./queue-view";
const UploadContext = createContext<UploadContextValue | null>(null);
export function useAssessmentUploads(): UploadContextValue {
  const value = useContext(UploadContext);
  if (!value) throw new Error("Uploads require the authenticated app shell.");
  return value;
}
export function AssessmentUploadProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}): ReactElement {
  const queue = useUploadQueue(userId);
  return (
    <UploadContext.Provider value={{ add: queue.add }}>
      {children}
      <UploadQueuePanel {...queue} userId={userId} />
    </UploadContext.Provider>
  );
}
