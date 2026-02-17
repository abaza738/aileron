import { describe, it } from 'node:test'
import assert from 'node:assert'
import { expandFlights, buildFlightQuery } from './flightSearch.js'

describe('expandFlights', () => {
  it('returns direct flight when service day matches date', () => {
    const baseDate = '2026-01-12' // Monday
    const records = [
      {
        get: (key: string) => {
          if (key !== 'itinerary') return undefined
          return [
            {
              properties: {
                flightNumber: 'X2200',
                departure_time: '02:30',
                arrival_time: '03:50',
                service_days: 'monday,tuesday',
                allow_callsign_change: 'False',
                is_hidden: 'False',
              },
            },
            { properties: { icao: 'NZCH', name: 'Christchurch', iata: 'CHC', city: 'Christchurch', country: 'NZ', countryCode: 'NZ' } },
            { properties: { icao: 'NZQN', name: 'Queenstown', iata: 'ZQN', city: 'Queenstown', country: 'NZ', countryCode: 'NZ' } },
          ]
        },
      },
    ]
    const result = expandFlights(records, baseDate)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].itinerary.length, 1)
    const flight = result[0].itinerary[0] as Record<string, unknown>
    assert.strictEqual(flight.flightNumber, 'X2200')
    assert.strictEqual(flight.allow_callsign_change, false)
    assert.strictEqual(flight.is_hidden, false)
    assert.strictEqual(flight.departure_date, baseDate)
  })

  it('returns empty when service day does not match date', () => {
    const baseDate = '2026-01-14' // Wednesday
    const records = [
      {
        get: (key: string) => {
          if (key !== 'itinerary') return undefined
          return [
            { properties: { flightNumber: 'X2200', departure_time: '02:30', arrival_time: '03:50', service_days: 'monday,tuesday' } },
            { properties: {} },
            { properties: {} },
          ]
        },
      },
    ]
    const result = expandFlights(records, baseDate)
    assert.strictEqual(result.length, 0)
  })

  it('rejects one-stop connection below MCT (30 min)', () => {
    const baseDate = '2026-01-12'
    const records = [
      {
        get: (key: string) => {
          if (key !== 'itinerary') return undefined
          return [
            { properties: { departure_time: '10:00', arrival_time: '11:00', service_days: 'monday' } },
            { properties: { departure_time: '11:15', arrival_time: '12:00', service_days: 'monday' } }, // 15 min connection
            { properties: {} },
            { properties: {} },
            { properties: {} },
          ]
        },
      },
    ]
    const result = expandFlights(records, baseDate)
    assert.strictEqual(result.length, 0)
  })

  it('accepts one-stop connection when connection time >= 30 min', () => {
    const baseDate = '2026-01-12'
    const records = [
      {
        get: (key: string) => {
          if (key !== 'itinerary') return undefined
          return [
            { properties: { flightNumber: 'X1', departure_time: '10:00', arrival_time: '11:00', service_days: 'monday' } },
            { properties: { flightNumber: 'X2', departure_time: '11:35', arrival_time: '12:00', service_days: 'monday' } }, // 35 min
            { properties: {} },
            { properties: {} },
            { properties: {} },
          ]
        },
      },
    ]
    const result = expandFlights(records, baseDate)
    assert.strictEqual(result.length, 1)
    assert.strictEqual(result[0].itinerary.length, 2)
  })

  it('rejects invalid connection (arrival after departure)', () => {
    const baseDate = '2026-01-12'
    const records = [
      {
        get: (key: string) => {
          if (key !== 'itinerary') return undefined
          return [
            { properties: { departure_time: '12:00', arrival_time: '13:00', service_days: 'monday' } },
            { properties: { departure_time: '11:00', arrival_time: '12:00', service_days: 'monday' } },
            { properties: {} },
            { properties: {} },
            { properties: {} },
          ]
        },
      },
    ]
    const result = expandFlights(records, baseDate)
    assert.strictEqual(result.length, 0)
  })
})

describe('buildFlightQuery', () => {
  it('includes WHERE clauses and params when filters provided', () => {
    const filters = {
      departure_airport: 'NZCH',
      arrival_airport: 'NZQN',
      departure_date: '2026-01-12',
      limit: 5,
      offset: 0,
    }
    const { query, params } = buildFlightQuery(filters)
    assert.ok(query.includes('WHERE'))
    assert.ok(query.includes('SKIP $offset LIMIT $limit'))
    assert.strictEqual(params.departure_airport, 'NZCH')
    assert.strictEqual(params.arrival_airport, 'NZQN')
    assert.strictEqual(params.day, 'monday')
  })

  it('applies default limit and offset', () => {
    const { params } = buildFlightQuery({})
    assert.ok(params.limit !== undefined)
    assert.ok(params.offset !== undefined)
  })
})
