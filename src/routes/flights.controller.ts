import neo4j from 'neo4j-driver'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { ListFlightsQueryParams } from '../types/flights.js'
import { getDayOfWeek, getNextFlightDates } from '../helpers/date.js'

function expandFlights(records: any[], baseDate: string) {
  const expanded: any[] = []
  for (const r of records) {
    const itinerary = r.get('itinerary')
    let serviceDays: string[]
    if (itinerary.length === 1) {
      serviceDays = itinerary[0].properties.service_days.split(',')
    } else {
      const days1 = itinerary[0].properties.service_days.split(',')
      const days2 = itinerary[1].properties.service_days.split(',')
      serviceDays = days1.filter((d: string) => days2.includes(d))
      // Check connection time
      const depDate = new Date(baseDate)
      const arr1 = getArrivalDateTime(itinerary[0].properties, depDate)
      const dep2 = getDepartureDateTime(itinerary[1].properties, depDate)
      if (arr1 >= dep2) continue // invalid connection
    }
    const dates = getNextFlightDates(baseDate, serviceDays)
    for (const date of dates) {
      const newItinerary = itinerary.map((f: any) => ({
        ...f.properties,
        service_days: undefined,
        departure_date: date,
      }))
      expanded.push({ itinerary: newItinerary })
    }
  }
  return expanded
}

function getArrivalDateTime(flight: any, date: Date): Date {
  const depTime = flight.departure_time
  const arrTime = flight.arrival_time
  const dep = new Date(date)
  const [h, m] = depTime.split(':').map(Number)
  dep.setHours(h, m, 0, 0)
  const arr = new Date(date)
  const [ah, am] = arrTime.split(':').map(Number)
  arr.setHours(ah, am, 0, 0)
  if (arr < dep) arr.setDate(arr.getDate() + 1) // crosses midnight
  return arr
}

function getDepartureDateTime(flight: any, date: Date): Date {
  const depTime = flight.departure_time
  const dep = new Date(date)
  const [h, m] = depTime.split(':').map(Number)
  dep.setHours(h, m, 0, 0)
  return dep
}

export const flightsController: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', ListFlightsRequest, async (request) => {
    const session = fastify.neo4j.session()

    if (request.query.type === 'roundtrip') {
      const outboundFilters = { ...request.query }
      const returnFilters = {
        departure_airport: request.query.arrival_airport,
        arrival_airport: request.query.departure_airport,
        departure_date: request.query.return_date,
      }

      const outbound = buildFlightQuery(outboundFilters)
      const returnQ = buildFlightQuery(returnFilters)

      const outboundFlights = await session.run(outbound.query, outbound.params)
      const returnFlights = await session.run(returnQ.query, returnQ.params)

      const outboundExpanded = expandFlights(outboundFlights.records, request.query.departure_date!)
      const returnExpanded = expandFlights(returnFlights.records, request.query.return_date!)

      const outboundDirect = outboundExpanded.filter((r) => r.itinerary.length === 1)
      const outboundOneStop = outboundExpanded.filter((r) => r.itinerary.length === 2)
      const returnDirect = returnExpanded.filter((r) => r.itinerary.length === 1)
      const returnOneStop = returnExpanded.filter((r) => r.itinerary.length === 2)

      return {
        flights: {
          outbound: {
            direct: outboundDirect.flatMap((r) => r.itinerary),
            one_stop: outboundOneStop.map((r) => r.itinerary),
          },
          return: {
            direct: returnDirect.flatMap((r) => r.itinerary),
            one_stop: returnOneStop.map((r) => r.itinerary),
          },
        },
      }
    } else {
      const { query, params } = buildFlightQuery(request.query)
      const flights = await session.run(query, params)

      const expandedRecords = expandFlights(flights.records, request.query.departure_date!)

      const direct = expandedRecords.filter((r) => r.itinerary.length === 1)
      const oneStop = expandedRecords.filter((r) => r.itinerary.length === 2)

      return {
        flights: {
          direct: direct.flatMap((r) => r.itinerary),
          one_stop: oneStop.map((r) => r.itinerary),
        },
      }
    }
  })
}

function buildFlightQuery(filters: Partial<ListFlightsQueryParams>) {
  const whereDirect: string[] = []
  const whereOneStop: string[] = []
  const params: Record<string, unknown> = {}

  params.limit = neo4j.int(filters.limit ?? 10)
  params.offset = neo4j.int(filters.offset ?? 0)

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
    MATCH (f1:Flight)-[:DEPARTS_FROM]->(dep:Airport)
    MATCH (f1)-[:ARRIVES_TO]->(arr:Airport)
    ${directWhere}
    RETURN [f1] AS itinerary

    UNION

    MATCH (f1:Flight)-[:DEPARTS_FROM]->(dep:Airport)
    MATCH (f1)-[:ARRIVES_TO]->(mid:Airport)
    MATCH (f2:Flight)-[:DEPARTS_FROM]->(mid)
    MATCH (f2)-[:ARRIVES_TO]->(arr:Airport)
    ${oneStopWhere}
    RETURN [f1, f2] AS itinerary
    SKIP $offset LIMIT $limit
  `

  return { query, params }
}

const ListFlightsRequest = {
  schema: {
    querystring: ListFlightsQueryParams,
  },
}
