"""Storage for the HVAC Schedule's temperature bands.

configs/hvac_bands.json is the source of truth. This module publishes it as the
attributes of pyscript.hvac_bands, where the HVAC Schedule automation
(automations.yaml) and the bands editor card (www/hvac-bands-card.js) read it.
The card writes back through pyscript.hvac_bands_save.

A band covers forecast highs from the previous band's max (inclusive) up to its
own max (exclusive); the last band has max null and covers everything above.
Each band names the HVAC mode and, per alarm state, a setpoint: one number for
heat or cool, [low, high] for heat_cool.
"""
import json
import os

BANDS_FILE = "/config/configs/hvac_bands.json"
ENTITY = "pyscript.hvac_bands"

MODES = {"heat", "cool", "heat_cool"}
OCCUPANCY = ["disarmed", "armed_home", "armed_night", "armed_away", "armed_vacation"]
MIN_TEMP = 45
MAX_TEMP = 90
MIN_SPREAD = 2  # heat_cool: high must be at least this far above low
MAX_BANDS = 8


@pyscript_compile
def _read_file():
    with open(BANDS_FILE, "r") as file:
        return json.load(file)


@pyscript_compile
def _write_file(data):
    # Write then rename, so a crash mid-write never leaves a half file.
    tmp = BANDS_FILE + ".tmp"
    with open(tmp, "w") as file:
        json.dump(data, file, indent=2)
        file.write("\n")
    os.replace(tmp, BANDS_FILE)


def _publish(data):
    bands = data.get("bands", [])
    state.set(
        ENTITY,
        len(bands),
        new_attributes={
            "friendly_name": "HVAC bands",
            "icon": "mdi:thermometer-lines",
            "occupancy": OCCUPANCY,
            "min_temp": MIN_TEMP,
            "max_temp": MAX_TEMP,
            "bands": bands,
        },
    )


def _is_temp(value):
    return isinstance(value, int) and not isinstance(value, bool) and MIN_TEMP <= value <= MAX_TEMP


def _validate_band(band, index, last):
    where = f"Band {index + 1}"
    if not isinstance(band, dict):
        return f"{where} is not an object"
    if not isinstance(band.get("id"), str) or not band["id"]:
        return f"{where} is missing an id"
    top = band.get("max")
    if last:
        if top is not None:
            return f"{where} is the last band, so it has no upper limit"
    elif not isinstance(top, int) or isinstance(top, bool) or not 0 < top < 130:
        return f"{where} needs an upper limit between 1 and 129°F"
    mode = band.get("mode")
    if mode not in MODES:
        return f"{where} has unknown mode '{mode}'"
    for occ in OCCUPANCY:
        value = band.get(occ)
        name = occ.replace("_", " ")
        if mode == "heat_cool":
            if not isinstance(value, list) or len(value) != 2 or not all([_is_temp(v) for v in value]):
                return f"{where} {name}: set a low and a high between {MIN_TEMP} and {MAX_TEMP}°F"
            if value[1] - value[0] < MIN_SPREAD:
                return f"{where} {name}: the high must be at least {MIN_SPREAD}° above the low"
        elif not _is_temp(value):
            return f"{where} {name}: set a temperature between {MIN_TEMP} and {MAX_TEMP}°F"
    return None


@time_trigger("startup")
def hvac_bands_startup():
    hvac_bands_reload()


@service
def hvac_bands_reload():
    """yaml
name: Reload HVAC bands
description: Re-reads configs/hvac_bands.json into pyscript.hvac_bands.
"""
    try:
        data = task.executor(_read_file)
    except Exception as err:
        log.error(f"hvac_bands: could not read {BANDS_FILE}: {err}")
        return
    _publish(data)


@service(supports_response="optional")
def hvac_bands_save(bands=None):
    """yaml
name: Save HVAC bands
description: Replaces every band in configs/hvac_bands.json. Used by the HVAC bands editor card.
fields:
  bands:
    description: The full list of bands, coldest first. The last band's max is null.
    required: true
    selector:
      object:
"""
    if not isinstance(bands, list) or not bands:
        return {"ok": False, "error": "There must be at least one band"}
    if len(bands) > MAX_BANDS:
        return {"ok": False, "error": f"There can be at most {MAX_BANDS} bands"}

    seen = set()
    for index, band in enumerate(bands):
        error = _validate_band(band, index, index == len(bands) - 1)
        if error:
            return {"ok": False, "error": error}
        if band["id"] in seen:
            return {"ok": False, "error": f"Band {index + 1} reuses id {band['id']}"}
        seen.add(band["id"])
        if index > 0 and band.get("max") is not None and band["max"] <= bands[index - 1]["max"]:
            return {"ok": False, "error": f"Band {index + 1} must end above {bands[index - 1]['max']}°F"}

    keep = ["id", "max", "mode"] + OCCUPANCY
    data = task.executor(_read_file)
    data["bands"] = [{key: band[key] for key in keep} for band in bands]
    task.executor(_write_file, data)
    _publish(data)
    log.info(f"hvac_bands: saved {len(bands)} bands")
    return {"ok": True}
