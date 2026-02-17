import neo4j from 'neo4j-driver'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import 'dotenv/config'
import { env } from './helpers/env.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }

  // Add the last field
  result.push(current)

  return result
}

async function seedDatabase() {
  // Connect to Neo4j
  const driver = neo4j.driver(env.NEO4J_URI, neo4j.auth.basic(env.NEO4J_USER, env.NEO4J_PASSWORD))

  const session = driver.session()

  try {
    console.log('Starting database seeding...')

    // Clear existing data
    console.log('Clearing existing data...')
    await session.run('MATCH (n) DETACH DELETE n')

    // Import airports
    console.log('Importing airports...')
    const airportsPath = path.join(__dirname, 'assets', 'airports.csv')
    const airportsData = fs.readFileSync(airportsPath, 'utf-8')
    const airportsLines = airportsData.split('\n')
    const airportDataLines = airportsLines.slice(1) // Skip header

    for (const line of airportDataLines) {
      if (!line.trim()) continue
      const cols = parseCSVLine(line)
      const [name, icao, iata, city, country, countryCode] = [
        cols[0] ?? '',
        cols[1] ?? '',
        cols[2] ?? '',
        cols[3] ?? '',
        cols[4] ?? '',
        cols[5] ?? '',
      ]
      if (icao) {
        await session.run(
          'CREATE (a:Airport {icao: $icao, name: $name, iata: $iata, city: $city, country: $country, countryCode: $countryCode})',
          { icao, name, iata, city, country, countryCode },
        )
      }
    }

    // Import flights
    console.log('Importing flights...')
    const flightsPath = path.join(__dirname, 'assets', 'flights.csv')
    const flightsData = fs.readFileSync(flightsPath, 'utf-8')
    const flightsLines = flightsData.split('\n').slice(1) // Skip header

    for (const line of flightsLines) {
      if (!line.trim()) continue
      const columns = parseCSVLine(line)
      const flightNumber = columns[0]
      const origin = columns[1]
      const destination = columns[2]
      const tags = columns[3]
      const departureTime = columns[4]
      const arrivalTime = columns[5]
      const serviceDays = columns[6]
      const fleetIds = columns[7]
      const paxLfId = columns[8]
      const paxLuggageLfId = columns[9]
      const cargoLfId = columns[10]
      const cargoVolumeLfId = columns[11]
      const callsign = columns[12]
      const type = columns[13]
      const isHidden = columns[14]
      const flightRules = columns[15]
      const flightType = columns[16]
      const allowCallsignChange = columns[17]

      if (flightNumber && origin && destination && departureTime && arrivalTime && serviceDays) {
        // Create flight node
        const result = await session.run(
          `CREATE (f:Flight {
            flightNumber: $flightNumber,
            departure_time: $departureTime,
            arrival_time: $arrivalTime,
            service_days: $serviceDays,
            tags: $tags,
            fleet_ids: $fleetIds,
            pax_lf_id: $paxLfId,
            pax_luggage_lf_id: $paxLuggageLfId,
            cargo_lf_id: $cargoLfId,
            cargo_volume_lf_id: $cargoVolumeLfId,
            callsign: $callsign,
            type: $type,
            is_hidden: $isHidden,
            flight_rules: $flightRules,
            flight_type: $flightType,
            allow_callsign_change: $allowCallsignChange
          }) RETURN f`,
          {
            flightNumber,
            departureTime,
            arrivalTime,
            serviceDays,
            tags,
            fleetIds,
            paxLfId,
            paxLuggageLfId,
            cargoLfId,
            cargoVolumeLfId,
            callsign,
            type,
            isHidden,
            flightRules,
            flightType,
            allowCallsignChange,
          },
        )

        const flightNode = result.records[0].get('f')

        // Create relationships
        await session.run(
          `MATCH (f:Flight), (dep:Airport {icao: $origin}), (arr:Airport {icao: $destination})
           WHERE id(f) = $flightId
           CREATE (f)-[:DEPARTS_FROM]->(dep), (f)-[:ARRIVES_TO]->(arr)`,
          { flightId: flightNode.identity, origin, destination },
        )
      }
    }

    console.log('Database seeding completed successfully!')
  } catch (error) {
    console.error('Error seeding database:', error)
  } finally {
    await session.close()
    await driver.close()
  }
}

seedDatabase()
