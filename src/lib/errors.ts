// Keeps internal error detail out of the interface.
// Technical text (database messages, constraint names, policy errors) goes to the
// browser console for developers; the user sees a plain, non-revealing message.
export function friendlyError(
  err: unknown,
  fallback = 'Something went wrong. Please try again.'
): string {
  console.error(err);
  return fallback;
}
