import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { dev } from '$app/environment'
import { env } from '$env/dynamic/private'
import { PUBLIC_SUPABASE_PUBLISHABLE_KEY, PUBLIC_SUPABASE_URL } from '$env/static/public'
import { createClient } from '@supabase/supabase-js'
import { fail } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { ScholarshipDTO } from '$lib/scripts/scholarships'
import type { SummerDTO } from '$lib/scripts/summerPrograms'

const SESSION_COOKIE = 'c3ss_admin_session'
const SESSION_DURATION_SECONDS = 8 * 60 * 60

type CatalogType = 'scholarships' | 'summerprograms'
type WriteMode = 'create' | 'save'
type ActionEvent = Parameters<Actions['create']>[0]

const isCatalogType = (value: FormDataEntryValue | null): value is CatalogType =>
  value === 'scholarships' || value === 'summerprograms'

const tableFor = (type: CatalogType) =>
  type === 'scholarships' ? 'scholarships' : 'summerprograms'

const sessionKey = () => env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || ''
const signSession = (expiresAt: string) => createHmac('sha256', sessionKey()).update(`c3ss-admin:${expiresAt}`).digest('base64url')

const isAuthenticated = (cookie: string | undefined) => {
  if (!cookie || !sessionKey()) return false

  const [expiresAt, signature, extra] = cookie.split('.')
  if (!expiresAt || !signature || extra || !/^\d+$/.test(expiresAt)) return false
  if (Number(expiresAt) <= Date.now()) return false

  const expected = Buffer.from(signSession(expiresAt))
  const received = Buffer.from(signature)
  return expected.length === received.length && timingSafeEqual(expected, received)
}

const doTheAdminCookie = (cookies: ActionEvent['cookies']) => {
  const expiresAt = String(Date.now() + SESSION_DURATION_SECONDS * 1000)
  cookies.set(SESSION_COOKIE, `${expiresAt}.${signSession(expiresAt)}`, {
    httpOnly: true,
    secure: !dev,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS
  })
}

const passwordMatches = (candidate: string, expected: string) => {
  const candidateHash = createHash('sha256').update(candidate).digest()
  const expectedHash = createHash('sha256').update(expected).digest()
  return timingSafeEqual(candidateHash, expectedHash)
}

const privilegedKey = () => env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY

const makeSupabaseClient = () =>
  createClient(
    PUBLIC_SUPABASE_URL,
    privilegedKey() || PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

const noAccessFailed = (cookies: ActionEvent['cookies']) => {
  if (!isAuthenticated(cookies.get(SESSION_COOKIE))) {
    return fail(401, { error: 'Your admin session expired. Sign in again.' })
  }

  if (!privilegedKey()) {
    return fail(503, {
      error: 'Database editing is not configured. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to the server environment.'
    })
  }

  return null
}

const parseFormThing = (form: FormData, field: string, label = field) => {
  const value = form.get(field)
  if (typeof value !== 'string') throw new Error(`Missing ${label}.`)

  try {
    return JSON.parse(value) as unknown
  } catch {
    throw new Error(`${label} must contain valid JSON.`)
  }
}

const textField = (form: FormData, field: string, label = field) => {
  const value = form.get(field)
  if (typeof value !== 'string') throw new Error(`Missing ${label}.`)
  return value.trim()
}

const nullableText = (form: FormData, field: string, label = field) =>
  textField(form, field, label) || null

const requiredText = (form: FormData, field: string, label = field) => {
  const value = textField(form, field, label)
  if (!value) throw new Error(`${label} is required.`)
  return value
}

const nullableDate = (form: FormData, field: string, label = field) => {
  const value = nullableText(form, field, label)
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} must be a valid date.`)

  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${label} must be a valid date.`)
  }

  return value
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isIntegerArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((item): item is number => Number.isInteger(item))

const readGrades = (grades: unknown, allowNull: boolean) => {
  if (allowNull && grades === null) return null
  if (!isIntegerArray(grades)) {
    const suffix = allowNull ? ', or null' : ''
    throw new Error(`The grades must be a JSON array of whole numbers${suffix}`)
  }
  return grades
}

const isAmountRange = (value: unknown): value is [number, number | 'full-tuition'] => {
  if (!Array.isArray(value) || value.length !== 2) return false

  const [minimum, maximum] = value
  if (typeof minimum !== 'number' || !Number.isFinite(minimum) || minimum < 0) return false
  if (typeof maximum === 'number') return Number.isFinite(maximum) && maximum >= minimum
  return maximum === 'full-tuition'
}

const isAward = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false

  const award = value as { place?: unknown; amount?: unknown }
  const validPlace = typeof award.place === 'number' && Number.isInteger(award.place) && award.place >= 1
  const validAmount =
    (typeof award.amount === 'number' && Number.isFinite(award.amount) && award.amount >= 0) ||
    isAmountRange(award.amount)

  return validPlace && validAmount
}

const isAwardList = (value: unknown) => Array.isArray(value) && value.every(isAward)

const buildListing = (form: FormData, type: CatalogType) => {
  const filterValues = parseFormThing(form, 'filters', 'Filters')
  const gradeValues = parseFormThing(form, 'availableGrades', 'Available grades')
  const endowment = type === 'scholarships'
    ? parseFormThing(form, 'endowment', 'Awards')
    : null

  if (!isStringArray(filterValues)) throw new Error('Choose valid filters.')
  const availableGrades = readGrades(gradeValues, type === 'summerprograms')

  if (type === 'scholarships') {
    if (!isAwardList(endowment)) throw new Error('Check the award places and amounts.')

    return {
      name: requiredText(form, 'name', 'Name'),
      description: requiredText(form, 'description', 'Description'),
      deadline: nullableDate(form, 'deadline', 'Deadline'),
      openDate: nullableDate(form, 'openDate', 'Application opens'),
      openUnknown: form.get('openUnknown') === 'on',
      primary_link: requiredText(form, 'primary_link', 'Primary link'),
      filters: filterValues,
      availableGrades,
      endowment
    }
  }

  return {
    created: nullableDate(form, 'created', 'Created date'),
    name: requiredText(form, 'name', 'Name'),
    description: nullableText(form, 'description', 'Description'),
    deadline: nullableDate(form, 'deadline', 'Deadline'),
    openDate: nullableDate(form, 'openDate', 'Application opens'),
    openUnknown: form.get('openUnknown') === 'on',
    start_date: nullableDate(form, 'start_date', 'Program start date'),
    primary_link: nullableText(form, 'primary_link', 'Primary link'),
    filters: filterValues,
    availableGrades,
    location: nullableText(form, 'location', 'Location')
  }
}

const catalogFromForm = (form: FormData) => {
  const value = form.get('catalogType')
  return isCatalogType(value) ? value : null
}

const idFromForm = (form: FormData) => {
  const value = form.get('id')
  const id = typeof value === 'string' ? Number(value) : NaN
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const saveListing = async (event: ActionEvent, mode: WriteMode) => {
  const accessFailure = noAccessFailed(event.cookies)
  if (accessFailure) return accessFailure

  const form = await event.request.formData()
  const type = catalogFromForm(form)
  if (!type) return fail(400, { error: 'Choose a valid catalog' })

  const id = mode === 'save' ? idFromForm(form) : null
  if (mode === 'save' && id === null) return fail(400, { error: 'Choose a valid record' })

  let values: Record<string, unknown>
  try {
    values = buildListing(form, type)
  } catch (error) {
    return fail(400, { error: error instanceof Error ? error.message : 'Check the submitted fields' })
  }

  const supabase = makeSupabaseClient()
  const table = tableFor(type)
  const result = mode === 'create'
    ? await supabase.from(table).insert(values).select('*').single()
    : await supabase.from(table).update(values).eq('id', id as number).select('*').maybeSingle()

  if (result.error) {
    const logMessage = mode === 'create'
      ? `Admin insert failed for ${table}:`
      : `Admin update failed for ${table} record ${id}:`
    console.error(logMessage, result.error.message)
    const message = mode === 'create'
      ? 'The database could not create this listing check the fields and try again'
      : 'The database rejected this change check the values and try again'
    return fail(500, { error: message })
  }

  if (mode === 'save' && !result.data) {
    return fail(404, { error: 'That record could not be found refresh and select it again' })
  }

  return {
    success: true,
    message: mode === 'create' ? 'Listing created.' : 'Changes saved to the database',
    record: result.data as ScholarshipDTO | SummerDTO,
    catalogType: type
  }
}

export const load: PageServerLoad = async ({ cookies, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' })

  const authenticated = isAuthenticated(cookies.get(SESSION_COOKIE))
  const loginConfigured = Boolean(env.ADMIN_PASSWORD)
  if (!authenticated) return { authenticated: false, loginConfigured }

  const supabase = makeSupabaseClient()
  const [scholarships, summerPrograms] = await Promise.all([
    supabase.from('scholarships').select('*').order('name'),
    supabase.from('summerprograms').select('*').order('name')
  ])

  const errors = [scholarships.error, summerPrograms.error].filter(Boolean)
  if (errors.length) console.error('Admin catalog load failed:', errors.map((error) => error?.message))

  return {
    authenticated: true,
    loginConfigured,
    canSave: Boolean(privilegedKey()),
    scholarships: (scholarships.data ?? []) as ScholarshipDTO[],
    summerPrograms: (summerPrograms.data ?? []) as SummerDTO[],
    loadError: errors.length ? 'Could not load one or more catalog lists from the database' : null
  }
}

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const form = await request.formData()
    const candidate = form.get('password')
    const expected = env.ADMIN_PASSWORD

    if (!expected) return fail(503, { error: 'Admin access not configured because devs are udmb' })
    if (typeof candidate !== 'string' || !passwordMatches(candidate, expected)) {
      return fail(401, { error: 'Password failed try again please' })
    }

    doTheAdminCookie(cookies)
    return { success: true }
  },

  logout: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE, { path: '/' })
    return { success: true }
  },

  create: (event) => saveListing(event, 'create'),

  delete: async ({ request, cookies }) => {
    const accessFailure = noAccessFailed(cookies)
    if (accessFailure) return accessFailure

    const form = await request.formData()
    const type = catalogFromForm(form)
    if (!type) return fail(400, { error: 'Choose a valid' })

    const id = idFromForm(form)
    if (id === null) return fail(400, { error: 'Choose a valid record' })

    const { data, error } = await makeSupabaseClient()
      .from(tableFor(type))
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle()

    if (error) {
      console.error(`Admin delete failed for ${tableFor(type)} record ${id}:`, error.message)
      return fail(500, { error: 'Sorry the listing failed to removed' })
    }
    if (!data) return fail(404, { error: 'Couldn\'t be found, try again' })

    return { success: true, deletedId: id, catalogType: type }
  },

  save: (event) => saveListing(event, 'save')
}
