export interface CategoryStatistic {
  category: string
  count: number
}

export interface MonthlyStatistic {
  month: string
  count: number
}

export interface EventStatistics {
  eventCount: number
  amountTotal: number
  categories: CategoryStatistic[]
  recentMonths: MonthlyStatistic[]
}
