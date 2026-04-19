import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const assetsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../assets')

export interface AirportInfo {
  name: string
  icao: string
  iata: string
  city: string
  country: string
  countryCode: string
}

export interface RouteRecord {
  flightNumber: string
  origin: string
  destination: string
  departure_time: string
  arrival_time: string
  service_days: string[]
  tags: string
  fleet_ids: string
  callsign: string
  type: string
  is_hidden: boolean
  flight_rules: string
  flight_type: string
  allow_callsign_change: boolean
  pax_lf_id: string
  pax_luggage_lf_id: string
  cargo_lf_id: string
  cargo_volume_lf_id: string
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

function loadAirports(): Map<string, AirportInfo> {
  const map = new Map<string, AirportInfo>()
  const lines = fs.readFileSync(path.join(assetsDir, 'airports.csv'), 'utf-8').split('\n').slice(1)
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = parseCSVLine(line)
    const icao = cols[1] ?? ''
    if (!icao) continue
    map.set(icao, {
      name: cols[0] ?? '',
      icao,
      iata: cols[2] ?? '',
      city: cols[3] ?? '',
      country: cols[4] ?? '',
      countryCode: cols[5]?.trim() ?? '',
    })
  }
  return map
}

function loadRoutes(): RouteRecord[] {
  const result: RouteRecord[] = []
  const lines = fs.readFileSync(path.join(assetsDir, 'flights.csv'), 'utf-8').split('\n').slice(1)
  for (const line of lines) {
    if (!line.trim()) continue
    const cols = parseCSVLine(line)
    const [flightNumber, origin, destination] = cols
    if (!flightNumber || !origin || !destination) continue
    result.push({
      flightNumber,
      origin,
      destination,
      tags: cols[3] ?? '',
      departure_time: cols[4] ?? '',
      arrival_time: cols[5] ?? '',
      service_days: (cols[6] ?? '').split(',').map((d) => d.trim().toLowerCase()),
      fleet_ids: cols[7] ?? '',
      pax_lf_id: cols[8] ?? '',
      pax_luggage_lf_id: cols[9] ?? '',
      cargo_lf_id: cols[10] ?? '',
      cargo_volume_lf_id: cols[11] ?? '',
      callsign: cols[12] ?? '',
      type: cols[13] ?? '',
      is_hidden: (cols[14] ?? '').toLowerCase() === 'true',
      flight_rules: cols[15] ?? '',
      flight_type: cols[16] ?? '',
      allow_callsign_change: (cols[17] ?? '').toLowerCase() === 'true',
    })
  }
  return result
}

export const airports = loadAirports()
export const routes = loadRoutes()
