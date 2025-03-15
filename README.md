# Home Assistant Configuration

## Overview

This repository contains my personal Home Assistant configuration, powering my smart home setup. The configuration features a comprehensive system of automations, customized dashboards, and integrations with various smart devices.

![Home Assistant Dashboard](https://brands.home-assistant.io/_/homeassistant/logo.png)

## Hardware

My smart home setup includes:

- **Hub**: Home Assistant running on a dedicated server
- **Climate**: Ecobee thermostat system
- **Lighting**: Philips Hue, WLED, and various smart switches
- **Security**: Abode security system
- **Media**: Various media players including Google Home, Echo devices, and Apple TV
- **Sensors**: Temperature, humidity, motion, door/window sensors throughout the house
- **Solar Power**: Monitoring and automation for solar generation system
- **Cameras**: Integrated surveillance system

## Features

- **Room-Based Management**: Organized by room (Master Bedroom, Ethan's Room, Living Room, Kitchen, Family Room, Office, etc.)
- **Climate Control**: Automated temperature management based on occupancy and time
- **Lighting Automation**: Motion-based lighting with awareness of ambient light levels
- **Energy Monitoring**: Tracking and visualization of power consumption and solar generation
- **Security Integration**: Integration with doors, windows, and motion sensors for comprehensive security
- **Media Control**: Control interfaces for various media devices throughout the home
- **Weather Data**: Integration with weather services for forecasting and environmental monitoring
- **Family Management**: Person tracking and notifications
- **Custom Dashboards**: Well-organized UI with room-specific views and status displays

## Dashboard Screenshots

*[Screenshots to be added here]*

## Custom Components

The setup uses several custom components and HACS integrations:

- Bubble Card
- Mushroom Cards
- Auto-Entities
- Button Cards
- Various weather integrations
- Media management cards
- And many more UI enhancements

## Automations

Some notable automations include:

- Motion-activated lighting throughout the house
- Climate control based on occupancy and time of day
- Security system integration and notifications
- Solar power optimization
- Media control automations
- Morning and evening routines

## Installation

This configuration is tailored to my specific setup and hardware, but you can use parts of it for inspiration. To use:

1. Clone this repository
2. Adapt the configuration files to your own devices and preferences
3. Update the `secrets.yaml` with your own credentials (not included in this repository)

## Security

See [SECURITY.md](SECURITY.md) for information on the security policy for this repository and how to report vulnerabilities.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- The Home Assistant community for their incredible work
- All the developers who create and maintain the integrations and custom components used in this configuration
