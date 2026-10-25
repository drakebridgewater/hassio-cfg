/*
 * hvac-bands-card
 *
 * Edits the HVAC Schedule's temperature bands (configs/hvac_bands.json,
 * published as pyscript.hvac_bands). Changes are kept as a draft until Save,
 * which calls pyscript.hvac_bands_save; the automation re-applies on save.
 *
 *   type: custom:hvac-bands-card
 *
 * Today's forecast high picks a band (each covers the previous band's limit up
 * to its own, the last one has no limit); the alarm state picks the setpoint.
 * The band shown as "today" is worked out here the same way the HVAC Schedule
 * automation does (variables today_high / band_index in automations.yaml):
 * keep the two in step.
 *
 * After editing this file, bump ?v= in dashboards/lovelace_resources.yaml and
 * restart HA: /local is served with a 31-day cache, so a refresh is not enough.
 */

const ENTITY = "pyscript.hvac_bands";
const FORECAST = "sensor.daily_weather_forecast";
const ALARM = "alarm_control_panel.default";
const CLIMATE = "climate.thermostat";
const PAUSED = "input_boolean.hvac_schedule_paused";
const SEALED = "binary_sensor.house_sealed";
const FALLBACK_HIGH = 65;
const MAX_BANDS = 8;
const MIN_SPREAD = 2;

const OCCUPANCY = [
  ["disarmed", "Disarmed"],
  ["armed_home", "Armed home"],
  ["armed_night", "Night"],
  ["armed_away", "Away"],
  ["armed_vacation", "Vacation"],
];
const MODES = {
  heat: { name: "Heat", icon: "mdi:fire", tone: "var(--deep-orange-color, #ff5722)" },
  cool: { name: "Cool", icon: "mdi:snowflake", tone: "var(--blue-color, #2196f3)" },
  heat_cool: { name: "Heat and cool", icon: "mdi:sun-snowflake-variant", tone: "var(--teal-color, #009688)" },
};

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const newId = () => `b-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const fmtSet = (mode, v) => (mode === "heat_cool" ? `${v?.[0]}–${v?.[1]}°` : `${v}°`);

class HvacBandsCard extends HTMLElement {
  setConfig(config) {
    this._config = config || {};
    this._open = null;
    this._dirty = false;
    this._error = "";
    this._saving = false;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
      this.shadowRoot.addEventListener("change", (e) => this._onChange(e));
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    const watch = [ENTITY, FORECAST, ALARM, CLIMATE, PAUSED, SEALED].map((id) => [
      hass.states[id]?.state,
      hass.states[id]?.last_updated,
    ]);
    const key = JSON.stringify(watch);
    if (key === this._lastKey && !first) return;
    this._lastKey = key;
    // Someone else's save never overwrites a draft in progress.
    if (!this._dirty) this._loadDraft();
    this._render();
  }

  getCardSize() {
    return 8;
  }

  static getStubConfig() {
    return {};
  }

  _stored() {
    return this._hass?.states[ENTITY]?.attributes?.bands;
  }

  _limits() {
    const at = this._hass?.states[ENTITY]?.attributes || {};
    return { min: at.min_temp ?? 45, max: at.max_temp ?? 90 };
  }

  _loadDraft() {
    const bands = this._stored();
    this._draft = bands ? JSON.parse(JSON.stringify(bands)) : null;
  }

  _find(id) {
    return this._draft.find((b) => b.id === id);
  }

  _touch() {
    this._dirty = true;
    this._error = "";
  }

  // Today's forecast high: the forecast entry dated today, else the first one.
  _todayHigh() {
    const fc = this._hass.states[FORECAST]?.attributes?.forecast || [];
    const today = new Date().toDateString();
    const hit = fc.find((f) => f.datetime && f.temperature != null && new Date(f.datetime).toDateString() === today);
    const t = hit ? hit.temperature : fc[0]?.temperature;
    const n = Number(t);
    return Math.round(Number.isFinite(n) ? n : FALLBACK_HIGH);
  }

  _bandIndex(bands, high) {
    const count = bands.filter((b) => b.max != null && b.max <= high).length;
    return Math.min(count, bands.length - 1);
  }

  _range(bands, i) {
    const lo = i > 0 ? bands[i - 1].max : null;
    const hi = bands[i].max;
    if (lo == null && hi == null) return "Any high";
    if (lo == null) return `Below ${hi}°`;
    if (hi == null) return `${lo}° and up`;
    return `${lo}–${hi}°`;
  }

  // ---------------------------------------------------------------- editing

  _setMode(band, mode) {
    if (band.mode === mode) return;
    const { min, max } = this._limits();
    const clamp = (v) => Math.max(min, Math.min(max, v));
    for (const [occ] of OCCUPANCY) {
      const v = band[occ];
      if (mode === "heat_cool") {
        // One number becomes a range around it: heat keeps it as the low, cool as the high.
        const n = Number(Array.isArray(v) ? v[0] : v) || 70;
        band[occ] = band.mode === "cool" ? [clamp(n - 5), clamp(n)] : [clamp(n), clamp(n + 5)];
      } else if (Array.isArray(v)) {
        band[occ] = mode === "cool" ? v[1] : v[0];
      }
    }
    band.mode = mode;
    this._touch();
  }

  // Splits a band in two at the middle of its range; the new half copies it.
  _split(id) {
    if (this._draft.length >= MAX_BANDS) {
      this._error = `There can be at most ${MAX_BANDS} bands.`;
      return;
    }
    const i = this._draft.findIndex((b) => b.id === id);
    const band = this._draft[i];
    const lo = i > 0 ? this._draft[i - 1].max : null;
    const hi = band.max;
    let cut;
    if (lo != null && hi != null) cut = Math.round((lo + hi) / 2);
    else if (hi != null) cut = hi - 10;
    else if (lo != null) cut = lo + 10;
    else cut = 65;
    if ((lo != null && cut <= lo) || (hi != null && cut >= hi)) {
      this._error = "This band is too narrow to split. Widen it first.";
      return;
    }
    const lower = { ...JSON.parse(JSON.stringify(band)), id: newId(), max: cut };
    this._draft.splice(i, 0, lower);
    this._open = lower.id;
    this._touch();
  }

  // Deleting a band hands its range to the band above it (or below, for the last one).
  _delete(id) {
    if (this._draft.length <= 1) {
      this._error = "There must be at least one band.";
      return;
    }
    const i = this._draft.findIndex((b) => b.id === id);
    if (i === this._draft.length - 1) this._draft[i - 1].max = null;
    this._draft.splice(i, 1);
    this._open = null;
    this._touch();
  }

  _setMax(band, value) {
    const i = this._draft.indexOf(band);
    const lo = i > 0 ? this._draft[i - 1].max : null;
    const next = this._draft[i + 1];
    const hi = next && next.max != null ? next.max : null;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return;
    if (lo != null && n <= lo) {
      this._error = `This band starts at ${lo}°, so it has to end above that.`;
      return;
    }
    if (hi != null && n >= hi) {
      this._error = `The next band ends at ${hi}°, so this one has to end below that.`;
      return;
    }
    band.max = n;
    this._touch();
  }

  _setTemp(band, occ, part, value) {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return;
    if (band.mode === "heat_cool") {
      const v = [...band[occ]];
      v[part] = n;
      band[occ] = v;
    } else {
      band[occ] = n;
    }
    this._touch();
  }

  _check() {
    const { min, max } = this._limits();
    for (const [i, band] of this._draft.entries()) {
      for (const [occ, label] of OCCUPANCY) {
        const vals = band.mode === "heat_cool" ? band[occ] : [band[occ]];
        if (vals.some((v) => !Number.isInteger(v) || v < min || v > max)) {
          return [band.id, `${this._range(this._draft, i)} · ${label}: use ${min}–${max}°.`];
        }
        if (band.mode === "heat_cool" && vals[1] - vals[0] < MIN_SPREAD) {
          return [band.id, `${this._range(this._draft, i)} · ${label}: the high must be at least ${MIN_SPREAD}° above the low.`];
        }
      }
    }
    return null;
  }

  // --------------------------------------------------------------- events

  _onClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const { action, id } = el.dataset;
    const band = id ? this._find(id) : null;
    switch (action) {
      case "toggle-open":
        this._open = this._open === id ? null : id;
        break;
      case "mode":
        this._setMode(band, el.dataset.mode);
        break;
      case "max-step":
        this._setMax(band, band.max + Number(el.dataset.delta));
        break;
      case "temp-step": {
        const part = Number(el.dataset.part || 0);
        const cur = band.mode === "heat_cool" ? band[el.dataset.occ][part] : band[el.dataset.occ];
        this._setTemp(band, el.dataset.occ, part, cur + Number(el.dataset.delta));
        break;
      }
      case "split":
        this._split(id);
        break;
      case "delete":
        this._delete(id);
        break;
      case "cancel":
        this._dirty = false;
        this._error = "";
        this._open = null;
        this._loadDraft();
        break;
      case "save":
        this._save();
        return;
      default:
        return;
    }
    this._render();
  }

  _onChange(e) {
    const el = e.target;
    const field = el.dataset?.field;
    if (!field || el.value === "") return;
    const band = this._find(el.dataset.id);
    if (field === "max") this._setMax(band, el.value);
    else if (field === "temp") this._setTemp(band, el.dataset.occ, Number(el.dataset.part || 0), el.value);
    else return;
    this._render();
  }

  // --------------------------------------------------------------- service calls

  async _save() {
    const problem = this._check();
    if (problem) {
      [this._open, this._error] = problem;
      this._render();
      return;
    }
    this._saving = true;
    this._render();
    try {
      const res = await this._hass.callWS({
        type: "call_service",
        domain: "pyscript",
        service: "hvac_bands_save",
        service_data: { bands: this._draft },
        return_response: true,
      });
      const result = res?.response || {};
      if (!result.ok) throw new Error(result.error || "Save failed");
      this._dirty = false;
      this._open = null;
      this._error = "";
      this._loadDraft();
    } catch (err) {
      this._error = `Couldn't save: ${err.message || err}`;
    } finally {
      this._saving = false;
      this._render();
    }
  }

  // ---------------------------------------------------------------- rendering

  _render() {
    if (!this.shadowRoot) return;
    if (!this._draft) {
      this.shadowRoot.innerHTML = `${STYLE}<ha-card><div class="empty">
        The bands aren't loaded. Is pyscript running and <code>${ENTITY}</code> there?</div></ha-card>`;
      return;
    }
    const high = this._todayHigh();
    const occ = this._hass.states[ALARM]?.state;
    const today = this._bandIndex(this._draft, high);
    const occName = (OCCUPANCY.find(([k]) => k === occ) || [occ, occ || "unknown"])[1];
    const todayBand = this._draft[today];
    const mode = MODES[todayBand.mode];
    const target = todayBand[occ] ?? todayBand.disarmed;
    const paused = this._hass.states[PAUSED]?.state === "on";
    const sealed = this._hass.states[SEALED]?.state === "on";
    const why = paused
      ? `<span class="attn">The schedule is paused, so the thermostat is yours until it resumes.</span>`
      : !sealed
        ? `<span class="attn">A door or window has been open recently. The schedule waits until everything is shut for 20 minutes.</span>`
        : `The schedule is running.`;

    const rows = this._draft.map((b, i) => this._renderBand(b, i, i === today, occ)).join("");

    this.shadowRoot.innerHTML = `${STYLE}
      <ha-card>
        <div class="now">
          <div class="now-line">
            <span class="fact"><span class="k">Forecast high</span><span class="v">${high}°</span></span>
            <span class="fact"><span class="k">Band</span><span class="v">${esc(this._range(this._draft, today))}</span></span>
            <span class="fact"><span class="k">Alarm</span><span class="v">${esc(occName)}</span></span>
            <span class="fact"><span class="k">Target</span><span class="v" style="color:${mode?.tone}">${esc(mode?.name || todayBand.mode)} ${fmtSet(todayBand.mode, target)}</span></span>
          </div>
          <div class="why">${why}</div>
        </div>

        <div class="intro">Today's forecast high picks a band. The alarm picks the temperature within it.</div>

        <div class="bands">${rows}</div>

        ${this._error ? `<div class="error">${esc(this._error)}</div>` : ""}
        <div class="footer" ${this._dirty || this._saving ? "" : "hidden"}>
          <span>Unsaved changes</span>
          <button class="ghost" data-action="cancel" ${this._saving ? "disabled" : ""}>Discard changes</button>
          <button class="primary" data-action="save" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving…" : "Save bands"}</button>
        </div>
      </ha-card>`;
  }

  _stepper(attrs, value, label, min, max) {
    return `<div class="stepper">
      <button ${attrs} data-delta="-1" ${value <= min ? "disabled" : ""} aria-label="${esc(label)} one degree lower">−</button>
      <input type="number" inputmode="numeric" min="${min}" max="${max}" ${attrs.replace(/data-action="[^"]*"/, "")} value="${value}" aria-label="${esc(label)}">
      <button ${attrs} data-delta="1" ${value >= max ? "disabled" : ""} aria-label="${esc(label)} one degree higher">+</button>
    </div>`;
  }

  _renderBand(b, i, isToday, occ) {
    const open = this._open === b.id;
    const mode = MODES[b.mode] || { name: b.mode, icon: "mdi:help", tone: "var(--secondary-text-color)" };
    const cells = OCCUPANCY.map(
      ([k, label]) =>
        `<span class="cell ${isToday && k === occ ? "live" : ""}" title="${esc(label)}"><span class="k">${esc(label)}</span><span class="v">${fmtSet(b.mode, b[k])}</span></span>`
    ).join("");
    const head = `
      <div class="row" data-action="toggle-open" data-id="${b.id}">
        <div class="range">${esc(this._range(this._draft, i))}${isToday ? `<span class="today">Today</span>` : ""}</div>
        <div class="mode" style="color:${mode.tone}"><ha-icon icon="${mode.icon}"></ha-icon>${esc(mode.name)}</div>
        <ha-icon class="chev" icon="${open ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
        <div class="cells">${cells}</div>
      </div>`;
    if (!open) return `<div class="band ${isToday ? "is-today" : ""}">${head}</div>`;

    const { min, max } = this._limits();
    const last = i === this._draft.length - 1;
    const lo = i > 0 ? this._draft[i - 1].max : null;
    const modeButtons = Object.entries(MODES)
      .map(
        ([k, m]) =>
          `<button class="seg ${b.mode === k ? "on" : ""}" data-action="mode" data-id="${b.id}" data-mode="${k}"><ha-icon icon="${m.icon}"></ha-icon>${m.name}</button>`
      )
      .join("");
    const setRows = OCCUPANCY.map(([k, label]) => {
      const v = b[k];
      const ctl =
        b.mode === "heat_cool"
          ? `<span class="pair"><span class="sub">Heat to</span>${this._stepper(`data-action="temp-step" data-field="temp" data-id="${b.id}" data-occ="${k}" data-part="0"`, v[0], `${label} low`, min, max)}
             <span class="sub">Cool to</span>${this._stepper(`data-action="temp-step" data-field="temp" data-id="${b.id}" data-occ="${k}" data-part="1"`, v[1], `${label} high`, min, max)}</span>`
          : this._stepper(`data-action="temp-step" data-field="temp" data-id="${b.id}" data-occ="${k}"`, v, label, min, max);
      return `<div class="set ${isToday && k === occ ? "live" : ""}"><span class="name">${esc(label)}</span>${ctl}</div>`;
    }).join("");

    return `<div class="band open ${isToday ? "is-today" : ""}">${head}
      <div class="edit">
        <div class="field"><span class="name">Forecast high</span>
          ${
            last
              ? `<span class="plain">${lo != null ? `${lo}° and up. The last band has no upper limit.` : "Every high"}</span>`
              : `<span class="plain">${lo != null ? `From ${lo}° up to` : "Below"}</span>
                 ${this._stepper(`data-action="max-step" data-field="max" data-id="${b.id}"`, b.max, "Upper limit", (lo ?? 0) + 1, 129)}
                 <span class="plain">° (not including)</span>`
          }
        </div>
        <div class="field"><span class="name">Mode</span><div class="segs">${modeButtons}</div></div>
        <div class="sets">${setRows}</div>
        <div class="actions">
          <button class="ghost" data-action="split" data-id="${b.id}" ${this._draft.length >= MAX_BANDS ? "disabled" : ""}><ha-icon icon="mdi:call-split"></ha-icon>Split this band</button>
          <button class="ghost danger" data-action="delete" data-id="${b.id}" ${this._draft.length <= 1 ? "disabled" : ""}><ha-icon icon="mdi:delete-outline"></ha-icon>Delete this band</button>
        </div>
        <small>Deleting a band gives its range to the next one. Nothing changes until you save.</small>
      </div>
    </div>`;
  }
}

const STYLE = `<style>
  ha-card { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
  button { font: inherit; cursor: pointer; }
  input {
    font: inherit; color: var(--primary-text-color);
    background: none; border: 1px solid var(--divider-color); border-radius: 6px; padding: 6px 8px;
  }
  code { font-family: var(--code-font-family, monospace); font-size: .9em; }
  small, .intro { color: var(--secondary-text-color); font-size: .9em; }
  .k { color: var(--secondary-text-color); font-size: .8em; }
  .v { font-family: var(--code-font-family, monospace); font-variant-numeric: tabular-nums; }
  .attn { color: var(--amber-color, #ffc107); }
  .now { display: flex; flex-direction: column; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--divider-color); }
  .now-line { display: flex; flex-wrap: wrap; gap: 8px 24px; }
  .fact { display: flex; flex-direction: column; gap: 2px; }
  .fact .v { font-size: 1.25em; font-weight: 600; }
  .why { font-size: .95em; }
  .bands { display: flex; flex-direction: column; }
  .band { border-top: 1px solid var(--divider-color); }
  .band:last-child { border-bottom: 1px solid var(--divider-color); }
  .band.is-today { box-shadow: inset 3px 0 0 var(--teal-color, #009688); }
  .row {
    display: grid; grid-template-columns: minmax(0, 1fr) auto 24px; grid-template-areas: "range mode chev" "cells cells cells";
    align-items: center; gap: 6px 12px; padding: 10px 4px 10px 12px; cursor: pointer;
  }
  .range { grid-area: range; font-family: var(--code-font-family, monospace); font-weight: 600; font-size: 1.05em; display: flex; align-items: center; gap: 8px; }
  .today { font-family: inherit; font-size: .75em; font-weight: 500; color: var(--teal-color, #009688); }
  .mode { grid-area: mode; display: flex; align-items: center; gap: 4px; font-size: .9em; }
  .mode ha-icon { --mdc-icon-size: 18px; }
  .chev { grid-area: chev; color: var(--secondary-text-color); }
  .cells { grid-area: cells; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 6px; }
  .cell { display: flex; flex-direction: column; min-width: 0; padding: 2px 0; }
  .cell .k { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cell.live .v, .set.live .name { color: var(--teal-color, #009688); font-weight: 600; }
  .edit { display: flex; flex-direction: column; gap: 12px; padding: 4px 4px 16px 12px; }
  .field { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .name { min-width: 104px; font-weight: 500; }
  .plain { color: var(--primary-text-color); }
  .segs { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--divider-color); border-radius: 6px; overflow: hidden; }
  .seg { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border: none; background: none; color: var(--primary-text-color); }
  .seg + .seg { border-left: 1px solid var(--divider-color); }
  .seg.on { background: var(--teal-color, #009688); color: var(--text-primary-color, #fff); }
  .seg ha-icon { --mdc-icon-size: 18px; }
  .sets { display: flex; flex-direction: column; gap: 8px; }
  .set { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .pair { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sub { color: var(--secondary-text-color); font-size: .85em; }
  .stepper { display: inline-flex; border: 1px solid var(--divider-color); border-radius: 6px; overflow: hidden; }
  .stepper button { min-width: 38px; height: 36px; border: none; background: none; color: var(--primary-text-color); font-size: 1.15em; }
  .stepper input {
    width: 52px; height: 36px; box-sizing: border-box; text-align: center; border: none; border-radius: 0;
    border-left: 1px solid var(--divider-color); border-right: 1px solid var(--divider-color);
    font-family: var(--code-font-family, monospace); -moz-appearance: textfield;
  }
  .stepper input::-webkit-outer-spin-button, .stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .ghost, .primary {
    display: inline-flex; align-items: center; gap: 6px; border-radius: 6px; padding: 8px 12px;
    border: 1px solid var(--divider-color); background: none; color: var(--primary-text-color);
  }
  .ghost ha-icon { --mdc-icon-size: 18px; }
  .danger { color: var(--red-color, #f44336); }
  .primary { background: var(--teal-color, #009688); color: var(--text-primary-color, #fff); border-color: var(--teal-color, #009688); font-weight: 600; }
  button:disabled { cursor: default; color: var(--secondary-text-color); }
  .error { color: var(--red-color, #f44336); font-size: .9em; }
  .footer {
    position: sticky; bottom: 0; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 10px;
    border-top: 1px solid var(--divider-color); background: var(--card-background-color, var(--ha-card-background));
  }
  .footer[hidden] { display: none; }
  .footer span { flex: 1; color: var(--secondary-text-color); }
  .empty { color: var(--secondary-text-color); padding: 8px 0; }
  @media (max-width: 520px) {
    .cells { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .name { min-width: 0; width: 100%; }
  }
</style>`;

customElements.define("hvac-bands-card", HvacBandsCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "hvac-bands-card",
  name: "HVAC bands",
  description: "Add, change and remove the forecast bands the HVAC Schedule automation uses.",
});
