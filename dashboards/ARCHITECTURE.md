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
- **Pop-ups only where they can open**: the whole dashboard is sent to the browser at once, so a
  card in the shared frame is paid for once per view (19×). See [Pop-up placement](#pop-up-placement).

## Folder structure

```
dashboards/
├── lovelace-main.yaml          # Entry point: templates + views
├── lovelace-admin.yaml         # Admin dashboard (views/admin)
├── lovelace_resources.yaml     # Frontend resources (shared with the GUI dashboards)
├── decluttering-templates/     # Shared card templates (controls, navbar, air quality, TV remote)
├── frame/                      # banner / sidebar / footer cards included by every view
├── navigation/                 # navbar route set per page group
├── layouts/                    # grid-layout definitions (grid.yaml, grid_wide.yaml)
├── views/default/              # One file per view, NN-name.yaml
├── sections/
│   ├── banner/                 # Status message markdown + status chips
│   ├── sidebar/                # Sidebar cards (reactive cards first)
│   ├── footer/                 # Room button bar + popup/ (every view)
│   ├── spaces-cards/           # Room cards on Home: upstairs/, downstairs/, other/
│   ├── rooms/<room>/           # Room content, used by room pop-ups (and future subviews)
│   ├── pages/<page>/colN/      # Content for pages ported from the GUI
│   └── climate/                # Air quality, spaces, trends (Climate page + room pop-ups)
├── popup/                      # Bubble pop-ups on every view (hash navigation)
├── popup_home/                 # Bubble pop-ups on Home only (frame/footer-home.yaml)
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
| `room_card` | Home room cards | See Rooms |
| `bubble_chips` | Chip rows | Bubble sub-buttons; replaces `mushroom-chips-card` |

### Chips

Chip rows are Bubble sub-buttons, never `mushroom-chips-card`:

```yaml
type: custom:decluttering-card
template: bubble_chips
variables:
  - align: center              # optional: start (default) | center | end
  - chips:
      - entity: binary_sensor.kitchen_door
        name: Door
        show_name: true
        icon: mdi:door
        show_state: true
        state_background: true   # highlight while on/open
        fill_width: false        # chip-sized, not stretched
```

Hide a chip with sub-button `visibility`. Chips that need JS `styles` (dynamic text, icons or colors)
can't use the template, because decluttering-card breaks on multi-line string variables. Write the
same sub-buttons card directly instead: `sections/banner/20-status-chips.yaml` and
`sections/rooms/outdoors/10-overview.yaml`. `styles` targets chips as `.bubble-sub-button-N`.

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

### Home room cards (`sections/spaces-cards/`)

Home groups the rooms like the GUI dashboard: a Bubble separator and a two-column grid for each of
`upstairs/`, `downstairs/` and `other/` (one card per file, `NN-name.yaml` sets the order). Spaces
without a pop-up (attic, crawl space, greenhouses, entries) set `popup` to a page path instead.

Every room card is one `custom:decluttering-card` using `room_card`: a single Bubble button row per
room, modelled on the stock area card, so all rooms look and behave alike. There is no collapsed or
expanded state; tapping anywhere opens the room pop-up, where the room's controls live. A room file
only supplies data:

| Variable | Use |
|---|---|
| `name`, `icon`, `color` | Header; `color` is the `r, g, b` card tint |
| `popup` | Room pop-up hash opened by a tap |
| `entity` | Occupancy sensor |
| `temp`, `humid`, `extra` | Readings shown under the name (`temp · humid`); use the area's sensors |
| `blocker` | `input_boolean.lighting_automation_blocker_<room>`: ring around the icon, amber while blocked |
| `badges` | Bubble badges on the icon (below) |

Badges go in this order and style so every card reads the same way (only four show at once):

| Alert | Icon | Color | Animation |
|---|---|---|---|
| Door open | `mdi:door-open` | red | pulse |
| Window open (`condition: or` for several) | `mdi:window-open-variant` | red | pulse |
| Water leak | `mdi:water-alert` | blue | shake |
| Air quality (HIGH band of the Climate page tiles) | `mdi:weather-dust` | orange | glow |
| Too warm / too cold (> 72 / < 69 indoors) | `mdi:fire` / `mdi:snowflake-alert` | orange / cyan | glow |
| Occupied | `mdi:motion-sensor` | green | none |

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

Rooms with pop-ups: `#kitchen`, `#dining`, `#living-room`, `#master`, `#family`, `#ethan`, `#office`,
`#outdoors`, `#holiday`. Ethan's pop-up links to the fuller `/lovelace-main/ethan` subview.

### Pop-up placement

A pop-up only opens on a view that contains it, and every card in the shared footer is repeated in
all 19 views of the config the browser downloads. Place each pop-up by where its hash is linked from:

| Linked from | Folder | Included by |
|---|---|---|
| Room bar, navbar rooms pop-up, banner chips, sidebar, room pop-ups | `popup/` | `frame/footer.yaml` (every view) |
| Home only (room cards, notification URLs like `home#main_floor_security`), or nothing yet | `popup_home/` | `frame/footer-home.yaml` (Home) |

The TV remotes (`#living_room_remote`, `#family_room_remote`) share `decluttering-templates/tv_remote.yaml`.

### Porting GUI room pages

Room pop-up content is generated from the GUI dashboard's room pages (the GUI is where rooms are
designed). Edit the room in the GUI, then run:

```
docker exec Home-Assistant-Core python3 /config/dashboards/tools/port_gui_rooms.py [room ...]
touch /mnt/user/appdata/Home-Assistant-Core/dashboards/lovelace-main.yaml
```

The script writes one file per GUI section to `sections/rooms/<room>/` (`00-badges.yaml` for the
page badges) and converts cards on the way: headings become Bubble separators (heading badges become
sub-buttons), badges and Mushroom chips become `bubble_chips`, and simple Bubble light/switch/fan
buttons become the control templates (the light template is picked from the registry's
`supported_color_modes`). Everything else is copied. Generated files carry a header marker and are
replaced on every run; don't edit them. Files without the marker, such as `90-air-quality.yaml`,
are kept. `--dry-run` reports without writing; the report lists skipped sub-buttons and entities
missing from the registry.

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
- HA caches a YAML dashboard until `lovelace-main.yaml` itself changes; editing an included file is
  not enough. `touch dashboards/lovelace-main.yaml`, then refresh the browser. No restart needed.
- Test in the browser with screenshots only. Bubble pop-ups animate in, and clicks can land on cards
  behind them and toggle real devices.

## Custom cards used

Bubble Card (+ modules in `/config/bubble_card/modules`), decluttering-card, navbar-card, layout-card,
mushroom (template/entity cards only; chips are Bubble), stack-in-card, card-mod, calendar-card-pro, skylight-calendar-card, advanced-camera-card,
alarmo-card, mini-graph-card, auto-entities, fold-entity-row, scheduler-card, mass-player-card.
