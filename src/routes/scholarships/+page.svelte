<script lang="ts">
  import Modal from "$lib/components/Modal.svelte"
  import ScholarshipCard from "$lib/components/Scholarship.svelte"
  import Tag from "$lib/components/Tag.svelte"
  import { search } from "fast-fuzzy"
  import { tick } from "svelte"
  import { slide, fly, fade } from "svelte/transition"
  import {
    Scholarship,
    type ScholarshipDTO,
    type ScholarshipFilter,
    type ScholarshipFilterKey,
  } from "$lib/scripts/scholarships"
  import {
    sortByApplicationSchedule,
  } from "$lib/scripts/applicationDates"
  import Search from "$lib/components/Search.svelte"
  import FilterSelect from "$lib/components/FilterSelect.svelte"
  import { browser } from "$app/environment"

  let { data }: { data: { scholarships: ScholarshipDTO[] } } = $props()

  let showModal = $state(false)
  let showIntro = $state(false)
  let filtersOpen = $state(false)
  let activeScholarship = $state<Scholarship | null>(null)
  let activeCardRect = $state<DOMRect | null>(null)
  let searchTerm = $state("")
  let selectedFilters = $state<ScholarshipFilterKey[]>([])
  let selectedMinAward = $state(0)
  let selectedMaxAward = $state(0)
  let awardRangeInitialized = $state(false)
  let scholarships = $derived(data.scholarships.map(Scholarship.from))

  type TutorialState = {
    searchTerm: string
    selectedFilters: ScholarshipFilterKey[]
    selectedMinAward: number
    selectedMaxAward: number
    filtersOpen: boolean
  }

  type TutorialRect = {
    top: number
    right: number
    bottom: number
    left: number
    width: number
    height: number
  }

  const stepDescies = [
    {
      title: "Use the search bar",
      description:
        "Use keywords to search! Or look for a specific scholarship by name",
    },
    {
      title: "Filter the results",
      description:
        "You can filter through the list using the award range or categories",
    },
    {
      title: "Learn more about each one",
      description:
        "Click on a scholarship to get some more detailed info about it",
    },
  ]

  let tutorialActive = $state(false)
  let step = $state(0)
  let tutorialState = $state<TutorialState | null>(null)
  let searchTarget = $state<HTMLDivElement | null>(null)
  let filterButtonTarget = $state<HTMLButtonElement | null>(null)
  let filterTarget = $state<HTMLDivElement | null>(null)
  let tutorialBubble = $state<HTMLElement | null>(null)
  let highlightStyle = $state("")
  let bubbleStyle = $state("")
  let cutoutStyle = $state("")
  let buttonStyle = $state("")

  const scholarshipIntroStorageKey = "c3ss-scholarships-intro-seen"

  let filterOptions = $derived.by(() => {
    const options = new Map<ScholarshipFilterKey, ScholarshipFilter>()

    for (const scholarship of scholarships) {
      for (const filter of scholarship.displayFilters()) {
        options.set(filter.key, filter)
      }
    }

    return [...options.values()].sort((first, second) =>
      first.name.localeCompare(second.name),
    )
  })

  const getFiniteAwardValues = (scholarship: Scholarship) =>
    scholarship.endowment.flatMap((prize) => {
      const [min, max] = Array.isArray(prize.amount)
        ? prize.amount
        : [prize.amount, prize.amount]

      return max === "full-tuition" ? [min] : [min, max]
    })

  const getAwardRange = (scholarship: Scholarship) => {
    let lowest = Number.POSITIVE_INFINITY
    let highest = Number.NEGATIVE_INFINITY

    for (const prize of scholarship.endowment) {
      const [min, max] = Array.isArray(prize.amount)
        ? prize.amount
        : [prize.amount, prize.amount]

      lowest = Math.min(lowest, min)
      highest =
        max === "full-tuition"
          ? Number.POSITIVE_INFINITY
          : Math.max(highest, max)
    }

    if (!Number.isFinite(lowest) || highest === Number.NEGATIVE_INFINITY)
      return null

    return { min: lowest, max: highest }
  }

  let awardBounds = $derived.by(() => {
    const values = scholarships.flatMap(getFiniteAwardValues)

    if (!values.length) return { min: 0, max: 0 }

    return {
      min: Math.max(0, Math.floor(Math.min(...values) / 100) * 100),
      max: Math.ceil(Math.max(...values) / 100) * 100,
    }
  })

  let isAwardRangeFiltered = $derived(
    awardBounds.max > awardBounds.min &&
      (selectedMinAward > awardBounds.min ||
        selectedMaxAward < awardBounds.max),
  )

  let activeFilterCount = $derived(
    selectedFilters.length + (isAwardRangeFiltered ? 1 : 0),
  )

  const openScholarship = (scholarship: Scholarship, event: MouseEvent) => {
    const sourceCard =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null

    activeScholarship = scholarship
    activeCardRect = sourceCard?.getBoundingClientRect() ?? null
    showModal = true
  }

  const sortScholarships = (
    term: string,
    source: Scholarship[],
  ): Scholarship[] => {
    const reference = new Date()
    const query = term.trim()
    const matchingScholarships = query
      ? search(query, source, {
          keySelector: (scholarship) => scholarship.name,
        })
      : source

    return sortByApplicationSchedule(matchingScholarships, reference)
  }

  const toggleFilter = (filter: ScholarshipFilterKey) => {
    selectedFilters = selectedFilters.includes(filter)
      ? selectedFilters.filter((selectedFilter) => selectedFilter !== filter)
      : [...selectedFilters, filter]
  }

  const setMinAward = (value: number) => {
    selectedMinAward = Math.min(
      Math.max(value, awardBounds.min),
      selectedMaxAward,
    )
  }

  const setMaxAward = (value: number) => {
    selectedMaxAward = Math.max(
      Math.min(value, awardBounds.max),
      selectedMinAward,
    )
  }

  const resetFilters = () => {
    selectedFilters = []
    selectedMinAward = awardBounds.min
    selectedMaxAward = awardBounds.max
  }

  const dismissIntro = () => {
    localStorage.setItem(scholarshipIntroStorageKey, "true")
    showIntro = false
  }

  const sequencer = () => {
    switch (step) {
      case 0:
        return searchTarget ? [searchTarget] : []
      case 1:
        return [filterButtonTarget, filterTarget].filter(
          (element): element is HTMLDivElement => element !== null,
        )
      default:
        if (!browser) return []

        const firstCard = document.querySelector<HTMLDivElement>(
          ".scholarship-card-slot",
        )

        return firstCard ? [firstCard] : []
    }
  }

  const stupidRectangleGetter = (): TutorialRect | null => {
    const rects = sequencer()
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width && rect.height)

    if (!rects.length) return null

    const left = Math.min(...rects.map((rect) => rect.left))
    const top = Math.min(...rects.map((rect) => rect.top))
    const right = Math.max(...rects.map((rect) => rect.right))
    const bottom = Math.max(...rects.map((rect) => rect.bottom))

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    }
  }

  const updatePos = () => {
    if (!browser || !tutorialActive) return

    const target = stupidRectangleGetter()

    if (!target) {
      highlightStyle = ""
      bubbleStyle = ""
      return
    }

    const padding = 10
    const highlightLeft = Math.max(padding, target.left - 8)
    const highlightTop = Math.max(padding, target.top - 8)
    const highlightRight = Math.min(
      window.innerWidth - padding,
      target.right + 8,
    )
    const highlightBottom = Math.min(
      window.innerHeight - padding,
      target.bottom + 8,
    )
    const highlightWidth = Math.max(0, highlightRight - highlightLeft)
    const highlightHeight = Math.max(0, highlightBottom - highlightTop)
    const bubbleWidth = Math.min(360, window.innerWidth - 32)
    const bubbleHeight = tutorialBubble?.offsetHeight ?? 190
    const bubbleGap = 18
    const spaceBelow = window.innerHeight - highlightBottom
    const spaceAbove = highlightTop
    const bubbleTop =
      spaceBelow >= bubbleHeight + bubbleGap || spaceBelow >= spaceAbove
        ? Math.min(
            window.innerHeight - bubbleHeight - 16,
            highlightBottom + bubbleGap,
          )
        : Math.max(16, highlightTop - bubbleHeight - bubbleGap)
    const bubbleLeft = Math.min(
      window.innerWidth - bubbleWidth - 16,
      Math.max(16, highlightLeft + highlightWidth / 2 - bubbleWidth / 2),
    )

    highlightStyle = `left: ${highlightLeft}px; top: ${highlightTop}px; width: ${highlightWidth}px; height: ${highlightHeight}px;`
    bubbleStyle = `left: ${bubbleLeft}px; top: ${bubbleTop}px;`
  }

  const refreshTutorialPosition = async (scrollToTarget = false) => {
    await tick()

    const targets = sequencer()
    console.log(targets[0])
    console.log(targets[targets.length - 1])

    if (scrollToTarget && targets[0]) {
      targets[targets.length - 1].scrollIntoView({
        block: "center",
        inline: "nearest",
        behavior: "smooth",
      })
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    updatePos()
  }

  const restoreTutorialState = () => {
    if (!tutorialState) return

    searchTerm = tutorialState.searchTerm
    selectedFilters = tutorialState.selectedFilters
    selectedMinAward = tutorialState.selectedMinAward
    selectedMaxAward = tutorialState.selectedMaxAward
    filtersOpen = tutorialState.filtersOpen
    tutorialState = null
  }

  const endTutorial = () => {
    tutorialActive = false
    document.body.classList.remove("no-scroll")
    restoreTutorialState()
  }

  const startTutorial = async () => {
    localStorage.setItem(scholarshipIntroStorageKey, "true")
    tutorialState = {
      searchTerm,
      selectedFilters: [...selectedFilters],
      selectedMinAward,
      selectedMaxAward,
      filtersOpen,
    }
    showIntro = false
    step = 0
    tutorialActive = true
    document.body.classList.add("no-scroll")
  }

  const goToTutorialStep = async (nextStep: number) => {
    if (nextStep >= stepDescies.length) {
      endTutorial()
      return
    }

    step = nextStep

    if (step === 1) {
      filtersOpen = true
    }

    if (step === 2 && !renderedScholarships.length) {
      searchTerm = ""
      resetFilters()
    }

    await refreshTutorialPosition(true)
  }

  const formatGradeList = (grades: number[]) =>
    grades.map((grade) => `Grade ${grade}`).join(", ")

  const matchesFilters = (scholarship: Scholarship) => {
    const hasSelectedFilters =
      selectedFilters.length === 0 ||
      selectedFilters.every((selectedFilter) =>
        scholarship.filters.includes(selectedFilter),
      )

    if (!hasSelectedFilters) return false
    if (!isAwardRangeFiltered) return true

    const awardRange = getAwardRange(scholarship)

    return (
      awardRange !== null &&
      awardRange.max >= selectedMinAward &&
      awardRange.min <= selectedMaxAward
    )
  }

  let renderedScholarships = $derived.by(() =>
    sortScholarships(searchTerm, scholarships.filter(matchesFilters)),
  )

  $effect(() => {
    if (awardRangeInitialized) return

    selectedMinAward = awardBounds.min
    selectedMaxAward = awardBounds.max
    awardRangeInitialized = true
  })

  $effect(() => {
    if (!showModal) {
      activeCardRect = null
    }
  })

  $effect(() => {
    if (!browser) return

    try {
      if (localStorage.getItem(scholarshipIntroStorageKey)) return

      showIntro = true
    } catch {
      showIntro = true
    }
  })

  const updateCutout = () => {
    if (!browser) return

    const rect = stupidRectangleGetter()

    if (!rect) {
      cutoutStyle = ""
      return
    }

    const padding = 10

    cutoutStyle = `top: ${rect.top + rect.height / 2}px; left: ${rect.left + rect.width / 2}px; width: ${rect.width + padding * 2}px; height: ${rect.height + padding * 2}px;`
  }

  const updateButton = () => {
    if (!browser) return

    const rect = stupidRectangleGetter()

    if (!rect) {
      buttonStyle = ""
      return
    }

    buttonStyle = `top: ${rect.top - 50}px;`
  }

  $effect(() => {
    if (!browser || !tutorialActive) {
      cutoutStyle = ""
      return
    }

    void step
    void searchTarget
    void filterTarget
    void filterButtonTarget
    void renderedScholarships.length

    const reposition = () => {
      updateCutout()
      updateButton()
    }

    reposition()
    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)

    const introSlideDuration = 180
    const start = performance.now()
    let rafId = requestAnimationFrame(function track() {
      reposition()
      if (performance.now() - start < introSlideDuration + 100) {
        rafId = requestAnimationFrame(track)
      }
    })

    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
      cancelAnimationFrame(rafId)
    }
  })

  $effect(() => {
    if (!browser || !tutorialActive) return

    const reposition = () => updatePos()
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") endTutorial()
    }

    window.addEventListener("resize", reposition)
    window.addEventListener("scroll", reposition, true)
    window.addEventListener("keydown", closeOnEscape)
    void refreshTutorialPosition()

    return () => {
      window.removeEventListener("resize", reposition)
      window.removeEventListener("scroll", reposition, true)
      window.removeEventListener("keydown", closeOnEscape)
    }
  })
</script>

{#if showIntro}
  <div class="intro-transition" transition:slide={{ duration: 180, axis: "y" }}>
    <section class="scholarship-intro">
      <button type="button" class="intro-close" onclick={dismissIntro}>
        <span>×</span>
      </button>
      <div class="intro-copy">
        <p class="intro-label">from the LC iTeam</p>
        <h2 id="scholarship-intro-title">Welcome to the C3SS Catalog!</h2>
        <p class="intro-description">
          Discover scholarships and summer programs curated by the College &
          Career Center and LCHS Counseling Department.
        </p>
        <button
          type="button"
          class="start-tut"
          onclick={() => void startTutorial()}
        >
          Walk me through it!
        </button>
      </div>
      <span class="intro-mark">C3</span>
    </section>
  </div>
{/if}


{#if tutorialActive && bubbleStyle}
  {#key step}
    <div class="tutorial-box" style={bubbleStyle} bind:this={tutorialBubble} role="dialog" transition:fly={{y : 12, duration: 200 }}>
      <p class="tutorial-step">Step {step + 1} of {stepDescies.length}</p>
      <h3 class="tutorial-title">{stepDescies[step].title}</h3>
      <p class="tutorial-text">{stepDescies[step].description}</p>
      <div class="tutorial-actions">
        <button type="button" class="tutorial-primary" onclick={() => void goToTutorialStep(step + 1)}>
          {step === stepDescies.length - 1 ? "Finish" : "Next"}
        </button>
      </div>
    </div>
  {/key}
{/if}

{#if cutoutStyle}
  <div class="cutout" id="cutout" style={cutoutStyle} transition:fade={{ duration: 200 }}></div>
{/if}

<div class="search-tools">
  <div class="tour-search-target" bind:this={searchTarget}>
    <Search bind:searchTerm thing="scholarships" />
  </div>
  <button
    type="button"
    class="filter-tab"
    class:is-active={filtersOpen}
    bind:this={filterButtonTarget}
    aria-expanded={filtersOpen}
    aria-controls="scholarship-filters"
    onclick={() => (filtersOpen = !filtersOpen)}
  >
    <span class="filter-icon" aria-hidden="true"></span>
    <span>Filters</span>
    {#if activeFilterCount}
      <span class="filter-count">{activeFilterCount}</span>
    {/if}
  </button>
</div>

{#if filtersOpen}
  <div
    class="filter-transition"
    bind:this={filterTarget}
    transition:slide={{ duration: 180, axis: "y" }}
  >
    <FilterSelect
      filters={filterOptions}
      {selectedFilters}
      minAward={selectedMinAward}
      maxAward={selectedMaxAward}
      rangeMin={awardBounds.min}
      rangeMax={awardBounds.max}
      resultCount={renderedScholarships.length}
      totalCount={scholarships.length}
      onFilterToggle={toggleFilter}
      onMinAwardChange={setMinAward}
      onMaxAwardChange={setMaxAward}
      onReset={resetFilters}
    />
  </div>
{/if}

{#if renderedScholarships.length}
  <section class="scholarship-grid">
    {#each renderedScholarships as scholarship, index (scholarship.id)}
      <div
        class="scholarship-card-slot"
        style={`--card-enter-delay: ${Math.min(index * 40, 280)}ms`}
        class:source-hidden={showModal &&
          activeScholarship?.id === scholarship.id}
        aria-hidden={showModal && activeScholarship?.id === scholarship.id}
      >
        <ScholarshipCard
          onclick={(event) => openScholarship(scholarship, event)}
          name={scholarship.name}
          deadline={scholarship.formattedDeadline()}
          openDate={scholarship.openDateIsFuture() ? scholarship.formattedOpenDate() : null}
          openUnknown={scholarship.openUnknown}
          daysLeft={scholarship.daysUntil()}
          description={scholarship.description}
          endowmentRange={scholarship.endowmentRange()}
          filters={scholarship.displayFilters()}
        />
      </div>
    {/each}
  </section>
{:else}
  <div class="empty-state">
    <p>No scholarships match this search.</p>
    <button type="button" onclick={resetFilters}>Reset filters</button>
  </div>
{/if}

<Modal bind:showModal sourceRect={activeCardRect}>
  {#if activeScholarship}
    <article class="scholarship-modal">
      <header class="modal-header">
        <div class="meta">
          <p class="eyebrow">Scholarship</p>
          <h2>{activeScholarship.name}</h2>
        </div>
      </header>

      <section class="detail-grid" aria-label="Scholarship details">
        {#if activeScholarship.endowmentRange()}
          <div class="detail-tile">
            <span>Award</span>
            <strong>{activeScholarship.endowmentRange()}</strong>
          </div>
        {/if}

        {#if activeScholarship.openUnknown}
          <div class="detail-tile">
            <span>Deadline</span>
            <strong>Not Released</strong>
          </div>
        {:else}
          <div class="detail-tile">
            <span>Deadline</span>
            <strong>{activeScholarship.formattedDeadline()}</strong>
          </div>

          {#if activeScholarship.openDateIsFuture() && activeScholarship.formattedOpenDate()}
            <div class="detail-tile">
              <span>Opens</span>
              <strong>{activeScholarship.formattedOpenDate()}</strong>
            </div>
          {/if}

          <div class="detail-tile">
            <span>Status</span>
            <strong class={`countdown ${activeScholarship.countdownClass()}`}>
              {activeScholarship.countdownLabel()}
            </strong>
          </div>
        {/if}

        {#if activeScholarship.availableGrades?.length}
          <div class="detail-tile">
            <span>Eligible grades</span>
            <strong>{formatGradeList(activeScholarship.availableGrades)}</strong
            >
          </div>
        {/if}
      </section>

      <div class="modal-content-grid">
        <section class="modal-section overview-section">
          <p class="section-label">Overview</p>
          <p class="modal-description">{activeScholarship.description}</p>
        </section>

        <aside class="modal-section sidebar-section">
          {#if activeScholarship.primary_link}
            <a
              class="primary-link"
              href={activeScholarship.primary_link}
              target="_blank"
              rel="noreferrer"
            >
              View full details
            </a>
          {/if}

          {#if activeScholarship.displayFilters().length}
            <div class="tag-section">
              <p class="section-label">Categories</p>
              <div class="tags">
                {#each activeScholarship.displayFilters() as filter (filter.key)}
                  <Tag
                    color={filter.color}
                    name={filter.name}
                    description={filter.description}
                  />
                {/each}
              </div>
            </div>
          {/if}
        </aside>
      </div>
    </article>
  {/if}
</Modal>

<style lang="scss">
  @use "$lib/styles/global.scss" as *;
  @use "$lib/styles/listing.scss" as listing;
  @use "$lib/styles/program-modal.scss" as modal;

  :global(.no-scroll) {
    overflow: hidden;
  }
  @media (prefers-reduced-motion: reduce) {
    .tutorial-box,
    .cutout {
      transition: none;
    }
  }

  .tutorial-box {
    position: fixed;
    width: min(360px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem 1.25rem;
    border-radius: 14px;
    background: $surface;
    border: 1px solid $nav-border;
    box-shadow: 0 12px 30px $nav-shadow;
    z-index: 20;
    transition: left 240ms, ease, top 240ms ease;
  }
  .tutorial-step {
    margin: 0;
    font: 700 0.7rem/1 "Inter", system-ui, sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: $primary;
  }

  .tutorial-title {
    margin: 0;
    font: 700 1.05rem/1.2 "Inter", system-ui, sans-serif;
    color: $text;
  }

  .tutorial-text {
    margin: 0;
    font: 400 0.9rem/1.45 "Inter", system-ui, sans-serif;
    color: $text;
  }

  .tutorial-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 0.25rem;
  }

  .tutorial-primary {
    padding: 0.6rem 1.1rem;
    border: none;
    border-radius: 999px;
    background: $primary;
    color: $surface;
    font: 700 0.85rem/1 "Inter", system-ui, sans-serif;
    cursor: pointer;
    transition: background 140ms ease, transform 140ms ease;

    &:hover,
    &:focus-visible {
      outline: none;
      background: $red;
      transform: translateY(-1px);
    }
}

  .intro-transition {
    overflow: hidden;
  }

  .cutout {
    position: fixed;
    transform: translate(-50%, -50%);
    border-radius: 26px;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    z-index: 15;
    border: 3px solid #007FEF;
    pointer-events: none;
    transition: top 240ms ease, left 240ms ease, width 240ms ease, height 240ms ease;
  }

  .scholarship-intro {
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(140px, 0.32fr);
    align-items: center;
    min-height: 260px;
    margin: 0 0 24px;
    padding: clamp(32px, 5vw, 58px);
    overflow: hidden;
    border: 1px solid $primary;
    border-radius: 22px;
    background: linear-gradient(125deg, $primary 0%, $primary 56%, $red 135%);
    box-shadow: 0 20px 42px $nav-shadow;

    &::before {
      position: absolute;
      z-index: -1;
      top: -150px;
      right: -100px;
      width: 360px;
      height: 360px;
      content: "";
      border-radius: 50%;
      background: $gold;
      opacity: 0.18;
    }
  }

  .intro-copy {
    position: relative;
    z-index: 1;
    min-width: 0;
    max-width: 650px;
  }

  .intro-label {
    display: inline-block;
    margin: 0 0 14px;
    padding: 6px 10px;
    border-radius: 999px;
    background: $gold;
    color: $text;
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  .intro-copy h2 {
    margin: 0;
    color: $surface;
    font-size: clamp(2rem, 4vw, 3.5rem);
    line-height: 1.04;
    letter-spacing: -0.045em;
  }

  .intro-description {
    max-width: 570px;
    margin: 16px 0 0;
    color: $surface;
    font-size: 1rem;
    line-height: 1.55;
    opacity: 0.86;
  }

  .start-tut {
    display: inline-block;
    margin: 18px 0 0;
    padding: 14px 14px;
    border-radius: 12px;
    border: 1px solid rgba($surface, 0.42);
    background: transparent;
    color: $surface;
    cursor: pointer;
    font:
      800 0.9rem/1 "Inter",
      system-ui,
      -apple-system,
      sans-serif;
    transition:
      transform 140ms ease,
      box-shadow 140ms ease,
      border 140ms ease,
      color 140ms ease,
      background 140ms ease;
    &:hover,
    &:focus-visible {
      outline: none;
      transform: translateY(-1px);
      border: 1px solid rgba($surface, 1);
      color: $primary;
      background: $surface;
    }
  }

  .tour-search-target {
    width: 100%;
  }

  .intro-close {
    position: absolute;
    z-index: 2;
    top: 16px;
    right: 16px;
    display: grid;
    width: 30px;
    height: 30px;
    padding: 0;
    place-items: center;
    border: 1px solid rgba($surface, 0.42);
    border-radius: 50%;
    background: transparent;
    color: $surface;
    cursor: pointer;
    font:
      400 1.25rem/1 "Inter",
      system-ui,
      -apple-system,
      sans-serif;
    transition:
      background 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
  }

  .intro-close span:first-child {
    transform: translateY(-1px);
  }

  .intro-close:hover,
  .intro-close:focus-visible {
    background: $surface;
    box-shadow: 0 6px 14px $link-shadow;
    color: $primary;
    outline: none;
    transform: scale(1.06);
  }

  .intro-mark {
    position: relative;
    z-index: 1;
    justify-self: end;
    color: $surface;
    font-size: clamp(5rem, 13vw, 10rem);
    font-weight: 800;
    letter-spacing: -0.12em;
    line-height: 0.8;
    opacity: 0.16;
    user-select: none;
  }

  @include listing.controls(30%);

  @include listing.results;

  @media (max-width: 640px) {
    .scholarship-intro {
      grid-template-columns: 1fr;
      min-height: 300px;
      padding: 34px 28px;
    }

    .intro-close {
      top: 12px;
      right: 12px;
    }

    .intro-mark {
      position: absolute;
      right: 26px;
      bottom: 10px;
      font-size: 7rem;
    }
  }

  @include listing.empty-state;

  @include modal.details(".scholarship-modal", true);
</style>
