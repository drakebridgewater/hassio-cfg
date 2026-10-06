"""Storage for Ethan's routine schedules (morning, bedtime).

configs/routines.json is the source of truth. This module publishes it as the
attributes of pyscript.ethan_routines, where the routine editor card
(www/routine-editor-card.js) and script.routine_run (packages/ethan_routines.yaml)
read it. The card writes back through pyscript.routines_save.

Adding a step type:
  1. add it to STEP_TYPES and _validate_step below
  2. add a branch to script.routine_step in packages/ethan_routines.yaml
  3. teach the card to render/edit it (STEP_TYPES in www/routine-editor-card.js)
"""
import json
import os

ROUTINES_FILE = "/config/configs/routines.json"
ENTITY = "pyscript.ethan_routines"

DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
STEP_TYPES = {"announce", "turn_off"}
MAX_OFFSET = 240  # minutes after the start time
MAX_MESSAGE = 255  # input_text.broadcast_message holds 256


@pyscript_compile
def _read_file():
    with open(ROUTINES_FILE, "r") as file:
        return json.load(file)


@pyscript_compile
def _write_file(data):
    # Write then rename, so a crash mid-write never leaves a half file.
    tmp = ROUTINES_FILE + ".tmp"
    with open(tmp, "w") as file:
        json.dump(data, file, indent=2)
        file.write("\n")
    os.replace(tmp, ROUTINES_FILE)


def _publish(data):
    routines = data.get("routines", {})
    state.set(
        ENTITY,
        len(routines),
        new_attributes={
            "friendly_name": "Ethan's routines",
            "icon": "mdi:calendar-clock",
            "routines": routines,
        },
    )


def _validate_step(step, index):
    where = f"Step {index + 1}"
    if not isinstance(step, dict):
        return f"{where} is not an object"
    if step.get("type") not in STEP_TYPES:
        return f"{where} has unknown type '{step.get('type')}'"
    if not isinstance(step.get("id"), str) or not step["id"]:
        return f"{where} is missing an id"
    at = step.get("at")
    if not isinstance(at, int) or isinstance(at, bool) or not 0 <= at <= MAX_OFFSET:
        return f"{where} must start 0-{MAX_OFFSET} minutes after the routine starts"
    days = step.get("days")
    if not isinstance(days, list) or not days or [d for d in days if d not in DAYS]:
        return f"{where} needs at least one day"
    if not isinstance(step.get("enabled", True), bool):
        return f"{where} has an invalid enabled flag"
    if step["type"] == "announce":
        message = step.get("message")
        if not isinstance(message, str) or not message.strip():
            return f"{where} needs a message"
        if len(message) > MAX_MESSAGE:
            return f"{where} message is longer than {MAX_MESSAGE} characters"
    if step["type"] == "turn_off":
        entities = step.get("entity_id")
        if not isinstance(entities, list) or not entities:
            return f"{where} needs entities to turn off"
    return None


@time_trigger("startup")
def routines_startup():
    routines_reload()


@service
def routines_reload():
    """yaml
name: Reload Ethan's routines
description: Re-reads configs/routines.json into pyscript.ethan_routines.
"""
    try:
        data = task.executor(_read_file)
    except Exception as err:
        log.error(f"routines: could not read {ROUTINES_FILE}: {err}")
        return
    _publish(data)


@service(supports_response="optional")
def routines_save(routine=None, steps=None):
    """yaml
name: Save a routine's steps
description: Replaces the steps of one routine in configs/routines.json. Used by the routine editor card.
fields:
  routine:
    description: Routine key, e.g. morning or bedtime.
    required: true
    example: bedtime
  steps:
    description: Full list of steps for that routine.
    required: true
    selector:
      object:
"""
    data = task.executor(_read_file)
    routines = data.get("routines", {})
    if routine not in routines:
        return {"ok": False, "error": f"Unknown routine '{routine}'"}
    if not isinstance(steps, list):
        return {"ok": False, "error": "steps must be a list"}

    seen = set()
    for index, step in enumerate(steps):
        error = _validate_step(step, index)
        if error:
            return {"ok": False, "error": error}
        if step["id"] in seen:
            return {"ok": False, "error": f"Step {index + 1} reuses id {step['id']}"}
        seen.add(step["id"])

    # Stable sort by start offset; steps at the same minute keep their order.
    ordered = sorted([(step["at"], index) for index, step in enumerate(steps)])
    routines[routine]["steps"] = [steps[index] for _, index in ordered]
    task.executor(_write_file, data)
    _publish(data)
    log.info(f"routines: saved {len(steps)} steps for {routine}")
    return {"ok": True}
