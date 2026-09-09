# Dashboards Architecture Documentation

## Overview

This document describes the architecture and structure of the Home Assistant Lovelace dashboards. The dashboard system uses a modular, component-based approach with YAML configuration files organized by functionality and view type.

## Folder Structure

```
dashboards/
├── button-card-templates/    # Reusable button card templates
├── cards/                     # Standalone card definitions
├── layouts/                   # Grid layout definitions for responsive design
├── popup/                     # Popup/modal card definitions (hash-based navigation)
├── sections/                  # Reusable UI sections
│   ├── footer/               # Footer components (button bars, etc.)
│   ├── sidebar/              # Sidebar components (overview, weather, etc.)
│   └── spaces-cards/         # Space/room cards (3-tier view system)
├── views/                     # View definitions organized by context
│   ├── admin/                # Administrative views
│   ├── default/              # Main/default views
│   ├── living_room/         # Living room specific views
│   └── wall_display/        # Wall display configurations
├── visibility/                # Visibility condition definitions
├── lovelace-main.yaml        # Main dashboard configuration
├── lovelace-admin.yaml       # Admin dashboard
├── lovelace-security.yaml    # Security dashboard
├── lovelace-tablet.yaml      # Tablet-optimized dashboard
└── lovelace_resources.yaml   # Custom card resources
```

## Core Concepts

### 1. Dashboard Entry Points

The main dashboard files (`lovelace-main.yaml`, `lovelace-admin.yaml`, etc.) serve as entry points that:
- Define the overall dashboard structure
- Include views from the `views/` directory
- Reference custom card resources

**Example:**
```yaml
# lovelace-main.yaml
views: !include_dir_list views/default
```

### 2. Views

Views are top-level pages in the dashboard. They are organized by context:
- **default/**: Main user-facing views (home, cameras, scheduling, etc.)
- **admin/**: Administrative views (people, groups, misc)
- **living_room/**: Space-specific detailed views
- **wall_display/**: Optimized views for wall-mounted displays

Views use the `!include_dir_list` directive to automatically include all files in a directory, ordered by filename prefix (e.g., `00-home.yaml`, `10-cameras.yaml`).

### 3. Sections

Sections are reusable UI components that can be included in multiple views. They are organized by type:

#### Spaces Cards (`sections/spaces-cards/`)
Space cards implement a **3-tier view system** (see below). Each space has its own file:
- `10-kitchen.yaml`
- `15-dining.yaml`
- `20-living-room.yaml`
- etc.

#### Sidebar (`sections/sidebar/`)
Sidebar components displayed in the main home view:
- Overview cards
- Weather information
- Trash schedules
- Timers
- Media controls
- Battery status
- Warnings

#### Footer (`sections/footer/`)
Footer components, typically button bars for quick actions.

### 4. Popups

Popups are modal overlays triggered by hash-based navigation (e.g., `#kitchen`, `#living-room`). They use `custom:bubble-card` with `card_type: pop-up` and a `hash` property.

**Structure:**
```yaml
- type: custom:bubble-card
  card_type: pop-up
  hash: '#kitchen'
  # ... popup header configuration
  cards:
    # ... popup content cards
```

## 3-Tier View System for Space Cards

Space cards implement a progressive disclosure pattern with three levels:

### Tier 1: Minimal View
- **Always visible** - The main button card showing:
  - Space name and icon
  - Key metrics (temperature, humidity, light sensor)
  - Door/window status indicators
  - Quick controls (main lights)
  - Chevron icons for expand/collapse state
- **Interaction**: 
  - Single tap: Navigate to detailed popup
  - Double tap: Toggle expanded view

### Tier 2: More View (Expanded)
- **Conditionally visible** - Shown when `input_boolean.{space}_view_expanded` is `on`
- **Content**: 2-column grid of named control cards
  - All lights with sliders/switches
  - Fans and other controls
  - Each card shows its name for clarity
- **Trigger**: Double-tap on minimal view card

### Tier 3: Detailed View (Popup)
- **Modal overlay** - Triggered by hash navigation (e.g., `#kitchen`)
- **Content**: Complete entity list for the space
  - All sensors
  - All controls
  - Media players
  - Specialized controls (refrigerator, etc.)
- **Trigger**: Single tap on minimal view card

### Implementation Pattern

```yaml
type: custom:stack-in-card
card_mod:
  style: |
    ha-card {
      background-color: rgba(R, G, B, 0.25) !important;
      background: linear-gradient(...);
    }
cards:
  # MINIMAL VIEW - Always visible
  - type: custom:bubble-card
    card_type: button
    # ... minimal view configuration
    double_tap_action:
      action: call-service
      service: input_boolean.toggle
      target:
        entity_id: input_boolean.{space}_view_expanded

  # BOTTOM SUB-BUTTONS - Hide when expanded
  - type: conditional
    conditions:
      - condition: state
        entity: input_boolean.{space}_view_expanded
        state: 'off'
    card:
      type: custom:bubble-card
      card_type: sub-buttons
      # ... bottom buttons configuration

  # MORE VIEW - Expanded inline view
  - type: conditional
    conditions:
      - condition: state
        entity: input_boolean.{space}_view_expanded
        state: 'on'
    card:
      type: grid
      columns: 2
      cards:
        # ... 2-column grid of named control cards

  # DETAILED VIEW - Popup
  - type: custom:bubble-card
    card_type: pop-up
    hash: '#{space}'
    # ... popup header
    cards:
      # ... detailed content
```

### State Management

Each space card uses an `input_boolean` helper for the expanded state:
- `input_boolean.kitchen_view_expanded`
- `input_boolean.living_room_view_expanded`
- `input_boolean.dining_view_expanded`
- etc.

These are defined in `configs/input_boolean.yaml` and toggled via double-tap actions.

## Layout System

The dashboard uses `custom:grid-layout` for responsive design. Layout definitions are in `layouts/`:

### Grid Layout Structure

```yaml
type: custom:grid-layout
layout: !include ../../layouts/grid.yaml
```

### Responsive Breakpoints

Layouts adapt to different screen sizes:
- **Desktop** (>2100px): 4-column grid with sidebar
- **Large Tablet** (1650-2100px): 3-column grid
- **Tablet** (1200-1650px): 2-column grid
- **Phone** (<1200px): Single column, stacked layout

Grid areas are defined for:
- `sidebar`: Left sidebar navigation
- `banner`: Top status bar
- `section1-9`: Main content areas
- `footer`: Bottom action bar

## Custom Cards Used

### Primary Cards
- **`custom:bubble-card`**: Main card type for buttons, popups, and media players
- **`custom:stack-in-card`**: Container for stacking multiple cards
- **`custom:mushroom-chips-card`**: Status chips display
- **`custom:mushroom-template-card`**: Template-based cards
- **`custom:grid-layout`**: Responsive grid layout system

### Secondary Cards
- **`custom:auto-entities`**: Dynamic entity lists
- **`custom:advanced-camera-card`**: Camera displays
- **`custom:scheduler-card`**: Scheduling interface
- **`custom:mini-media-player`**: Media player controls

## Naming Conventions

### Files
- **Views**: `{number}-{name}.yaml` (e.g., `00-home.yaml`, `10-cameras.yaml`)
  - Numbers control ordering
  - Descriptive names indicate content
- **Space Cards**: `{number}-{space-name}.yaml` (e.g., `10-kitchen.yaml`)
  - Numbers control display order
  - Hyphenated space names
- **Sections**: `{number}-{description}.yaml` (e.g., `01-overview.yaml`)
  - Numbers control ordering within sections

### Entities
- **View Expansion**: `input_boolean.{space}_view_expanded`
- **Automation Blockers**: `input_boolean.lighting_automation_blocker_{space}`
- **Sensors**: `sensor.{space}_{type}_sensor_{metric}`
- **Binary Sensors**: `binary_sensor.{space}_{type}`

## YAML Includes

The dashboard heavily uses YAML include directives:

### `!include`
Includes a single file:
```yaml
chips: !include ../../sections/status-bar.yaml
```

### `!include_dir_list`
Includes all files in a directory as a list (ordered by filename):
```yaml
cards: !include_dir_list ../../sections/spaces-cards
```

### `!include_dir_merge_named`
Merges all files in a directory into a named dictionary:
```yaml
button_card_templates: !include_dir_merge_named dashboards/button-card-templates/
```

## Color System

Each space card has a unique background color for visual distinction:

- **Kitchen**: Green gradient (`rgba(139, 195, 74, 0.25)`)
- **Living Room**: Blue gradient (`rgba(33, 150, 243, 0.25)`)
- **Dining Room**: Amber/Orange gradient (`rgba(255, 193, 7, 0.25)`)

Colors are applied via `card_mod` styling on the `stack-in-card` container.

## Interaction Patterns

### Tap Actions
- **Single tap**: Navigate to detailed popup or more-info
- **Double tap**: Toggle expanded view (for space cards)
- **Hold**: More-info dialog or alternative action

### Navigation
- **Hash-based**: `#kitchen`, `#living-room` for popups
- **Path-based**: `navigation_path: "home"` for view navigation

## Best Practices

### 1. Modularity
- Keep cards reusable and focused on a single purpose
- Use sections for repeated UI patterns
- Extract common patterns into templates

### 2. Responsive Design
- Use grid layouts with responsive breakpoints
- Test on multiple screen sizes
- Use visibility conditions for screen-size-specific content

### 3. State Management
- Use `input_boolean` helpers for UI state
- Keep state names consistent: `{space}_view_expanded`
- Document state dependencies

### 4. Performance
- Minimize nested includes
- Use conditional cards to hide unused content
- Optimize image sizes and media content

### 5. Maintainability
- Use descriptive file names with ordering prefixes
- Comment complex configurations
- Keep related cards in the same directory
- Document custom card requirements

### 6. Accessibility
- Provide clear labels and names
- Use icons consistently
- Ensure sufficient color contrast
- Support keyboard navigation where possible

## Adding a New Space Card

To add a new space card:

1. **Create the card file** in `sections/spaces-cards/`:
   - Name: `{number}-{space-name}.yaml`
   - Follow the 3-tier view pattern

2. **Add input_boolean** in `configs/input_boolean.yaml`:
   ```yaml
   {space}_view_expanded:
     name: "{Space} View Expanded"
     icon: mdi:home
   ```

3. **Choose a unique background color**:
   - Update `card_mod.style` with a distinct color
   - Ensure good contrast with card content

4. **Implement the 3 tiers**:
   - Minimal view with chevron toggle
   - Conditional bottom sub-buttons
   - Conditional expanded grid view
   - Popup with detailed content

5. **Test interactions**:
   - Single tap → popup
   - Double tap → expand/collapse
   - Verify all controls work

## Troubleshooting

### Card Not Appearing
- Check YAML syntax (indentation, quotes)
- Verify entity IDs exist
- Check include paths are correct
- Review Home Assistant logs for errors

### Popup Not Showing
- Verify hash matches navigation path
- Check popup card structure (should have `card_type: pop-up`)
- Ensure popup card is properly nested

### Expanded View Not Working
- Verify `input_boolean.{space}_view_expanded` exists
- Check conditional card conditions
- Ensure double-tap action is configured correctly

### Layout Issues
- Check grid layout configuration
- Verify grid-area assignments
- Test responsive breakpoints
- Review z-index for overlapping elements

## Future Enhancements

Potential improvements to consider:

1. **Template System**: Create reusable templates for space cards
2. **Theme Support**: Centralized color/theme configuration
3. **Accessibility**: Enhanced keyboard navigation and screen reader support
4. **Performance**: Lazy loading for popup content
5. **Documentation**: Inline documentation for complex cards
6. **Testing**: Automated validation of YAML structure

## Related Documentation

- Home Assistant Lovelace: https://www.home-assistant.io/dashboards/
- Bubble Card: https://github.com/Clooos/Bubble-Card
- Mushroom Cards: https://github.com/piitaya/lovelace-mushroom
- Grid Layout: https://github.com/thomasloven/lovelace-layout-card

