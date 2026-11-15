import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
if (typeof window !== "undefined") {
  afterEach(() => { cleanup(); localStorage.clear(); });
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  window.confirm = () => true;
}
