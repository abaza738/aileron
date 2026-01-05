import { Type } from 'typebox'

export const flightTypes = ['roundtrip', 'one-way']
export type FlightType = (typeof flightTypes)[number]

export const ListFlightsQueryParams = Type.Object({
  departure_airport: Type.String(),
  arrival_airport: Type.String(),
  type: Type.Enum(flightTypes),
  departure_date: Type.String(),
  return_date: Type.String(),
  limit: Type.Optional(Type.Number()),
  offset: Type.Optional(Type.Number()),
})

export type ListFlightsQueryParams = Type.Static<typeof ListFlightsQueryParams>
export type ListFlightsResponse = {
  departure_airport: string
  arrival_airport: string
  type: FlightType
}
