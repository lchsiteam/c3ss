<script lang="ts">
  import Tag from "$lib/components/Tag.svelte"
  import type { SummerFilter } from "$lib/scripts/summerPrograms"

  interface Props {
    name: string
    deadline: string
    openDate?: string | null
    openUnknown?: boolean
    start_date: string | null
    daysLeft: number | null
    description: string
    estimated_cost?: string | null
    filters?: SummerFilter[]
    onclick?: (event: MouseEvent) => void
  }

  let props: Props = $props()
  let descriptionElement: HTMLParagraphElement | null = null
  let isDescriptionClipped = $state(false)

  const rollingCountdownClass = () => {
    if (props.daysLeft === null) return "calm"
    return "calm"
  }

  const countdownClass = () => {
    if (props.daysLeft === null) return "calm"
    if (props.daysLeft < 0) return "passed"
    if (props.daysLeft <= 3) return "hot"
    if (props.daysLeft <= 10) return "warm"
    return "calm"
  }

  const rollingCountdownLabel = () =>
    props.daysLeft === null
      ? "Rolling"
      : props.daysLeft < 0
        ? "Opened"
        : `${props.daysLeft}d`

  const countdownLabel = () =>
    (props.daysLeft === null)
      ? "No deadline"
      : (props.daysLeft < 0)
        ? "Passed"
        : `${props.daysLeft}d`

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
  class="summer-program-card"
  role="button"
  tabindex="0"
  onclick={props.onclick}
  onkeydown={handleKeydown}
>
  <div class="header">
    <div class="header-left">
      <div class="name">{props.name}</div>
      {#if props.estimated_cost}
        <span class="award">{props.estimated_cost}</span>
      {/if}
      {#if props.filters?.length}
        <div class="filter-tags">
          {#each props.filters as filter (filter.key)}
            <Tag color={filter.color} name={filter.name} description={filter.description} />
          {/each}
        </div>
      {/if}
    </div>
<!-- this part works! -->
    {#if props.openUnknown}
      <div class="deadline">
        <div class="deadline-text">
          <strong>Not Released</strong>
        </div>
      </div>
    {:else if props.deadline != "Not listed"}
      <div class="deadline">
        <span class={`countdown ${countdownClass()}`}>
          {countdownLabel()}
        </span>
        <div class="deadline-text">
          <span>Deadline</span>
          <strong>{props.deadline}</strong>
          {#if props.openDate}
            <span class="open-date">Opens {props.openDate}</span>
          {/if}
          {#if props.start_date && props.start_date !== "Not listed"}
            <span class="open-date">Start date {props.start_date}</span>
          {/if}
        </div>
      </div>
    {:else if props.start_date != "Not listed"}
      <div class="deadline">
        <span class={`countdown ${rollingCountdownClass()}`}>
          {rollingCountdownLabel()}
        </span>
        <div class="deadline-text">
          <span>Start Date</span>
          <strong>{props.start_date}</strong>
          {#if props.openDate}
            <span class="open-date">Opens {props.openDate}</span>
          {/if}
        </div>

      </div>
    {:else}
      <div class="deadline">
        <span class={`countdown ${countdownClass()}`}>
          {countdownLabel()}
        </span>
        <div class="deadline-text">
          <span>Deadline</span>
          <strong>{props.deadline}</strong>
          {#if props.openDate}
            <span class="open-date">Opens {props.openDate}</span>
          {/if}
        </div>
      </div>
    {/if}
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
  @use "$lib/styles/cards.scss" as cards;

  @include cards.program-card(".summer-program-card");
</style>
