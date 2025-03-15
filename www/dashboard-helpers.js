/**
 * Dashboard Helper Functions for Home Assistant
 * This file contains reusable functions for custom cards and components
 */

/**
 * Format entity states with proper error handling
 * @param {Object} hass - Home Assistant object
 * @param {String} entityId - The entity ID to retrieve state for
 * @param {String} defaultValue - Default value to return if entity not available
 * @returns {String} Formatted entity state
 */
function getFormattedEntityState(hass, entityId, defaultValue = 'N/A') {
    try {
        const entity = hass.states[entityId];
        if (!entity || entity.state === 'unknown' || entity.state === 'unavailable') {
            return defaultValue;
        }

        try {
            return hass.formatEntityState(entity);
        } catch (e) {
            return entity.state;
        }
    } catch (error) {
        console.error(`Error getting state for ${entityId}:`, error);
        return defaultValue;
    }
}

/**
 * Create and manage badge elements
 * @param {HTMLElement} card - The card element
 * @param {Object} hass - Home Assistant object
 * @param {String} containerSelector - CSS selector for badge container
 * @param {Array} badgesConfig - Configuration for badges
 */
function createBadges(card, hass, containerSelector, badgesConfig) {
    try {
        const container = card.querySelector(containerSelector);
        if (!container) return;

        // Initialize badges storage if not exists
        card.badges = card.badges || {};
        card.badges[containerSelector] = card.badges[containerSelector] || [];

        // Process each badge config
        let configIndex = 0;
        badgesConfig.forEach((badgeConfig) => {
            let state;
            try {
                state = hass.states[badgeConfig.entity]?.state;
            } catch (e) {
                console.error(`Error getting state for badge ${badgeConfig.entity}:`, e);
                return;
            }

            // Find existing badge if any
            const existingBadge = card.badges[containerSelector].find(b =>
                b.entity === badgeConfig.entity && b.condition.toString() === badgeConfig.condition.toString()
            );

            // Process condition
            let conditionResult = false;
            try {
                conditionResult = badgeConfig.condition(state);
            } catch (e) {
                console.error(`Error evaluating condition for badge ${badgeConfig.entity}:`, e);
            }

            if (conditionResult) {
                if (existingBadge) {
                    // Update existing badge
                    if (badgeConfig.text) {
                        try {
                            existingBadge.element.textContent = typeof badgeConfig.text === 'function' ?
                                badgeConfig.text(state) : badgeConfig.text;
                        } catch (e) {
                            console.error(`Error updating badge text for ${badgeConfig.entity}:`, e);
                        }
                    }
                } else {
                    // Create new badge
                    try {
                        const el = document.createElement("div");

                        // Use the configIndex for position instead of badges array length
                        const positionIndex = configIndex + 1;

                        // Add basic and position classes
                        el.className = `badge position-${positionIndex} ${badgeConfig.text ? 'text' : ''}`;

                        // Add status-specific classes if provided
                        if (badgeConfig.class) {
                            el.classList.add(badgeConfig.class);
                        }

                        // Set background color
                        if (badgeConfig.color) el.style.backgroundColor = badgeConfig.color;

                        // Set content - either text or icon
                        if (badgeConfig.text) {
                            el.textContent = typeof badgeConfig.text === 'function' ?
                                badgeConfig.text(state) : badgeConfig.text;
                        } else if (badgeConfig.icon) {
                            const icon = document.createElement("ha-icon");
                            icon.icon = badgeConfig.icon;
                            el.appendChild(icon);
                        }

                        // Set animation if provided
                        if (badgeConfig.animation) {
                            el.style.animation = badgeConfig.animation;
                        }

                        // Add to container and track in badges list
                        container.appendChild(el);
                        card.badges[containerSelector].push({
                            entity: badgeConfig.entity,
                            condition: badgeConfig.condition,
                            element: el,
                            position: positionIndex // Store position for reference
                        });
                    } catch (e) {
                        console.error(`Error creating badge for ${badgeConfig.entity}:`, e);
                    }
                }
            } else if (existingBadge) {
                // Remove badge if condition no longer applies
                try {
                    container.removeChild(existingBadge.element);
                    card.badges[containerSelector] = card.badges[containerSelector].filter(b => b !== existingBadge);
                } catch (e) {
                    console.error(`Error removing badge for ${badgeConfig.entity}:`, e);
                }
            }
        });
    } catch (error) {
        console.error('Error creating badges:', error);
    }
}

function createBadges_OLD(card, hass, containerSelector, badgesConfig) {
    try {
        const container = card.querySelector(containerSelector);
        if (!container) {
            console.error(`Container not found: ${containerSelector}`);
            return;
        }

        // Make sure the container has relative positioning
        container.style.position = 'relative';

        // Rest of your function...

        // When creating badge element:
        const el = document.createElement("div");
        el.className = `badge bubble-badge position-${index + 1} ${badgeConfig.text ? 'text' : ''}`;
        el.style.position = 'absolute';
        el.style.zIndex = '10';

        // Set explicit positioning based on position number
        switch (index + 1) {
            case 1:
                el.style.top = '-4px';
                el.style.right = '-4px';
                break;
            case 2:
                el.style.bottom = '-4px';
                el.style.right = '-4px';
                break;
            case 3:
                el.style.bottom = '-4px';
                el.style.left = '-4px';
                break;
            case 4:
                el.style.top = '-4px';
                el.style.left = '-4px';
                break;
        }

        // Initialize badges storage if not exists
        card.badges = card.badges || {};
        card.badges[containerSelector] = card.badges[containerSelector] || [];

        badgesConfig.forEach((badgeConfig) => {
            // Get entity state with error handling
            let state;
            try {
                state = hass.states[badgeConfig.entity]?.state;
            } catch (e) {
                console.error(`Error getting state for badge ${badgeConfig.entity}:`, e);
                return;
            }

            // Find existing badge if any
            const existingBadge = card.badges[containerSelector].find(b =>
                b.entity === badgeConfig.entity && b.condition.toString() === badgeConfig.condition.toString()
            );

            // Process condition
            let conditionResult = false;
            try {
                conditionResult = badgeConfig.condition(state);
            } catch (e) {
                console.error(`Error evaluating condition for badge ${badgeConfig.entity}:`, e);
            }

            if (conditionResult) {
                if (existingBadge) {
                    // Update existing badge
                    if (badgeConfig.text) {
                        try {
                            existingBadge.element.textContent = typeof badgeConfig.text === 'function' ?
                                badgeConfig.text(state) : badgeConfig.text;
                        } catch (e) {
                            console.error(`Error updating badge text for ${badgeConfig.entity}:`, e);
                        }
                    }
                } else {
                    // Create new badge
                    try {
                        const el = document.createElement("div");
                        // Add basic and position classes
                        el.className = `badge position-${card.badges[containerSelector].length + 1} ${badgeConfig.text ? 'text' : ''}`;

                        // Add status-specific classes if provided
                        if (badgeConfig.class) {
                            el.classList.add(badgeConfig.class);
                        }

                        // Set background color
                        if (badgeConfig.color) el.style.backgroundColor = badgeConfig.color;

                        // Set content - either text or icon
                        if (badgeConfig.text) {
                            el.textContent = typeof badgeConfig.text === 'function' ?
                                badgeConfig.text(state) : badgeConfig.text;
                        } else if (badgeConfig.icon) {
                            const icon = document.createElement("ha-icon");
                            icon.icon = badgeConfig.icon;
                            el.appendChild(icon);
                        }

                        // Set animation if provided
                        if (badgeConfig.animation) {
                            el.style.animation = badgeConfig.animation;
                        }

                        // Add to container and track in badges list
                        container.appendChild(el);
                        card.badges[containerSelector].push({
                            entity: badgeConfig.entity,
                            condition: badgeConfig.condition,
                            element: el
                        });
                    } catch (e) {
                        console.error(`Error creating badge for ${badgeConfig.entity}:`, e);
                    }
                }
            } else if (existingBadge) {
                // Remove badge if condition no longer applies
                try {
                    container.removeChild(existingBadge.element);
                    card.badges[containerSelector] = card.badges[containerSelector].filter(b => b !== existingBadge);
                } catch (e) {
                    console.error(`Error removing badge for ${badgeConfig.entity}:`, e);
                }
            }
        });
    } catch (error) {
        console.error('Error creating badges:', error);
    }
}

/**
 * Set status text with error handling
 * @param {HTMLElement} card - The card element
 * @param {Object} hass - Home Assistant object
 * @param {Object} config - Configuration for status text
 */
function setStatusText(card, hass, config) {
    try {
        const stateElement = card.querySelector('.bubble-state');
        if (!stateElement) return;

        // Remove any previous status classes
        stateElement.classList.remove('status-unavailable', 'status-error');

        let statusParts = [];
        let hasUnavailableEntity = false;

        // Add temperature if available
        if (config.tempEntity) {
            const tempSensor = hass.states[config.tempEntity];
            if (tempSensor && tempSensor.state && tempSensor.state !== 'unknown' && tempSensor.state !== 'unavailable') {
                try {
                    statusParts.push(hass.formatEntityState(tempSensor));
                } catch (e) {
                    statusParts.push(tempSensor.state);
                }
            } else {
                statusParts.push('Temp: N/A');
                hasUnavailableEntity = true;
            }
        }

        // Add humidity if available
        if (config.humidityEntity) {
            const humiditySensor = hass.states[config.humidityEntity];
            if (humiditySensor && humiditySensor.state && humiditySensor.state !== 'unknown' && humiditySensor.state !== 'unavailable') {
                try {
                    statusParts.push(hass.formatEntityState(humiditySensor));
                } catch (e) {
                    statusParts.push(humiditySensor.state);
                }
            } else {
                statusParts.push('Humidity: N/A');
                hasUnavailableEntity = true;
            }
        }

        // Add window state if available and open
        if (config.windowEntity) {
            const windowSensor = hass.states[config.windowEntity];
            if (windowSensor && windowSensor.state === 'on') {
                statusParts.push("Window Opened");
            } else if (windowSensor && windowSensor.state !== 'off' && windowSensor.state !== 'unknown' && windowSensor.state !== 'unavailable') {
                // Handle unusual states
                statusParts.push(`Window: ${windowSensor.state}`);
            }

            if (!windowSensor || windowSensor.state === 'unknown' || windowSensor.state === 'unavailable') {
                hasUnavailableEntity = true;
            }
        }

        // Add custom messages
        if (config.customMessages) {
            config.customMessages.forEach(msgConfig => {
                if (hass.states[msgConfig.entity]?.state === msgConfig.state) {
                    statusParts.push(msgConfig.message);
                }
            });
        }

        // Set appropriate class if entities are unavailable
        if (hasUnavailableEntity) {
            stateElement.classList.add('status-unavailable');
        }

        // Join all parts with separator
        stateElement.innerText = statusParts.join(' | ');
    } catch (error) {
        console.error('Error setting status text:', error);
        try {
            const stateElement = card.querySelector('.bubble-state');
            if (stateElement) {
                stateElement.innerText = "Status unavailable";
                stateElement.classList.add('status-error');
            }
        } catch (e) {
            // Silent fail
        }
    }
}

/**
 * Set dynamic CSS styles based on entity states
 * @param {HTMLElement} card - The card element
 * @param {Object} hass - Home Assistant object
 * @param {Array} styleConfig - Configuration for dynamic styles
 */
function setDynamicStyles(card, hass, styleConfig) {
    try {
        styleConfig.forEach(config => {
            if (!config.selector || !config.property) return;

            // Find the elements to style
            const elements = card.querySelectorAll(config.selector);
            if (!elements || elements.length === 0) return;

            // Get entity state if an entity is specified
            let value = config.value; // Static value

            if (config.entity) {
                const entityState = hass.states[config.entity]?.state;
                if (!entityState && config.defaultValue === undefined) return;

                // Get dynamic value based on entity state
                if (typeof config.valueMap === 'function') {
                    value = config.valueMap(entityState);
                } else if (config.valueMap && entityState in config.valueMap) {
                    value = config.valueMap[entityState];
                } else {
                    value = config.defaultValue || '';
                }
            }

            // Apply the style to all matching elements
            elements.forEach(element => {
                try {
                    if (config.property === 'class') {
                        // Handle class special case
                        if (config.removeClasses) {
                            config.removeClasses.forEach(cls => element.classList.remove(cls));
                        }
                        if (value) element.classList.add(value);
                    } else if (config.property === 'animation') {
                        element.style.animation = value;
                    } else {
                        element.style[config.property] = value;
                    }
                } catch (e) {
                    console.error(`Error setting style ${config.property} on ${config.selector}:`, e);
                }
            });
        });
    } catch (error) {
        console.error('Error setting dynamic styles:', error);
    }
}

/**
 * Apply dynamic classes based on entity states
 * @param {HTMLElement} card - The card element
 * @param {Object} hass - Home Assistant object
 * @param {String} entity - Entity ID
 * @param {Object} classMap - Mapping of states to class names
 */
function applyDynamicClasses(card, hass, entity, classMap) {
    try {
        const state = hass.states[entity]?.state;

        // Get all possible classes to remove them first
        const allClasses = Object.values(classMap);

        // Remove all possible state classes first
        allClasses.forEach(className => {
            card.classList.remove(className);
        });

        // Add the appropriate class based on current state
        if (state && classMap[state]) {
            card.classList.add(classMap[state]);
        } else if (state === 'unavailable' || state === 'unknown') {
            card.classList.add('state-unavailable');
        }
    } catch (error) {
        console.error(`Error applying dynamic classes for ${entity}:`, error);
    }
}

/**
 * Creates or updates a conditional element based on entity state
 * @param {HTMLElement} card - The card element
 * @param {Object} hass - Home Assistant object
 * @param {Object} config - Configuration for the conditional element
 */
function updateConditionalElement(card, hass, config) {
    try {
        // Get parent container
        const container = card.querySelector(config.containerSelector);
        if (!container) return;

        // Unique ID for this conditional element
        const elementId = `conditional-${config.entity.replace(/\./g, '-')}`;

        // Check if element already exists
        let element = card.querySelector(`#${elementId}`);
        const state = hass.states[config.entity]?.state;

        // Evaluate condition function
        let shouldDisplay = false;
        if (typeof config.condition === 'function') {
            shouldDisplay = config.condition(state);
        } else {
            shouldDisplay = (state === config.condition);
        }

        if (shouldDisplay) {
            // Create element if it doesn't exist yet
            if (!element) {
                element = document.createElement('div');
                element.id = elementId;
                element.className = config.className || '';
                container.appendChild(element);
            }

            // Update content
            if (typeof config.content === 'function') {
                element.innerHTML = config.content(state);
            } else {
                element.innerHTML = config.content;
            }
        } else if (element) {
            // Remove element if condition is no longer true
            container.removeChild(element);
        }
    } catch (error) {
        console.error(`Error updating conditional element for ${config.entity}:`, error);
    }
}

// Export the functions for use in Home Assistant
window.dashboardHelpers = {
    getFormattedEntityState,
    createBadges,
    setStatusText,
    setDynamicStyles,
    applyDynamicClasses,
    updateConditionalElement
};