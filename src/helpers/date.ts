const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

export function getDayOfWeek(dateString: string): string {
  const date = new Date(dateString)
  const dayIndex = date.getUTCDay()
  return daysOfWeek[dayIndex]
}

export function getNextFlightDates(departureDate: string, serviceDays: string[]): string[] {
  const date = new Date(departureDate)
  const dayIndex = date.getUTCDay()
  const dayName = daysOfWeek[dayIndex]
  if (serviceDays.some((d) => d.toLowerCase() === dayName)) {
    return [departureDate]
  }
  return []
}
