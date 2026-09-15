const padDatePart = (value: number): string => String(value).padStart(2, '0')

export const toLocalDateInputValue = (date = new Date()): string =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
