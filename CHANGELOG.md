# Changelog

## [0.1.0]

### Added
- NTC characteristic (`POST /api/v1/ntc`): current or resistance to temperature from the NTC 5k table by linear
  interpolation (as the script did) and by interpolation in ln R against 1/T, Beta and Steinhart–Hart fits,
  B constants from the table against the datasheet, error of the linear interpolation across the range
- Modbus RTU (`/api/v1/modbus/...`): scan for the unit id (input, then holding register), read input/holding
  registers, write a single register; every frame shown byte by byte with its CRC-16; simulated controller unless
  `MODBUS_PORT` is set, writes to a real port only with `MODBUS_ALLOW_WRITE=1`
- ceramic regenerator calculator (`POST /api/v1/regenerator`): section 4.4 of the thesis with the printed values
  side by side, geometry and flow as inputs, drawing of the block face
- COP against outdoor temperature over the steady windows, with the ranges reported in section 4.3
  (`POST /api/v1/datasets/{id}/cop-vs-tout`)
- home page with all tools grouped as data, analysis and lab tools

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
