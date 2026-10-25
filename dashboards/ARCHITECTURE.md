# Dashboards Architecture

## Overview

`lovelace-main` ("My Home") is a YAML-mode dashboard built from small include files. The GUI (storage)
dashboards under `.storage/lovelace.*` are where UI ideas are prototyped; they are ported here, never
the other way around, and are never edited from YAML work.

Guiding rules:
- **Every view is a native sections view** (`type: sections`): the shared header puts the alert
  ticker at the very top; the first section is the status card (`frame/status-section.yaml`); the last
  section holds the pop-ups, the ambient edge glow (`cards/ambient-glow.yaml`) and the navbar, which
  render nothing in place. There is no sidebar: its cards are sections on Home.
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
├── frame/                      # footer.yaml / footer-home.yaml: last section of every view
├── navigation/                 # navbar route set per page group
├── layouts/                    # header.yaml (alert ticker)
├── views/default/              # One file per view, NN-name.yaml
├── sections/
│   ├── banner/                 # Alert ticker (the header card) and status card
│   ├── sidebar/                # Home sections: warnings, timers, Shawna's day
│   ├── sidebar/          # Home sections: calendars, chores, media, batteries
│   ├── tablet/                 # The one-card tablet landing page (10-hero.yaml)
│   ├── footer/                 # Ambient glow + popup/ (every view)
│   ├── spaces-cards/           # Room cards on Home: upstairs/, downstairs/, other/
│   ├── rooms/<room>/           # Room content, one card per GUI section; shown by the room pages
│   ├── pages/<page>/colN/      # Content for pages ported from the GUI
│   └── climate/                # Temperatures, hvac, air quality, spaces, trends (Climate tabs + room pages)
├── popup/                      # Bubble pop-ups on every view (hash navigation)
├── popup_home/                 # Bubble pop-ups on Home only (frame/footer-home.yaml)
├── cards/                      # Standalone cards
├── visibility/                 # Reusable visibility conditions
├── button-card-templates/      # active/ is loaded (hero_pill, status_tile, close_up); the rest is legacy
└── unused/                     # Retired configs
```

## Views

Every view is a native sections view. Home and Tablet are tabs; every other view is a subview with
`back_path: /lovelace-main/home`, reached through the navbar or room cards.

```yaml
title: Security
path: security
subview: true
back_path: /lovelace-main/home
type: sections
max_columns: 4
header: !include ../../header/alert-ticker.yaml   # alert ticker on top
sections:
  - !include ../../frame/status-section.yaml   # status card, full width
  - type: grid
    cards: !include_dir_list ../../sections/pages/security/col1
  - type: grid
    cards: !include_dir_list ../../sections/pages/security/col2
  - type: grid                               # last: pop-ups, glow, navbar
    cards:
      - !include ../../frame/footer.yaml
      - !include ../../navigation/security.yaml
```

- Each old column folder (`colN/`) is a section. Full-width pages (calendar, music, camera events,
  doorbell) use one section with `column_span: 4`.
- Room pages: the first section (`column_span: 4`) holds the room's main-light Bubble button and
  `00-badges.yaml`; every other file in `sections/rooms/<room>/` is its own section, listed by name
  in the view. A new file from the GUI port needs a line in the view.
- The status card (`sections/banner/10-status-card.yaml`, below) replaces the old view badges:
  presence and alarm (while disarmed or for listed users), garage, front door, doors/windows
  (only while open), thermostat, lights, wall switches, motion, packages, guest mode and power.

### Home and Tablet

- Home (`00-home.yaml`): a status section (today's events, Shawna's day, warnings, timers,
  one section per floor of room cards, Today (calendar, chores, birthdays), media and batteries.
  Weather and who's away are in the status card.
- Tablet (`01-tablet.yaml`, `/lovelace-main/tablet`): the landing page for wall tablets, modelled on
  the satellite kiosk screensaver. Everything is inside one `custom:button-card`
  (`sections/tablet/10-hero.yaml`) sized to the screen, so it never scrolls: alarm and alert ticker
  on top with the entry pills (`hero_pill`) right under them, today's calendar left, clock and date
  centre, upstairs and downstairs room cards right, weather along the bottom. The sky follows
  `weather.pirateweather`, `sun.sun` and `sensor.airnow_aqi` (`variables.sky`, from the shared `sky`
  button-card template in `button-card-templates/active/sky.yaml`): colours, sun, stars,
  AQI haze (from 51, smoke bands and an orange sun above 150) and an `fx` layer. `cloud_coverage`
  sets how many seeded three-puff clouds there are (plus a veil past 60%) and dims the sun and
  stars, whatever the condition. The moon (`custom_fields.moon`) is an SVG worked out in `variables.sky` for
  the home's latitude and longitude (SunCalc's formulas): shown only while it's above the horizon
  (by day only when a sixth or more is lit), placed by azimuth (east left, west right) and altitude
  (squeezed into the band above the clock),
  at its real phase, and turned so the lit side faces the sun. After dark the outside weather block
  shows how much of it is lit and the phase, or the next moonrise while it's down. Clouds, fog
  and lightning are CSS; rain, snow and wind streaks are a canvas particle loop (`this._heroFx`) with
  depth, size and speed variation, slanted and drifted by wind speed, bearing and gusts. Pale skies
  switch `--hero-glass` to a dark tint. Under 900px it stacks and grows. The ticker sits in a
  fixed 110px row right above the clock, top-aligned with the calendar and rooms, so alerts never move the layout and the clock sits just under the pills; anything but disarmed turns the alarm into a
  pulsing red pill; the AQI pill opens `#aqi-overview`.
- Weather pop-up (`popup/weather.yaml`, `#weather`, opened by the what-to-wear kid and the outside
  weather block on Tablet): the kid, every reading the sky and weather block use (the dense
  `weather_details` button-card template, on the same `sky` template; each cell opens its source), the Wireless Tag's outside
  temperature over 24 hours, the daily forecast and the what-to-wear cutoffs.
- Scroll lock: `cards/scroll-lock.yaml` is an invisible button-card in the last section of the
  full-screen pages. It starts one page-level watcher that turns off page scrolling while the URL
  is one of its pages and the window is wide enough (tablet 900px, music 1300px; narrower, their
  panels stack and the page scrolls). button-card templates get a proxied `window`, so it uses
  `document.defaultView`. Add a page by including the card and adding it to `pages`.
- Cleaning (`33-cleaning.yaml`): a full-screen vacuum page, no header or status card, two
  sections (`max_columns: 2`). Left: the vacuum's state in words (`cleaning/col1/10-status.yaml`),
  `action_tile` buttons that say what each one does (Start, Keep cleaning and Pause swap with
  the state), and "Clean one room", one tile per room calling `vacuum.clean_area` (the
  vacuum's rooms are mapped to HA areas in its entity options, set through the websocket
  `config/entity_registry/update`; its "Hall" is mapped to Entryway). Right: the live map,
  filling the screen height from 768px. Scrolling is locked from 900px.
- Help (`99-help.yaml`): for anyone who isn't Drake; no status card. "Tell the house"
  (`help`): a canned-message dropdown (`input_select.broadcast_canned`, sent the moment
  it's picked) and the free-text broadcast, then the grocery list (`todo.kitchen_mealie_grocery`)
  and printing it. "Something's not working" (`help`): one `action_tile` per thing that
  goes wrong, saying what's happening now; tapping the tile is the fix where there is one
  (pause ad blocking 10 minutes, every room back on automatic, reconnect Alexa / Google / Apple
  TV, open or close the garage, Ask Drake: a high-priority note to Drake's phone). A tile lights
  up while its problem is happening. "How the house works" (`help`): the colour key, the
  wall switch buttons, what the house does on its own. Scripts and the canned list live in
  `packages/help.yaml`.
- Security (`11-security.yaml`, two sections): security only. Left: the panic card (only
  during a panic), the Alarmo card, the front door and driveway cameras (tap for Outdoor).
  Right: garage, driveway and front door controls with the door separators, then smoke and
  carbon monoxide. The events feed is on Camera Events; anything about the house's own
  health (sensors not reporting, water leak sensors, Frigate) is on Maintenance.
- Maintenance (`98-maintenance.yaml`, `/lovelace-main/maintenance`, not in the navbar yet):
  AdGuard and the critical-sensors list (moved from Help), then security sensors not
  reporting, water leak sensors and Frigate health (moved from Security); the start of the
  system maintenance page.
- Lights pop-up (`popup/light.yaml`, `#lights`, opened by the Lights tile): the lights that
  are on, grouped by floor (Upstairs = HA floor `main`, Downstairs = `basement`, Outside, then
  Other for anything without a floor), a heading per room (HA area), two to a row, each through
  the control template its colour modes call for. The room name is trimmed off the light's name.
  The card list is built server-side by `lights_popup()` in `custom_templates/lights.jinja`,
  returned to an auto-entities `filter.template` (it keeps non-entity cards in order). The
  button on top shows or hides the lights that are off (`input_boolean.lights_popup_show_off`,
  shared by every screen, back off after 10 minutes; `packages/lights_popup.yaml`). The same
  file's `light_skip()` leaves out groups, status LEDs, LED rings and screens, both here and in
  `sensor.lights_on_count` (the tile's count; `lights_off` attribute for the button). After
  editing the .jinja, reload custom templates, then template entities.
- Who's home pop-up (`popup/people_overview.yaml`, `#people_overview`, opened by the Who's away
  tile): a live map of the grown-ups, then one `person_tile` row each: picture with a green ring
  while home, where they are and since when (or miles from home and heading home or away), and
  a detail line with today's work or school, the drive home while at work ("18 min home via
  SE 32nd Ave Milwaukie", amber with the minutes over usual when it's at least 8 min and 30%
  slower), the street when away, moving or not, and phone battery (amber under 20%). Ethan and
  Abby read their school and daycare sensors. Guest mode last.
  The drive comes from `packages/drive_home.yaml`: `sensor.drake_drive_home` and
  `sensor.shawna_drive_home` wrap the Waze Travel Time sensors (Siemens -> Home, Aspire Dental)
  with `at_work` (from the work zone's persons list, since both zones are named Work), `usual`
  (`sensor.*_usual_drive_home`: median Waze time for the current half hour over the last 10
  workdays, so the evening rush is compared with past evening rushes), `delay`, `delayed`,
  `route` and `summary`. Shawna's drive home reads `sensor.shawna_work_to_home` once that
  Waze entry exists; until then her home -> Aspire Dental entry stands in.
  On Shawna's work mornings (home, `sensor.shawna_work_today` working, 5:30-7:20)
  `binary_sensor.shawna_leave_for_work` adds "Leave by 7:12 · 18 min drive" to her row: 7:20
  minus the live home -> Aspire Dental drive, amber from 10 minutes before, "Leave now · there
  by 7:36" after.
- Camera Events (`13-camera-events.yaml`): the status card, then whether the Prius and Ford are
  parked on the driveway pad (`camera-events`, `binary_sensor.prius_home` / `ford_home` from
  `packages/cars.yaml`, fed by Frigate's `driveway_cars` state classification model on the
  driveway camera; until it's trained the tiles say so), then the clips, full width, then the
  security events feed (`camera-events`): a logbook of the last hour for the alarm, lock,
  garage, doors, packages, smoke and leak sensors, and a "Show the full history" button that
  opens the Activity panel (`/logbook?entity_id=...`) filtered to the same entities. The two
  entity lists are in one file; keep them in sync.
- Music (`80-music.yaml`): Music Assistant, no header or badges. Left section: the player + queue
  + players `mass-player-card` (`sections/pages/music/10-player.yaml`). Right section (two
  columns, `sections/pages/music/right/`): Quick play (playlist and room dropdowns, Play, Stop;
  `packages/music.yaml`), your Spotify as a collapsed `yet-another-media-player` bar while it
  plays and for 30 minutes after (`binary_sensor.spotify_recently_active`; the library shrinks
  to make room), then the library `mass-player-card`. The bar's own search only opens it up a
  little, so its menu has "Big search": the `#spotify-search` pop-up (`popup/spotify_search.yaml`),
  a full-size YAMP search card. Both cards list every MA player
  from `sections/pages/music/players.yaml`. From 1300px scrolling is locked and card-mod sizes
  both cards to the window (`--page-vh` from the scroll lock, minus what sits above them and
  the card's 56px tab bar); narrower, the sections stack and the page scrolls.
- Calendar (`55-calendar.yaml`): no header or badges; the skylight card spans the section
  (`grid_options: columns: full`) and `compact_height` fits it to the screen.
  Templates in its nested cards run in the hero's context (`entity` is `sensor.time`), so they
  name their entities explicitly; the parent's `triggers_update` lists them.

### Adding a page

1. Create `sections/pages/<page>/col1/` (and `col2`, `col3` as needed), one card per file.
2. Add `views/default/NN-<page>.yaml` using the snippet above, one section per column.
3. Add one route to the matching group file in `navigation/`.

## Navigation

The navbar (`navigation/`) is a fixed bar at the bottom on phones and a floating bar at the bottom
from 768px. Room pages are opened from the room cards (Home, Tablet) or the navbar's Rooms menu.

The navbar is `decluttering-templates/navbar.yaml`; each view includes the bar for its page group,
which only supplies `routes`. On Home the bar lists the groups; on every other page it shows Home
first, then the pages in that group.

| Group file | Pages |
|---|---|
| `home.yaml` | Security, Rooms (menu of room pages), Planning, House |
| `security.yaml` | Overview, Events, Outdoor (`cameras`), Doorbell, Armed |
| `rooms.yaml` | Ethan, Garage, Greenhouse, Bathrooms, Rooms menu |
| `planning.yaml` | Calendar, Scheduling (automation controls; was also Automations), Gardening (`planting`) |
| `house.yaml` | Cleaning, Climate, Music, Misc, Help |

Room page links shared by two bars live in `navigation/rooms-popup.yaml`.

While a media player is playing (or paused for under 10 minutes), the navbar shows a media bar
above it with the title, play/pause and next; several at once become a swipeable carousel. The
players it watches are listed in `navigation/media-players.yaml`.

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
| `bubble_wled` | WLED strips | Own card, not on `bubble_control`. Takes `device` (the light's object id, e.g. `wled_candles`). Brightness slider, effect as attribute, then an effect / palette / preset row and a color / speed / intensity row |
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

## Header and Home sections

- `sections/banner/01-alert-ticker.yaml`: the header card on every view (inside the hero on Tablet).
  Hides itself when nothing needs attention.
- `sections/banner/10-status-card.yaml`: the status card, the first section of every view with
  the shared header (`frame/status-section.yaml`, `column_span: 4`; not in the header, which caps
  its card at 700px). It replaced the view badges (retired to `dashboard_unused/layout-badges.yaml`). A
  transparent `stack-in-card` (tiles float on the page) with the tiles from `status-tiles.yaml`
  in one layout-card grid (4 columns on phones, 3 from 768px, 6 from 1280px, dense packing).
  layout-card ignores `visibility`, so tiles that come and go are `conditional` cards. Each is a
  `status_tile` (`button-card-templates/active/`): a tinted rounded-square button filling its
  cell (stack-in-card strips its background, shadow and radius, so the template re-applies them
  with `!important`), coloured by role through the `tone` variable (`ok` green, `attention` amber,
  `failed` orange, `alarm` red, `warm` lights, `heat`/`cool` thermostat, `info` guests and
  motion); anything but `ok`/`neutral` glows, and `pulse` pulses it (alarm triggered or entry
  delay; the garage, front lock, doors and windows when `close_up` says they should be shut, the
  same rules the tablet's entry pills use). Phones show one or two plain words under the icon; from 768px
  the tile turns sideways with its `name` above the state, and label spans with class `more`
  add detail (who's home, the temperature inside and what the HVAC is doing), while class
  `phone` spans hide. The thermostat tile shows the set point: one temperature in heat or cool,
  the range in heat/cool.
  Doors, windows, wall switches and guest mode appear only while on; motion only from 768px.
  The who's away tile shows the pictures of whoever is out in place of its icon (Ethan and Abby
  from their school/daycare sensors, otherwise with the grown-ups; from 768px a grown-up at work
  adds their drive home, "(18 min home)", amber when slow; tap for `#people_overview`); on
  Shawna's work mornings a "Shawna to work" tile ("Leave 7:12", amber when it's time) appears
  while `binary_sensor.shawna_leave_for_work` is on;
  the weather tile shows the condition and temperature, and from 768px today's high and low and
  the chance of rain (`sensor.daily_weather_forecast`; tap for the forecast); the next birthday
  tile reads `calendar.birthdays` (first name on phones, full name, days away and date from
  768px; glows from 7 days out; tap for the calendar). The power tile spans two columns
  (`view_layout: grid-column: span 2`): sending or buying in words, a bar for how much of the
  house solar covers, and the solar and house figures; tap for Energy. Under the grid: a
  package row (`binary_sensor.package_delivered`, a Frigate package seen for 2 minutes; tap for
  the front door camera). Every icon keeps its old badge's tap and hold. Never
  set `width` in a button-card's `styles.card`: button-card then sizes the card to its content.
- `cards` and `cards`: the former sidebar cards, now included one by
  one into Home's sections. Weather and who's away moved into the status card (the old cards are
  in `dashboard_unused/`).

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
| `zone` | LED zone (`main_area`, `office_room`, ...): a faint ring around the icon in the room's wall switch LED 4 colour from `sensor.lighting_mode_<zone>` (green automatic, orange manual, yellow blinking when the motion automation is off) |
| `badges` | Bubble badges on the icon (below) |

A parent can resize the cards through `--room-card-*` custom properties (the tablet hero does).
Bubble fixes the name's line height at 18px, so a bigger `--room-card-name-size` also needs
`--room-card-name-line` (the hero uses 1.3) or the descenders are clipped.

Badges go in this order and style so every card reads the same way (only four show at once):

| Alert | Icon | Color | Animation |
|---|---|---|---|
| Door open | `mdi:door-open` | red | pulse |
| Window open (`condition: or` for several) | `mdi:window-open-variant` | red | pulse |
| Water leak | `mdi:water-alert` | blue | shake |
| Air quality poor (any reading above the tile's `high`) | `mdi:smog` | red | pulse |
| Air quality high (above `mod`, none above `high`) | `mdi:weather-dust` | orange | glow |
| Air quality moderate (above `good`, none above `mod`) | `mdi:weather-dust` | yellow | none |
| Too warm / too cold (> 72 / < 69 indoors) | `mdi:fire` / `mdi:snowflake-alert` | orange / cyan | glow |
| Occupied | `mdi:motion-sensor` | green | none |

### Room pages

Each room page also opens with an alert chip row (`sections/rooms/<room>/01-alerts.yaml`) that repeats the
room card's badges with a label, the same icon and the same colour, shown only while the badge's condition
holds. It is generated: edit the badges in the room card, then run `python3 dashboards/tools/gen_room_alerts.py`.

Each room is a subview (`views/default/21-living-room.yaml` … `27-outdoors.yaml`, plus `20-ethan.yaml`)
(sections view). A full-width first section holds the room's main-light Bubble button (the old pop-up
header) and `00-badges.yaml`; each other file in `sections/rooms/<room>/` (one per GUI section) is
its own section. Ethan's page is hand-built. Paths: `living-room`, `kitchen`, `dining`,
`master-bedroom`, `family-room`, `office`, `outdoors`, `ethan`. Holiday is still a pop-up (`#holiday`).

Pop-ups use Bubble Card's standalone format (v3.2+): the `pop-up` card is the top-level card and
holds its content in `cards:`. Never wrap a pop-up in a `vertical-stack`; Bubble treats that as legacy.

### Pop-up placement

A pop-up only opens on a view that contains it, and every card in the shared footer is repeated in
every view of the config the browser downloads. Place each pop-up by where its hash is linked from:

| Linked from | Folder | Included by |
|---|---|---|
| Badges, Home sections, room pages | `popup/` | `frame/footer.yaml` (every view) |
| Home/Tablet only (room cards, notification URLs like `home#main_floor_security`), or nothing yet | `popup_home/` | `frame/footer-home.yaml` (Home, Tablet) |

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

Three tabs, each its own subview so the address says which one is open; `cards/climate-tabs.yaml`
(the `page_tab` button-card template, as on Music and TV) sits at the top of all three.

- **Temperatures** (`40-climate.yaml`, `/climate`): one card per floor
  (`sections/climate/temperatures/`): a `stack-in-card` holding the `floor_temps` button-card header
  (name, average and spread) over a tile per room (decluttering `temp_tile`, built on the
  `temp_tile` button-card template). A tile shows the reading, how it compares with the
  thermostat's current setting (blue a degree or more below the heat setting, orange above the cool
  setting) and a 24-hour mini-graph; tapping it opens more-info. Upstairs and downstairs sit side by
  side (layout-card `auto-fit`); "Outside and unheated" has no average and no comparison
  (`compare: false`). Then the temperature and humidity trends and the attic and crawl space
  histories.
- **HVAC** (`41-climate-hvac.yaml`, `/climate-hvac`): the Bubble climate bar
  (`sections/climate/hvac/10-thermostat.yaml`), pausing the schedule (`20-pause-schedule.yaml`,
  `packages/hvac_pause.yaml`) and the schedule's bands (`30-bands.yaml`, `custom:hvac-bands-card`).
  The thermostat status tile and Help's heating tile open this tab.
- **Air quality** (`42-climate-aqi.yaml`, `/climate-aqi`): the three room monitors
  (`sections/climate/air-quality/`) side by side, then outdoor AQI. `#aqi-overview` opens this tab.

### HVAC bands

The HVAC Schedule automation (`automations.yaml`, id `1782243414971`) picks a band by today's
forecast high and a setpoint within it by the alarm state. The bands live in
`configs/hvac_bands.json`; `pyscript/hvac_bands.py` publishes them as `pyscript.hvac_bands` and
validates saves (`pyscript.hvac_bands_save`); `www/hvac-bands-card.js` edits them (change a band's
upper limit, mode and five setpoints, split a band, delete one; nothing is written until Save).
A band runs from the previous band's limit up to its own, not including it; the last has
`max: null`. Saving changes the entity's attributes, which re-runs the automation, so a change to
today's band reaches the thermostat straight away (unless the schedule is paused or the house
isn't sealed). The card works out "today" the same way the automation does; keep the two in step.

Cards sit side by side with `grid_options.columns`; a section's grid has 12 columns per column it
spans, so in a `column_span: 4` section 12 is a quarter and 24 a half, and they wrap to halves
on narrower screens. The air-quality cards are also included by the room pages and `#aqi-overview`.

## Status chip header cards

A status chip that opens a page or pop-up gets a Bubble header card there, styled like the thermostat
card: the group entity with its state, and related readings as `sub_button.bottom`.

| Chip | Header card |
|---|---|
| Thermostat | `sections/climate/hvac/10-thermostat.yaml` |
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

### Tap the tile, see the thing

Where a status tile leads, the thing it shows comes first: the alarm tile opens Security, which
starts with the Alarmo card (state and arm buttons, `sections/pages/security/col1/20-alarm.yaml`,
after the panic card that only shows during a panic); the thermostat tile opens the Climate page's HVAC tab, which
starts with the thermostat. Pop-ups (doors, windows, wall switches, people) open with their own
status card. Keep it that way when adding a tile or reordering a page.

### Lighting mode: one colour everywhere

A room's lighting mode shows in the same colour on its wall switches (LED 4,
`custom_templates/led_status.jinja` `mode_table`), on its room card ring and at the top of its
room page: green automatic, orange manual, yellow blinking when the motion automation is off.
All three read `sensor.lighting_mode_<zone>` (UI template helpers). Main Area is manual when
any of `main_area`, `kitchen`, `living_room` or `dining_room` blockers is on, because those
rooms' motion automations each read their own blocker.

Each room page starts with `cards/lighting-mode/<zone>.yaml` (button-card template
`lighting_mode`): Automatic and Manual segments, the current one filled in its colour, both
running `script.lighting_set_zone_mode` (`packages/lighting_mode.yaml`), which flips the zone's
blockers (Main Area flips all four) and, for Automatic, turns its motion automations back on.
It replaced the per-room "Automation" chips the port script had generated; re-running
`tools/port_gui_rooms.py` brings them back.
