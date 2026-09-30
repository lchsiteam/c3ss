const formatCurrency = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  })

export type EndowmentRange = [number, number | "full-tuition"]

export type Endowment = {
  place: number
  amount: number | EndowmentRange
}

export const FILTER_COLORS = {
  cyan: "#52cfeb",
  red: "#eb5752",
  green: "#65ba6a",
  yellow: "#debe68",
  blue: "#5276eb",
  orange: "#eb8552",
  purple: "#b882e0",
  gold: "#e3ab62",
  pink: "#e362b8",
  orangeRed: "#d8372b",
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
    description: "The scholarship has some relevancy to science.",
    color: "green",
  },
  ethnic: {
    name: "Ethnic",
    description: "The scholarship is intended for a specific ethnic community.",
    color: "purple",
  },
  needbased: {
    name: "Need-Based",
    description: "The scholarship considers financial need.",
    color: "gold",
  },
  experienceincluded: {
    name: "Experience Included",
    description: "The scholarship offers an additional experience on top of the financial endowment.",
    color: "red",
  },
  literaryarts: {
    name: "Literary Arts",
    description: "The scholarship has some relevancy to the literary arts.",
    color: "orange",
  },
  advocacy: {
    name: "Advocacy",
    description: "The scholarship has some relevancy to political or social activism.",
    color: "orange",
  },
  meritonly: {
    name: "Merit Only",
    description: "The scholarship only considers merit in applicants.",
    color: "gold",
  },
  majorspecific: {
    name: "Major-Specific",
    description: "The scholarship only accepts applicants pursuing a specific major in college/other program.",
    color: "cyan",
  },
  local: {
    name: "Local",
    description: "This scholarship is only available to students in the La Canada/SGV area. (It may be easier to get!)",
    color: "pink",
  },
  womenonly: {
    name: "Women Only",
    description: "This scholarship is only available to female students.",
    color: "orangeRed",
  }
} as const satisfies Record<string, FilterDefinition>

export type ScholarshipFilterKey = keyof typeof filterDefinitions

export type ScholarshipFilter = FilterDefinition & {
  key: ScholarshipFilterKey
}

export type ScholarshipDTO = {
  id: number
  name: string
  description: string
  deadline: string
  primary_link: string
  filters?: ScholarshipFilterKey[] | null
  availableGrades: number[]
  endowment: Endowment[]
}

export class Scholarship implements ScholarshipDTO {
  id: number
  name: string
  description: string
  deadline: string
  primary_link: string
  filters: ScholarshipFilterKey[]
  availableGrades: number[]
  endowment: Endowment[]

  constructor(dto: ScholarshipDTO) {
    this.id = dto.id
    this.name = dto.name
    this.description = dto.description
    this.deadline = dto.deadline
    this.primary_link = dto.primary_link
    this.filters = dto.filters ?? []
    this.availableGrades = dto.availableGrades
    this.endowment = dto.endowment ?? []
  }

  static from(dto: ScholarshipDTO) {
    return new Scholarship(dto)
  }

  get deadlineDate() {
    return new Date(this.deadline)
  }

  formattedDeadline() {
    const date = this.deadlineDate
    return this.deadline ? `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}` : "Rolling Deadline"
  }

  daysUntil(reference: Date = new Date()) {
    const msPerDay = 1000 * 60 * 60 * 24
    const today = new Date(reference)
    today.setHours(0, 0, 0, 0)

    const target = new Date(this.deadline)
    target.setHours(0, 0, 0, 0)

    return Math.ceil((target.getTime() - today.getTime()) / msPerDay)
  }

  countdownClass(reference?: Date) {
    const days = this.daysUntil(reference)
    if (days < 0) return "passed" as const
    if (days <= 3) return "hot" as const
    if (days <= 10) return "warm" as const
    return "calm" as const
  }

  countdownLabel(reference?: Date, { short = false } = {}) {
    const days = this.daysUntil(reference)
    if (days < 0) return "Passed"
    if (short) return `${days}d`
    return `${days} days`
  }

  endowmentRange() {
    let lowest = Number.POSITIVE_INFINITY
    let highest: number | "full-tuition" = Number.NEGATIVE_INFINITY

    if (!this.endowment || this.endowment.length === 0) return null

    for (const prize of this.endowment) {
      const [min, max] = Array.isArray(prize.amount)
        ? prize.amount
        : [prize.amount, prize.amount]

      lowest = Math.min(lowest, min)
      highest =
        highest === "full-tuition"
          ? "full-tuition"
          : max === "full-tuition"
            ? "full-tuition"
            : Math.max(highest, max)
    }

    if (!Number.isFinite(lowest) || (highest !== "full-tuition" && !Number.isFinite(highest))) {
      return null
    }

    return lowest === highest
      ? formatCurrency(lowest)
      : `${formatCurrency(lowest)} – ${highest === "full-tuition" ? "Full Tuition" : formatCurrency(highest)}`
  }

  displayFilters(): ScholarshipFilter[] {
    return this.filters.flatMap((key) => {
      const definition = filterDefinitions[key]
      return definition ? [{ key, ...definition }] : []
    })
  }

  toJSON(): ScholarshipDTO {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      deadline: this.deadline,
      primary_link: this.primary_link,
      filters: this.filters,
      availableGrades: this.availableGrades,
      endowment: this.endowment,
    }
  }
}
