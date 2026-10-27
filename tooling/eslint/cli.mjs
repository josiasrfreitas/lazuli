#!/usr/bin/env node
import { formatResults, lintFiles } from "./run-oxlint.mjs";

try {
  const results = await lintFiles({ files: process.argv.slice(2) });
  process.stdout.write(formatResults(results));
  const messages = results.flatMap((result) => result.messages);
  const errors = messages.filter((message) => message.severity === 2).length;
  process.stdout.write(`Oxlint: ${errors} error(s), ${messages.length - errors} warning(s).\n`);
  if (errors > 0) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
