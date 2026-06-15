export function notify(msg: string) {
  if (typeof window !== "undefined") {
    alert(msg); // simple fallback (can upgrade to toast later)
  }
}