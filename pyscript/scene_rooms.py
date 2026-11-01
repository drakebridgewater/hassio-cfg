"""Scene Presets by room: favourites, room targeting and the motion pause.

configs/scene_rooms.json is the source of truth for each room's favourite
presets and for which scene is active (and which blockers it turned on). This
module publishes one entity per room, pyscript.scene_room_<room>, which the
scene-rooms card (www/scene-rooms.js) reads:

  state            name of the active preset, or "none"
  favorites        [{id, name, img}] in the order they were starred
  lights           the room's lights that take colour (what a preset targets)
  active_id        id of the active preset
  paused_blockers  blockers this module turned on for the active scene

Rooms: the main space (kitchen, dining room, living room and entryway, as one)
and the entertainment center (its TV lights) are separate rooms; the others are
one HA area each. Targets: a room's lights, narrowed to those that support colour
(xy/hs/rgb). Wall switches and white-only bulbs are left alone; Scene Presets
would otherwise turn them on at a colour temperature or plain brightness.
Status LEDs (voice satellites, tag readers) are skipped: see EXCLUDE.

WLED strips: Home Assistant sees a strip as one light, so a preset would give
all its LEDs one colour while its effect kept running. After any preset call
that reaches a WLED light, this module writes three of the preset's colours
into the strip's colour slots with the "Color Gradient" palette, through
WLED's JSON API. The strip keeps its effect, so it moves in the scene's
colours; a strip on Solid switches to WLED_DEFAULT_EFFECT so it moves too.

Brightness: pyscript.scene_room_brightness (the card's slider) sets the room's
colour lights that are on to one brightness, keeping their colours.

Pause: any scene_presets.apply_preset / start_dynamic_scene call (the room
card, the Scene Presets panel, voice) that reaches a room's lights turns on
that room's lighting blockers, the same ones the room page's Manual button
and the wall switch hold use, so LED 4 turns orange. The next change of
alarm_control_panel.default turns off the blockers this module turned on,
stops any dynamic scene in the room and clears the active scene. Pressing
Automatic on the room page also clears it.
"""
import json
import os

import aiohttp
from homeassistant.helpers import entity_registry
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util.color import color_xy_to_RGB
from custom_components.scene_presets.file_utils import PRESET_DATA
from custom_components.scene_presets.util import ensure_list, resolve_targets

DATA_FILE = "/config/configs/scene_rooms.json"
ENTITY_PREFIX = "pyscript.scene_room_"
ALARM = "alarm_control_panel.default"
COLOR_MODES = {"xy", "hs", "rgb", "rgbw", "rgbww"}

WLED_PALETTE = "* Color Gradient"  # blends the segment's three colour slots
WLED_DEFAULT_EFFECT = "Aurora"  # for a strip that was on Solid
WLED_SOLID = 0
WLED_DELAY = 1.5  # seconds: let Scene Presets' own light.turn_on land first

# The kitchen, living room, dining room and entryway share the main area's motion
# automations, so they are one scene room that pauses all four (as the cube's Main).
MAIN_AREA = [
    "input_boolean.lighting_automation_blocker_main_area",
    "input_boolean.lighting_automation_blocker_kitchen",
    "input_boolean.lighting_automation_blocker_living_room",
    "input_boolean.lighting_automation_blocker_dining_room",
]

# The entertainment center: the TV lights group, which the Apple TV automation
# drives on its own. Its blocker pauses that automation (its by-pass switch).
ENTERTAINMENT = [
    "light.entertainment_center_backdrop",
    "light.living_room_tv_left_lamp",
    "light.living_room_tv_right_lamp",
    "light.yeelight_theater_left",
]

# Room keys are what the room pages' cards (cards/scenes/) and the ?room= link to
# the panel use. A room is its areas' lights, or an explicit `lights` list;
# `exclude` takes lights out (they belong to another room).
ROOMS = {
    "main": {
        "name": "Main space",
        "areas": ["kitchen", "dinning_room", "living_room", "entryway"],
        "exclude": ENTERTAINMENT,
        "blockers": MAIN_AREA,
    },
    "entertainment": {
        "name": "Entertainment center",
        "lights": ENTERTAINMENT,
        "blockers": ["input_boolean.lighting_automation_blocker_entertainment_center"],
    },
    "master_bedroom": {
        "name": "Master bedroom",
        "areas": ["master_bedroom"],
        "blockers": ["input_boolean.lighting_automation_blocker_master_bedroom"],
    },
    "family_room": {
        "name": "Family room",
        "areas": ["family_room"],
        "blockers": ["input_boolean.lighting_automation_blocker_family_room"],
    },
    "office": {
        "name": "Office",
        "areas": ["office"],
        "blockers": ["input_boolean.lighting_automation_blocker_office_room"],
    },
    "ethan": {
        "name": "Ethan's room",
        "areas": ["ethan_s_bedroom"],
        "blockers": ["input_boolean.lighting_automation_blocker_ethan_s_room"],
    },
    # Outdoors has no colour lights yet; add it here (blockers: []) when it does.
}

ALL_BLOCKERS = sorted({b for cfg in ROOMS.values() for b in cfg["blockers"]})

# Colour lights that are really status indicators. Config/diagnostic and hidden
# entities are skipped already; list the rest here.
EXCLUDE = {
    "light.home_assistant_voice_0941b8_led_ring",
    "light.tagreader_led",
    "light.tagreader_led_2",
    "light.m5stack_atom_echo_23b0d0_m5stack_atom_echo_23b0d0",
    "light.apollo_air_1_f8b340_rgb_light",
}


@pyscript_compile
def _read_file():
    if not os.path.exists(DATA_FILE):
        return {"rooms": {}}
    with open(DATA_FILE, "r") as file:
        return json.load(file)


@pyscript_compile
def _write_file(data):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w") as file:
        json.dump(data, file, indent=2)
        file.write("\n")
    os.replace(tmp, DATA_FILE)


@pyscript_compile
def _presets():
    return {p["id"]: p for p in PRESET_DATA.get("presets", [])}


@pyscript_compile
def _supports_colour(entity_id, entry, live):
    if entity_id in EXCLUDE:
        return False
    if entry is not None and (entry.entity_category or entry.hidden_by or entry.disabled_by):
        return False
    modes = None
    if live is not None:
        modes = live.attributes.get("supported_color_modes")
    if not modes and entry is not None and entry.capabilities:
        modes = entry.capabilities.get("supported_color_modes")
    return bool(COLOR_MODES & set(modes or []))


@pyscript_compile
async def _wled_get(session, host):
    async with session.get(f"http://{host}/json", timeout=aiohttp.ClientTimeout(total=5)) as resp:
        resp.raise_for_status()
        return await resp.json()


@pyscript_compile
async def _wled_post(session, host, body):
    async with session.post(f"http://{host}/json/state", json=body, timeout=aiohttp.ClientTimeout(total=5)) as resp:
        resp.raise_for_status()


@pyscript_compile
def _gradient(preset):
    """Three of the preset's colours (first, middle, last) as RGB."""
    xys = [(light["x"], light["y"]) for light in preset.get("lights", [])]
    if not xys:
        return None
    picks = [xys[0], xys[len(xys) // 2], xys[-1]]
    return [list(color_xy_to_RGB(x, y)) for x, y in picks]


def _wled_hosts(lights):
    """WLED lights among `lights`, with the address of their controller."""
    ent_reg = entity_registry.async_get(hass)
    hosts = {}
    for entity_id in lights:
        entry = ent_reg.async_get(entity_id)
        if entry is None or entry.platform != "wled":
            continue
        config_entry = hass.config_entries.async_get_entry(entry.config_entry_id)
        if config_entry and config_entry.data.get("host"):
            hosts[entity_id] = config_entry.data["host"]
    return hosts


def _paint_wled(lights, preset_id):
    hosts = _wled_hosts(lights)
    preset = _presets().get(preset_id)
    colours = _gradient(preset) if preset else None
    if not hosts or not colours:
        return
    task.sleep(WLED_DELAY)
    session = async_get_clientsession(hass)
    for entity_id, host in hosts.items():
        try:
            data = _wled_get(session, host)
            palette = data["palettes"].index(WLED_PALETTE)
            effect = data["effects"].index(WLED_DEFAULT_EFFECT)
            segments = []
            for seg in data["state"]["seg"]:
                change = {"id": seg["id"], "col": colours, "pal": palette}
                if seg.get("fx", WLED_SOLID) == WLED_SOLID:
                    change["fx"] = effect
                segments.append(change)
            _wled_post(session, host, {"seg": segments})
        except Exception as err:
            log.warning(f"scene_rooms: could not paint {preset.get('name')} on {entity_id} ({host}): {err}")


def _room_members(room):
    """Every light in the room (any kind), groups expanded as Scene Presets does."""
    cfg = ROOMS[room]
    members = set(resolve_targets(hass, cfg.get("lights", []), [], cfg.get("areas", []), [], []))
    return members - set(resolve_targets(hass, cfg.get("exclude", []), [], [], [], []))


def _room_lights(room):
    """The room's lights that take colour: what a preset targets."""
    ent_reg = entity_registry.async_get(hass)
    keep = [e for e in _room_members(room) if _supports_colour(e, ent_reg.async_get(e), hass.states.get(e))]
    return sorted(keep)


def _room_data(data, room):
    rooms = data.setdefault("rooms", {})
    entry = rooms.setdefault(room, {})
    entry.setdefault("favorites", [])
    entry.setdefault("active_id", None)
    entry.setdefault("paused_blockers", [])
    return entry


def _publish(data, room):
    entry = _room_data(data, room)
    presets = _presets()
    favorites = []
    for preset_id in entry["favorites"]:
        preset = presets.get(preset_id)
        if preset:
            favorites.append({"id": preset_id, "name": preset.get("name"), "img": preset.get("img")})
    active = presets.get(entry["active_id"]) if entry["active_id"] else None
    state.set(
        ENTITY_PREFIX + room,
        active.get("name") if active else "none",
        new_attributes={
            "friendly_name": f"{ROOMS[room]['name']} scene",
            "icon": "mdi:palette-outline",
            "room": room,
            "room_name": ROOMS[room]["name"],
            "favorites": favorites,
            "lights": _room_lights(room),
            "active_id": entry["active_id"],
            "paused_blockers": entry["paused_blockers"],
        },
    )


def _publish_all(data):
    for room in ROOMS:
        _publish(data, room)


@time_trigger("startup")
def scene_rooms_startup():
    scene_rooms_reload()


@service
def scene_rooms_reload():
    """yaml
name: Reload scene rooms
description: Re-reads configs/scene_rooms.json and each room's colour lights into pyscript.scene_room_*.
"""
    for entity_id in state.names(domain="pyscript"):
        if entity_id.startswith(ENTITY_PREFIX) and entity_id[len(ENTITY_PREFIX):] not in ROOMS:
            state.delete(entity_id)
    _publish_all(task.executor(_read_file))


@service
def scene_room_apply(room=None, preset_id=None):
    """yaml
name: Apply a scene to a room
description: Applies a Scene Presets preset to the room's colour lights and pauses the room's motion lighting until the alarm next changes.
fields:
  room:
    description: Room key, e.g. family_room.
    required: true
    example: family_room
  preset_id:
    description: Scene Presets preset id.
    required: true
    example: e03267e7-9914-4f47-97fe-63c0bd317fe7
"""
    if room not in ROOMS:
        log.error(f"scene_rooms: unknown room '{room}'")
        return
    lights = _room_lights(room)
    if not lights:
        log.warning(f"scene_rooms: {room} has no colour lights")
        return
    # Room bookkeeping happens in scene_presets_called, like any other caller.
    scene_presets.apply_preset(preset_id=preset_id, targets={"entity_id": lights})


@service
def scene_room_brightness(room=None, brightness_pct=None):
    """yaml
name: Set a room's scene brightness
description: Sets every colour light in the room that is on to the same brightness, keeping their colours. Lights that are off stay off.
fields:
  room:
    description: Room key, e.g. family_room.
    required: true
    example: family_room
  brightness_pct:
    description: Brightness, 1 to 100.
    required: true
    example: 60
    selector:
      number:
        min: 1
        max: 100
        unit_of_measurement: "%"
"""
    if room not in ROOMS:
        log.error(f"scene_rooms: unknown room '{room}'")
        return
    pct = max(1, min(100, int(float(brightness_pct))))
    on = [e for e in _room_lights(room) if state.get(e) == "on"]
    if on:
        light.turn_on(entity_id=on, brightness_pct=pct, transition=1)


@service(supports_response="optional")
def scene_room_set_favorites(room=None, preset_ids=None):
    """yaml
name: Set a room's favourite scenes
description: Replaces the room's favourite presets. Used by the Scene Presets panel when it is opened for a room.
fields:
  room:
    description: Room key, e.g. family_room.
    required: true
    example: family_room
  preset_ids:
    description: Preset ids in display order.
    required: true
    selector:
      object:
"""
    if room not in ROOMS:
        return {"ok": False, "error": f"Unknown room '{room}'"}
    presets = _presets()
    ids = [p for p in ensure_list(preset_ids) if p in presets]
    # Keep the first occurrence of each id.
    ids = [p for i, p in enumerate(ids) if p not in ids[:i]]
    data = task.executor(_read_file)
    _room_data(data, room)["favorites"] = ids
    task.executor(_write_file, data)
    _publish(data, room)
    return {"ok": True, "favorites": ids}


@event_trigger("call_service", "domain == 'scene_presets' and service in ('apply_preset', 'start_dynamic_scene')")
def scene_presets_called(service=None, service_data=None, **kwargs):
    targets = (service_data or {}).get("targets") or {}
    lights = resolve_targets(
        hass,
        ensure_list(targets.get("entity_id")),
        ensure_list(targets.get("device_id")),
        ensure_list(targets.get("area_id")),
        ensure_list(targets.get("floor_id")),
        ensure_list(targets.get("label_id")),
    )
    hit = [room for room in ROOMS if set(lights) & _room_members(room)]
    if hit:
        _pause_rooms(hit, service_data.get("preset_id"))
    _paint_wled(lights, service_data.get("preset_id"))


def _pause_rooms(hit, preset_id):
    data = task.executor(_read_file)
    for room in hit:
        entry = _room_data(data, room)
        turn_on = [b for b in ROOMS[room]["blockers"] if state.get(b) == "off"]
        if turn_on:
            input_boolean.turn_on(entity_id=turn_on)
        entry["active_id"] = preset_id
        entry["paused_blockers"] = sorted(set(entry["paused_blockers"]) | set(turn_on))
    task.executor(_write_file, data)
    for room in hit:
        _publish(data, room)
    log.info(f"scene_rooms: {preset_id} in {', '.join(hit)}; motion lighting paused")


@state_trigger(ALARM)
def scene_rooms_alarm_changed(value=None, old_value=None):
    if value == old_value or "unavailable" in (value, old_value) or "unknown" in (value, old_value):
        return
    data = task.executor(_read_file)
    released = []
    for room in ROOMS:
        entry = _room_data(data, room)
        if not entry["active_id"] and not entry["paused_blockers"]:
            continue
        if entry["paused_blockers"]:
            input_boolean.turn_off(entity_id=entry["paused_blockers"])
        lights = _room_lights(room)
        if lights:
            scene_presets.stop_dynamic_scenes_for_targets(targets={"entity_id": lights})
        entry["active_id"] = None
        entry["paused_blockers"] = []
        released.append(room)
    if not released:
        return
    task.executor(_write_file, data)
    for room in released:
        _publish(data, room)
    log.info(f"scene_rooms: alarm {old_value} -> {value}; motion lighting back on in {', '.join(released)}")


@state_trigger(*ALL_BLOCKERS)
def scene_rooms_blocker_off(var_name=None, value=None):
    """Automatic (or the alarm automation) cleared a room's blockers: its scene is over."""
    if value != "off":
        return
    data = task.executor(_read_file)
    cleared = []
    for room, cfg in ROOMS.items():
        entry = _room_data(data, room)
        if var_name not in cfg["blockers"] or not entry["active_id"]:
            continue
        if any(state.get(b) == "on" for b in cfg["blockers"]):
            continue
        entry["active_id"] = None
        entry["paused_blockers"] = []
        cleared.append(room)
    if not cleared:
        return
    task.executor(_write_file, data)
    for room in cleared:
        _publish(data, room)
