import { db } from "@lazuli/db";
import { refreshStudentHealthPending } from "@lazuli/worker-handlers";

const REFRESH_MS = 60_000;
export function startStudentHealthRefresh(): () => void {
  let running = false;
  const refresh = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await refreshStudentHealthPending(db);
    } catch {
      process.stdout.write("[worker] student health refresh failed\n");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  void refresh();
  return () => clearInterval(timer);
}
