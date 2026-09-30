<script lang="ts">
  import Tag from "$lib/components/Tag.svelte"
  import type { ScholarshipFilter } from "$lib/scripts/scholarships"

  interface Props {
    name: string
    deadline: string
    daysLeft: number
    description: string
    endowmentRange?: string | null
    filters?: ScholarshipFilter[]
    onclick?: (event: MouseEvent) => void
  }

  let props: Props = $props()
  let descriptionElement: HTMLParagraphElement | null = null
  let isDescriptionClipped = $state(false)

  const countdownClass = () => {
    if (props.daysLeft < 0) return "passed"
    if (props.daysLeft <= 3) return "hot"
    if (props.daysLeft <= 10) return "warm"
    return "calm"
  }

  const countdownLabel = () => (props.daysLeft < 0 ? "Passed" : `${props.daysLeft}d`)

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault()
      props.onclick?.(event as unknown as MouseEvent)
    }
  }

  const updateDescriptionClip = () => {
    if (!descriptionElement) return
    isDescriptionClipped = descriptionElement.scrollHeight > descriptionElement.clientHeight + 1
  }

  $effect(() => {
    props.description
    queueMicrotask(updateDescriptionClip)
  })

  $effect(() => {
    if (!descriptionElement) return

    const observer = new ResizeObserver(updateDescriptionClip)

    observer.observe(descriptionElement)
    updateDescriptionClip()

    return () => observer.disconnect()
  })
</script>

<section
  class="scholarship-card"
  role="button"
  tabindex="0"
  onclick={props.onclick}
  onkeydown={handleKeydown}
>
  <div class="header">
    <div class="header-left">
      <div class="name">{props.name}</div>
      {#if props.endowmentRange}
        <span class="award">{props.endowmentRange}</span>
      {/if}
      {#if props.filters?.length}
        <div class="filter-tags">
          {#each props.filters as filter (filter.key)}
            <Tag color={filter.color} name={filter.name} description={filter.description} />
          {/each}
        </div>
      {/if}
    </div>
    <div class="deadline">
      <span class={`countdown ${countdownClass()}`} style={(props.deadline === "Rolling Deadline") ? "display: none;" : ""}>
        {countdownLabel()}
      </span>
      <div class="deadline-text">
        <span>Deadline</span>
        <strong>{props.deadline}</strong>
      </div>
    </div>
  </div>

  <div class="description-block">
    <div class="description-preview">
      <p bind:this={descriptionElement} class="description">{props.description}</p>

      {#if isDescriptionClipped}
        <div class="description-fade" aria-hidden="true"></div>
      {/if}
    </div>

    {#if isDescriptionClipped}
      <span class="description-hint" aria-hidden="true">Click to see more</span>
    {/if}
  </div>
</section>

<style lang="scss">
  @use "$lib/styles/global.scss" as *;

  * {
    box-sizing: border-box;
  }

  .scholarship-card {
    display: grid;
    gap: 0.75rem;
    align-items: start;
    width: 100%;
    min-width: 0;
    container-type: inline-size;
    padding: 1rem 1.25rem;
    border-radius: 14px;
    background: linear-gradient(135deg, $surface, $bg);
    border: 1px solid $nav-border;
    box-shadow: 0 12px 30px $nav-shadow;
    cursor: pointer;
    transition: transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease;
    font-family: "Lato", "Inter", system-ui, -apple-system, sans-serif;

    &:hover,
    &:focus-visible {
      transform: translateY(-2px);
      box-shadow: 0 16px 36px $link-shadow;
      border-color: rgba($primary, 0.4);
      outline: none;
    }

    &:focus-visible {
      box-shadow: 0 0 0 3px $link-focus, 0 14px 32px $link-shadow;
    }
  }

  .header {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    min-width: 0;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1 1 4rem;
    min-width: 0;
    flex-wrap: wrap;
  }

  .name {
    font-weight: 800;
    font-size: 1.05rem;
    color: $primary;
    line-height: 1.4;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .award {
    background: rgba($calm, 0.14);
    color: $text;
    border: 1px solid rgba($calm, 0.32);
    border-radius: 999px;
    padding: 4px 10px;
    font-weight: 700;
    font-size: 0.82rem;
    white-space: nowrap;
  }

  .filter-tags {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex-wrap: wrap;
  }

  .deadline {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 0.4rem 0.65rem;
    background: rgba($primary, 0.08);
    border-radius: 10px;
    border: 1px solid $nav-border;
    color: $text;
    flex: 0 0 auto;
    max-width: 100%;
  }

  .deadline-text {
    display: grid;
    align-items: center;
    text-align: right;
    line-height: 1.1;

    span {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: $eyebrow;
    }

    strong {
      font-size: 0.95rem;
      font-weight: 800;
      color: $primary;
    }
  }

  .countdown {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 0.82rem;
    letter-spacing: 0.02em;
    background: rgba($primary, 0.12);
    color: $primary;
    box-shadow: inset 0 0 0 1px rgba($primary, 0.32);
  }

  .countdown.calm {
    background: rgba($calm, 0.18);
    color: $calm;
    box-shadow: inset 0 0 0 1px rgba($calm, 0.4);
  }

  .countdown.warm {
    background: rgba($warm, 0.18);
    color: $warm;
    box-shadow: inset 0 0 0 1px rgba($warm, 0.5);
    animation: pulse 1s ease-in-out infinite;
  }

  .countdown.hot {
    background: rgba($primary, 0.18);
    color: $primary;
    box-shadow: inset 0 0 0 1px rgba($primary, 0.5), 0 0 0 6px rgba($primary, 0.12);
    animation: pulse-fast 0.9s ease-in-out infinite, shake 1.0s ease-in-out infinite;
  }

  .countdown.passed {
    background: rgba($text, 0.08);
    color: $eyebrow;
    box-shadow: inset 0 0 0 1px rgba($text, 0.2);
    text-decoration: line-through;
  }

  @keyframes pulse {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px); }
  }

  @keyframes pulse-fast {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-2px) scale(1.02); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-1px); }
    50% { transform: translateX(1px); }
    75% { transform: translateX(-0.5px); }
  }

  .description-block {
    display: grid;
    gap: 0.35rem;
  }

  .description-preview {
    position: relative;
    overflow: hidden;
  }

  .description {
    margin: 0;
    color: $text;
    line-height: 1.5;
    font-size: 0.98rem;
    max-height: calc(4 * 1em * 1.5);
    overflow: hidden;
    padding-right: 0.1rem;
  }

  .description-fade {
    position: absolute;
    inset: auto 0 0;
    height: 3.25rem;
    background: linear-gradient(180deg, rgba($bg, 0) 0%, rgba($bg, 0.96) 78%);
    pointer-events: none;
  }

  .description-hint {
    font-size: 0.78rem;
    font-weight: 800;
    color: $primary;
    letter-spacing: 0.02em;
  }

  @container (max-width: 40rem) {
    .header {
      flex-direction: column;
      align-items: flex-start;
    }

    .deadline {
      justify-items: start;
      width: 100%;
    }

    .name {
      white-space: normal;
    }
  }

  @container (max-width: 30rem) {
    .scholarship-card {
      padding: 0.9rem 1rem;
      border-radius: 12px;
    }
  }
</style>
