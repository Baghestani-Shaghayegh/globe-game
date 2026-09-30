import { beaconTone } from "../../lib/globeTheme";

/**
 * The two things drawn over a globe as plain DOM: a country's name, and a
 * pulse on a country to look at. Shared by the daily's result globe, the
 * Country hunt and the lessons, so they all say it the same way.
 */

/** Anything with a place on the globe, for the html layer's accessors. */
export type Placed = { lat: number; lng: number };

export const markLat = (d: object) => (d as Placed).lat;
export const markLng = (d: object) => (d as Placed).lng;

/**
 * A country's name in a small dark pill, lifted just above the point.
 *
 * The globe positions the outer element by writing its transform every frame,
 * so the lift above the country has to go on an inner one — set on the outer,
 * it was silently overwritten. Lifted further where a pulse shares the point,
 * so the rings don't run through the name.
 */
export function namePill(text: string, lift = 18): HTMLElement {
  const holder = document.createElement("div");
  holder.style.pointerEvents = "none";
  const el = holder.appendChild(document.createElement("span"));
  el.textContent = text;
  el.style.cssText = [
    "display: inline-block",
    "color: #f4f4f5",
    "font: 500 13px ui-sans-serif, system-ui, sans-serif",
    "white-space: nowrap",
    "pointer-events: none",
    "padding: 2px 8px",
    "border-radius: 9999px",
    "background: rgb(20 27 35 / 0.9)",
    "border: 1px solid rgb(255 255 255 / 0.12)",
    `transform: translateY(-${lift}px)`,
  ].join(";");
  return holder;
}

/**
 * A pulse on a country: two rings growing out from the point (`.beacon` in
 * index.css). DOM rather than the globe's own ring layer, which drew
 * one-pixel lines lost among the coastlines; this stays the same size on
 * screen however far out the camera is, and the globe hides it round the back.
 */
export function pulseMark(): HTMLElement {
  const el = document.createElement("div");
  el.className = "beacon";
  el.setAttribute("aria-hidden", "true");
  el.style.setProperty("--beacon", beaconTone());
  return el;
}
