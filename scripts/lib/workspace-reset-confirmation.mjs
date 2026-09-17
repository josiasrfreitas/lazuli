export function acceptsWorkspaceReset(answer) {
  return answer.trim().toLowerCase() === "reset";
}
