/*
 * scene-rooms
 *
 * Scene Presets by room (pyscript/scene_rooms.py). Two jobs:
 *
 * 1. scene-rooms-card: a room's favourite scenes on its room page. Tapping one
 *    calls pyscript.scene_room_apply, which pauses the room's motion lighting
 *    until the alarm next changes. "Edit scenes" opens the Scene Presets panel
 *    for the room. While any of the room's colour lights is on, a brightness
 *    slider sets them all to one brightness (pyscript.scene_room_brightness)
 *    when you let go.
 *
 *      type: custom:scene-rooms-card
 *      room: family_room          # key in ROOMS in pyscript/scene_rooms.py
 *      note: Optional line after the status, e.g. which rooms share it
 *
 * 2. The panel link /scene_presets?room=<room>. The panel keeps its targets and
 *    favourites in localStorage and reads them once, when it opens. Before the
 *    router opens it, this module swaps in the room's colour lights and
 *    favourites (keeping your own panel state aside), and while the room is in
 *    the address it saves every star you toggle to the room through
 *    pyscript.scene_room_set_favorites. Opening the panel without ?room= puts
 *    your own targets and favourites back.
 *
 * Loaded twice over, under two URLs: as a Lovelace resource
 * (dashboards/lovelace_resources.yaml, ?v=N) and by frontend.extra_module_url
 * in configuration.yaml (?v=N&panel), which also reaches the panel (not a
 * dashboard). Not one URL: a browser keeps a failed module load for the life
 * of the page, so a single dropped download (the phone app reopening) left the
 * card "Custom element doesn't exist" until the app reloaded. Both copies run;
 * the guards below keep the second one from wrapping or defining anything
 * again. After editing, bump ?v= in both and restart HA: /local is cached for
 * 31 days.
 */

const PANEL_PATH = "/scene_presets";
const KEY_TARGETS = "scene_presets_apply_page_targets";
const KEY_FAVORITES = "scene_presets_apply_page_favorite_presets";
const KEY_OWN = "scene_rooms_own_panel_state";
const KEY_CACHE = "scene_rooms_cache_";
const ENTITY_PREFIX = "pyscript.scene_room_";
const IMG_BASE = "/assets/scene_presets/";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const getHass = () => document.querySelector("home-assistant")?.hass;

/* ---- Panel link ------------------------------------------------------- */

// Loaded both as a dashboard resource and as an extra module; keep the real setItem
// when the second copy runs after the first one wrapped it.
const rawSet = window.__sceneRoomsRawSet || (window.__sceneRoomsRawSet = Storage.prototype.setItem);
const store = {
  get(key) {
    try {
      const v = window.localStorage.getItem(key);
      return v == null ? null : JSON.parse(v);
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      rawSet.call(window.localStorage, key, JSON.stringify(value));
    } catch (e) {
      /* private mode or full: the panel falls back to its own state */
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      /* ignore */
    }
  },
};

// undefined: not the panel. null: the panel, no room. Otherwise the room key.
const panelRoom = (url) => {
  let u;
  try {
    u = new URL(url, window.location.origin);
  } catch (e) {
    return undefined;
  }
  if (u.pathname.replace(/\/$/, "") !== PANEL_PATH) return undefined;
  return u.searchParams.get("room") || null;
};

// The room's lights and favourites: live from HA, else what the card last saw
// (on a cold load of the link the connection may not be up yet).
const roomData = (room) => {
  const st = getHass()?.states?.[ENTITY_PREFIX + room];
  if (st) {
    const data = { lights: st.attributes.lights || [], favorites: (st.attributes.favorites || []).map((f) => f.id) };
    store.set(KEY_CACHE + room, data);
    return data;
  }
  return store.get(KEY_CACHE + room);
};

const preparePanel = (url) => {
  const room = panelRoom(url);
  if (room === undefined) return;
  if (room) {
    const data = roomData(room);
    if (!data || !data.lights.length) return;
    if (store.get(KEY_OWN) == null) {
      store.set(KEY_OWN, { targets: store.get(KEY_TARGETS), favorites: store.get(KEY_FAVORITES) });
    }
    store.set(KEY_TARGETS, { entity_id: data.lights });
    store.set(KEY_FAVORITES, data.favorites);
  } else {
    const own = store.get(KEY_OWN);
    if (own == null) return;
    if (own.targets == null) store.remove(KEY_TARGETS);
    else store.set(KEY_TARGETS, own.targets);
    if (own.favorites == null) store.remove(KEY_FAVORITES);
    else store.set(KEY_FAVORITES, own.favorites);
    store.remove(KEY_OWN);
  }
};

if (!window.__sceneRoomsHistory) {
  window.__sceneRoomsHistory = true;

  // The panel writes favourites with localStorage.setItem; with a room in the
  // address, send them to the room too.
  Storage.prototype.setItem = function (key, value) {
    rawSet.call(this, key, value);
    if (this !== window.localStorage || key !== KEY_FAVORITES) return;
    const room = panelRoom(window.location.href);
    if (!room) return;
    let ids;
    try {
      ids = JSON.parse(value);
    } catch (e) {
      return;
    }
    getHass()
      ?.callService("pyscript", "scene_room_set_favorites", { room, preset_ids: ids })
      .catch((err) => console.warn("scene-rooms: could not save favourites", err));
  };

  for (const method of ["pushState", "replaceState"]) {
    const orig = history[method];
    history[method] = function (state, title, url) {
      if (url != null) preparePanel(String(url));
      return orig.apply(this, arguments);
    };
  }
  window.addEventListener("popstate", () => preparePanel(window.location.href));
  preparePanel(window.location.href);
}

const navigate = (path) => {
  history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
};

/* ---- Card ------------------------------------------------------------- */

class SceneRoomsCard extends HTMLElement {
  setConfig(config) {
    if (!config.room) throw new Error("Set `room:` (e.g. family_room)");
    this._config = config;
    this._busy = null;
    this._sig = null;
    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
      this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
      this.shadowRoot.addEventListener("input", (e) => this._onSlide(e, false));
      this.shadowRoot.addEventListener("change", (e) => this._onSlide(e, true));
    }
  }

  set hass(hass) {
    this._hass = hass;
    const st = hass.states[ENTITY_PREFIX + this._config.room];
    // Redraw when the room's lights change too (the brightness slider follows
    // them), but never while the slider is being dragged.
    const lights = (st?.attributes.lights || [])
      .map((e) => `${hass.states[e]?.state}:${hass.states[e]?.attributes.brightness ?? ""}`)
      .join(",");
    const sig = st ? `${st.last_updated}|${this._busy}|${lights}` : `missing|${this._busy}`;
    if (sig === this._sig || this._sliding) return;
    this._sig = sig;
    if (st) {
      store.set(KEY_CACHE + this._config.room, {
        lights: st.attributes.lights || [],
        favorites: (st.attributes.favorites || []).map((f) => f.id),
      });
    }
    this._render(st);
  }

  getCardSize() {
    return 3;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _onClick(e) {
    const el = e.target.closest("[data-act]");
    if (!el) return;
    if (el.dataset.act === "edit") {
      navigate(`${PANEL_PATH}?room=${encodeURIComponent(this._config.room)}`);
      return;
    }
    if (el.dataset.act === "apply" && !this._busy) {
      this._busy = el.dataset.id;
      this._sig = null;
      this.hass = this._hass;
      this._hass
        .callService("pyscript", "scene_room_apply", { room: this._config.room, preset_id: el.dataset.id })
        .catch((err) => console.warn("scene-rooms: could not apply", err))
        .finally(() => {
          this._busy = null;
          this._sig = null;
          this.hass = this._hass;
        });
    }
  }

  _onSlide(e, done) {
    const input = e.target.closest?.('input[data-act="bri"]');
    if (!input) return;
    const pct = Number(input.value);
    input.parentElement.querySelector(".v").textContent = `${pct}%`;
    this._sliding = !done;
    if (!done) return;
    this._hass
      .callService("pyscript", "scene_room_brightness", { room: this._config.room, brightness_pct: pct })
      .catch((err) => console.warn("scene-rooms: could not set brightness", err));
  }

  // Average brightness (1-100) of the room's colour lights that are on, or null.
  _brightness(st) {
    const on = (st.attributes.lights || [])
      .map((e) => this._hass.states[e])
      .filter((s) => s && s.state === "on");
    if (!on.length) return null;
    const avg = on.reduce((sum, s) => sum + (s.attributes.brightness ?? 255), 0) / on.length;
    return Math.max(1, Math.round(avg / 2.55));
  }

  _render(st) {
    const root = this.shadowRoot;
    if (!st) {
      root.innerHTML = `${STYLE}<ha-card><div class="head"><div class="t">Scenes</div>
        <div class="s">The house has no scene list for this room (${esc(this._config.room)}).</div></div></ha-card>`;
      return;
    }
    const a = st.attributes;
    const favorites = a.favorites || [];
    const activeId = a.active_id;
    const bri = this._brightness(st);
    const say = activeId
      ? `${esc(st.state)} is on. Motion lighting is paused until the alarm next changes.`
      : favorites.length
        ? "Pick a scene to pause motion lighting until the alarm next changes."
        : "No favourites yet. Edit scenes to star some for this room.";
    // Full width under the lighting mode card: picture tiles in a row that wraps.
    const buttons = favorites
      .map((f) => {
        const on = f.id === activeId;
        const busy = f.id === this._busy;
        const img = f.img ? `<img src="${IMG_BASE}${esc(f.img)}" alt="" loading="lazy">` : "";
        return `<button class="tile${on ? " on" : ""}${busy ? " busy" : ""}" data-act="apply" data-id="${esc(f.id)}"
          title="${esc(f.name)}"><span class="pic">${img}</span><span class="n">${esc(f.name)}</span></button>`;
      })
      .join("");
    root.innerHTML = `${STYLE}<ha-card>
      <div class="head"><div class="t">Scenes</div>
        <div class="s">${activeId ? '<span class="dot"></span>' : ""}${say}${
          this._config.note ? ` ${esc(this._config.note)}` : ""}</div></div>
      <div class="row">${buttons}
        <button class="tile edit" data-act="edit" title="Edit scenes for this room">
          <span class="pic"><ha-icon icon="mdi:palette-swatch-outline"></ha-icon></span><span class="n">Edit scenes</span></button>
      </div>
      ${bri == null ? "" : `<label class="bri"><ha-icon icon="mdi:brightness-6"></ha-icon>
        <input type="range" min="1" max="100" step="1" value="${bri}" data-act="bri" aria-label="Brightness">
        <span class="v">${bri}%</span></label>`}
    </ha-card>`;
  }
}

const STYLE = `<style>
  /* Square corners: a rounded card clips the heading's first letter. */
  ha-card { padding: 4px 0; background: none; box-shadow: none; border: none; border-radius: 0; }
  .head { margin-bottom: 8px; line-height: normal; }
  .t { font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
  .s { font-size: 13px; color: var(--secondary-text-color); }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px;
         background: var(--orange-color); vertical-align: 1px; }
  .row { display: flex; flex-wrap: wrap; gap: 12px; }
  .tile { all: unset; box-sizing: border-box; cursor: pointer; width: 96px; display: flex; flex-direction: column;
          gap: 6px; -webkit-tap-highlight-color: transparent; }
  .pic { width: 96px; height: 96px; border-radius: 12px; overflow: hidden; display: grid; place-items: center;
         background: color-mix(in srgb, var(--primary-text-color) 6%, transparent); }
  .pic img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .n { font-size: 13px; color: var(--primary-text-color); text-align: center; line-height: 1.25;
       overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tile.on .pic { outline: 2px solid var(--orange-color); outline-offset: 2px; }
  .tile.on .n { font-weight: 500; }
  .tile.busy .pic { opacity: 0.55; }
  .tile:focus-visible .pic { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .edit ha-icon { --mdc-icon-size: 28px; color: var(--secondary-text-color); }
  .edit .n { color: var(--secondary-text-color); }
  .bri { display: flex; align-items: center; gap: 10px; margin-top: 12px; max-width: 520px; }
  .bri ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); flex: none; }
  .bri input { flex: 1; min-width: 0; height: 24px; margin: 0; accent-color: var(--primary-color); cursor: pointer; }
  .bri .v { flex: none; width: 40px; text-align: right; font-size: 13px; color: var(--secondary-text-color);
            font-variant-numeric: tabular-nums; }
</style>`;

if (!customElements.get("scene-rooms-card")) {
  customElements.define("scene-rooms-card", SceneRoomsCard);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "scene-rooms-card",
    name: "Scene rooms",
    description: "A room's favourite Scene Presets, and a link to edit them.",
  });
}
