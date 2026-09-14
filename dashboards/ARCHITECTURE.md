# Dashboards Architecture

## Overview

`lovelace-main` ("My Home") is a YAML-mode dashboard built from small include files. The GUI (storage)
dashboards under `.storage/lovelace.*` are where UI ideas are prototyped; they are ported here, never
the other way around, and are never edited from YAML work.

Guiding rules:
- **Every view shares one frame**: status banner, chips, sidebar, room bar and pop-ups, a navbar, and
  the ambient edge glow (`cards/ambient-glow.yaml`, included from `sections/footer/`; desktop only).
  A view file only adds its content areas.
- **Like controls look alike**: switches and lights render through shared decluttering templates.
- **Small files**: use `!include_dir_list` directories instead of long lists; one card per file.

## Folder structure

```
dashboards/
├── lovelace-main.yaml          # Entry point: templates + views
├── lovelace-admin.yaml         # Admin dashboard (views/admin)
├── lovelace_resources.yaml     # Frontend resources
├── decluttering-templates/     # Shared card templates (controls, navbar, air quality)
├── frame/                      # banner / sidebar / footer cards included by every view
├── navigation/                 # navbar route set per page group
├── layouts/                    # grid-layout definitions (grid.yaml, grid_wide.yaml)
├── views/default/              # One file per view, NN-name.yaml
├── sections/
│   ├── banner/                 # Status message markdown + status chips
│   ├── sidebar/                # Sidebar cards (reactive cards first)
│   ├── footer/                 # Room button bar + all pop-ups
│   ├── spaces-cards/           # Room cards on Home (3-tier system)
│   ├── rooms/<room>/           # Room content, used by room pop-ups (and future subviews)
│   ├── pages/<page>/colN/      # Content for pages ported from the GUI
│   └── climate/                # Air quality, spaces, trends (Climate page + room pop-ups)
├── popup/                      # Bubble pop-ups (hash navigation)
├── cards/                      # Standalone cards
├── visibility/                 # Reusable visibility conditions
├── button-card-templates/      # Legacy button-card templates (not loaded)
└── unused/                     # Retired configs
```

## Views and the shared frame

Every view is a `custom:grid-layout` view. Home is the only tab; every other view is a subview with
`back_path: /lovelace-main/home` and is reached through the navbar or room bar.

```yaml
title: Security
path: security
subview: true
back_path: /lovelace-main/home
type: custom:grid-layout
layout: !include ../../layouts/grid.yaml
cards:
  - !include ../../frame/banner.yaml       # grid-area: banner
  - !include ../../frame/sidebar.yaml      # grid-area: sidebar
  - !include ../../frame/footer.yaml       # grid-area: footer
  - !include ../../navigation/security.yaml
  - type: vertical-stack
    view_layout:
      grid-area: section1
    cards: !include_dir_list ../../sections/pages/security/col1
```

Layouts:
- `layouts/grid.yaml`: sidebar + banner + `section1`–`section9` + footer, with phone/tablet/desktop breakpoints.
- `layouts/grid_wide.yaml`: the same frame with one wide `main` area (cameras, calendar, music).

### Adding a page

1. Create `sections/pages/<page>/col1/` (and `col2`, `col3` as needed), one card per file.
2. Add `views/default/NN-<page>.yaml` using the frame snippet above.
3. Add one route to the matching group file in `navigation/`.

## Navigation

| Screen | Room bar (`sections/footer/button-bar.yaml`) | Navbar (`navigation/`) |
|---|---|---|
| Phone (<768px) | hidden | fixed bottom bar |
| Tablet / desktop (≥768px) | shown | fixed rail on the right |

The navbar is `decluttering-templates/navbar.yaml`; each view includes the bar for its page group,
which only supplies `routes`. On Home the bar lists the groups; on every other page it shows Home
first, then the pages in that group.

| Group file | Pages |
|---|---|
| `home.yaml` | Security, Rooms (pop-up of room hashes), Planning, House |
| `security.yaml` | Overview, Events, Outdoor (`cameras`), Doorbell, Armed |
| `rooms.yaml` | Ethan, Garage, Greenhouse, Bathrooms, Rooms pop-up |
| `planning.yaml` | Calendar, Scheduling, Automations, Gardening (`planting`) |
| `house.yaml` | Cleaning, Climate, Music, Misc, Help |

Room hash links shared by two bars live in `navigation/rooms-popup.yaml`.

## Control templates

Loaded with `decluttering_templates: !include_dir_merge_named decluttering-templates/`. File order
does not matter; templates layer by nesting a `custom:decluttering-card` that points at the base.

| Template | Use for | Notes |
|---|---|---|
| `bubble_control` | Base, not used directly | Icon tap → more-info, power button on the right → toggle, one slider |
| `bubble_switch` | `switch.*`, on/off lights | Card body tap toggles |
| `bubble_light` | Dimmers, light groups | Brightness slider |
| `bubble_light_temp` | Tunable-white lights | `slider: brightness` (default) or `white_temp` |
| `bubble_light_color` | Color lights | `slider: brightness` (default), `hue` or `white_temp` |
| `bubble_light_effect` | WLED-style strips | Brightness slider + `palette` / `preset` selects |
| `aq_metric` | Air quality readings | Icon amber at `good`, red at `bad` |

**One slider per card.** Never add extra slider sub-buttons below a light.

```yaml
- type: custom:decluttering-card
  template: bubble_light_color
  variables:
    - entity: light.corner_couch_lamp
    - name: Corner Lamp        # optional; defaults to the friendly name
    - slider: hue              # optional
```

Pick the light template from the entity's `supported_color_modes`: any of `hs/rgb/rgbw/rgbww/xy` →
color, only `color_temp` → temp, `brightness` → light, `onoff` → switch.

## Banner, chips and sidebar

- `sections/banner/10-status-message.yaml`: weather, daycare pickup, commute and night door checks (Jinja markdown).
- `sections/banner/20-status-chips.yaml`: presence, Alarmo, garage, doors/windows (only while open),
  motion, thermostat, lights on, power usage, solar (only while producing).
- `sections/sidebar/`: reactive cards (who's away, guest mode, upcoming reminders, warnings) show on
  every screen; static cards (weather, calendars, media, reports) use
  `visibility: [{condition: screen, media_query: "(min-width: 768px)"}]`.

## Rooms

### Home room cards (`sections/spaces-cards/`), 3-tier system

1. **Minimal**: always-visible Bubble button with key readings (temperature, air quality, doors and
   windows). Tap → room pop-up; double tap → toggle `input_boolean.<room>_view_expanded`.
2. **Expanded**: conditional grid of controls while the helper is `on`.
3. **Detailed**: the room pop-up (`popup/<room>.yaml`).

Readings added to the minimal card's `sub_button.main` go at the end so `bubble_badges`
`sub_button_index` and `sub_button_coloring` `button_N` references don't shift.

### Room pop-ups

Pop-ups use Bubble Card's standalone format (v3.2+): the `pop-up` card is the top-level card and
holds its content in `cards:`. Never wrap a pop-up in a `vertical-stack`; Bubble treats that as legacy.

```yaml
type: custom:bubble-card
card_type: pop-up
hash: '#master'
name: Master Bedroom
...
cards: !include_dir_list ../sections/rooms/master-bedroom
```

A room's air-quality card is pulled in by a one-line file in its room directory,
e.g. `sections/rooms/master-bedroom/90-air-quality.yaml`:
`!include ../../climate/air-quality/30-master-bedroom.yaml`.

The room content in `sections/rooms/<room>/` is container-independent, so a room can later become a
subview by adding a thin view file that includes the same directory.

## Climate

`views/default/40-climate.yaml` uses `layouts/grid_wide.yaml` with one `custom:layout-card`
(`layout_type: masonry`) in `main`. Masonry fills the shortest column, so a tall card doesn't leave
empty rows beside short ones. Each card is included on its own line (not `!include_dir_list`) so the
cards balance individually; list order is the fill order.
- `sections/climate/thermostat/thermostat.yaml`: Bubble climate card, first on the page.
- `sections/climate/air-quality/`: one card per room (Living Room / Ecobee, Family Room / View Plus,
  Master Bedroom / Apollo AIR-1). The same files are included in the room pop-ups.
- `sections/climate/spaces/`: attic, crawl space, outdoor AQI (also used by `#aqi-overview`).
- `sections/climate/trends/`: temperature and humidity graphs.

## Status chip header cards

A status chip that opens a page or pop-up gets a Bubble header card there, styled like the thermostat
card: the group entity with its state, and related readings as `sub_button.bottom`.

| Chip | Header card |
|---|---|
| Thermostat | `sections/climate/thermostat/thermostat.yaml` |
| Alarm | `sections/pages/security/col1/00-alarm.yaml` (more-info only, no arm/disarm buttons) |
| Doors / Windows | first card in `popup/doors.yaml` / `popup/windows.yaml` |
| Wall switches | first card in `popup/wall_switches.yaml` (`bubble_light`) |

## YAML includes

- `!include file.yaml`: one file, path relative to the including file.
- `!include_dir_list dir`: every file in `dir` as a list item, ordered by filename (`NN-name.yaml`).
- `!include_dir_merge_named dir`: merge every file's top-level keys into one mapping (templates).

## Validation and testing

- Parse with HA's loader (resolves includes):
  `docker exec Home-Assistant-Core python3 -c "from homeassistant.util.yaml import load_yaml; load_yaml('/config/dashboards/lovelace-main.yaml')"`
- YAML dashboards reload on browser refresh; no restart needed.
- Test in the browser with screenshots only. Bubble pop-ups animate in, and clicks can land on cards
  behind them and toggle real devices.

## Custom cards used

Bubble Card (+ modules in `/config/bubble_card/modules`), decluttering-card, navbar-card, layout-card,
mushroom, stack-in-card, card-mod, calendar-card-pro, skylight-calendar-card, advanced-camera-card,
alarmo-card, mini-graph-card, auto-entities, fold-entity-row, scheduler-card, mass-player-card.
