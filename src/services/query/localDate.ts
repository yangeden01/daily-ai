const pad = (value: number): string => String(value).padStart(2, '0')

export const formatLocalDate = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const monthRange = (year: number, monthIndex: number): { dateFrom: string; dateTo: string } => ({
  dateFrom: formatLocalDate(new Date(year, monthIndex, 1)),
  dateTo: formatLocalDate(new Date(year, monthIndex + 1, 0)),
})

export const yearRange = (year: number): { dateFrom: string; dateTo: string } => ({
  dateFrom: `${year}-01-01`,
  dateTo: `${year}-12-31`,
})
