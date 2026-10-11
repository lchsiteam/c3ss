const DAY_IN_MS = 24 * 60 * 60 * 1000

const startOfDay = (date: Date) => {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

const compareAscending = (first: number | null, second: number | null) => {
  if (first === null) return second === null ? 0 : 1
  if (second === null) return -1
  return first - second
}

export const parseApplicationDate = (value: string | null | undefined) => {
  if (!value) return null

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const applicationDateKey = (value: string | null | undefined) => {
  const date = parseApplicationDate(value)
  return date ? startOfDay(date) : null
}

export const formatApplicationDate = (value: string | null | undefined) => {
  const date = parseApplicationDate(value)
  if (!date) return null

  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
}

export const applicationDateIsFuture = (
  value: string | null | undefined,
  reference: Date = new Date(),
) => {
  const dateKey = applicationDateKey(value)
  return dateKey !== null && dateKey > startOfDay(reference)
}

type ScheduledApplication = {
  deadline?: string | null
  openDate?: string | null
  openUnknown?: boolean | null
}

export const compareApplicationSchedule = <T extends ScheduledApplication>(
  first: T,
  second: T,
  reference: Date = new Date(),
  getSchedule: (item: T) => ScheduledApplication = (item) => item,
) => {
  const today = startOfDay(reference)
  const firstDates = getSchedule(first)
  const secondDates = getSchedule(second)
  const firstOpenDate = applicationDateKey(firstDates.openDate)
  const secondOpenDate = applicationDateKey(secondDates.openDate)
  const firstDeadline = applicationDateKey(firstDates.deadline)
  const secondDeadline = applicationDateKey(secondDates.deadline)

  const group = (
    openUnknown: boolean | null | undefined,
    openDate: number | null,
    deadline: number | null,
  ) => {
    if (openUnknown === true) return 3
    if (openDate !== null && openDate > today) return 1
    if (deadline !== null && deadline < today) return 2
    return 0
  }

  const firstGroup = group(firstDates.openUnknown, firstOpenDate, firstDeadline)
  const secondGroup = group(secondDates.openUnknown, secondOpenDate, secondDeadline)
  if (firstGroup !== secondGroup) return firstGroup - secondGroup

  if (firstGroup === 1) {
    return compareAscending(firstOpenDate, secondOpenDate)
  }

  if (firstGroup === 2) {
    return compareAscending(secondDeadline, firstDeadline)
  }

  if (firstGroup === 3) return 0

  return compareAscending(firstDeadline, secondDeadline)
}

export const sortByApplicationSchedule = <T extends ScheduledApplication>(
  items: T[],
  reference: Date = new Date(),
  getSchedule: (item: T) => ScheduledApplication = (item) => item,
) => {
  return [...items].sort((first, second) =>
    compareApplicationSchedule(first, second, reference, getSchedule),
  )
}

export const daysUntilApplicationDate = (
  value: string | null | undefined,
  reference: Date = new Date(),
) => {
  const dateKey = applicationDateKey(value)
  if (dateKey === null) return null

  return Math.ceil((dateKey - startOfDay(reference)) / DAY_IN_MS)
}
