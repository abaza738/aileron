import { Type } from 'typebox'

export const flightTypes = ['roundtrip', 'one-way']
export type FlightType = (typeof flightTypes)[number]

export const ListFlightsQueryParams = Type.Object({
  departure_airport: Type.String(),
  arrival_airport: Type.String(),
  type: Type.Enum(flightTypes),
  departure_date: Type.String(),
  return_date: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number()),
  offset: Type.Optional(Type.Number()),
})

export type ListFlightsQueryParams = Type.Static<typeof ListFlightsQueryParams>

export const AirportSchema = Type.Object({
  name: Type.String(),
  icao: Type.String(),
  iata: Type.String(),
  city: Type.String(),
  country: Type.String(),
  countryCode: Type.String(),
})

export const FlightSchema = Type.Object({
  allow_callsign_change: Type.Boolean(),
  arrival_time: Type.String(),
  pax_lf_id: Type.String(),
  fleet_ids: Type.String(),
  is_hidden: Type.Boolean(),
  type: Type.String(),
  tags: Type.String(),
  flightNumber: Type.String(),
  cargo_volume_lf_id: Type.String(),
  cargo_lf_id: Type.String(),
  callsign: Type.String(),
  flight_type: Type.String(),
  flight_rules: Type.String(),
  departure_time: Type.String(),
  pax_luggage_lf_id: Type.String(),
  origin: AirportSchema,
  destination: AirportSchema,
  prices: Type.Object({
    economy: Type.Number(),
    premium_economy: Type.Number(),
  }),
  departure_date: Type.String(),
})

export const ListFlightsResponseRoundtrip = Type.Object({
  flights: Type.Object({
    outbound: Type.Object({
      direct: Type.Array(FlightSchema),
      one_stop: Type.Array(Type.Array(FlightSchema)),
    }),
    return: Type.Object({
      direct: Type.Array(FlightSchema),
      one_stop: Type.Array(Type.Array(FlightSchema)),
    }),
  }),
})

export const ListFlightsResponseOneWay = Type.Object({
  flights: Type.Object({
    direct: Type.Array(FlightSchema),
    one_stop: Type.Array(Type.Array(FlightSchema)),
  }),
})

export type ListFlightsResponseRoundtripType = Type.Static<typeof ListFlightsResponseRoundtrip>
export type ListFlightsResponseOneWayType = Type.Static<typeof ListFlightsResponseOneWay>

export type ListFlightsResponse = {
  departure_airport: string
  arrival_airport: string
  type: FlightType
}
