<script lang="ts">
  import favicon from "$lib/assets/logo.ico"
  import { dev } from "$app/environment"
  import { injectAnalytics } from "@vercel/analytics/sveltekit"

  const error = "https://forms.gle/Tg79A2oLBQWeXDpr7"

  let { children } = $props()

  injectAnalytics({ mode: dev ? "development" : "production" })
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" />
  <link
    href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lato:wght@300;400;600;700&display=swap"
    rel="stylesheet"
  />
  <title>Catalog | C3SS</title>
</svelte:head>

<div class="background-pattern" aria-hidden="true"></div>

<div class="app-shell">
  <header class="topbar">
    <div class="brand">
      <span class="logo-container"
        ><enhanced:img
          class="logo"
          src="$lib/assets/logo.ico"
          alt="c3 logo"
        /></span
      >
      <div>
        <p class="eyebrow">College & Career Center</p>
        <p class="title">Scholarships & Summer Programs Catalog</p>
      </div>
    </div>
    <nav class="nav">
      <a class="nav-link" href="/scholarships">Scholarships</a>
      <a class="nav-link" href="/summerprograms">Summer Programs</a>
    </nav>
  </header>

  <main class="page">
    {@render children()}
  </main>

  <span class="credit"
    >Made with ❤️ by the <a href="https://github.com/lchsiteam">LC iTeam</a> &copy
    2026 Kenneth Lee, Luke Dabell, Intern Jeo</span
  >
</div>

<a class="report-issue" href={error} target="_blank" rel="noreferrer">
  <span class="report-icon" aria-hidden="true">?</span>
  <span class="report-label">Report an issue</span>
</a>

<style lang="scss">
  @use "$lib/styles/global.scss" as *;

  :global(*),
  :global(*::before),
  :global(*::after) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    min-height: 100vh;
    background: $bg;
    color: $text;
    font-family:
      "Inter",
      "Lato",
      system-ui,
      -apple-system,
      sans-serif;
  }

  .background-pattern {
    position: fixed;
    inset: -20%;
    z-index: 0;
    pointer-events: none;
    background-image: url("$lib/assets/logo.ico");
    background-position: 64px 88px;
    background-repeat: repeat;
    background-size: 272px;
    opacity: 0.026;
  }

  .background-pattern::after {
    position: absolute;
    inset: -12%;
    content: "";
    background-image: url("$lib/assets/logo.ico");
    background-position: 138px 184px;
    background-repeat: repeat;
    background-size: 224px;
    opacity: 0.52;
    transform: rotate(-8deg);
  }

  .app-shell {
    max-width: 75vw;
    margin: 0 auto;
    padding: 32px 0px 64px;
    position: relative;
    z-index: 1;
  }

  .topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.8);
    border: 1px solid $nav-border;
    box-shadow: 0 18px 40px $nav-shadow;
    backdrop-filter: blur(12px);
    position: sticky;
    top: 18px;
    z-index: 10;

    width: 100%;
  }

  .brand {
    display: inline-flex;
    gap: 12px;
    align-items: center;
  }

  .logo-container {
    width: 48px;
    height: 48px;

    .logo {
      width: 48px;
      height: 48px;
    }
  }

  .title {
    font-weight: 800;
    margin: 0;
    color: $primary;
  }

  .eyebrow {
    margin: 0;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: $eyebrow;
  }

  .nav {
    display: inline-flex;
    gap: 14px;
    align-items: center;
  }

  .nav-link {
    padding: 10px 14px;
    border-radius: 12px;
    text-decoration: none;
    color: $text;
    font-weight: 700;
    transition:
      background 120ms ease,
      color 120ms ease,
      transform 120ms ease,
      box-shadow 120ms ease;
  }

  .nav-link:hover,
  .nav-link:focus-visible {
    background: $link-focus;
    color: $primary;
    outline: none;
    transform: translateY(-1px);
    box-shadow: 0 10px 20px $link-shadow;
  }

  .page {
    margin-top: 28px;
    width: 100%;
    animation: page-enter 360ms ease-out both;
  }

  @keyframes page-enter {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }

  .report-issue {
    position: fixed;
    bottom: 24px;
    left: 24px;
    z-index: 20;
    display: inline-flex;
    align-items: center;
    width: 46px;
    height: 46px;
    padding: 0 12px;
    overflow: hidden;
    border: 1px solid $nav-border;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 12px 26px $nav-shadow;
    color: $primary;
    text-decoration: none;
    transition:
      width 180ms ease,
      background 180ms ease,
      color 180ms ease,
      transform 180ms ease,
      box-shadow 180ms ease;
  }

  .report-icon {
    display: grid;
    flex: 0 0 22px;
    width: 22px;
    height: 22px;
    place-items: center;
    border: 1.5px solid currentColor;
    border-radius: 50%;
    font-size: 0.9rem;
    font-weight: 800;
    line-height: 1;
  }

  .report-label {
    margin-left: 10px;
    opacity: 0;
    transform: translateX(-6px);
    transition:
      opacity 130ms ease,
      transform 180ms ease;
    white-space: nowrap;
    font-size: 0.86rem;
    font-weight: 800;
  }

  .report-issue:hover,
  .report-issue:focus-visible {
    width: 166px;
    background: $primary;
    box-shadow: 0 16px 32px $link-shadow;
    color: #ffffff;
    outline: none;
    transform: translateY(-2px);
  }

  .report-issue:hover .report-label,
  .report-issue:focus-visible .report-label {
    opacity: 1;
    transform: translateX(0);
  }

  @media (max-width: 720px) {
    .app-shell {
      width: calc(100% - 32px);
      max-width: none;
      padding-top: 16px;
      padding-bottom: 48px;
    }

    .topbar {
      flex-direction: column;
      align-items: flex-start;
      gap: 12px;
    }

    .nav {
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .report-issue {
      bottom: 16px;
      left: 16px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .page {
      animation: none;
    }

    .nav-link,
    .report-issue,
    .report-label {
      transition: none;
    }
  }

  span.credit {
    font-size: 0.76rem;
    color: $eyebrow;
    display: grid;
    align-items: center;
    text-align: center;

    a {
      color: rgb(9, 139, 190);
      text-decoration: none;
    }
  }
</style>
