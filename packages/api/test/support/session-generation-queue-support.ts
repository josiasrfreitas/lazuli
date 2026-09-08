import type { SessionsGeneratePayload, SessionsGenerateQueue } from "@lazuli/job-contracts";

export type RecordingSessionsGenerateQueue = SessionsGenerateQueue & {
  calls: SessionsGeneratePayload[];
};

export function recordingSessionsGenerateQueue(jobId: string): RecordingSessionsGenerateQueue {
  const calls: SessionsGeneratePayload[] = [];

  return {
    calls,
    enqueueSessionsGenerate: (payload) => {
      calls.push(payload);
      return Promise.resolve({ workflowName: "sessions-generate", jobId, payload });
    },
  };
}
