import neo4j from 'neo4j-driver'
import type { Session } from 'neo4j-driver'
import { ListFlightsQueryParams } from '../types/flights.js'
import type { ListFlightsResponseRoundtripType, ListFlightsResponseOneWayType } from '../types/flights.js'
import { getDayOfWeek, getFlightsOnDate } from '../helpers/date.js'

const MIN_CONNECTION_MINUTES = 30

function normalizeBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value
  if (value === 'True' || value === 'true') return true
  if (value === 'False' || value === 'false') return false
  return false
}

function normalizeFlight<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj }
  if ('allow_callsign_change' in out) out.allow_callsign_change = normalizeBoolean(out.allow_callsign_change)
  if ('is_hidden' in out) out.is_hidden = normalizeBoolean(out.is_hidden)
  return out as T
}

function getArrivalDateTime(flight: Record<string, unknown>, date: Date): Date {
  const depTime = flight.departure_time as string
  const arrTime = flight.arrival_time as string
  const dep = new Date(date)
  const [h, m] = depTime.split(':').map(Number)
  dep.setHours(h, m, 0, 0)
  const arr = new Date(date)
  const [ah, am] = arrTime.split(':').map(Number)
  arr.setHours(ah, am, 0, 0)
  if (arr < dep) arr.setDate(arr.getDate() + 1) // crosses midnight
  return arr
}

function getDepartureDateTime(flight: Record<string, unknown>, date: Date): Date {
  const depTime = flight.departure_time as string
  const dep = new Date(date)
  const [h, m] = depTime.split(':').map(Number)
  dep.setHours(h, m, 0, 0)
  return dep
}

/**
 * Expands raw Neo4j itinerary records into flight objects with origin/destination and dates.
 * Exported for unit tests.
 */
export function expandFlights(records: { get: (key: string) => unknown }[], baseDate: string) {
  const expanded: { itinerary: unknown[] }[] = []
  for (const r of records) {
    const itinerary = r.get('itinerary') as { properties: Record<string, unknown> }[]
    if (!Array.isArray(itinerary)) continue

    let serviceDays: string[]
    let depAirport: Record<string, unknown>
    let arrAirport: Record<string, unknown>

    if (itinerary.length === 3) {
      const [flight, dep, arr] = itinerary
      const sd = flight?.properties?.service_days
      if (typeof sd !== 'string') continue
      serviceDays = sd.split(',')
      depAirport = dep?.properties ?? {}
      arrAirport = arr?.properties ?? {}
    } else if (itinerary.length === 5) {
      const [f1, f2, , dep, arr] = itinerary
      const sd1 = f1?.properties?.service_days
      const sd2 = f2?.properties?.service_days
      if (typeof sd1 !== 'string' || typeof sd2 !== 'string') continue
      const days1 = sd1.split(',')
      const days2 = sd2.split(',')
      serviceDays = days1.filter((d: string) => days2.includes(d))

      const depDate = new Date(baseDate)
      const arr1 = getArrivalDateTime(f1.properties, depDate)
      const dep2 = getDepartureDateTime(f2.properties, depDate)
      if (arr1 >= dep2) continue
      const connectionMinutes = (dep2.getTime() - arr1.getTime()) / (60 * 1000)
      if (connectionMinutes < MIN_CONNECTION_MINUTES) continue

      depAirport = dep?.properties ?? {}
      arrAirport = arr?.properties ?? {}
    } else {
      continue
    }

    const dates = getFlightsOnDate(baseDate, serviceDays)
    for (const date of dates) {
      if (itinerary.length === 3) {
        const [flight] = itinerary
        expanded.push({
          itinerary: [
            normalizeFlight({
              ...flight.properties,
              service_days: undefined,
              origin: depAirport,
              destination: arrAirport,
              prices: { economy: 100, premium_economy: 300 },
              departure_date: date,
            }),
          ],
        })
      } else {
        const [f1, f2] = itinerary
        const midProps = (itinerary[2] as { properties: Record<string, unknown> }).properties
        expanded.push({
          itinerary: [
            normalizeFlight({
              ...f1.properties,
              service_days: undefined,
              origin: depAirport,
              destination: midProps,
              prices: { economy: 100, premium_economy: 300 },
              departure_date: date,
            }),
            normalizeFlight({
              ...f2.properties,
              service_days: undefined,
              origin: midProps,
              destination: arrAirport,
              prices: { economy: 100, premium_economy: 300 },
              departure_date: date,
            }),
          ],
        })
      }
    }
  }
  return expanded
}

export function buildFlightQuery(filters: Partial<ListFlightsQueryParams>) {
  const whereDirect: string[] = []
  const whereOneStop: string[] = []
  const params: Record<string, unknown> = {}

  const limit = Number(filters.limit) || 10
  const offset = Number(filters.offset) || 0
  params.limit = neo4j.int(limit)
  params.offset = neo4j.int(offset)

  if (filters.departure_airport) {
    whereDirect.push('dep.icao = $departure_airport')
    whereOneStop.push('dep.icao = $departure_airport')
    params.departure_airport = filters.departure_airport
  }

  if (filters.arrival_airport) {
    whereDirect.push('arr.icao = $arrival_airport')
    whereOneStop.push('arr.icao = $arrival_airport')
    params.arrival_airport = filters.arrival_airport
  }

  if (filters.departure_date) {
    const day = getDayOfWeek(filters.departure_date)
    whereDirect.push("$day IN split(f1.service_days, ',')")
    whereOneStop.push("$day IN split(f1.service_days, ',') AND $day IN split(f2.service_days, ',')")
    params.day = day
  }

  const directWhere = whereDirect.length ? `WHERE ${whereDirect.join(' AND ')}` : ''
  const oneStopWhere = whereOneStop.length ? `WHERE ${whereOneStop.join(' AND ')}` : ''

  const query = `
    CALL {
      MATCH (f1:Flight)-[:DEPARTS_FROM]->(dep:Airport)
      MATCH (f1)-[:ARRIVES_TO]->(arr:Airport)
      ${directWhere}
      RETURN [f1, dep, arr] AS itinerary
      UNION
      MATCH (f1:Flight)-[:DEPARTS_FROM]->(dep:Airport)
      MATCH (f1)-[:ARRIVES_TO]->(mid:Airport)
      MATCH (f2:Flight)-[:DEPARTS_FROM]->(mid)
      MATCH (f2)-[:ARRIVES_TO]->(arr:Airport)
      ${oneStopWhere}
      RETURN [f1, f2, mid, dep, arr] AS itinerary
    }
    RETURN itinerary
    SKIP $offset LIMIT $limit
  `

  return { query, params }
}

export type FlightsOneWayResult = ListFlightsResponseOneWayType
export type FlightsRoundtripResult = ListFlightsResponseRoundtripType

export async function getFlightsOneWay(
  filters: ListFlightsQueryParams,
  session: Session,
): Promise<FlightsOneWayResult> {
  const { query, params } = buildFlightQuery(filters)
  const result = await session.run(query, params)
  const expanded = expandFlights(result.records, filters.departure_date)
  const direct = expanded.filter((r) => r.itinerary.length === 1)
  const oneStop = expanded.filter((r) => r.itinerary.length === 2)
  return {
    flights: {
      direct: direct.flatMap((r) => r.itinerary) as FlightsOneWayResult['flights']['direct'],
      one_stop: oneStop.map((r) => r.itinerary) as FlightsOneWayResult['flights']['one_stop'],
    },
  }
}

export async function getFlightsRoundtrip(
  outboundFilters: ListFlightsQueryParams,
  returnFilters: { departure_airport: string; arrival_airport: string; departure_date: string; limit?: number; offset?: number },
  session: Session,
): Promise<FlightsRoundtripResult> {
  const outbound = buildFlightQuery(outboundFilters)
  const returnQ = buildFlightQuery(returnFilters)

  // Same session cannot run concurrent transactions; run sequentially
  const outboundResult = await session.run(outbound.query, outbound.params)
  const returnResult = await session.run(returnQ.query, returnQ.params)

  const outboundExpanded = expandFlights(outboundResult.records, outboundFilters.departure_date)
  const returnExpanded = expandFlights(returnResult.records, returnFilters.departure_date)

  const outboundDirect = outboundExpanded.filter((r) => r.itinerary.length === 1)
  const outboundOneStop = outboundExpanded.filter((r) => r.itinerary.length === 2)
  const returnDirect = returnExpanded.filter((r) => r.itinerary.length === 1)
  const returnOneStop = returnExpanded.filter((r) => r.itinerary.length === 2)

  return {
    flights: {
      outbound: {
        direct: outboundDirect.flatMap((r) => r.itinerary) as FlightsRoundtripResult['flights']['outbound']['direct'],
        one_stop: outboundOneStop.map((r) => r.itinerary) as FlightsRoundtripResult['flights']['outbound']['one_stop'],
      },
      return: {
        direct: returnDirect.flatMap((r) => r.itinerary) as FlightsRoundtripResult['flights']['return']['direct'],
        one_stop: returnOneStop.map((r) => r.itinerary) as FlightsRoundtripResult['flights']['return']['one_stop'],
      },
    },
  }
}
