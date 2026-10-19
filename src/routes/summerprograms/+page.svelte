<script lang="ts">
  import Modal from "$lib/components/Modal.svelte"
  import SummerProgramCard from "$lib/components/SummerPrograms.svelte"
  import Tag from "$lib/components/Tag.svelte"
  import { search } from "fast-fuzzy"
  import { slide } from "svelte/transition"
  import { 
    Summer, 
    type SummerDTO,
    type SummerFilterKey,
    type SummerFilter
  } from "$lib/scripts/summerPrograms"
  import {
    sortByApplicationSchedule,
  } from "$lib/scripts/applicationDates"
  import Search from "$lib/components/Search.svelte"
  import FilterSelectSummerPrograms from "$lib/components/FilterSelectSummerPrograms.svelte"

  let { data }: { data: { summerPrograms: SummerDTO[] } } = $props()

  let showModal = $state(false)
  let filtersOpen = $state(false)
  let activeSummerProgram = $state<Summer | null>(null)
  let activeCardRect = $state<DOMRect | null>(null)
  let searchTerm = $state("")
  let selectedFilters = $state<SummerFilterKey[]>([])
  let summerPrograms = $derived(data.summerPrograms.map(Summer.from))

  let filterOptions = $derived.by(() => {
    const options = new Map<SummerFilterKey, SummerFilter>()

    for (const summerProgram of summerPrograms) {
      for (const filter of summerProgram.displayFilters()) {
        options.set(filter.key, filter)
      }
    }

    return [...options.values()].sort((first, second) =>
      first.name.localeCompare(second.name),
    )
  })

  const openSummerProgram = (summerProgram: Summer, event: MouseEvent) => {
    const sourceCard =
      event.currentTarget instanceof HTMLElement ? event.currentTarget : null

    activeSummerProgram = summerProgram
    activeCardRect = sourceCard?.getBoundingClientRect() ?? null
    showModal = true
  }

  const sortSummerPrograms = (
    term: string,
    source: Summer[],
  ): Summer[] => {
    const reference = new Date()
    const getSchedule = (program: Summer) => ({
      deadline: program.deadline ?? program.start_date,
      openDate: program.openDate,
      openUnknown: program.openUnknown,
    })
    const query = term.trim()
    const matchingPrograms = query
      ? search(query, source, {
          keySelector: (program) => program.name,
        })
      : source

    return sortByApplicationSchedule(matchingPrograms, reference, getSchedule)
  }

  const toggleFilter = (filter: SummerFilterKey) => {
    selectedFilters = selectedFilters.includes(filter)
      ? selectedFilters.filter((selectedFilter) => selectedFilter !== filter)
      : [...selectedFilters, filter]
  }

  const resetFilters = () => {
    selectedFilters = []
  }

  const formatGradeList = (grades: number[]) =>
    grades.map((grade) => `Grade ${grade}`).join(", ")

  const matchesFilters = (summerProgram: Summer) => {
    const hasSelectedFilters =
      selectedFilters.length === 0 ||
      selectedFilters.every((selectedFilter) =>
        summerProgram.filters.includes(selectedFilter),
      )

    if (!hasSelectedFilters) return false
    return true
  }

  let renderedSummerPrograms = $derived.by(() =>
    sortSummerPrograms(searchTerm, summerPrograms.filter(matchesFilters)),
  )

  let activeFilterCount = $derived(
    selectedFilters.length
  )

  $effect(() => {
    if (!showModal) {
      activeCardRect = null
    }
  })

</script>

<div class="search-tools">
  <Search bind:searchTerm thing="summer programs"/>
  <button
    type="button"
    class="filter-tab"
    class:is-active={filtersOpen}
    aria-expanded={filtersOpen}
    aria-controls="summerprogram-filters"
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
    transition:slide={{ duration: 180, axis: "y" }}
  >
    <FilterSelectSummerPrograms
      filters={filterOptions}
      {selectedFilters}
      resultCount={renderedSummerPrograms.length}
      totalCount={summerPrograms.length}
      onFilterToggle={toggleFilter}
      onReset={resetFilters}
    />
  </div>
{/if}

{#if renderedSummerPrograms.length}
  <section class="scholarship-grid">
    {#each renderedSummerPrograms as summerProgram, index (summerProgram.id)}
      <div
        class="scholarship-card-slot"
        style={`--card-enter-delay: ${Math.min(index * 40, 280)}ms`}
        class:source-hidden={showModal &&
          activeSummerProgram?.id === summerProgram.id}
        aria-hidden={showModal && activeSummerProgram?.id === summerProgram.id}
      >
        <SummerProgramCard
          onclick={(event) => openSummerProgram(summerProgram, event)}
          name={summerProgram.name}
          deadline={summerProgram.formattedDeadline()}
          openDate={summerProgram.openDateIsFuture() ? summerProgram.formattedOpenDate() : null}
          openUnknown={summerProgram.openUnknown}
          start_date={summerProgram.rollingFormattedDeadline()}
          daysLeft={summerProgram.daysUntil()}
          description={summerProgram.description}
          filters={summerProgram.displayFilters()}
        />
      </div>
    {/each}
  </section>
{:else}
  <div class="empty-state">
    <p>No summer programs match this search.</p>
    <button type="button" onclick={resetFilters}>Reset filters</button>
  </div>
{/if}

<Modal bind:showModal sourceRect={activeCardRect}>
  {#if activeSummerProgram}
    <article class="summerprogram-modal">
      <header class="modal-header">
        <div class="meta">
          <p class="eyebrow">Summer Program</p>
          <h2>{activeSummerProgram.name}</h2>
        </div>
      </header>
      <section class="detail-grid" aria-label="Summer program details">
        {#if activeSummerProgram.openUnknown}
          <div class="detail-tile">
            <span>Deadline</span>
            <strong>Not Released</strong>
          </div>
        {:else}
          {#if activeSummerProgram.deadlineDate}
            <div class="detail-tile">
              <span>Deadline</span>
              <strong>{activeSummerProgram.formattedDeadline()}</strong>
            </div>
            {#if activeSummerProgram.rollingDeadlineDate}
              <div class="detail-tile">
                <span>Start Date</span>
                <strong>{activeSummerProgram.rollingFormattedDeadline()}</strong>
              </div>
            {/if}
            <div class="detail-tile">
              <span>Status</span>
              <strong class={`countdown ${activeSummerProgram.countdownClass()}`}>
                {activeSummerProgram.countdownLabel()}
              </strong>
            </div>
          {:else if activeSummerProgram.start_date != null}
            <div class="detail-tile">
              <span>Start Date</span>
              <strong>{activeSummerProgram.rollingFormattedDeadline()}</strong>
            </div>
            <div class="detail-tile">
              <span>Status</span>
              <strong class={`countdown ${activeSummerProgram.rollingCountdownClass()}`}>
                {activeSummerProgram.rollingCountdownLabel()}
              </strong>
            </div>
          {:else}
            <div class="detail-tile">
              <span>Deadline</span>
              <strong>{activeSummerProgram.formattedDeadline()}</strong>
            </div>
            <div class="detail-tile">
              <span>Status</span>
              <strong class={`countdown ${activeSummerProgram.countdownClass()}`}>
                {activeSummerProgram.countdownLabel()}
              </strong>
            </div>
          {/if}

          {#if activeSummerProgram.openDateIsFuture() && activeSummerProgram.formattedOpenDate()}
            <div class="detail-tile">
              <span>Opens</span>
              <strong>{activeSummerProgram.formattedOpenDate()}</strong>
            </div>
          {/if}
        {/if}


        {#if activeSummerProgram.availableGrades?.length}
          <div class="detail-tile">
            <span>Eligible grades</span>
            <strong>{formatGradeList(activeSummerProgram.availableGrades)}</strong
            >
          </div>
        {/if}
      </section>

      <div class="modal-content-grid">
        <section class="modal-section overview-section">
          <p class="section-label">Overview</p>
          <p class="modal-description">{activeSummerProgram.description}</p>
        </section>

        <aside class="modal-section sidebar-section">
          {#if activeSummerProgram.primary_link}
            <a
              class="primary-link"
              href={activeSummerProgram.primary_link}
              target="_blank"
              rel="noreferrer"
            >
              View full details
            </a>
          {/if}

          {#if activeSummerProgram.displayFilters().length}
            <div class="tag-section">
              <p class="section-label">Categories</p>
              <div class="tags">
                {#each activeSummerProgram.displayFilters() as filter (filter.key)}
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
  @use "$lib/styles/listing.scss" as listing;
  @use "$lib/styles/program-modal.scss" as modal;

  @include listing.controls(-30%);

  @include listing.results;

  @include listing.empty-state;

  @include modal.details(".scholarship-modal");
</style>
