export function attendanceBrowserId(): string {
  const key = "lazuli.attendance-browser";
  let id = localStorage.getItem(key);
  if (!id || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/iu.test(id)) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}
