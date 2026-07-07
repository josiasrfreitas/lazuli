import type { ReceivablesSnapshot } from "@lazuli/domain";

import {
  buildReceivablesSnapshotFromDatabase,
  type ReceivablesDatabase,
} from "./receivables-data.js";

export async function receivablesSnapshot(input: {
  database: ReceivablesDatabase;
}): Promise<ReceivablesSnapshot> {
  return buildReceivablesSnapshotFromDatabase(input.database);
}
