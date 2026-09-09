import json
from datetime import datetime
from builtins import open

# Get current month
current_month = datetime.now().strftime('%B').lower()

# Load the thermostat schedule
schedule_file = "/config/configs/thermostat_schedule.yaml"

try:
    import yaml
    with open(schedule_file, 'r') as file:
        schedule = yaml.safe_load(file)
    
    # Get data passed from automation
    trigger_entity = data.get('trigger_entity', 'alarm_control_panel.abode_alarm')
    current_state = data.get('current_state')
    
    # Get current month's schedule
    month_schedule = schedule.get('thermostat_schedule', {}).get(current_month, {})
    
    if not month_schedule:
        log.warning(f"No schedule found for month: {current_month}")
        
    # Process each thermostat in the monthly schedule
    for climate_entity, settings_list in month_schedule.items():
        for settings in settings_list:
            trigger_entity_config = settings.get('trigger_entity')
            trigger_state_config = settings.get('trigger_state')
            
            # Check if this setting matches current trigger
            if current_state == trigger_state_config:
                # Prepare service call data
                service_data = {
                    'entity_id': climate_entity
                }
                
                # Add temperature settings based on HVAC mode
                hvac_mode = settings.get('hvac_mode')
                service_data['hvac_mode'] = hvac_mode
                
                if hvac_mode == 'heat_cool':
                    if 'target_temp_high' in settings:
                        service_data['target_temp_high'] = settings['target_temp_high']
                    if 'target_temp_low' in settings:
                        service_data['target_temp_low'] = settings['target_temp_low']
                elif 'temperature' in settings:
                    service_data['temperature'] = settings['temperature']
                
                # Call the climate service
                hass.services.call('climate', 'set_temperature', service_data)
                
                log.info(f"Set {climate_entity} for {current_month} - State: {current_state}")
                
except Exception as e:
    log.error(f"Error in thermostat automation: {str(e)}")