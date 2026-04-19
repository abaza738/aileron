import { Type } from 'typebox'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import {
  ListFlightsQueryParams,
  ListFlightsResponseRoundtrip,
  ListFlightsResponseOneWay,
} from '../types/flights.js'
import { getFlightsOneWay, getFlightsRoundtrip } from '../services/flightSearch.js'

export const flightsController: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/', ListFlightsRequest, async (request, reply) => {
    if (request.query.type === 'roundtrip' && !request.query.return_date) {
      return reply.code(400).send({
        error: 'Bad Request',
        message: 'return_date is required for roundtrip search',
      })
    }

    if (request.query.type === 'roundtrip') {
      const returnFilters = {
        departure_airport: request.query.arrival_airport,
        arrival_airport: request.query.departure_airport,
        departure_date: request.query.return_date!,
      }
      return getFlightsRoundtrip(request.query, returnFilters)
    }

    return getFlightsOneWay(request.query)
  })
}

const ListFlightsRequest = {
  schema: {
    querystring: ListFlightsQueryParams,
    response: {
      200: Type.Union([ListFlightsResponseRoundtrip, ListFlightsResponseOneWay]),
      400: Type.Object({
        error: Type.String(),
        message: Type.String(),
      }),
    },
  },
}
