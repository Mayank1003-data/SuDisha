---
name: Expo static build port
description: Static Expo bundle generation can collide with the mockup preview's Metro port.
---

Static Expo builds need an alternate Metro port when another workspace workflow already owns 8081; use the build helper's `EXPO_METRO_PORT` override.

**Why:** The mockup preview can occupy Metro's default port, and Expo's non-interactive build otherwise waits for a port-selection prompt and times out.

**How to apply:** Run the static mobile build with an unused `EXPO_METRO_PORT` whenever the default Metro port is occupied.