export function toast(message, type = "ok") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("srb-toast", { detail: { message, type } }));
}
