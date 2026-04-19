import { describe, it } from 'node:test'
import assert from 'node:assert'
import { searchFlights, getFlightsOneWay, getFlightsRoundtrip } from './flightSearch.js'
import type { RouteRecord, AirportInfo } from '../data/timetable.js'

const baseRoute: RouteRecord = {
  flightNumber: 'X1',
  origin: 'NZCH',
  destination: 'NZAA',
  departure_time: '10:00',
  arrival_time: '11:00',
  service_days: ['monday'],
  tags: 'A-0001',
  fleet_ids: '16300',
  callsign: 'XZA001',
  type: 'scheduled',
  is_hidden: false,
  flight_rules: 'i',
  flight_type: 's',
  allow_callsign_change: false,
  pax_lf_id: '1',
  pax_luggage_lf_id: '2',
  cargo_lf_id: '3',
  cargo_volume_lf_id: '4',
}

const testAirports = new Map<string, AirportInfo>([
  ['NZCH', { name: 'Christchurch', icao: 'NZCH', iata: 'CHC', city: 'Christchurch', country: 'New Zealand', countryCode: 'NZ' }],
  ['NZAA', { name: 'Auckland', icao: 'NZAA', iata: 'AKL', city: 'Auckland', country: 'New Zealand', countryCode: 'NZ' }],
  ['NZQN', { name: 'Queenstown', icao: 'NZQN', iata: 'ZQN', city: 'Queenstown', country: 'New Zealand', countryCode: 'NZ' }],
])

describe('searchFlights', () => {
  it('returns a direct flight when origin/destination/day match', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, origin: 'NZCH', destination: 'NZQN' },
    ]
    const result = searchFlights('NZCH', 'NZQN', '2026-01-12', testRoutes, testAirports) // Monday
    assert.strictEqual(result.direct.length, 1)
    assert.strictEqual(result.direct[0].flightNumber, 'X1')
    assert.strictEqual(result.direct[0].origin.icao, 'NZCH')
    assert.strictEqual(result.direct[0].destination.icao, 'NZQN')
    assert.deepStrictEqual(result.direct[0].prices, { economy: 100, premium_economy: 300 })
  })

  it('returns no direct flights when day does not match', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, origin: 'NZCH', destination: 'NZQN', service_days: ['monday'] },
    ]
    const result = searchFlights('NZCH', 'NZQN', '2026-01-13', testRoutes, testAirports) // Tuesday
    assert.strictEqual(result.direct.length, 0)
  })

  it('returns a valid one-stop connection with MCT >= 30 min', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, flightNumber: 'X1', origin: 'NZCH', destination: 'NZAA', departure_time: '10:00', arrival_time: '11:00' },
      { ...baseRoute, flightNumber: 'X2', origin: 'NZAA', destination: 'NZQN', departure_time: '11:35', arrival_time: '12:30' },
    ]
    const result = searchFlights('NZCH', 'NZQN', '2026-01-12', testRoutes, testAirports)
    assert.strictEqual(result.one_stop.length, 1)
    assert.strictEqual(result.one_stop[0].length, 2)
    assert.strictEqual(result.one_stop[0][0].flightNumber, 'X1')
    assert.strictEqual(result.one_stop[0][1].flightNumber, 'X2')
  })

  it('rejects a one-stop connection with MCT < 30 min', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, flightNumber: 'X1', origin: 'NZCH', destination: 'NZAA', departure_time: '10:00', arrival_time: '11:00' },
      { ...baseRoute, flightNumber: 'X2', origin: 'NZAA', destination: 'NZQN', departure_time: '11:15', arrival_time: '12:00' },
    ]
    const result = searchFlights('NZCH', 'NZQN', '2026-01-12', testRoutes, testAirports)
    assert.strictEqual(result.one_stop.length, 0)
  })

  it('rejects a connection where second leg departs before first leg arrives', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, flightNumber: 'X1', origin: 'NZCH', destination: 'NZAA', departure_time: '12:00', arrival_time: '13:00' },
      { ...baseRoute, flightNumber: 'X2', origin: 'NZAA', destination: 'NZQN', departure_time: '11:00', arrival_time: '12:00' },
    ]
    const result = searchFlights('NZCH', 'NZQN', '2026-01-12', testRoutes, testAirports)
    assert.strictEqual(result.one_stop.length, 0)
  })

  it('returns a valid one-stop when first leg is overnight and second leg operates next day', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, flightNumber: 'X1', origin: 'NZCH', destination: 'NZAA',
        departure_time: '23:00', arrival_time: '01:00', service_days: ['monday'] },
      { ...baseRoute, flightNumber: 'X2', origin: 'NZAA', destination: 'NZQN',
        departure_time: '02:00', arrival_time: '03:30', service_days: ['tuesday'] },
    ]
    const result = searchFlights('NZCH', 'NZQN', '2026-01-12', testRoutes, testAirports) // Monday
    assert.strictEqual(result.one_stop.length, 1)
    assert.strictEqual(result.one_stop[0][1].departure_date, '2026-01-13') // f2 departs Tuesday
  })

  it('enriches flights with departure_date', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, origin: 'NZCH', destination: 'NZQN' },
    ]
    const date = '2026-01-12'
    const result = searchFlights('NZCH', 'NZQN', date, testRoutes, testAirports)
    assert.strictEqual(result.direct[0].departure_date, date)
  })

  it('returns all direct flights when multiple operate the same route on the same day', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, flightNumber: 'X1', origin: 'NZCH', destination: 'NZQN', departure_time: '06:00', arrival_time: '07:15' },
      { ...baseRoute, flightNumber: 'X2', origin: 'NZCH', destination: 'NZQN', departure_time: '14:00', arrival_time: '15:15' },
      { ...baseRoute, flightNumber: 'X3', origin: 'NZCH', destination: 'NZQN', departure_time: '20:00', arrival_time: '21:15' },
    ]
    const result = searchFlights('NZCH', 'NZQN', '2026-01-12', testRoutes, testAirports)
    assert.strictEqual(result.direct.length, 3)
    const numbers = result.direct.map((f) => f.flightNumber)
    assert.ok(numbers.includes('X1'))
    assert.ok(numbers.includes('X2'))
    assert.ok(numbers.includes('X3'))
  })

  it('returns both direct and one-stop results when both exist for the same route', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, flightNumber: 'X1', origin: 'NZCH', destination: 'NZQN', departure_time: '08:00', arrival_time: '09:15' },
      { ...baseRoute, flightNumber: 'X2', origin: 'NZCH', destination: 'NZAA', departure_time: '10:00', arrival_time: '11:00' },
      { ...baseRoute, flightNumber: 'X3', origin: 'NZAA', destination: 'NZQN', departure_time: '11:45', arrival_time: '12:45' },
    ]
    const result = searchFlights('NZCH', 'NZQN', '2026-01-12', testRoutes, testAirports)
    assert.strictEqual(result.direct.length, 1)
    assert.strictEqual(result.direct[0].flightNumber, 'X1')
    assert.strictEqual(result.one_stop.length, 1)
    assert.strictEqual(result.one_stop[0][0].flightNumber, 'X2')
    assert.strictEqual(result.one_stop[0][1].flightNumber, 'X3')
  })

  it('uses departure_date (not arrival_date) for an overnight direct flight', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, flightNumber: 'X1', origin: 'NZCH', destination: 'NZQN',
        departure_time: '23:00', arrival_time: '01:30' },
    ]
    const date = '2026-01-12'
    const result = searchFlights('NZCH', 'NZQN', date, testRoutes, testAirports)
    assert.strictEqual(result.direct.length, 1)
    assert.strictEqual(result.direct[0].departure_date, date)
    assert.strictEqual(result.direct[0].arrival_time, '01:30')
  })

  it('uses icao as fallback when airport is not in the airport map', () => {
    const testRoutes: RouteRecord[] = [
      { ...baseRoute, flightNumber: 'X1', origin: 'NZCH', destination: 'ZZZZ' },
    ]
    const result = searchFlights('NZCH', 'ZZZZ', '2026-01-12', testRoutes, testAirports)
    assert.strictEqual(result.direct.length, 1)
    assert.strictEqual(result.direct[0].destination.icao, 'ZZZZ')
    assert.strictEqual(result.direct[0].destination.name, '')
  })
})

describe('getFlightsOneWay (real data)', () => {
  it('returns expected response shape', () => {
    const result = getFlightsOneWay({
      departure_airport: 'NZCH',
      arrival_airport: 'NZQN',
      type: 'one-way',
      departure_date: '2026-01-12',
    })
    assert.ok('flights' in result)
    assert.ok(Array.isArray(result.flights.direct))
    assert.ok(Array.isArray(result.flights.one_stop))
  })

  it('every one_stop entry is an array of 2 flights', () => {
    const result = getFlightsOneWay({
      departure_airport: 'NZCH',
      arrival_airport: 'NZWN',
      type: 'one-way',
      departure_date: '2026-01-12',
    })
    for (const pair of result.flights.one_stop) {
      assert.strictEqual(pair.length, 2)
    }
  })
})

describe('getFlightsRoundtrip (real data)', () => {
  it('returns outbound and return legs', () => {
    const result = getFlightsRoundtrip(
      { departure_airport: 'NZCH', arrival_airport: 'NZQN', type: 'roundtrip', departure_date: '2026-01-12' },
      { departure_airport: 'NZQN', arrival_airport: 'NZCH', departure_date: '2026-01-15' },
    )
    assert.ok('outbound' in result.flights)
    assert.ok('return' in result.flights)
    assert.ok(Array.isArray(result.flights.outbound.direct))
    assert.ok(Array.isArray(result.flights.return.direct))
  })
})
