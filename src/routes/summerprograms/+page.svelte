<script lang="ts">
  import Modal from "$lib/components/Modal.svelte"
  import SummerProgramCard from "$lib/components/SummerPrograms.svelte"
  import Tag from "$lib/components/Tag.svelte"
  import { fuzzy } from "fast-fuzzy"
  import { slide } from "svelte/transition"
  import { 
    Summer, 
    type SummerDTO,
    type SummerFilterKey,
    type SummerFilter
  } from "$lib/scripts/summerPrograms"
  import {
    compareApplicationSchedule,
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
    const scheduled = sortByApplicationSchedule(source, reference, getSchedule)
    const query = term.trim()

    if (!query) return scheduled

    return [...source]
      .map((summerProgram) => ({
        summerProgram,
        similarity: fuzzy(query, summerProgram.name),
      }))
      .sort(
        (firstItem, secondItem) =>
          compareApplicationSchedule(
            firstItem.summerProgram,
            secondItem.summerProgram,
            reference,
            getSchedule,
          ) ||
          secondItem.similarity - firstItem.similarity,
      )
      .map(({ summerProgram }) => summerProgram)
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
  @use "$lib/styles/global.scss" as *;
  @use "sass:color";

  .search-tools {
    display: flex;
    align-items: stretch;
    gap: 10px;
    margin: 0 0 18px;
  }

  .search-tools :global(.search-shell) {
    flex: 1 1 auto;
    min-width: 0;
    margin: 0;
    padding: 0;
    height: 7vh;
    min-height: 52px;
  }

  .search-tools :global(.search-bar) {
    width: 100%;
  }

  .filter-tab {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-width: 124px;
    min-height: 52px;
    padding: 12px 15px;
    border: 1px solid $nav-border;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.86);
    color: $primary;
    cursor: pointer;
    font:
      800 0.94rem/1 "Inter",
      system-ui,
      -apple-system,
      sans-serif;
    box-shadow: 0 12px 26px $nav-shadow;
    transition:
      background 140ms ease,
      border-color 140ms ease,
      box-shadow 140ms ease,
      transform 140ms ease;
    z-index: 0;
  }

  .filter-tab:hover,
  .filter-tab:focus-visible,
  .filter-tab.is-active {
    background: $link-focus;
    border-color: color.adjust($nav-border, $lightness: -30%);
    box-shadow: 0 15px 30px $link-shadow;
    outline: none;
    transform: translateY(-1px);
  }

  .filter-icon {
    position: relative;
    display: inline-block;
    width: 18px;
    height: 14px;
    transition: transform 140ms ease;
  }

  .filter-icon::before,
  .filter-icon::after {
    content: "";
    position: absolute;
    left: 0;
    width: 18px;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
    box-shadow: 0 6px 0 currentColor;
    transition:
      transform 140ms ease,
      width 140ms ease;
  }

  .filter-icon::before {
    top: 0;
  }

  .filter-icon::after {
    bottom: 6px;
    width: 12px;
  }

  .filter-tab.is-active .filter-icon {
    transform: translateY(1px);
  }

  .filter-tab.is-active .filter-icon::after {
    width: 18px;
    transform: translateX(3px);
  }

  .filter-count {
    display: inline-grid;
    place-items: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 999px;
    background: $primary;
    color: #ffffff;
    font-size: 0.78rem;
  }

  .filter-transition {
    overflow: hidden;
  }

  .scholarship-grid {
    display: grid;
    gap: 14px;
    margin: 18px 0 32px;
  }

  @keyframes card-entrance {
    from {
      opacity: 0;
      transform: translateY(14px) scale(0.985);
    }

    65% {
      transform: translateY(-1px) scale(1.002);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .scholarship-card-slot {
    transition: opacity 160ms ease;
    max-width: 75vw;
    animation: card-entrance 360ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: var(--card-enter-delay);
  }

  .scholarship-card-slot.source-hidden {
    opacity: 0;
    animation: none;
    pointer-events: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .scholarship-card-slot {
      animation: none;
    }
  }

  .empty-state {
    display: grid;
    place-items: center;
    gap: 12px;
    min-height: 220px;
    margin: 18px 0 32px;
    padding: 30px;
    border: 1px dashed $nav-border;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.72);
    color: $eyebrow;
    text-align: center;
  }

  .empty-state p {
    margin: 0;
    font-weight: 800;
  }

  .empty-state button {
    border: 1px solid $nav-border;
    border-radius: 10px;
    background: $link-focus;
    color: $primary;
    cursor: pointer;
    font:
      800 0.9rem/1 "Inter",
      system-ui,
      -apple-system,
      sans-serif;
    padding: 10px 12px;
  }

  .scholarship-modal {
    display: grid;
    gap: 18px;
  }

  .modal-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 18px;
    align-items: start;
    padding: 0 44px 18px 0;
  }

  .meta {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .meta h2 {
    margin: 0;
    color: $primary;
    font-size: clamp(1.35rem, 2.5vw, 1.9rem);
    line-height: 1.18;
  }

  .eyebrow,
  .section-label {
    margin: 0;
    color: $primary;
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .status-card {
    display: grid;
    justify-items: end;
    gap: 4px;
    min-width: 132px;
    padding: 12px 14px;
    border: 1px solid $nav-border;
    border-radius: 14px;
    background: $link-focus;
    color: $text;
    text-align: right;
  }

  .status-card.calm {
    background: $calm;
    border-color: color.adjust($calm, $lightness: -10%);
  }

  .status-card.warm {
    background: $warm;
    border-color: color.adjust($warm, $lightness: -10%);
  }

  .status-card.hot {
    background: $hot;
    border-color: color.adjust($hot, $lightness: -10%);
  }

  .status-card.passed {
    background: rgba(90, 112, 144, 0.12);
    border-color: rgba(90, 112, 144, 0.26);
    color: #4f5f7d;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
  }

  .detail-tile {
    display: grid;
    align-content: start;
    gap: 7px;
    min-height: 82px;
    padding: 12px;
    border: 1px solid $nav-border;
    border-radius: 14px;
    background: rgba(247, 250, 255, 0.86);
  }

  .detail-tile span {
    color: $eyebrow;
    font-size: 0.73rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .detail-tile strong {
    color: $text;
    font-size: 0.95rem;
    line-height: 1.28;
  }

  .modal-content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(190px, 0.38fr);
    gap: 14px;
    align-items: start;
  }

  .modal-section {
    display: grid;
    gap: 10px;
    padding: 16px;
    border: 1px solid rgba(199, 115, 115, 0.12);
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.72);
  }

  .overview-section {
    min-height: 170px;
  }

  .sidebar-section {
    gap: 14px;
  }

  .tag-section {
    display: grid;
    gap: 10px;
  }

  .countdown {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 0.85rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    background: rgba(248, 133, 56, 0.2);
    color: $primary
  }

  .countdown.calm {
    background: rgba(104, 181, 123, 0.18);
    color: #2b4c35;
    box-shadow: inset 0 0 0 1px rgba(104, 181, 123, 0.4);
  }

  .countdown.warm {
    background: rgba(246, 195, 68, 0.28);
    color: #7a2a1f;
    box-shadow: inset 0 0 0 1px rgba(246, 195, 68, 0.5);
    animation: pulse 1s ease-in-out infinite;
  }

  .countdown.hot {
    background: rgba(179, 38, 30, 0.22);
    color: #b3261e;
    box-shadow:
      inset 0 0 0 1px rgba(179, 38, 30, 0.5),
      0 0 0 6px rgba(179, 38, 30, 0.12);
    animation:
      pulse-fast 0.9s ease-in-out infinite,
      shake 1s ease-in-out infinite;
  }

  .countdown.passed {
    background: rgba(144, 90, 90, 0.14);
    color: $primary;
    box-shadow: inset 0 0 0 1px $nav-shadow;
    text-decoration: line-through;
  }

  @keyframes pulse {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-1px);
    }
  }

  @keyframes pulse-fast {
    0%,
    100% {
      transform: translateY(0);
    }
    50% {
      transform: translateY(-2px) scale(1.02);
    }
  }

  @keyframes shake {
    0%,
    100% {
      transform: translateX(0);
    }
    25% {
      transform: translateX(-1px);
    }
    50% {
      transform: translateX(1px);
    }
    75% {
      transform: translateX(-0.5px);
    }
  }

  .modal-description {
    margin: 0;
    color: var(--text);
    font-size: 1rem;
    line-height: 1.65;
  }

  .primary-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 12px;
    background: linear-gradient(135deg, $gold, $red);
    color: #ffffff;
    text-decoration: none;
    font-weight: 800;
    box-shadow: 0 12px 26px $nav-shadow;
    transition:
      transform 130ms ease,
      box-shadow 130ms ease;
  }

  .primary-link:hover,
  .primary-link:focus-visible {
    outline: none;
    transform: translateY(-1px);
    box-shadow: 0 16px 30px $nav-shadow;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  @media (max-width: 640px) {
    .search-tools {
      flex-direction: column;
    }

    .filter-tab {
      width: 100%;
    }

    .modal-header,
    .modal-content-grid {
      grid-template-columns: 1fr;
    }

    .modal-header {
      padding-right: 38px;
    }

    .status-card {
      justify-items: start;
      width: 100%;
      text-align: left;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }

    .overview-section {
      min-height: 0;
    }
  }
</style>
