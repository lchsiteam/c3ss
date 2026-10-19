<script lang="ts">
  import { FILTER_COLORS, type SummerFilter, type SummerFilterKey } from "$lib/scripts/summerPrograms"

  interface Props {
    filters: SummerFilter[]
    selectedFilters: SummerFilterKey[]
    resultCount: number
    totalCount: number
    onFilterToggle: (filter: SummerFilterKey) => void
    onReset: () => void
  }

  let {
    filters,
    selectedFilters,
    resultCount,
    totalCount,
    onFilterToggle,
    onReset,
  }: Props = $props()
</script>

<section class="filter-panel" id="summerprogram-filters" aria-label="Summer program filters">
  <div class="panel-header">
    <div>
      <p class="eyebrow">Filters</p>
      <p class="result-count">{resultCount} of {totalCount} summer programs</p>
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
</section>

<style lang="scss">
  @use "$lib/styles/filter-panel.scss" as filterPanel;

  @include filterPanel.panel;
</style>
