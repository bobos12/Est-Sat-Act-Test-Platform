/** Request-time clock for server components (all callers run after dynamic data access). */
export function requestTime() {
  return Date.now();
}
