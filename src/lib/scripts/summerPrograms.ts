import {
  applicationDateIsFuture,
  daysUntilApplicationDate,
  formatApplicationDate,
  parseApplicationDate,
} from "./applicationDates"

export const FILTER_COLORS = {
  cyan: "#52cfeb",
  red: "#eb5752",
  green: "#65ba6a",
  yellow: "#debe68",
  blue: "#5276eb",
  orange: "#eb8552",
  purple: "#b882e0",
  gold: "#e3ab62",
} as const

export type FilterColor = keyof typeof FILTER_COLORS

export type FilterDefinition = {
  name: string
  description: string
  color: FilterColor
}

const filterDefinitions = {
  science: {
    name: "Science",
    description: "The summer program has some relevancy to science.",
    color: "green",
  },
  ethnic: {
    name: "Ethnic",
    description: "The summer program is intended for a specific ethnic community.",
    color: "purple",
  },
  needbased: {
    name: "Need-Based",
    description: "The summer program considers financial need.",
    color: "gold",
  },
  literaryarts: {
    name: "Literary Arts",
    description: "The summer program has some relevancy to the literary arts.",
    color: "orange",
  },
  advocacy: {
    name: "Advocacy",
    description: "The summer program has some relevancy to political or social activism.",
    color: "orange",
  },
  meritonly: {
    name: "Merit Only",
    description: "The summer program only considers merit in applicants.",
    color: "gold",
  },
} as const satisfies Record<string, FilterDefinition>

export type SummerFilterKey = keyof typeof filterDefinitions

export type SummerFilter = FilterDefinition & {
  key: SummerFilterKey
}

export type SummerDTO = {
  id: number
  name: string
  created: string | null
  description: string | null
  deadline: string | null
  openDate?: string | null
  openUnknown?: boolean | null
  start_date: string | null
  primary_link: string | null
  filters?: unknown
  availableGrades?: number[] | null
  location?: string
}

const isSummerFilterKey = (value: unknown): value is SummerFilterKey =>
  typeof value === "string" && value in filterDefinitions

const normalizeFilters = (filters: unknown): SummerFilterKey[] => {
  const values = Array.isArray(filters) ? filters : [filters]

  return values.filter(isSummerFilterKey)
}

export class Summer implements SummerDTO {
  id: number
  name: string
  created: string | null
  description: string
  deadline: string | null
  openDate?: string | null
  openUnknown: boolean
  start_date: string | null
  primary_link: string | null
  filters: SummerFilterKey[]
  availableGrades: number[]
  location?: string
  constructor(dto: SummerDTO) {
    this.id = dto.id
    this.name = dto.name
    this.created = dto.created
    this.description = dto.description ?? "No description available."
    this.deadline = dto.deadline
    this.openDate = dto.openDate ?? null
    this.openUnknown = dto.openUnknown === true
    this.start_date = dto.start_date
    this.primary_link = dto.primary_link
    this.filters = normalizeFilters(dto.filters)
    this.availableGrades = dto.availableGrades ?? []
    this.location = dto.location
  }

  static from(dto: SummerDTO) {
    return new Summer(dto)
  }

  get rollingDeadlineDate(): Date | null {
    return parseApplicationDate(this.start_date)
  }

  get deadlineDate(): Date | null {
    return parseApplicationDate(this.deadline)
  }

  get openDateDate(): Date | null {
    return parseApplicationDate(this.openDate)
  }

  openDateIsFuture(reference: Date = new Date()) {
    return applicationDateIsFuture(this.openDate, reference)
  }

  formattedOpenDate() {
    return formatApplicationDate(this.openDate)
  }

  rollingFormattedDeadline() {
    const date = this.rollingDeadlineDate

    if (!date) return "Not listed"

    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  }


  formattedDeadline() {
    const date = this.deadlineDate

    if (!date) return "Not listed"

    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`
  }

  daysFrom(reference: Date = new Date()) {
    const target = this.deadlineDate ?? this.rollingDeadlineDate
    if (!target) return null

    const msPerDay = 1000 * 60 * 60 * 24
    const today = new Date(reference)
    today.setHours(0, 0, 0, 0)

    target.setHours(0, 0, 0, 0)

    return Math.ceil((target.getTime() - today.getTime()) / msPerDay)
  }

  rollingCountdownClass(reference?: Date) {
    const days = this.rollingDaysUntil(reference)
    console.log(days)
    if (days === null) return "calm" as const
    if (days < -30) return "likely closed" as const
    if (days < 0) return "opened" as const

    return "calm" as const
  }

  rollingCountdownLabel(reference?: Date, { short = false } = {}) {
    const days = this.rollingDaysUntil(reference)
    if (days === null) return "No deadline"
    if (days < 0) return "opened"
    if (days < -30) return "likely closed" as const
    if (short) return `${days}d`
    return `${days} days`
  }

  rollingDaysUntil(reference: Date = new Date()) {
    const target = this.rollingDeadlineDate
    if (!target) return null

    const msPerDay = 1000 * 60 * 60 * 24
    const today = new Date(reference)
    today.setHours(0, 0, 0, 0)

    target.setHours(0, 0, 0, 0)

    return Math.ceil((target.getTime() - today.getTime()) / msPerDay)
  }

  daysUntil(reference: Date = new Date()) {
    return daysUntilApplicationDate(this.deadline, reference)
  }

  countdownClass(reference?: Date) {
    const days = this.daysUntil(reference)
    if (days === null) return "calm" as const
    if (days < 0) return "passed" as const
    if (days <= 3) return "hot" as const
    if (days <= 10) return "warm" as const
    return "calm" as const
  }

  countdownLabel(reference?: Date, { short = false } = {}) {
    const days = this.daysUntil(reference)
    if (days === null) return "No deadline"
    if (days < 0) return "Passed"
    if (short) return `${days}d`
    return `${days} days`
  }

  displayFilters(): SummerFilter[] {
    return this.filters.flatMap((key) => {
      const definition = filterDefinitions[key]
      return definition ? [{ key, ...definition }] : []
    })
  }

  toJSON(): SummerDTO {
    return {
      id: this.id,
      name: this.name,
      created: this.created,
      description: this.description,
      deadline: this.deadline,
      openDate: this.openDate,
      openUnknown: this.openUnknown,
      start_date: this.start_date,
      primary_link: this.primary_link,
      filters: this.filters,
      availableGrades: this.availableGrades,
      location: this.location,
    }
  }
}
