<script lang="ts">
  import { FILTER_COLORS, type ScholarshipFilter, type ScholarshipFilterKey } from "$lib/scripts/scholarships"

  interface Props {
    filters: ScholarshipFilter[]
    selectedFilters: ScholarshipFilterKey[]
    minAward: number
    maxAward: number
    rangeMin: number
    rangeMax: number
    resultCount: number
    totalCount: number
    onFilterToggle: (filter: ScholarshipFilterKey) => void
    onMinAwardChange: (value: number) => void
    onMaxAwardChange: (value: number) => void
    onReset: () => void
  }

  let {
    filters,
    selectedFilters,
    minAward,
    maxAward,
    rangeMin,
    rangeMax,
    resultCount,
    totalCount,
    onFilterToggle,
    onMinAwardChange,
    onMaxAwardChange,
    onReset,
  }: Props = $props()

  const formatCurrency = (value: number) =>
    value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    })

  let rangeSpan = $derived(Math.max(rangeMax - rangeMin, 1))
  let lowerPercent = $derived(((minAward - rangeMin) / rangeSpan) * 100)
  let upperPercent = $derived(((maxAward - rangeMin) / rangeSpan) * 100)
  let awardStep = $derived(Math.max(100, Math.round(rangeSpan / 10000) * 100))
  let canUseAwardRange = $derived(rangeMax > rangeMin)
</script>

<section class="filter-panel" id="scholarship-filters" aria-label="Scholarship filters">
  <div class="panel-header">
    <div>
      <p class="eyebrow">Filters</p>
      <p class="result-count">{resultCount} of {totalCount} scholarships</p>
    </div>
    <button type="button" class="reset-button" onclick={onReset}>Reset</button>
  </div>

  <div class="filter-section">
    <p class="section-title">Categories</p>
    {#if filters.length}
      <div class="filter-options">
        {#each filters as filter (filter.key)}
          <button
            type="button"
            class="filter-chip"
            class:selected={selectedFilters.includes(filter.key)}
            style={`--filter-color: ${FILTER_COLORS[filter.color]}`}
            aria-pressed={selectedFilters.includes(filter.key)}
            title={filter.description}
            onclick={() => onFilterToggle(filter.key)}
          >
            <span class="color-dot" aria-hidden="true"></span>
            {filter.name}
          </button>
        {/each}
      </div>
    {:else}
      <p class="empty-filter-note">No category filters are available yet.</p>
    {/if}
  </div>

  <div class="filter-section">
    <div class="section-row">
      <p class="section-title">Award Range</p>
      <p class="price-label">{formatCurrency(minAward)} to {formatCurrency(maxAward)}</p>
    </div>

    <div
      class="range-track"
      style={`--range-start: ${lowerPercent}%; --range-end: ${upperPercent}%`}
    >
      <input
        class="range-input min-input"
        style={`z-index: ${minAward >= maxAward && minAward > rangeMin ? 4 : 2}`}
        type="range"
        min={rangeMin}
        max={rangeMax}
        step={awardStep}
        value={minAward}
        disabled={!canUseAwardRange}
        aria-label="Minimum award amount"
        aria-valuetext={formatCurrency(minAward)}
        oninput={(event) => onMinAwardChange(Number(event.currentTarget.value))}
      />
      <input
        class="range-input max-input"
        type="range"
        min={rangeMin}
        max={rangeMax}
        step={awardStep}
        value={maxAward}
        disabled={!canUseAwardRange}
        aria-label="Maximum award amount"
        aria-valuetext={formatCurrency(maxAward)}
        oninput={(event) => onMaxAwardChange(Number(event.currentTarget.value))}
      />
    </div>

    <div class="range-captions" aria-hidden="true">
      <span>{formatCurrency(rangeMin)}</span>
      <span>{formatCurrency(rangeMax)}</span>
    </div>
  </div>
</section>

<style lang="scss">
  @use "$lib/styles/filter-panel.scss" as filterPanel;

  @include filterPanel.panel(true);
</style>
