import { getDayOfWeek } from '../helpers/date.js'
import { routes, airports } from '../data/timetable.js'
import type { RouteRecord, AirportInfo } from '../data/timetable.js'
import type {
  ListFlightsQueryParams,
  ListFlightsResponseOneWayType,
  ListFlightsResponseRoundtripType,
} from '../types/flights.js'

const MIN_CONNECTION_MINUTES = 30

function getArrivalDateTime(route: RouteRecord, date: Date): Date {
  const dep = new Date(date)
  const [h, m] = route.departure_time.split(':').map(Number)
  dep.setUTCHours(h, m, 0, 0)
  const arr = new Date(date)
  const [ah, am] = route.arrival_time.split(':').map(Number)
  arr.setUTCHours(ah, am, 0, 0)
  if (arr < dep) arr.setUTCDate(arr.getUTCDate() + 1)
  return arr
}

function getDepartureDateTime(route: RouteRecord, date: Date): Date {
  const dep = new Date(date)
  const [h, m] = route.departure_time.split(':').map(Number)
  dep.setUTCHours(h, m, 0, 0)
  return dep
}

const fallbackAirport = (icao: string): AirportInfo => ({
  name: '',
  icao,
  iata: '',
  city: '',
  country: '',
  countryCode: '',
})

function toFlightResult(route: RouteRecord, departureDate: string, airportMap: Map<string, AirportInfo>) {
  return {
    flightNumber: route.flightNumber,
    callsign: route.callsign,
    tags: route.tags,
    type: route.type,
    fleet_ids: route.fleet_ids,
    pax_lf_id: route.pax_lf_id,
    pax_luggage_lf_id: route.pax_luggage_lf_id,
    cargo_lf_id: route.cargo_lf_id,
    cargo_volume_lf_id: route.cargo_volume_lf_id,
    is_hidden: route.is_hidden,
    flight_rules: route.flight_rules,
    flight_type: route.flight_type,
    allow_callsign_change: route.allow_callsign_change,
    departure_time: route.departure_time,
    arrival_time: route.arrival_time,
    departure_date: departureDate,
    origin: airportMap.get(route.origin) ?? fallbackAirport(route.origin),
    destination: airportMap.get(route.destination) ?? fallbackAirport(route.destination),
    prices: { economy: 100, premium_economy: 300 },
  }
}

export function searchFlights(
  origin: string,
  destination: string,
  date: string,
  routeTable: RouteRecord[] = routes,
  airportMap: Map<string, AirportInfo> = airports,
) {
  const day = getDayOfWeek(date)
  const depDate = new Date(date)

  const direct = routeTable
    .filter((r) => r.origin === origin && r.destination === destination && r.service_days.includes(day))
    .map((r) => toFlightResult(r, date, airportMap))

  const outLegs = routeTable.filter((r) => r.origin === origin && r.service_days.includes(day))
  // No day filter here — leg 2 may operate on the next day if leg 1 is overnight
  const connectingCandidates = routeTable.filter((r) => r.destination === destination)

  const one_stop: ReturnType<typeof toFlightResult>[][] = []
  for (const f1 of outLegs) {
    const arr1 = getArrivalDateTime(f1, depDate)
    const connectionDateStr = arr1.toISOString().slice(0, 10)
    const connectionDay = getDayOfWeek(connectionDateStr)
    const connectionDateBase = new Date(connectionDateStr)

    for (const f2 of connectingCandidates) {
      if (f1.destination !== f2.origin) continue
      if (!f2.service_days.includes(connectionDay)) continue
      const dep2 = getDepartureDateTime(f2, connectionDateBase)
      if (arr1 >= dep2) continue
      const connectionMinutes = (dep2.getTime() - arr1.getTime()) / (60 * 1000)
      if (connectionMinutes < MIN_CONNECTION_MINUTES) continue
      one_stop.push([toFlightResult(f1, date, airportMap), toFlightResult(f2, connectionDateStr, airportMap)])
    }
  }

  return { direct, one_stop }
}

export type FlightsOneWayResult = ListFlightsResponseOneWayType
export type FlightsRoundtripResult = ListFlightsResponseRoundtripType

export function getFlightsOneWay(filters: ListFlightsQueryParams): FlightsOneWayResult {
  const result = searchFlights(filters.departure_airport, filters.arrival_airport, filters.departure_date)
  return {
    flights: {
      direct: result.direct as FlightsOneWayResult['flights']['direct'],
      one_stop: result.one_stop as FlightsOneWayResult['flights']['one_stop'],
    },
  }
}

export function getFlightsRoundtrip(
  outboundFilters: ListFlightsQueryParams,
  returnFilters: { departure_airport: string; arrival_airport: string; departure_date: string },
): FlightsRoundtripResult {
  const outbound = searchFlights(
    outboundFilters.departure_airport,
    outboundFilters.arrival_airport,
    outboundFilters.departure_date,
  )
  const ret = searchFlights(returnFilters.departure_airport, returnFilters.arrival_airport, returnFilters.departure_date)
  return {
    flights: {
      outbound: {
        direct: outbound.direct as FlightsRoundtripResult['flights']['outbound']['direct'],
        one_stop: outbound.one_stop as FlightsRoundtripResult['flights']['outbound']['one_stop'],
      },
      return: {
        direct: ret.direct as FlightsRoundtripResult['flights']['return']['direct'],
        one_stop: ret.one_stop as FlightsRoundtripResult['flights']['return']['one_stop'],
      },
    },
  }
}
