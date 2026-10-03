"""Apply this month's thermostat settings from configs/thermostat_schedule.yaml.

Call from an automation:

    action: pyscript.set_thermostat_monthly
    data:
      trigger_entity: alarm_control_panel.abode_alarm
      current_state: "{{ trigger.to_state.state }}"
"""
from datetime import datetime

import yaml

SCHEDULE_FILE = "/config/configs/thermostat_schedule.yaml"


@pyscript_compile
def _load_schedule():
    # Native function so it can run in the executor; file I/O must stay off the event loop.
    with open(SCHEDULE_FILE, "r") as file:
        return yaml.safe_load(file)


@service
def set_thermostat_monthly(current_state=None, trigger_entity="alarm_control_panel.abode_alarm"):
    """yaml
name: Set thermostat for this month
description: Applies the configs/thermostat_schedule.yaml entries for the current month that match trigger_entity and current_state.
fields:
  current_state:
    description: State of the trigger entity, e.g. armed_home or disarmed.
    required: true
    example: armed_home
  trigger_entity:
    description: Entity whose state is being matched.
    example: alarm_control_panel.abode_alarm
"""
    current_month = datetime.now().strftime("%B").lower()
    schedule = task.executor(_load_schedule)
    month_schedule = (schedule or {}).get("thermostat_schedule", {}).get(current_month, {})

    if not month_schedule:
        log.warning(f"No schedule found for month: {current_month}")
        return

    for climate_entity, settings_list in month_schedule.items():
        for settings in settings_list:
            if settings.get("trigger_entity", trigger_entity) != trigger_entity:
                continue
            if settings.get("trigger_state") != current_state:
                continue

            hvac_mode = settings.get("hvac_mode")
            service_data = {"entity_id": climate_entity, "hvac_mode": hvac_mode}
            if hvac_mode == "heat_cool":
                for key in ("target_temp_high", "target_temp_low"):
                    if key in settings:
                        service_data[key] = settings[key]
            elif "temperature" in settings:
                service_data["temperature"] = settings["temperature"]

            climate.set_temperature(**service_data)
            log.info(f"Set {climate_entity} for {current_month} - State: {current_state}")
