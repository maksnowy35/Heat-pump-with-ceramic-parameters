# Changelog

## [0.0.5]

### Added
- 30-minute window: T, RH and enthalpy at the five points, pressures, running COP with and without the constant
  power, saturation temperatures of R290 from the pressures next to the controller values, suction superheat
  (`POST /api/v1/datasets/{id}/window`)
- one cycle (120 s) in the layout of the original 2 × 2 figure, with heating capacity, power and the cycle COP;
  start snapped to the next supply half-cycle
- reconstruction of the supply/exhaust flags where the logger did not record them: half-cycle and anchor read off the
  logged part, preview against T2 (`/phases`, `/phases/preview`, `/phases/apply`)
- window finder: coverage of the hand-picked windows with a tolerance (`/windows/check`) and steady windows proposed
  across the outdoor-temperature range (`/windows/suggest`)
- info button on every tool: what it does, how, the formulas and which script it replaces
- record page: channels with their completeness, logging gaps

### Changed
- pages split by tool, routing; whole-record charts moved to their own page
- blocks cut by the window edges are left out of the window averages

### Fixed
- the flag reconstruction no longer drifts: the original loop restarted the count at the row where it switched,
  so every rebuilt half-cycle was one sample too long

## [0.0.1]

- first version: Python port of the COP scripts (block COP, cumulative COP) + simple Angular page
