type SessionState = {
  renderedEmail: string;
  currentEmail: string | null;
  isPending: boolean;
  hasError: boolean;
};

/** Re-enter server authorization when the rendered identity is no longer current. */
export function sessionRedirect(state: SessionState): "/login" | "/" | null {
  if (state.isPending || state.hasError) return null;
  if (state.currentEmail === null) return "/login";
  return state.currentEmail === state.renderedEmail ? null : "/";
}
