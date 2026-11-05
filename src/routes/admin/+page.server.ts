import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';
import { fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import type { Actions, PageServerLoad } from './$types';
import type { ScholarshipDTO } from '$lib/scripts/scholarships';
import type { SummerDTO } from '$lib/scripts/summerPrograms';

const SESSION_COOKIE = 'c3ss_admin_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 8;

type CatalogType = 'scholarships' | 'summerprograms';

const isCatalogType = (value: FormDataEntryValue | null): value is CatalogType =>
  value === 'scholarships' || value === 'summerprograms';

const sessionKey = () => env.ADMIN_SESSION_SECRET || env.ADMIN_PASSWORD || '';

const signatureFor = (expiresAt: string) =>
  createHmac('sha256', sessionKey()).update(`c3ss-admin:${expiresAt}`).digest('base64url');

const isAuthenticated = (cookie: string | undefined) => {
  if (!cookie || !sessionKey()) return false;

  const [expiresAt, signature, extra] = cookie.split('.');
  if (!expiresAt || !signature || extra || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Date.now()) return false;

  const expected = Buffer.from(signatureFor(expiresAt));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
};

const setAdminCookie = (cookies: Parameters<Actions['login']>[0]['cookies']) => {
  const expiresAt = String(Date.now() + SESSION_DURATION_SECONDS * 1000);
  cookies.set(SESSION_COOKIE, `${expiresAt}.${signatureFor(expiresAt)}`, {
    httpOnly: true,
    secure: !dev,
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_SECONDS
  });
};

const comparePassword = (candidate: string, expected: string) => {
  const candidateHash = createHash('sha256').update(candidate).digest();
  const expectedHash = createHash('sha256').update(expected).digest();
  return timingSafeEqual(candidateHash, expectedHash);
};

const privilegedKey = () => env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY;

const createReadClient = () =>
  createClient(
    PUBLIC_SUPABASE_URL,
    privilegedKey() || PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

const parseJsonField = (value: FormDataEntryValue | null, name: string) => {
  if (typeof value !== 'string') throw new Error(`Missing ${name}.`);
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${name} must contain valid JSON.`);
  }
};

const nullableText = (value: FormDataEntryValue | null, name: string) => {
  if (typeof value !== 'string') throw new Error(`Missing ${name}.`);
  return value.trim() === '' ? null : value.trim();
};

const requiredText = (value: FormDataEntryValue | null, name: string) => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name} is required.`);
  return value.trim();
};

const nullableDate = (value: FormDataEntryValue | null, name: string) => {
  const date = nullableText(value, name);
  if (date === null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${name} must be a valid date.`);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`${name} must be a valid date.`);
  }
  return date;
};

const isAwardList = (value: unknown) =>
  Array.isArray(value) && value.every((award) => {
    if (!award || typeof award !== 'object' || Array.isArray(award)) return false;
    const candidate = award as { place?: unknown; amount?: unknown };
    if (!Number.isInteger(candidate.place) || Number(candidate.place) < 1) return false;
    if (typeof candidate.amount === 'number') return Number.isFinite(candidate.amount) && candidate.amount >= 0;
    return Array.isArray(candidate.amount) && candidate.amount.length === 2 &&
      typeof candidate.amount[0] === 'number' && Number.isFinite(candidate.amount[0]) && candidate.amount[0] >= 0 &&
      (typeof candidate.amount[1] === 'number'
        ? Number.isFinite(candidate.amount[1]) && candidate.amount[1] >= candidate.amount[0]
        : candidate.amount[1] === 'full-tuition');
  });

const buildUpdate = (form: FormData, type: CatalogType) => {
  if (type === 'scholarships') {
    const filters = parseJsonField(form.get('filters'), 'Filters');
    const availableGrades = parseJsonField(form.get('availableGrades'), 'Available grades');
    const endowment = parseJsonField(form.get('endowment'), 'Awards');
    if (!Array.isArray(filters) || !filters.every((filter) => typeof filter === 'string')) {
      throw new Error('Choose valid filters.');
    }
    if (!Array.isArray(availableGrades) || !availableGrades.every(Number.isInteger)) {
      throw new Error('Available grades must be a JSON array of whole numbers.');
    }
    if (!isAwardList(endowment)) throw new Error('Check the award places and amounts.');

    return {
      name: requiredText(form.get('name'), 'Name'),
      description: requiredText(form.get('description'), 'Description'),
      deadline: nullableDate(form.get('deadline'), 'Deadline'),
      openDate: nullableDate(form.get('openDate'), 'Application opens'),
      openUnknown: form.get('openUnknown') === 'on',
      primary_link: requiredText(form.get('primary_link'), 'Primary link'),
      filters,
      availableGrades,
      endowment
    };
  }

  const filters = parseJsonField(form.get('filters'), 'Filters');
  const availableGrades = parseJsonField(form.get('availableGrades'), 'Available grades');
  if (!Array.isArray(filters) || !filters.every((filter) => typeof filter === 'string')) {
    throw new Error('Choose valid filters.');
  }
  if (availableGrades !== null && (!Array.isArray(availableGrades) || !availableGrades.every(Number.isInteger))) {
    throw new Error('Available grades must be a JSON array of whole numbers, or null.');
  }

  return {
    created: nullableDate(form.get('created'), 'Created date'),
    name: requiredText(form.get('name'), 'Name'),
    description: nullableText(form.get('description'), 'Description'),
    deadline: nullableDate(form.get('deadline'), 'Deadline'),
    openDate: nullableDate(form.get('openDate'), 'Application opens'),
    openUnknown: form.get('openUnknown') === 'on',
    start_date: nullableDate(form.get('start_date'), 'Program start date'),
    primary_link: nullableText(form.get('primary_link'), 'Primary link'),
    filters,
    availableGrades,
    location: nullableText(form.get('location'), 'Location')
  };
};

export const load: PageServerLoad = async ({ cookies, setHeaders }) => {
  setHeaders({ 'cache-control': 'private, no-store' });

  const authenticated = isAuthenticated(cookies.get(SESSION_COOKIE));
  const loginConfigured = Boolean(env.ADMIN_PASSWORD);
  if (!authenticated) return { authenticated: false, loginConfigured };

  const supabase = createReadClient();
  const [scholarshipsResult, summerProgramsResult] = await Promise.all([
    supabase.from('scholarships').select('*').order('name'),
    supabase.from('summerprograms').select('*').order('name')
  ]);

  const errors = [scholarshipsResult.error, summerProgramsResult.error].filter(Boolean);
  if (errors.length) console.error('Admin catalog load failed:', errors.map((error) => error?.message));

  return {
    authenticated: true,
    loginConfigured,
    canSave: Boolean(privilegedKey()),
    scholarships: (scholarshipsResult.data ?? []) as ScholarshipDTO[],
    summerPrograms: (summerProgramsResult.data ?? []) as SummerDTO[],
    loadError: errors.length ? 'Could not load one or more catalog lists from the database.' : null
  };
};

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const form = await request.formData();
    const candidate = form.get('password');
    const expected = env.ADMIN_PASSWORD;

    if (!expected) return fail(503, { error: 'Admin access is not configured on the server.' });
    if (typeof candidate !== 'string' || !comparePassword(candidate, expected)) {
      return fail(401, { error: 'That password did not match.' });
    }

    setAdminCookie(cookies);
    return { success: true };
  },

  logout: async ({ cookies }) => {
    cookies.delete(SESSION_COOKIE, { path: '/' });
    return { success: true };
  },

  create: async ({ request, cookies }) => {
    if (!isAuthenticated(cookies.get(SESSION_COOKIE))) {
      return fail(401, { error: 'Your admin session expired. Sign in again.' });
    }
    if (!privilegedKey()) {
      return fail(503, {
        error: 'Database editing is not configured. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to the server environment.'
      });
    }

    const form = await request.formData();
    const typeValue = form.get('catalogType');
    if (!isCatalogType(typeValue)) return fail(400, { error: 'Choose a valid catalog.' });

    let values: Record<string, unknown>;
    try {
      values = buildUpdate(form, typeValue);
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Check the submitted fields.' });
    }

    const supabase = createReadClient();
    const table = typeValue === 'scholarships' ? 'scholarships' : 'summerprograms';
    const { data, error } = await supabase.from(table).insert(values).select('*').single();

    if (error) {
      console.error(`Admin insert failed for ${table}:`, error.message);
      return fail(500, { error: 'The database could not create this listing. Check the fields and try again.' });
    }

    return {
      success: true,
      message: 'Listing created.',
      record: data as ScholarshipDTO | SummerDTO,
      catalogType: typeValue
    };
  },

  delete: async ({ request, cookies }) => {
    if (!isAuthenticated(cookies.get(SESSION_COOKIE))) {
      return fail(401, { error: 'Your admin session expired. Sign in again.' });
    }
    if (!privilegedKey()) {
      return fail(503, {
        error: 'Database editing is not configured. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to the server environment.'
      });
    }

    const form = await request.formData();
    const typeValue = form.get('catalogType');
    const idValue = form.get('id');
    const id = typeof idValue === 'string' ? Number(idValue) : NaN;
    if (!isCatalogType(typeValue)) return fail(400, { error: 'Choose a valid catalog.' });
    if (!Number.isSafeInteger(id) || id < 1) return fail(400, { error: 'Choose a valid record.' });

    const table = typeValue === 'scholarships' ? 'scholarships' : 'summerprograms';
    const { data, error } = await createReadClient()
      .from(table)
      .delete()
      .eq('id', id)
      .select('id')
      .maybeSingle();

    if (error) {
      console.error(`Admin delete failed for ${table} record ${id}:`, error.message);
      return fail(500, { error: 'The database could not remove this listing.' });
    }
    if (!data) return fail(404, { error: 'That record could not be found. Refresh and try again.' });

    return { success: true, deletedId: id, catalogType: typeValue };
  },

  save: async ({ request, cookies }) => {
    if (!isAuthenticated(cookies.get(SESSION_COOKIE))) {
      return fail(401, { error: 'Your admin session expired. Sign in again.' });
    }
    if (!privilegedKey()) {
      return fail(503, {
        error: 'Database editing is not configured. Add SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to the server environment.'
      });
    }

    const form = await request.formData();
    const typeValue = form.get('catalogType');
    if (!isCatalogType(typeValue)) return fail(400, { error: 'Choose a valid catalog.' });

    const idValue = form.get('id');
    const id = typeof idValue === 'string' ? Number(idValue) : NaN;
    if (!Number.isSafeInteger(id) || id < 1) return fail(400, { error: 'Choose a valid record.' });

    let values: Record<string, unknown>;
    try {
      values = buildUpdate(form, typeValue);
    } catch (error) {
      return fail(400, { error: error instanceof Error ? error.message : 'Check the submitted fields.' });
    }

    const supabase = createReadClient();
    const table = typeValue === 'scholarships' ? 'scholarships' : 'summerprograms';
    const { data, error } = await supabase.from(table).update(values).eq('id', id).select('*').maybeSingle();

    if (error) {
      console.error(`Admin update failed for ${table} record ${id}:`, error.message);
      return fail(500, { error: 'The database rejected this change. Check the values and try again.' });
    }
    if (!data) return fail(404, { error: 'That record could not be found. Refresh and select it again.' });

    return {
      success: true,
      message: 'Changes saved to the database.',
      record: data as ScholarshipDTO | SummerDTO,
      catalogType: typeValue
    };
  }
};
