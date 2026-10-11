# Dashboards Architecture

## Overview

`lovelace-main` ("My Home") is a YAML-mode dashboard built from small include files. The GUI (storage)
dashboards under `.storage/lovelace.*` are where UI ideas are prototyped; they are ported here, never
the other way around, and are never edited from YAML work.

Guiding rules:
- **Every view shares one frame**: a banner on top (status message, chips, room bar), general cards on
  the left (sidebar), the page's own content on the right (`main`), and a footer (pop-ups, the ambient
  edge glow from `cards/ambient-glow.yaml`, desktop only). The navbar floats at the bottom.
- **No sideways scrolling, nothing spilling out of its box**, on phone, tablet or desktop. Size text
  inside a card with container units (`cqi`), never `vw`.
  A view file only adds its content areas.
- **Like controls look alike**: switches and lights render through shared decluttering templates.
- **Small files**: use `!include_dir_list` directories instead of long lists; one card per file.
- **Pop-ups only where they can open**: the whole dashboard is sent to the browser at once, so a
  card in the shared frame is paid for once per view (once per view). See [Pop-up placement](#pop-up-placement).

## Folder structure

```
dashboards/
├── lovelace-main.yaml          # Entry point: templates + views
├── lovelace-admin.yaml         # Admin dashboard (views/admin)
├── lovelace_resources.yaml     # Frontend resources (shared with the GUI dashboards)
├── decluttering-templates/     # Shared card templates (controls, navbar, air quality, TV remote)
├── frame/                      # banner / sidebar / footer cards included by every view
├── navigation/                 # navbar route set per page group
├── layouts/                    # frame.yaml (every view) + main.yaml (the `main` area's columns)
├── views/default/              # One file per view, NN-name.yaml
├── sections/
│   ├── banner/                 # Alert ticker, status chips, room bar
│   ├── sidebar/                # Top of the sidebar: status, weather, warnings (above content on phones)
│   ├── sidebar-lower/          # Rest of the sidebar: calendars, chores, media (below content on phones)
│   ├── footer/                 # Ambient glow + popup/ (every view)
│   ├── spaces-cards/           # Room cards on Home: upstairs/, downstairs/, other/
│   ├── rooms/<room>/           # Room content, one card per GUI section; shown by the room pages
│   ├── pages/<page>/colN/      # Content for pages ported from the GUI
│   └── climate/                # Air quality, spaces, trends (Climate page + room pages)
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
layout: !include ../../layouts/frame.yaml
cards:
  - !include ../../frame/banner.yaml       # grid-area: banner
  - !include ../../frame/sidebar.yaml      # grid-area: sidebar
  - !include ../../frame/sidebar-lower.yaml  # grid-area: lower
  - !include ../../frame/footer.yaml       # grid-area: footer
  - !include ../../navigation/security.yaml
  - type: custom:layout-card               # grid-area: main
    layout_type: custom:grid-layout
    view_layout:
      grid-area: main
    layout: !include ../../layouts/main.yaml
    cards:
      - type: vertical-stack
        cards: !include_dir_list ../../sections/pages/security/col1
      - type: vertical-stack
        cards: !include_dir_list ../../sections/pages/security/col2
```

Layouts:
- `layouts/frame.yaml`: banner across the top, sidebar left (two areas, `sidebar` then `lower`, that
  read as one column), `main` right, footer. Phone (<768px): one column (banner, sidebar, main,
  lower, footer), so calendars and chores drop below the page content. Tablet: sidebar 1fr (min 300px) / main 2fr. Desktop:
  1fr (min 340px) / 3fr; ≥2100px: 1fr / 4fr. The sidebar has a minimum width so its cards fit;
  `main` is `minmax(0, …)` so wide cards shrink instead of scrolling the page sideways.
- `layouts/main.yaml`: the nested grid in `main`. Each card (usually a column stack) gets a column of
  at least 300px; columns stretch to fill and wrap one at a time, down to one on a phone. A card can
  span every column with `view_layout: {grid-column: 1 / -1}` (room badges do).
- Full-width pages (calendar, music, camera events, doorbell) put a single card in `main` instead.
- Masonry is only used where the cards are single cards, not stacks (Climate): it sorts by estimated
  card size, and stacks of Bubble cards report 0 while loading, so they all land in column one.

### Adding a page

1. Create `sections/pages/<page>/col1/` (and `col2`, `col3` as needed), one card per file.
2. Add `views/default/NN-<page>.yaml` using the frame snippet above.
3. Add one route to the matching group file in `navigation/`.

## Navigation

| Screen | Room bar (`sections/banner/30-room-bar.yaml`) | Navbar (`navigation/`) |
|---|---|---|
| Phone (<768px) | hidden | fixed bottom bar |
| Tablet / desktop (≥768px) | under the status chips; buttons wrap | floating bar at the bottom |

The navbar is `decluttering-templates/navbar.yaml`; each view includes the bar for its page group,
which only supplies `routes`. On Home the bar lists the groups; on every other page it shows Home
first, then the pages in that group.

| Group file | Pages |
|---|---|
| `home.yaml` | Security, Rooms (menu of room pages), Planning, House |
| `security.yaml` | Overview, Events, Outdoor (`cameras`), Doorbell, Armed |
| `rooms.yaml` | Ethan, Garage, Greenhouse, Bathrooms, Rooms menu |
| `planning.yaml` | Calendar, Scheduling, Automations, Gardening (`planting`) |
| `house.yaml` | Cleaning, Climate, Music, Misc, Help |

Room page links shared by two bars live in `navigation/rooms-popup.yaml`.

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
- `sections/banner/30-room-bar.yaml`: room page buttons (tablet and up), wrapping under the chips.
- `sections/sidebar/`: top of the sidebar, above the content on every screen: packages, who's away,
  guest mode, daycare message, weather, timers, warnings. Weather is a compact one-row card on phones
  (`14-weather-compact.yaml`) and the full clock/tiles/forecast stack from 768px (`15-weather.yaml`).
- `sections/sidebar-lower/`: chores, today, upcoming/birthdays, media, batteries. Under the top part
  on tablet and desktop, below the page content on phones. Media and batteries stay tablet-and-up
  (`visibility: [{condition: screen, media_query: "(min-width: 768px)"}]`).

## Rooms

### Home room cards (`sections/spaces-cards/`)

Home groups the rooms like the GUI dashboard: a Bubble separator and a two-column grid for each of
`upstairs/`, `downstairs/` and `other/` (one card per file, `NN-name.yaml` sets the order). Spaces
set `popup` to their room page (`/lovelace-main/<room>`), a related page, or a pop-up hash (holiday).

Every room card is one `custom:decluttering-card` using `room_card`: a single Bubble button row per
room, modelled on the stock area card, so all rooms look and behave alike. There is no collapsed or
expanded state; tapping anywhere opens the room page, where the room's controls live. A room file
only supplies data:

| Variable | Use |
|---|---|
| `name`, `icon`, `color` | Header; `color` is the `r, g, b` card tint |
| `popup` | Room page path (or pop-up hash) opened by a tap |
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

### Room pages

Each room is a subview (`views/default/21-living-room.yaml` … `27-outdoors.yaml`, plus `20-ethan.yaml`)
on the shared frame. `main` holds the room's main-light Bubble button (the old pop-up header) above a
`layouts/main.yaml` grid of `!include_dir_list ../../sections/rooms/<room>`, so each GUI section is a
column and `00-badges.yaml` spans the top. Paths: `living-room`, `kitchen`, `dining`,
`master-bedroom`, `family-room`, `office`, `outdoors`, `ethan`. Holiday is still a pop-up (`#holiday`).

Pop-ups use Bubble Card's standalone format (v3.2+): the `pop-up` card is the top-level card and
holds its content in `cards:`. Never wrap a pop-up in a `vertical-stack`; Bubble treats that as legacy.

### Pop-up placement

A pop-up only opens on a view that contains it, and every card in the shared footer is repeated in
every view of the config the browser downloads. Place each pop-up by where its hash is linked from:

| Linked from | Folder | Included by |
|---|---|---|
| Banner chips, sidebar, room pages | `popup/` | `frame/footer.yaml` (every view) |
| Home only (room cards, notification URLs like `home#main_floor_security`), or nothing yet | `popup_home/` | `frame/footer-home.yaml` (Home) |

The TV remotes (`#living_room_remote`, `#family_room_remote`) share `decluttering-templates/tv_remote.yaml`.

### Porting GUI room pages

Room page content is generated from the GUI dashboard's room pages (the GUI is where rooms are
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

Ethan's GUI page is not re-ported: `views/default/20-ethan.yaml` is hand-built.

## Climate

`views/default/40-climate.yaml` puts one `custom:layout-card`
(`layout_type: masonry`) in `main`. Masonry fills the shortest column, so a tall card doesn't leave
empty rows beside short ones. Each card is included on its own line (not `!include_dir_list`) so the
cards balance individually; list order is the fill order.
- `sections/climate/thermostat/thermostat.yaml`: Bubble climate card, first on the page.
- `sections/climate/air-quality/`: one card per room (Living Room / Ecobee, Family Room / View Plus,
  Master Bedroom / Apollo AIR-1). The same files are included in the room pages.
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
