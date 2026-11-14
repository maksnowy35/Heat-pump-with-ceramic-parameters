# HeatFlip Ceramic

Analysis of the measurements of a reversible ventilation unit with a ceramic regenerator and an R290 heat pump
(Politechnika Warszawska, MEiL, Zakład Chłodnictwa i Energetyki Budynku).

The logger of the test stand writes Excel reports with a timestamp and 23 channels (temperatures and humidities at five
points, refrigerant pressures and temperatures, compressor power and setpoint, supply/exhaust flags). The scripts I
wrote to process them were my first Python code; this repository turns them into one FastAPI + Angular app,
tool by tool.

## Version 0.0.1

- loading of the logger reports (`.xlsx` / `.csv`, both column naming variants, several files merged in time order)
- air enthalpy at the five measuring points, `delta_i = i2 - i3`
- COP in 2-minute blocks (one supply + one exhaust half-cycle), with and without the constant fan/automation power
- running COP over the whole record, outdoor temperature and refrigerant pressures
- a synthetic demo record in the logger layout (the measurement data is not published)

## Running it

```bash
cd backend
pip install -r requirements-dev.txt
uvicorn app.main:app --reload        # http://localhost:8000/docs
pytest -q

cd ../frontend
npm ci
npx ng serve --proxy-config proxy.conf.json   # http://localhost:4200
```
