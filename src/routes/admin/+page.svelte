<script lang="ts">
  import { enhance } from "$app/forms"
  import type { PageData } from "./$types"
  import type { ScholarshipDTO } from "$lib/scripts/scholarships"
  import { FILTER_COLORS, filterDefinitions } from "$lib/scripts/scholarships"
  import type { SummerDTO } from "$lib/scripts/summerPrograms"

  type CatalogType = "scholarships" | "summerprograms"
  type CatalogRecord = ScholarshipDTO | SummerDTO
  type Field = {
    key: string
    label: string
    kind: "text" | "url" | "date" | "textarea" | "checkbox"
    hint?: string
    wide?: boolean
  }
  type FilterOption = {
    key: string
    label: string
    description: string
    color?: string
  }
  type AwardDraft = {
    place: number
    mode: "single" | "range" | "full-tuition"
    minimum: string
    maximum: string
  }

  let { data }: { data: PageData } = $props()
  let catalogType = $state<CatalogType>("scholarships")
  let searchTerm = $state("")
  let selectedId = $state<number | null>(null)
  let isCreating = $state(false)
  let draft = $state<Record<string, unknown> | null>(null)
  let selectedFilters = $state<string[]>([])
  let selectedGrades = $state<number[]>([])
  let extraGradeValue = $state("")
  let awards = $state<AwardDraft[]>([])
  let loginError = $state("")
  let saveError = $state("")
  let saveMessage = $state("")
  let saving = $state(false)
  let deleting = $state(false)
  let deleteError = $state("")

  const scholarshipFields: Field[] = [
    { key: "name", label: "Name", kind: "text", wide: true },
    { key: "description", label: "Description", kind: "textarea", wide: true },
    {
      key: "deadline",
      label: "Deadline",
      kind: "date",
    },
    {
      key: "openDate",
      label: "Application opens",
      kind: "date",
    },
    {
      key: "openUnknown",
      label: "Application date not released",
      kind: "checkbox",
    },
    {
      key: "primary_link",
      label: "Application link",
      kind: "url",
      wide: true,
    },
  ]

  const summerProgramFields: Field[] = [
    { key: "name", label: "Name", kind: "text", wide: true },
    {
      key: "created",
      label: "Created",
      kind: "date",
      hint: "Optional record date.",
    },
    { key: "description", label: "Description", kind: "textarea", wide: true },
    {
      key: "deadline",
      label: "Application deadline",
      kind: "date",
      hint: "Leave blank if there is no deadline.",
    },
    {
      key: "openDate",
      label: "Application opens",
      kind: "date",
      hint: "Choose the calendar date applications open.",
    },
    {
      key: "openUnknown",
      label: "Application date not released",
      kind: "checkbox",
    },
    {
      key: "start_date",
      label: "Program start date",
      kind: "date",
      hint: "Used as a rolling deadline when there is no application deadline.",
    },
    {
      key: "primary_link",
      label: "Application link",
      kind: "url",
      wide: true,
    },
    { key: "location", label: "Location", kind: "text" },
  ]

  const scholarshipFilterOptions: FilterOption[] = Object.entries(
    filterDefinitions,
  ).map(([key, definition]) => ({
    key,
    label: definition.name,
    description: definition.description,
    color: FILTER_COLORS[definition.color],
  }))

  const summerFilterOptions: FilterOption[] = [
    { key: "science", label: "Science", description: "Related to science." },
    {
      key: "ethnic",
      label: "Ethnic community",
      description: "For a specific ethnic community.",
    },
    {
      key: "needbased",
      label: "Need-based",
      description: "Considers financial need.",
    },
    {
      key: "literaryarts",
      label: "Literary arts",
      description: "Related to writing or the arts.",
    },
    {
      key: "advocacy",
      label: "Advocacy",
      description: "Related to social or political activism.",
    },
    {
      key: "meritonly",
      label: "Merit only",
      description: "Admission is based on merit.",
    },
  ]

  const gradeOptions = [11, 12]

  let records = $derived(
    catalogType === "scholarships"
      ? (data.scholarships ?? [])
      : (data.summerPrograms ?? []),
  )
  let fields = $derived(
    catalogType === "scholarships" ? scholarshipFields : summerProgramFields,
  )
  let filterOptions = $derived(
    catalogType === "scholarships"
      ? scholarshipFilterOptions
      : summerFilterOptions,
  )
  let extraGrades = $derived(
    selectedGrades.filter((grade) => !gradeOptions.includes(grade)),
  )
  let filteredRecords = $derived.by(() => {
    const query = searchTerm.trim().toLocaleLowerCase()
    if (!query) return records
    return records.filter((record) =>
      Object.values(record).some((value) => {
        const searchableValue =
          typeof value === "string" ? value : JSON.stringify(value ?? "")
        return searchableValue?.toLocaleLowerCase().includes(query)
      }),
    )
  })

  const dateInputValue = (value: unknown) => {
    if (typeof value !== "string" || !value) return ""
    const datePrefix = /^(\d{4}-\d{2}-\d{2})/.exec(value)?.[1]
    if (datePrefix) return datePrefix
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`
  }

  const readFilterList = (value: unknown): string[] => {
    if (typeof value === "string") {
      try {
        value = JSON.parse(value) as unknown
      } catch {
        return [value]
      }
    }
    if (Array.isArray(value)) {
      return value.filter(
        (filter): filter is string => typeof filter === "string",
      )
    }
    return typeof value === "string" ? [value] : []
  }

  const toAwardDrafts = (value: unknown): AwardDraft[] => {
    if (!Array.isArray(value)) return []
    const result: AwardDraft[] = []
    value.forEach((item: unknown, index: number) => {
      if (!item || typeof item !== "object") return
      const award = item as { place?: unknown; amount?: unknown }
      if (Array.isArray(award.amount) && award.amount.length === 2) {
        const fullTuition = award.amount[1] === "full-tuition"
        result.push({
          place: Number(award.place) || index + 1,
          mode: fullTuition ? "full-tuition" : "range",
          minimum: String(award.amount[0] ?? ""),
          maximum: fullTuition ? "" : String(award.amount[1] ?? ""),
        })
      } else if (typeof award.amount === "number") {
        result.push({
          place: Number(award.place) || index + 1,
          mode: "single",
          minimum: String(award.amount),
          maximum: "",
        })
      }
    })
    return result
  }

  const assignDraft = (record: CatalogRecord) => {
    const recordValues = record as unknown as Record<string, unknown>
    draft = { ...recordValues }
    selectedFilters = readFilterList(recordValues.filters)
    selectedGrades = Array.isArray(recordValues.availableGrades)
      ? recordValues.availableGrades
          .filter((grade): grade is number => Number.isInteger(grade))
          .sort((first, second) => first - second)
      : []
    awards =
      catalogType === "scholarships"
        ? toAwardDrafts(recordValues.endowment)
        : []
    extraGradeValue = ""
  }

  const makeDraft = (record: CatalogRecord) => {
    selectedId = record.id
    isCreating = false
    assignDraft(record)
    saveError = ""
    saveMessage = ""
    deleteError = ""
  }

  const beginCreate = () => {
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    isCreating = true
    selectedId = null
    draft =
      catalogType === "scholarships"
        ? {
            name: "",
            description: "",
            deadline: null,
            openDate: null,
            openUnknown: false,
            primary_link: "",
            filters: [],
            availableGrades: [],
            endowment: [],
          }
        : {
            name: "",
            created: today,
            description: "",
            deadline: null,
            openDate: null,
            openUnknown: false,
            start_date: null,
            primary_link: null,
            filters: [],
            availableGrades: [],
            location: "",
          }
    selectedFilters = []
    selectedGrades = []
    awards = []
    extraGradeValue = ""
    saveError = ""
    saveMessage = ""
    deleteError = ""
  }

  const changeCatalog = (nextType: CatalogType) => {
    catalogType = nextType
    selectedId = null
    isCreating = false
    draft = null
    searchTerm = ""
    saveError = ""
    saveMessage = ""
    deleteError = ""
    const first =
      nextType === "scholarships"
        ? data.scholarships?.[0]
        : data.summerPrograms?.[0]
    if (first) makeDraft(first)
  }

  const updateText = (key: string, value: string) => {
    if (!draft) return
    draft[key] = value
    saveError = ""
    saveMessage = ""
  }

  const updateCheckbox = (key: string, value: boolean) => {
    if (!draft) return
    draft[key] = value
    saveError = ""
    saveMessage = ""
  }

  const toggleFilter = (key: string, checked: boolean) => {
    selectedFilters = checked
      ? [...new Set([...selectedFilters, key])]
      : selectedFilters.filter((filter) => filter !== key)
    saveError = ""
    saveMessage = ""
  }

  const toggleGrade = (grade: number, checked: boolean) => {
    selectedGrades = (
      checked
        ? [...new Set([...selectedGrades, grade])]
        : selectedGrades.filter((current) => current !== grade)
    ).sort((first, second) => first - second)
    saveError = ""
    saveMessage = ""
  }

  const addExtraGrade = () => {
    const grade = Number(extraGradeValue)
    if (!Number.isInteger(grade) || grade < 1) return
    toggleGrade(grade, true)
    extraGradeValue = ""
  }

  const addAward = () => {
    const place = Math.max(0, ...awards.map((award) => award.place)) + 1
    awards = [...awards, { place, mode: "single", minimum: "", maximum: "" }]
    saveError = ""
    saveMessage = ""
  }

  const updateAward = (index: number, key: keyof AwardDraft, value: string) => {
    const award = awards[index]
    if (!award) return
    if (key === "place") award.place = Number(value) || 0
    else if (key === "mode") award.mode = value as AwardDraft["mode"]
    else if (key === "minimum") award.minimum = value
    else award.maximum = value
    saveError = ""
    saveMessage = ""
  }

  const removeAward = (index: number) => {
    awards = awards.filter((_, awardIndex) => awardIndex !== index)
    saveError = ""
    saveMessage = ""
  }

  const confirmDelete = (event: SubmitEvent) => {
    const name = String(draft?.name ?? "this listing")
    if (!window.confirm(`Delete “${name}”? This cannot be undone.`)) {
      event.preventDefault()
    }
  }

  const awardPayload = () =>
    awards.map((award) => ({
      place: award.place,
      amount:
        award.mode === "single"
          ? Number(award.minimum)
          : [
              Number(award.minimum),
              award.mode === "full-tuition"
                ? "full-tuition"
                : Number(award.maximum),
            ],
    }))

  $effect(() => {
    if (!data.authenticated || isCreating || selectedId !== null) return
    const first = records[0]
    if (first) makeDraft(first)
  })
</script>

<svelte:head>
  <title>Admin | C3SS Catalog</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<section class="admin-page">
  {#if !data.authenticated}
    <div class="login-card">
      <h1>Admin sign in</h1>
      <form
        class="login-form"
        method="POST"
        action="?/login"
        use:enhance={() => {
          loginError = ""
          return async ({ result, update }) => {
            await update()
            if (result.type === "failure") {
              const response = result.data as { error?: unknown }
              loginError = String(response.error ?? "Sign in failed.")
            }
          }
        }}
      >
        <label for="admin-password">Password</label>
        <input
          id="admin-password"
          name="password"
          type="password"
          autocomplete="current-password"
          required
        />
        {#if loginError}<p class="message error" role="alert">
            {loginError}
          </p>{/if}
        <button class="primary-button" type="submit">Sign in</button>
      </form>
    </div>
  {:else}
    <header class="admin-header">
      <div>
        <h1>Edit listings</h1>
      </div>
      <form method="POST" action="?/logout" use:enhance>
        <button type="submit" class="quiet-button">Sign out</button>
      </form>
    </header>

    {#if data.loadError}
      <p class="message error" role="alert">{data.loadError}</p>
    {/if}

    <div class="catalog-tabs" role="tablist" aria-label="Catalog type">
      <button
        type="button"
        class:active={catalogType === "scholarships"}
        role="tab"
        aria-selected={catalogType === "scholarships"}
        onclick={() => changeCatalog("scholarships")}
        >Scholarships <span>{data.scholarships?.length ?? 0}</span></button
      >
      <button
        type="button"
        class:active={catalogType === "summerprograms"}
        role="tab"
        aria-selected={catalogType === "summerprograms"}
        onclick={() => changeCatalog("summerprograms")}
        >Summer programs <span>{data.summerPrograms?.length ?? 0}</span></button
      >
    </div>

    <div class="admin-workspace">
      <aside class="record-browser" aria-label="Catalog listings">
        <button class="new-record-button" type="button" onclick={beginCreate}>
          <span aria-hidden="true">＋</span> New {catalogType === "scholarships"
            ? "scholarship"
            : "summer program"}
        </button>
        <input
          id="admin-search"
          class="search-input"
          type="search"
          placeholder="Search…"
          bind:value={searchTerm}
        />
        <p class="result-count">
          {filteredRecords.length} of {records.length}
        </p>
        <div class="record-list">
          {#each filteredRecords as record (record.id)}
            <button
              type="button"
              class="record-option"
              class:selected={selectedId === record.id}
              aria-current={selectedId === record.id ? "true" : undefined}
              onclick={() => makeDraft(record)}
            >
              <span>{record.name}</span>
              <small>ID {record.id}</small>
            </button>
          {:else}
            <p class="no-results">Sorry, we couldn't find any results for that search :(</p>
          {/each}
        </div>
      </aside>

      {#key `${catalogType}-${isCreating ? "new" : selectedId ?? "empty"}`}
      <section class="editor-panel" aria-label="Listing editor">
        {#if draft}
          <div class="editor-heading">
            <div>
              <h2>{String(draft.name ?? "Untitled listing")}</h2>
            </div>
            {#if !isCreating}
              <div class="editor-tools">
                <span class="record-id">ID {selectedId}</span>
                <form
                  class="delete-form"
                  method="POST"
                  action="?/delete"
                  onsubmit={confirmDelete}
                  use:enhance={() => {
                    deleting = true
                    deleteError = ""
                    return async ({ result, update }) => {
                      await update()
                      deleting = false
                      if (result.type === "success") {
                        selectedId = null
                        draft = null
                        isCreating = false
                        selectedFilters = []
                        selectedGrades = []
                        awards = []
                      } else if (result.type === "failure") {
                        const response = result.data as { error?: unknown }
                        deleteError = String(response.error ?? "Could not delete this listing.")
                      }
                    }
                  }}
                >
                  <input type="hidden" name="catalogType" value={catalogType} />
                  <input type="hidden" name="id" value={selectedId ?? ""} />
                  <button class="delete-button" type="submit" disabled={deleting || !data.canSave}>
                    {deleting ? "Removing…" : "Delete listing"}
                  </button>
                </form>
              </div>
            {/if}
          </div>

          {#if deleteError}
            <p class="message error" role="alert">{deleteError}</p>
          {/if}

          {#if !data.canSave}
            <p class="message error" role="alert">
              Add a private Supabase server key to enable saving.
            </p>
          {/if}

          <form
            class="editor-form"
            method="POST"
            action={isCreating ? "?/create" : "?/save"}
            use:enhance={() => {
              saving = true
              saveError = ""
              saveMessage = ""
              return async ({ result, update }) => {
                await update({ reset: false })
                saving = false
                if (result.type === "success") {
                  const response = result.data as {
                    record?: Record<string, unknown>
                    message?: string
                  }
                  if (response.record) {
                    selectedId = Number(response.record.id)
                    isCreating = false
                    assignDraft(response.record as CatalogRecord)
                  }
                  saveMessage = response.message ?? "Changes saved."
                } else if (result.type === "failure") {
                  const response = result.data as { error?: unknown }
                  saveError = String(
                    response.error ?? "Could not save these changes.",
                  )
                }
              }
            }}
          >
            <input type="hidden" name="catalogType" value={catalogType} />
            {#if !isCreating}<input
                type="hidden"
                name="id"
                value={selectedId ?? ""}
              />{/if}
            <input
              type="hidden"
              name="filters"
              value={JSON.stringify(selectedFilters)}
            />
            <input
              type="hidden"
              name="availableGrades"
              value={JSON.stringify(selectedGrades)}
            />
            {#if catalogType === "scholarships"}
              <input
                type="hidden"
                name="endowment"
                value={JSON.stringify(awardPayload())}
              />
            {/if}

            <div class="field-grid">
              {#each fields as field (field.key)}
                <div
                  class="field"
                  class:wide={field.wide}
                  class:checkbox-field={field.kind === "checkbox"}
                >
                  {#if field.kind === "checkbox"}
                    <label class="checkbox-label">
                      <input
                        type="checkbox"
                        name={field.key}
                        checked={draft[field.key] === true}
                        onchange={(event) =>
                          updateCheckbox(
                            field.key,
                            event.currentTarget.checked,
                          )}
                      />
                      <span>{field.label}</span>
                    </label>
                  {:else}
                    <label for={`field-${field.key}`}>{field.label}</label>
                    {#if field.kind === "textarea"}
                      <textarea
                        id={`field-${field.key}`}
                        name={field.key}
                        rows="5"
                        required={field.key === "description" &&
                          catalogType === "scholarships"}
                        oninput={(event) =>
                          updateText(field.key, event.currentTarget.value)}
                        >{String(draft[field.key] ?? "")}</textarea
                      >
                    {:else}
                      <input
                        id={`field-${field.key}`}
                        name={field.key}
                        type={field.kind === "date"
                          ? "date"
                          : field.kind === "url"
                            ? "url"
                            : "text"}
                        value={field.kind === "date"
                          ? dateInputValue(draft[field.key])
                          : String(draft[field.key] ?? "")}
                        required={field.key === "name" ||
                          (field.key === "primary_link" &&
                            catalogType === "scholarships")}
                        oninput={(event) =>
                          updateText(field.key, event.currentTarget.value)}
                      />
                    {/if}
                    {#if field.hint}<small class="field-hint"
                        >{field.hint}</small
                      >{/if}
                  {/if}
                </div>
              {/each}
            </div>

            <section
              class="structured-section"
              aria-labelledby="filter-heading"
            >
              <div class="section-heading">
                <div>
                  <h3 id="filter-heading">Categories</h3>
                </div>
              </div>
              <div class="option-grid">
                {#each filterOptions as option (option.key)}
                  <label
                    class="choice-card"
                    style={`--filter-color: ${option.color ?? "#7d1915"}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFilters.includes(option.key)}
                      onchange={(event) =>
                        toggleFilter(option.key, event.currentTarget.checked)}
                    />
                    <span>
                      <strong>{option.label}</strong>
                      <small>{option.description}</small>
                    </span>
                  </label>
                {/each}
              </div>
            </section>

            <section
              class="structured-section"
              aria-labelledby="grades-heading"
            >
              <div class="section-heading">
                <div>
                  <h3 id="grades-heading">Eligible grades</h3>

                </div>
              </div>
              <div class="grade-options">
                {#each gradeOptions as grade (grade)}
                  <label class="grade-choice">
                    <input
                      type="checkbox"
                      checked={selectedGrades.includes(grade)}
                      onchange={(event) =>
                        toggleGrade(grade, event.currentTarget.checked)}
                    />
                    Grade {grade}
                  </label>
                {/each}
                {#each extraGrades as grade (grade)}
                  <button
                    class="grade-chip"
                    type="button"
                    aria-label={`Remove grade ${grade}`}
                    onclick={() => toggleGrade(grade, false)}
                  >
                    Grade {grade} <span aria-hidden="true">×</span>
                  </button>
                {/each}
              </div>
            </section>

            {#if catalogType === "scholarships"}
              <section
                class="structured-section"
                aria-labelledby="awards-heading"
              >
                <div class="section-heading">
                  <div>
                    <h3 id="awards-heading">Award amounts</h3>

                  </div>
                  <button class="small-button" type="button" onclick={addAward}
                    >Add an award</button
                  >
                </div>

                {#if awards.length}
                  <div class="award-list">
                    {#each awards as award, index}
                      <div
                        class={award.mode === "single"
                          ? "award-row"
                          : `award-row ${award.mode}`}
                      >
                        <label>
                          <span>Place</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            required
                            value={award.place}
                            oninput={(event) =>
                              updateAward(
                                index,
                                "place",
                                event.currentTarget.value,
                              )}
                          />
                        </label>
                        <label>
                          <span>Award type</span>
                          <select
                            value={award.mode}
                            onchange={(event) =>
                              updateAward(
                                index,
                                "mode",
                                event.currentTarget.value,
                              )}
                          >
                            <option value="single">One amount</option>
                            <option value="range">Amount range</option>
                            <option value="full-tuition">Full tuition</option>
                          </select>
                        </label>
                        <label>
                          <span
                            >{award.mode === "single"
                              ? "Amount (USD)"
                              : "Minimum (USD)"}</span
                          >
                          <input
                            type="number"
                            min="0"
                            step="1"
                            required
                            value={award.minimum}
                            oninput={(event) =>
                              updateAward(
                                index,
                                "minimum",
                                event.currentTarget.value,
                              )}
                          />
                        </label>
                        {#if award.mode === "range"}
                          <label>
                            <span>Maximum (USD)</span>
                            <input
                              type="number"
                              min={award.minimum || "0"}
                              step="1"
                              required
                              value={award.maximum}
                              oninput={(event) =>
                                updateAward(
                                  index,
                                  "maximum",
                                  event.currentTarget.value,
                                )}
                            />
                          </label>
                        {:else if award.mode === "full-tuition"}
                          <p class="tuition-note">Up to full tuition</p>
                        {/if}
                        <button
                          class="remove-button"
                          type="button"
                          onclick={() => removeAward(index)}>Remove</button
                        >
                      </div>
                    {/each}
                  </div>
                {:else}
                  <p class="no-awards">No award amounts have been added.</p>
                {/if}
              </section>
            {/if}

            {#if saveError}<p class="message error" role="alert">
                {saveError}
              </p>{/if}
            {#if saveMessage}<p class="message success" role="status">
                {saveMessage}
              </p>{/if}

            <div class="save-row">
              <button
                class="primary-button"
                type="submit"
                disabled={saving || !data.canSave}
              >
                {saving
                  ? isCreating
                    ? "Creating…"
                    : "Saving…"
                  : isCreating
                    ? "Create listing"
                    : "Save changes"}
              </button>
            </div>
          </form>
        {:else}
          <div class="empty-editor">
            <h2>Select a listing</h2>
            <p>Choose a record from the list to edit its fields.</p>
          </div>
        {/if}
      </section>
      {/key}
    </div>
  {/if}
</section>

<style lang="scss">
  @use "$lib/styles/global.scss" as *;

  .admin-page {
    --admin-line: rgba(125, 25, 21, 0.14);
    --admin-soft: rgba(255, 255, 255, 0.83);
    color: $text;
    width: 100%;
    min-width: 0;
    margin-bottom: 5%;
    animation: admin-enter 300ms ease-out backwards;
  }

  @keyframes admin-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
    }
  }

  @keyframes editor-enter {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
    }
  }

  .login-card,
  .editor-panel,
  .record-browser {
    box-sizing: border-box;
    min-width: 0;
    max-width: 100%;
    border: 1px solid var(--admin-line);
    border-radius: 18px;
    background: var(--admin-soft);
    box-shadow: 0 14px 32px rgba(93, 34, 29, 0.08);
  }

  .login-card {
    width: min(100%, 430px);
    margin: 7vh auto;
    padding: 32px;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 8px;
    color: $primary;
    font-size: clamp(1.65rem, 3vw, 2.15rem);
  }

  h2 {
    margin-bottom: 0;
    color: $primary;
    font-size: 1.25rem;
  }

  .login-form,
  .field {
    display: grid;
    gap: 8px;
  }

  .login-form label,
  .field > label {
    color: $text;
    font-size: 0.83rem;
    font-weight: 800;
  }

  input[type="text"],
  input[type="password"],
  input[type="search"],
  input[type="url"],
  input[type="date"],
  input[type="number"],
  select,
  .field textarea {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    border: 1px solid rgba(125, 25, 21, 0.18);
    border-radius: 10px;
    background: #fff;
    color: $text;
    font: inherit;
    line-height: 1.45;
    padding: 10px 12px;
  }

  input:focus,
  textarea:focus {
    border-color: $primary;
    outline: 3px solid rgba(125, 25, 21, 0.1);
  }

  .field textarea {
    min-height: 110px;
    resize: vertical;
  }

  .field-hint {
    color: $eyebrow;
    font-size: 0.74rem;
    line-height: 1.45;
  }

  .primary-button,
  .quiet-button,
  .delete-button {
    min-height: 42px;
    padding: 10px 16px;
    border: 1px solid transparent;
    border-radius: 11px;
    cursor: pointer;
    font:
      800 0.9rem/1 "Inter",
      system-ui,
      sans-serif;
    transition:
      transform 140ms ease,
      box-shadow 140ms ease,
      background 140ms ease;
  }

  .primary-button {
    background: $primary;
    color: #fff;
    box-shadow: 0 9px 18px rgba(125, 25, 21, 0.16);
  }

  .primary-button:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 12px 22px rgba(125, 25, 21, 0.22);
  }

  .primary-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .quiet-button {
    border-color: var(--admin-line);
    background: #fff;
    color: $primary;
  }

  .quiet-button:hover {
    background: rgba(125, 25, 21, 0.06);
  }

  .delete-button {
    min-height: 38px;
    padding: 9px 12px;
    border: 1px solid rgba(125, 25, 21, 0.2);
    border-radius: 10px;
    background: rgba(212, 38, 32, 0.07);
    color: $primary;
    cursor: pointer;
    font: 800 0.78rem/1 "Inter", system-ui, sans-serif;
    transition: transform 140ms ease, background 140ms ease, box-shadow 140ms ease;
  }

  .delete-button:hover:not(:disabled) {
    transform: translateY(-1px);
    background: rgba(212, 38, 32, 0.14);
    box-shadow: 0 8px 16px rgba(125, 25, 21, 0.12);
  }

  .delete-button:disabled {
    cursor: wait;
    opacity: 0.62;
  }

  .admin-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 22px;
  }

  .catalog-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 14px;
  }

  .catalog-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    min-height: 42px;
    padding: 9px 13px;
    border: 1px solid var(--admin-line);
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.72);
    color: $text;
    cursor: pointer;
    font:
      800 0.87rem/1 "Inter",
      system-ui,
      sans-serif;
    transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
  }

  .catalog-tabs button:hover {
    transform: translateY(-1px);
  }

  .catalog-tabs button.active {
    border-color: $primary;
    background: $primary;
    color: #fff;
  }

  .catalog-tabs span {
    display: grid;
    min-width: 22px;
    height: 22px;
    padding: 0 5px;
    place-items: center;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.22);
    font-size: 0.72rem;
  }

  .admin-workspace {
    display: grid;
    grid-template-columns: minmax(0, 0.78fr) minmax(0, 2fr);
    align-items: start;
    gap: 14px;
    min-width: 0;
  }

  .record-browser {
    position: sticky;
    top: 118px;
    width: 100%;
    padding: 16px;
  }

  .new-record-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    min-height: 42px;
    margin-bottom: 18px;
    padding: 10px 12px;
    border: 1px solid rgba(125, 25, 21, 0.2);
    border-radius: 10px;
    background: rgba(125, 25, 21, 0.07);
    color: $primary;
    cursor: pointer;
    font:
      800 0.84rem/1.2 "Inter",
      system-ui,
      sans-serif;
    transition: transform 140ms ease, background 140ms ease, box-shadow 140ms ease;
  }

  .new-record-button:hover,
  .new-record-button:focus-visible {
    background: rgba(125, 25, 21, 0.13);
    outline: none;
    transform: translateY(-1px);
    box-shadow: 0 8px 16px rgba(125, 25, 21, 0.1);
  }

  .result-count {
    margin: 11px 0 8px;
    color: $eyebrow;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .record-list {
    display: grid;
    max-height: min(64vh, 720px);
    gap: 5px;
    overflow: auto;
    padding-right: 3px;
  }

  .record-option {
    display: grid;
    gap: 4px;
    width: 100%;
    padding: 10px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    color: $text;
    cursor: pointer;
    text-align: left;
    overflow-wrap: anywhere;
    transition: transform 140ms ease, border-color 140ms ease, background 140ms ease;
  }

  .record-option:hover,
  .record-option.selected {
    border-color: var(--admin-line);
    background: rgba(125, 25, 21, 0.06);
  }

  .record-option:hover {
    transform: translateX(2px);
  }

  .record-option span {
    min-width: 0;
    font-size: 0.82rem;
    font-weight: 750;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  .record-option small {
    color: $eyebrow;
    font-size: 0.7rem;
  }

  .no-results,
  .empty-editor p {
    color: $eyebrow;
    font-size: 0.88rem;
    line-height: 1.5;
  }

  .editor-panel {
    min-width: 0;
    width: 100%;
    padding: clamp(16px, 2vw, 26px);
    animation: editor-enter 240ms cubic-bezier(0.22, 1, 0.36, 1) backwards;
  }

  .editor-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    min-width: 0;
    gap: 12px;
    margin-bottom: 20px;
  }

  .editor-heading h2 {
    overflow-wrap: anywhere;
  }

  .editor-tools {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 9px;
    min-width: 0;
  }

  .delete-form {
    display: flex;
    min-width: 0;
  }

  .record-id {
    flex: 0 0 auto;
    padding: 6px 9px;
    border-radius: 99px;
    background: rgba(125, 25, 21, 0.07);
    color: $primary;
    font-size: 0.73rem;
    font-weight: 800;
  }

  .field-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 17px 14px;
    min-width: 0;
  }

  .field {
    min-width: 0;
  }

  .field input,
  .field textarea,
  .field select {
    width: 100%;
    max-width: 100%;
    min-width: 0;
  }

  .field input,
  .field textarea,
  .field select,
  .choice-card,
  .award-row,
  .small-button,
  .remove-button {
    transition: border-color 140ms ease, box-shadow 140ms ease, background 140ms ease;
  }

  .field.wide {
    grid-column: 1 / -1;
  }

  .checkbox-field {
    align-self: end;
    min-height: 40px;
    align-content: center;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 42px;
    cursor: pointer;
    font-size: 0.83rem;
    font-weight: 800;
  }

  .checkbox-label input {
    width: 18px;
    height: 18px;
    accent-color: $primary;
  }

  .structured-section {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid var(--admin-line);
  }

  .section-heading {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 14px;
    margin-bottom: 12px;
  }

  .section-heading > div {
    min-width: 0;
  }

  .section-heading h3 {
    margin: 0 0 4px;
    color: $primary;
    font-size: 0.98rem;
  }

  .section-heading p {
    margin: 0;
    color: $eyebrow;
    font-size: 0.78rem;
    line-height: 1.45;
  }

  .option-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
    min-width: 0;
  }

  .choice-card {
    display: flex;
    align-items: flex-start;
    gap: 9px;
    min-width: 0;
    overflow-wrap: anywhere;
    padding: 10px;
    border: 1px solid color-mix(in srgb, var(--filter-color) 38%, transparent);
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.76);
    box-shadow: inset 3px 0 var(--filter-color);
    cursor: pointer;
  }

  .choice-card:hover {
    border-color: var(--filter-color);
    background: color-mix(in srgb, var(--filter-color) 6%, white);
  }

  .choice-card:has(input:checked) {
    border-color: var(--filter-color);
    background: color-mix(in srgb, var(--filter-color) 10%, white);
    box-shadow: inset 4px 0 var(--filter-color);
  }

  .choice-card input,
  .grade-choice input {
    flex: 0 0 auto;
    width: 17px;
    height: 17px;
    margin: 1px 0 0;
  }

  .choice-card input {
    accent-color: var(--filter-color);
  }

  .grade-choice input {
    accent-color: $primary;
  }

  .choice-card span {
    display: grid;
    min-width: 0;
    gap: 3px;
    overflow-wrap: anywhere;
  }

  .choice-card strong {
    color: $text;
    font-size: 0.78rem;
  }

  .choice-card small {
    color: $eyebrow;
    font-size: 0.7rem;
    line-height: 1.35;
  }

  .grade-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .grade-choice,
  .grade-chip {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 36px;
    padding: 7px 10px;
    border: 1px solid rgba(125, 25, 21, 0.15);
    border-radius: 9px;
    background: rgba(255, 255, 255, 0.8);
    color: $text;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .grade-choice {
    cursor: pointer;
  }

  .grade-chip {
    background: rgba(125, 25, 21, 0.07);
    color: $primary;
    cursor: pointer;
    transition: transform 140ms ease, background 140ms ease;
  }

  .grade-chip:hover {
    transform: translateY(-1px);
  }

  .grade-chip span {
    font-size: 1rem;
    line-height: 0.8;
  }

  .add-grade-row {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }

  .add-grade-row label {
    color: $eyebrow;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .add-grade-row input {
    width: 90px;
    padding: 8px 9px;
  }

  .small-button,
  .remove-button {
    min-height: 36px;
    padding: 8px 11px;
    border: 1px solid rgba(125, 25, 21, 0.2);
    border-radius: 9px;
    background: #fff;
    color: $primary;
    cursor: pointer;
    font:
      750 0.75rem/1 "Inter",
      system-ui,
      sans-serif;
  }

  .small-button:hover,
  .remove-button:hover {
    background: rgba(125, 25, 21, 0.07);
  }

  .award-list {
    display: grid;
    gap: 10px;
  }

  .award-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-items: end;
    gap: 10px;
    min-width: 0;
    padding: 12px;
    border: 1px solid rgba(125, 25, 21, 0.12);
    border-radius: 11px;
    background: rgba(255, 255, 255, 0.7);
  }

  .award-row label {
    display: grid;
    gap: 6px;
    min-width: 0;
    color: $eyebrow;
    font-size: 0.72rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .award-row input,
  .award-row select {
    width: 100%;
    max-width: 100%;
    min-width: 0;
    padding: 9px;
    font-size: 0.82rem;
  }

  .tuition-note,
  .no-awards {
    margin: 0;
    color: $eyebrow;
    font-size: 0.76rem;
  }

  .tuition-note {
    align-self: center;
    min-width: 0;
    padding: 8px 0;
    overflow-wrap: anywhere;
  }

  .remove-button {
    border-color: rgba(125, 25, 21, 0.12);
    color: $eyebrow;
    grid-column: 1 / -1;
    justify-self: end;
  }

  .save-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding-top: 16px;
  }

  .message {
    margin: 14px 0 0;
    padding: 11px 13px;
    border: 1px solid transparent;
    border-radius: 10px;
    font-size: 0.84rem;
    line-height: 1.5;
  }

  .message.error {
    border-color: rgba(125, 25, 21, 0.17);
    background: rgba(212, 38, 32, 0.07);
    color: $primary;
  }

  .message.success {
    border-color: rgba(72, 115, 76, 0.2);
    background: rgba(72, 115, 76, 0.08);
    color: #315a35;
  }

  .empty-editor {
    display: grid;
    min-height: 260px;
    align-content: center;
    justify-items: center;
    text-align: center;
  }

  .empty-editor h2 {
    margin-bottom: 8px;
  }

  .empty-editor p {
    margin-bottom: 0;
  }

  @media (max-width: 900px) {
    .admin-workspace {
      grid-template-columns: minmax(0, 1fr);
    }

    .record-browser {
      position: static;
    }

    .record-list {
      max-height: 280px;
    }
  }

  @media (max-width: 700px) {
    .admin-header {
      align-items: flex-start;
    }

    .editor-heading {
      flex-wrap: wrap;
    }

    .editor-tools {
      justify-content: flex-start;
    }
  }

  @media (max-width: 480px) {
    .login-card {
      padding: 22px;
    }

    .admin-header {
      flex-direction: column;
    }

    .field-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .field.wide {
      grid-column: auto;
    }

    .option-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .save-row {
      align-items: stretch;
      flex-direction: column;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .admin-page,
    .editor-panel,
    .record-option,
    .primary-button,
    .quiet-button,
    .delete-button,
    .new-record-button,
    .catalog-tabs button,
    .grade-chip,
    .small-button,
    .remove-button,
    .choice-card {
      animation: none;
      transition: none;
    }
  }
</style>
