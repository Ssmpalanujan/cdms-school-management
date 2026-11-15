// Lets any part of the app make the owl react: owlReact("celebrate", { en: "...", ta: "..." })
export function owlReact(type, text = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("srb-owl", { detail: { type, ...text } }));
}
