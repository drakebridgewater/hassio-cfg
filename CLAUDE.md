# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Repository

This is a comprehensive Home Assistant configuration repository for a smart home setup running in Docker. The configuration features room-based organization, extensive automation, multiple dashboard views, and integration with various smart devices including Ecobee, Philips Hue, Abode security, and solar power monitoring.

## Core Architecture

### Configuration Structure
- **Main config**: `configuration.yaml` - Central configuration with includes for modular organization
- **Packages**: `packages/` - Domain-specific configurations using Home Assistant packages pattern
- **Configs**: `configs/` - Modular configuration files (sensors, switches, groups, etc.)
- **Dashboards**: `dashboards/` - Lovelace UI configurations in YAML mode
- **Automations**: `automations.yaml`, `automations/` - Core automation logic
- **Themes**: `themes/` - Custom UI themes including macOS and minimalist designs

### Dashboard System
- **Multi-dashboard setup**: Main, tablet, security, and admin views
- **Modular cards**: `dashboards/cards/` and `dashboards/complete_btns/`
- **Button templates**: `dashboards/button-card-templates/` - Reusable UI components
- **Popup cards**: `dashboards/popup/` - Modal overlays for detailed controls

### Integration Patterns
- **HomeKit bridges**: Multiple bridges (ports 21063-21067) for different device categories
- **Custom components**: Located in `custom_components/` (Jellyfin, Saver, TickTick, etc.)
- **Blueprint automations**: `blueprints/automation/` - Reusable automation templates

## Key Configuration Files

- `configuration.yaml` - Main config with HTTP proxy settings, Lovelace mode, HomeKit bridges
- `secrets.yaml` - Credentials (not in repo)
- `automations.yaml` - Core automation definitions
- `scripts.yaml` - Home Assistant scripts
- `scenes.yaml` - Scene definitions

## Development Workflow

### Configuration Validation
Since Home Assistant runs in Docker, use these approaches for validation:
- **Check config**: Access HA container and run `ha core check` or use the UI Configuration > Server Controls > Check Configuration
- **View logs**: Monitor HA logs through the UI or Docker logs for syntax/configuration errors
- **Restart required**: Most configuration changes require Home Assistant restart

### Testing Changes
1. **Backup first**: Always backup before major changes
2. **Check syntax**: YAML syntax validation in your editor
3. **Staged deployment**: Test changes in development mode if possible
4. **Monitor logs**: Watch for errors after restart

### File Organization Principles
- **Room-based entities**: Group related devices by physical room
- **Functional separation**: Keep automations, UI, and device configs separate
- **Template reuse**: Use `!include` and `!include_dir_merge_named` for modularity
- **Naming conventions**: Use descriptive, consistent entity names across rooms

## Custom Components & Integrations

The configuration uses several custom integrations:
- **HACS components**: Modern UI cards (Bubble Card, Mushroom, Auto-Entities)
- **Custom integrations**: Jellyfin, Saver, TickTick, Scheduler
- **Theme systems**: macOS-inspired themes and minimalist designs

## Security Considerations

- **Trusted proxies**: Configured for Cloudflare and local networks
- **HomeKit exposure**: Selective entity filtering across multiple bridges
- **Secrets management**: All credentials externalized to `secrets.yaml`
- **Entity filtering**: Careful inclusion/exclusion patterns for external access