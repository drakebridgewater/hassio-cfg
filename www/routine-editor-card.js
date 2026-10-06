/*
 * routine-editor-card
 *
 * Edits one of Ethan's routines (configs/routines.json, published as
 * pyscript.ethan_routines). Changes are kept as a draft until Save, which
 * calls pyscript.routines_save and input_datetime.set_datetime.
 *
 *   type: custom:routine-editor-card
 *   routine: bedtime
 *   note: Only runs on workdays   # optional, shown under the summary
 *
 * Steps are stored as minutes after the start time, so moving the start time
 * moves every alert. The editor shows and accepts clock times.
 *
 * Adding a step type: add an entry to STEP_TYPES (how it is labelled and
 * whether the message is editable), plus the hooks listed in
 * pyscript/routines.py.
 */

const ENTITY = "pyscript.ethan_routines";
const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MAX_OFFSET = 240;
const MAX_MESSAGE = 255;

const STEP_TYPES = {
  announce: { icon: "mdi:bullhorn-outline", text: (s) => s.message, editable: true },
  turn_off: { icon: "mdi:power", text: (s) => s.label || "Turn off devices", editable: false },
};

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || "0:0").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toHHMM = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const to12h = (min) => {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const daysLabel = (days) => {
  const set = new Set(days);
  if (set.size === 7) return "Every day";
  if (set.size === 5 && ["mon", "tue", "wed", "thu", "fri"].every((d) => set.has(d))) return "Weekdays";
  if (set.size === 2 && set.has("sat") && set.has("sun")) return "Weekends";
  return DAYS.filter((d) => set.has(d)).map((d) => d[0].toUpperCase() + d.slice(1)).join(", ");
};
const newId = () => `s-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

class RoutineEditorCard extends HTMLElement {
  setConfig(config) {
    if (!config.routine) throw new Error("Set `routine:` (e.g. morning or bedtime)");
    this._config = config;
    this._day = new Date().getDay();
    this._open = null;
    this._dirty = false;
    this._error = "";
    this._saving = false;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
      this.shadowRoot.addEventListener("change", (e) => this._onChange(e));
      this.shadowRoot.addEventListener("input", (e) => this._onInput(e));
    }
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    const cfg = this._routineCfg();
    const autoState = cfg && cfg.automation ? hass.states[cfg.automation]?.state : undefined;
    const key = JSON.stringify([cfg, cfg && hass.states[cfg.start_entity]?.state, autoState]);
    if (key === this._lastKey && !first) return;
    this._lastKey = key;
    // Someone else's save never overwrites a draft in progress.
    if (!this._dirty) this._loadDraft();
    this._render();
  }

  getCardSize() {
    return 6;
  }

  static getStubConfig() {
    return { routine: "bedtime" };
  }

  _routineCfg() {
    return this._hass?.states[ENTITY]?.attributes?.routines?.[this._config.routine];
  }

  _loadDraft() {
    const cfg = this._routineCfg();
    if (!cfg) {
      this._draft = null;
      return;
    }
    const start = this._hass.states[cfg.start_entity]?.state || "00:00:00";
    this._draft = {
      start: toMinutes(start),
      steps: JSON.parse(JSON.stringify(cfg.steps || [])),
    };
  }

  _sorted() {
    return this._draft.steps
      .map((s, i) => [s, i])
      .sort((a, b) => a[0].at - b[0].at || a[1] - b[1])
      .map(([s]) => s);
  }

  _stepsOn(dayIdx) {
    return this._sorted().filter((s) => s.enabled !== false && s.days.includes(DAYS[dayIdx]));
  }

  _find(id) {
    return this._draft.steps.find((s) => s.id === id);
  }

  // Minutes between this step and the one before it (or the start time).
  _gap(step) {
    const sorted = this._sorted();
    const idx = sorted.indexOf(step);
    return step.at - (idx > 0 ? sorted[idx - 1].at : 0);
  }

  // Sets a step's gap; it and every later step move together, keeping their spacing.
  _setGap(step, gap) {
    gap = Math.round(Number(gap));
    if (!Number.isFinite(gap) || gap < 0) return;
    const sorted = this._sorted();
    const idx = sorted.indexOf(step);
    const delta = gap - this._gap(step);
    if (!delta) return;
    const later = sorted.slice(idx);
    if (later.at(-1).at + delta > MAX_OFFSET) {
      this._error = `The last alert can be at most ${MAX_OFFSET / 60} hours after the start time.`;
      return;
    }
    later.forEach((s) => (s.at += delta));
    this._touch();
  }

  _touch() {
    this._dirty = true;
    this._error = "";
  }

  // ---------------------------------------------------------------- events

  _onClick(e) {
    const el = e.target.closest("[data-action]");
    if (!el) return;
    const { action, id } = el.dataset;
    const step = id ? this._find(id) : null;
    switch (action) {
      case "toggle-open":
        this._open = this._open === id ? null : id;
        break;
      case "day-view":
        this._day = Number(el.dataset.day);
        break;
      case "step-day": {
        const d = el.dataset.day;
        const has = step.days.includes(d);
        if (has && step.days.length === 1) {
          this._error = "An alert needs at least one day. Turn it off instead.";
          break;
        }
        step.days = has ? step.days.filter((x) => x !== d) : DAYS.filter((x) => x === d || step.days.includes(x));
        this._touch();
        break;
      }
      case "gap":
        this._setGap(step, Number(el.dataset.gap));
        break;
      case "gap-step":
        this._setGap(step, this._gap(step) + Number(el.dataset.delta));
        break;
      case "delete":
        this._draft.steps = this._draft.steps.filter((s) => s.id !== id);
        this._open = null;
        this._touch();
        break;
      case "add": {
        const last = this._sorted().at(-1);
        const at = Math.min(MAX_OFFSET, last ? last.at + 5 : 0);
        const fresh = { id: newId(), at, type: "announce", message: "", days: [...DAYS], enabled: true };
        this._draft.steps.push(fresh);
        this._open = fresh.id;
        this._touch();
        break;
      }
      case "play":
        this._play(step);
        return;
      case "cancel":
        this._dirty = false;
        this._error = "";
        this._open = null;
        this._loadDraft();
        break;
      case "save":
        this._save();
        return;
      case "routine-switch": {
        const cfg = this._routineCfg();
        const on = this._hass.states[cfg.automation]?.state === "on";
        this._hass.callService("automation", on ? "turn_off" : "turn_on", { entity_id: cfg.automation });
        return;
      }
      default:
        return;
    }
    this._render();
  }

  _onChange(e) {
    const el = e.target;
    const field = el.dataset?.field;
    if (!field) return;
    if (field === "start") {
      if (!el.value) return;
      this._draft.start = toMinutes(el.value);
      this._touch();
    } else if (field === "gap") {
      if (el.value === "") return;
      this._setGap(this._find(el.dataset.id), el.value);
    } else if (field === "enabled") {
      this._find(el.dataset.id).enabled = el.checked;
      this._touch();
    } else {
      return;
    }
    this._render();
  }

  _onInput(e) {
    const el = e.target;
    if (el.dataset?.field !== "message") return;
    this._find(el.dataset.id).message = el.value;
    this._dirty = true;
    // Typing must not re-render (it would steal focus); just refresh the footer.
    const counter = this.shadowRoot.querySelector(`[data-counter="${el.dataset.id}"]`);
    if (counter) counter.textContent = `${el.value.length}/${MAX_MESSAGE}`;
    const footer = this.shadowRoot.querySelector(".footer");
    if (footer) footer.hidden = false;
  }

  // --------------------------------------------------------------- service calls

  async _play(step) {
    if (!step) return;
    if (step.type === "announce" && !step.message.trim()) {
      this._error = "Type a message first.";
      this._render();
      return;
    }
    await this._hass.callService("script", "routine_step", { step });
  }

  async _save() {
    const blank = this._draft.steps.find((s) => s.type === "announce" && !s.message.trim());
    if (blank) {
      this._error = "Every alert needs a message (or delete the empty one).";
      this._open = blank.id;
      this._render();
      return;
    }
    const cfg = this._routineCfg();
    this._saving = true;
    this._render();
    try {
      const steps = this._draft.steps.map((s) => ({ ...s, message: s.message?.trim() ?? s.message }));
      const res = await this._hass.callWS({
        type: "call_service",
        domain: "pyscript",
        service: "routines_save",
        service_data: { routine: this._config.routine, steps },
        return_response: true,
      });
      const result = res?.response || {};
      if (!result.ok) throw new Error(result.error || "Save failed");
      const startNow = toMinutes(this._hass.states[cfg.start_entity]?.state);
      if (startNow !== this._draft.start) {
        await this._hass.callService("input_datetime", "set_datetime", {
          entity_id: cfg.start_entity,
          time: `${toHHMM(this._draft.start)}:00`,
        });
      }
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
    const cfg = this._routineCfg();
    if (!cfg || !this._draft) {
      this.shadowRoot.innerHTML = `${STYLE}<ha-card><div class="empty">
        Routine "${esc(this._config.routine)}" not found. Is pyscript running and
        <code>${ENTITY}</code> loaded?</div></ha-card>`;
      return;
    }
    const auto = cfg.automation ? this._hass.states[cfg.automation] : null;
    const autoOn = auto?.state === "on";
    const start = this._draft.start;
    const today = new Date().getDay();
    const dayName = this._day === today ? "Today" : this._day === (today + 1) % 7 ? "Tomorrow" : DAY_NAMES[this._day];
    const onDay = this._stepsOn(this._day);

    const summary = onDay.length
      ? `<div class="summary">
          <div class="bound"><span class="lbl">First alert</span><span class="big">${to12h(start + onDay[0].at)}</span></div>
          <div class="arrow"><ha-icon icon="mdi:arrow-right"></ha-icon><span>${onDay.length} alert${onDay.length > 1 ? "s" : ""} · ${onDay.at(-1).at - onDay[0].at} min</span></div>
          <div class="bound end"><span class="lbl">Last alert</span><span class="big">${to12h(start + onDay.at(-1).at)}</span></div>
        </div>`
      : `<div class="summary none">No alerts on ${esc(dayName === "Today" || dayName === "Tomorrow" ? dayName.toLowerCase() : dayName)}</div>`;

    const dayTabs = DAYS.map(
      (d, i) =>
        `<button class="daytab ${i === this._day ? "sel" : ""} ${i === today ? "today" : ""}" data-action="day-view" data-day="${i}" title="${DAY_NAMES[i]}">${DAY_LETTERS[i]}</button>`
    ).join("");

    const rows = this._sorted()
      .map((s) => this._renderStep(s, start))
      .join("");

    this.shadowRoot.innerHTML = `${STYLE}
      <ha-card>
        <div class="head">
          <ha-icon icon="${esc(cfg.icon || "mdi:calendar-clock")}"></ha-icon>
          <div class="title">${esc(this._config.title || cfg.name)}</div>
          ${
            auto
              ? `<button class="pill ${autoOn ? "on" : "off"}" data-action="routine-switch" title="Turn the whole routine on or off">
                   ${autoOn ? "On" : "Off"}</button>`
              : ""
          }
        </div>

        <label class="start">
          <span>Starts at</span>
          <input type="time" data-field="start" value="${toHHMM(start)}">
          <small>Moving this moves every alert.</small>
        </label>

        <div class="days-view">
          <span class="lbl">${esc(dayName)}</span>
          <div class="daytabs">${dayTabs}</div>
        </div>
        ${summary}
        ${this._config.note ? `<div class="note"><ha-icon icon="mdi:information-outline"></ha-icon>${esc(this._config.note)}</div>` : ""}

        <div class="steps">${rows || `<div class="empty">No alerts yet.</div>`}</div>

        <button class="add" data-action="add"><ha-icon icon="mdi:plus"></ha-icon>Add alert</button>

        ${this._error ? `<div class="error">${esc(this._error)}</div>` : ""}
        <div class="footer" ${this._dirty || this._saving ? "" : "hidden"}>
          <span>Unsaved changes</span>
          <button class="ghost" data-action="cancel" ${this._saving ? "disabled" : ""}>Cancel</button>
          <button class="primary" data-action="save" ${this._saving ? "disabled" : ""}>${this._saving ? "Saving…" : "Save"}</button>
        </div>
      </ha-card>`;
  }

  _renderGap(s, start) {
    const gap = this._gap(s);
    const first = this._sorted()[0] === s;
    const quick = [1, 5, 10]
      .map((g) => `<button class="qpick ${gap === g ? "on" : ""}" data-action="gap" data-id="${s.id}" data-gap="${g}">${g}</button>`)
      .join("");
    return `<div class="field col"><span>When</span>
      <div class="gap">
        <div class="quick">${quick}</div>
        <div class="stepper">
          <button data-action="gap-step" data-id="${s.id}" data-delta="-1" ${gap <= 0 ? "disabled" : ""} aria-label="One minute less">−</button>
          <input type="number" inputmode="numeric" min="0" max="${MAX_OFFSET}" data-field="gap" data-id="${s.id}" value="${gap}" aria-label="Minutes">
          <button data-action="gap-step" data-id="${s.id}" data-delta="1" aria-label="One minute more">+</button>
        </div>
      </div>
      <small>min after ${first ? "the start time" : "the previous alert"} · plays at <b>${to12h(start + s.at)}</b>. Later alerts move with it.</small>
    </div>`;
  }

  _renderStep(s, start) {
    const type = STEP_TYPES[s.type] || { icon: "mdi:help-circle-outline", text: () => s.type, editable: false };
    const open = this._open === s.id;
    const off = s.enabled === false;
    const notToday = !s.days.includes(DAYS[this._day]);
    const head = `
      <div class="row" data-action="toggle-open" data-id="${s.id}">
        <div class="when">
          <span class="clock">${to12h(start + s.at)}</span>
          <span class="offset">+${s.at} min</span>
        </div>
        <div class="what">
          <div class="msg">${type.editable ? "" : `<ha-icon icon="${type.icon}"></ha-icon>`}${esc(type.text(s)) || "<i>New alert</i>"}</div>
          <div class="meta">${off ? "Off · " : ""}${esc(daysLabel(s.days))}</div>
        </div>
        <ha-icon class="chev" icon="${open ? "mdi:chevron-up" : "mdi:chevron-down"}"></ha-icon>
      </div>`;
    if (!open) return `<div class="step ${off || notToday ? "dim" : ""}">${head}</div>`;

    const dayChips = DAYS.map(
      (d, i) =>
        `<button class="chip ${s.days.includes(d) ? "on" : ""}" data-action="step-day" data-id="${s.id}" data-day="${d}" title="${DAY_NAMES[i]}">${DAY_LETTERS[i]}</button>`
    ).join("");

    return `<div class="step open ${off ? "dim" : ""}">${head}
      <div class="edit">
        ${this._renderGap(s, start)}
        ${
          type.editable
            ? `<label class="field col"><span>Say</span>
                 <textarea data-field="message" data-id="${s.id}" maxlength="${MAX_MESSAGE}" rows="3" placeholder="What should the speakers say?">${esc(s.message)}</textarea>
                 <small>Type <code>{time}</code> to say the current time · <span data-counter="${s.id}">${(s.message || "").length}/${MAX_MESSAGE}</span></small>
               </label>`
            : `<div class="field"><span>Does</span><div>${esc(type.text(s))}</div></div>`
        }
        <div class="field"><span>Days</span><div class="chips">${dayChips}</div></div>
        <label class="field"><span>On</span><input type="checkbox" data-field="enabled" data-id="${s.id}" ${off ? "" : "checked"}></label>
        <div class="actions">
          <button class="ghost" data-action="play" data-id="${s.id}"><ha-icon icon="mdi:play"></ha-icon>Play now</button>
          <button class="ghost danger" data-action="delete" data-id="${s.id}"><ha-icon icon="mdi:delete-outline"></ha-icon>Delete</button>
        </div>
      </div>
    </div>`;
  }
}

const STYLE = `<style>
  ha-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
  button { font: inherit; cursor: pointer; }
  input, textarea {
    font: inherit; color: var(--primary-text-color);
    background: var(--secondary-background-color, rgba(127,127,127,.1));
    border: 1px solid var(--divider-color); border-radius: 8px; padding: 6px 8px;
  }
  textarea { width: 100%; box-sizing: border-box; resize: vertical; }
  code { font-size: .9em; }
  .head { display: flex; align-items: center; gap: 10px; }
  .title { flex: 1; font-size: 1.25em; font-weight: 600; }
  .pill { border: none; border-radius: 999px; padding: 4px 14px; font-weight: 600; }
  .pill.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .pill.off { background: var(--disabled-color, #888); color: #fff; }
  .start { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .start span { font-weight: 500; }
  .start small, small { color: var(--secondary-text-color); }
  .lbl { color: var(--secondary-text-color); font-size: .85em; text-transform: uppercase; letter-spacing: .04em; }
  .days-view { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .daytabs { display: flex; gap: 4px; }
  .daytab, .chip {
    width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--divider-color);
    background: none; color: var(--primary-text-color); padding: 0;
  }
  .daytab.today { border-color: var(--primary-color); }
  .daytab.sel, .chip.on { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
  .summary {
    display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 12px;
    background: var(--secondary-background-color, rgba(127,127,127,.1));
  }
  .summary.none { justify-content: center; color: var(--secondary-text-color); }
  .bound { display: flex; flex-direction: column; }
  .bound.end { text-align: right; }
  .big { font-size: 1.4em; font-weight: 600; font-variant-numeric: tabular-nums; }
  .arrow { flex: 1; display: flex; flex-direction: column; align-items: center; color: var(--secondary-text-color); font-size: .8em; }
  .note { display: flex; gap: 6px; align-items: center; color: var(--secondary-text-color); font-size: .9em; }
  .note ha-icon { --mdc-icon-size: 18px; }
  .steps { display: flex; flex-direction: column; }
  .step { border-top: 1px solid var(--divider-color); }
  .step.dim .row { opacity: .45; }
  .row { display: flex; align-items: center; gap: 12px; padding: 10px 0; cursor: pointer; }
  .when { display: flex; flex-direction: column; min-width: 72px; }
  .clock { font-weight: 600; font-variant-numeric: tabular-nums; }
  .offset { font-size: .8em; color: var(--secondary-text-color); }
  .what { flex: 1; min-width: 0; }
  .msg { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .msg ha-icon { --mdc-icon-size: 18px; margin-right: 4px; vertical-align: -3px; }
  .meta { font-size: .8em; color: var(--secondary-text-color); }
  .chev { color: var(--secondary-text-color); }
  .edit { display: flex; flex-direction: column; gap: 10px; padding: 0 0 14px; }
  .field { display: flex; align-items: center; gap: 10px; }
  .field.col { flex-direction: column; align-items: stretch; gap: 4px; }
  .field > span { min-width: 44px; font-weight: 500; }
  .chips { display: flex; gap: 4px; flex-wrap: wrap; }
  .gap { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .quick, .stepper { display: inline-flex; border: 1px solid var(--divider-color); border-radius: 8px; overflow: hidden; }
  .quick button, .stepper button {
    min-width: 40px; height: 36px; border: none; background: none; color: var(--primary-text-color); font-weight: 500;
  }
  .quick button + button { border-left: 1px solid var(--divider-color); }
  .quick button.on { background: var(--primary-color); color: var(--text-primary-color, #fff); }
  .stepper button { font-size: 1.2em; }
  .stepper input {
    width: 52px; height: 36px; box-sizing: border-box; text-align: center; border: none; border-radius: 0;
    border-left: 1px solid var(--divider-color); border-right: 1px solid var(--divider-color);
    -moz-appearance: textfield;
  }
  .stepper input::-webkit-outer-spin-button, .stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .ghost, .add, .primary {
    display: inline-flex; align-items: center; gap: 6px; border-radius: 8px; padding: 8px 12px;
    border: 1px solid var(--divider-color); background: none; color: var(--primary-text-color);
  }
  .ghost ha-icon, .add ha-icon { --mdc-icon-size: 18px; }
  .danger { color: var(--error-color, #db4437); }
  .add { justify-content: center; border-style: dashed; color: var(--primary-color); }
  .primary { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); font-weight: 600; }
  button:disabled { opacity: .6; cursor: default; }
  .error { color: var(--error-color, #db4437); font-size: .9em; }
  .footer {
    position: sticky; bottom: 0; display: flex; align-items: center; gap: 8px; padding-top: 10px;
    border-top: 1px solid var(--divider-color); background: var(--card-background-color, var(--ha-card-background));
  }
  .footer[hidden] { display: none; }
  .footer span { flex: 1; color: var(--secondary-text-color); }
  .empty { color: var(--secondary-text-color); padding: 8px 0; }
</style>`;

customElements.define("routine-editor-card", RoutineEditorCard);
window.customCards = window.customCards || [];
window.customCards.push({
  type: "routine-editor-card",
  name: "Routine Editor",
  description: "Add, move and remove the timed announcements of Ethan's routines.",
});
