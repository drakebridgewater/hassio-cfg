// "What to wear" icon set: the garments the kid wears on the tablet card
// (decluttering-templates/what_to_wear.yaml), drawn in Material's 24x24 solid
// style. Use them as `wear:umbrella`, `wear:boots`, `wear:light-coat`,
// `wear:heavy-coat`, `wear:sweater`, `wear:tank-top` and `wear:sunglasses`.
// Loaded for every dashboard from frontend.extra_module_url (configuration.yaml)
// and the dashboard resources (dashboards/lovelace_resources.yaml).
const wearIcons = {
  // Canopy with a scalloped edge, shaft and hooked handle.
  umbrella:
    "M12 2C6.7 2 2.5 5.8 2 10.8c.9-1.1 2-1.7 3.3-1.7s2.4.6 3.4 1.7c.9-1.1 2-1.7 3.3-1.7s2.4.6 3.3 1.7" +
    "c.9-1.1 2-1.7 3.4-1.7s2.4.6 3.3 1.7C21.5 5.8 17.3 2 12 2z" +
    "M11 10.8h2V18a3.5 3.5 0 0 1-3.5 3.5A3.5 3.5 0 0 1 6 18h2a1.5 1.5 0 0 0 3 0z",
  // Rain boot in profile, toe to the right, with a band at the top of the shaft.
  boots:
    "M5 3h7v9l5.2 2.2A4 4 0 0 1 20 18v1.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5V4a1 1 0 0 1 1-1z" +
    "M6 6.5v1.5h5V6.5z",
  // Zip-front jacket: collar, long sleeves with cuffs, open zip line.
  "light-coat":
    "M9 3l3 2.5L15 3l5.5 2.2L22 17h-3.6l-.4-6.5V21H6V10.5L5.6 17H2L3.5 5.2z" +
    "M11.5 7v14h1V7z",
  // Long coat: big collar, buttoned front, skirt below the hip.
  "heavy-coat":
    "M8 2.5l4 3.5 4-3.5 5 2.5 1.5 12-3.8.6V22H5.3v-4.4L1.5 17 3 5z" +
    "M11.4 9v13h1.2V9z" +
    "M9 12.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM9 17.5a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
  // Crew-neck sweater: scooped neck, long sleeves, ribbed hem.
  sweater:
    "M8.5 3.5C9.2 5.3 10.5 6.2 12 6.2s2.8-.9 3.5-2.7L21 6l1.6 12.3-3.6.7-.5-7V21h-13v-9L5 19l-3.6-.7L3 6z" +
    "M5.5 18.4h13v-1h-13z",
  // Tank top: two straps, deep scoop neck, armholes, slight flare.
  "tank-top":
    "M7.5 3h2.3c0 2.6 1.2 4.4 2.2 4.4s2.2-1.8 2.2-4.4h2.3v4.6c0 1.9 1.1 3.2 2.5 3.8V21a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9.6c1.4-.6 2.5-1.9 2.5-3.8z",
  // Two lenses, a bridge, and the arms running back along the top.
  sunglasses:
    "M2.5 9.5C2.5 8.7 3.2 8 4 8h5.5c.8 0 1.5.7 1.5 1.5v2a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4z" +
    "M13 9.5c0-.8.7-1.5 1.5-1.5H20c.8 0 1.5.7 1.5 1.5v2a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4z" +
    "M10.6 8.6h2.8v1.6h-2.8zM1 7h2v1.2H1zM21 7h2v1.2h-2z",
};

window.customIconsets = window.customIconsets || {};
window.customIconsets.wear = (name) => Promise.resolve({ path: wearIcons[name] || "", viewBox: "0 0 24 24" });
window.customIcons = window.customIcons || {};
window.customIcons.wear = {
  getIcon: (name) => Promise.resolve({ path: wearIcons[name] || "", viewBox: "0 0 24 24" }),
  getIconList: () => Promise.resolve(Object.keys(wearIcons).map((name) => ({ name }))),
};

// Icons drawn before this file arrived stay blank (ha-icon doesn't retry an
// unknown prefix), so redraw any wear: icon already on the page, now and once
// more after the dashboard has settled.
const redrawWearIcons = (root = document) => {
  root.querySelectorAll("*").forEach((el) => {
    if (el.localName === "ha-icon" && String(el.icon || "").startsWith("wear:")) {
      const name = el.icon;
      el.icon = "";
      requestAnimationFrame(() => { el.icon = name; });
    }
    if (el.shadowRoot) redrawWearIcons(el.shadowRoot);
  });
};
redrawWearIcons();
setTimeout(() => redrawWearIcons(), 3000);

