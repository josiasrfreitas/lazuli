/** Reads the JSON payload supplied to a Claude Code command hook. */
export async function readHookInput() {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
