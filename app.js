(() => {
  "use strict";

  const root = document.documentElement;
  const themeButton = document.querySelector("#theme-toggle");
  const searchInput = document.querySelector("#site-search");
  const categorySelect = document.querySelector("#category-filter");
  const clearButton = document.querySelector("#clear-filter");
  const expandButton = document.querySelector("#expand-toggle");
  const printButton = document.querySelector("#print-page");
  const printCheatButton = document.querySelector("#print-cheat");
  const filterItems = [...document.querySelectorAll("[data-filter-item]")];
  const progressInputs = [...document.querySelectorAll("[data-progress]")];
  const status = document.querySelector("#filter-status");
  const noResults = document.querySelector("#no-results");
  const readinessRing = document.querySelector("#readiness-ring");
  const readinessValue = document.querySelector("#readiness-value");
  const readinessCopy = document.querySelector("#readiness-copy");
  const resetProgress = document.querySelector("#reset-progress");
  const THEME_KEY = "dcn-prep-theme";
  const PROGRESS_KEY = "dcn-prep-progress";
  let printOpenState = [];

  const normalize = (value) =>
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const announce = (message) => {
    if (status) status.textContent = message;
  };

  const localPreference = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (error) {
        console.warn(`Local preference read failed for ${key}.`, error);
        announce("Browser storage is unavailable; preferences will last only for this page view.");
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (error) {
        console.warn(`Local preference write failed for ${key}.`, error);
        announce("Could not save this preference in browser storage.");
      }
    },
    remove(key) {
      try {
        localStorage.removeItem(key);
      } catch (error) {
        console.warn(`Local preference removal failed for ${key}.`, error);
        announce("Could not clear the saved browser preference.");
      }
    }
  };

  const preferredTheme = () => {
    const stored = localPreference.get(THEME_KEY);
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    if (!themeButton) return;
    const isDark = theme === "dark";
    themeButton.setAttribute("aria-pressed", String(isDark));
    themeButton.querySelector("[data-theme-label]").textContent = isDark ? "Light" : "Dark";
  };

  const applyFilters = () => {
    const query = normalize(searchInput?.value || "");
    const category = categorySelect?.value || "all";
    let visible = 0;

    filterItems.forEach((item) => {
      const haystack = normalize(`${item.dataset.search || ""} ${item.textContent || ""}`);
      const categories = (item.dataset.category || "").split(/\s+/);
      const queryMatch = !query || haystack.includes(query);
      const categoryMatch = category === "all" || categories.includes(category);
      const show = queryMatch && categoryMatch;
      item.classList.toggle("is-filtered", !show);
      if (show) {
        visible += 1;
        if (query && item instanceof HTMLDetailsElement) item.open = true;
      }
    });

    noResults?.classList.toggle("is-visible", visible === 0);
    announce(`${visible} of ${filterItems.length} preparation cards shown.`);
  };

  const clearFilters = () => {
    if (searchInput) searchInput.value = "";
    if (categorySelect) categorySelect.value = "all";
    applyFilters();
    searchInput?.focus();
  };

  const updateExpandLabel = () => {
    if (!expandButton) return;
    const details = [...document.querySelectorAll("details.card:not(.is-filtered)")];
    const allOpen = details.length > 0 && details.every((item) => item.open);
    expandButton.dataset.action = allOpen ? "collapse" : "expand";
    expandButton.textContent = allOpen ? "Collapse all" : "Expand all";
    expandButton.setAttribute("aria-pressed", String(allOpen));
  };

  const toggleAllDetails = () => {
    const details = [...document.querySelectorAll("details.card:not(.is-filtered)")];
    const shouldOpen = expandButton?.dataset.action !== "collapse";
    details.forEach((item) => {
      item.open = shouldOpen;
    });
    updateExpandLabel();
    announce(`${shouldOpen ? "Expanded" : "Collapsed"} ${details.length} cards.`);
  };

  const savedProgress = () => {
    try {
      return JSON.parse(localPreference.get(PROGRESS_KEY) || "{}");
    } catch (error) {
      console.warn("Saved readiness data was invalid and has been cleared.", error);
      localPreference.remove(PROGRESS_KEY);
      announce("Invalid saved readiness data was cleared.");
      return {};
    }
  };

  const updateReadiness = () => {
    const complete = progressInputs.filter((input) => input.checked).length;
    const total = progressInputs.length;
    const percent = total ? Math.round((complete / total) * 100) : 0;
    if (readinessRing) {
      readinessRing.style.setProperty("--readiness", `${percent}%`);
      readinessRing.setAttribute("aria-label", `${percent}% ready; ${complete} of ${total} actions complete`);
    }
    if (readinessValue) readinessValue.textContent = `${percent}%`;
    if (readinessCopy) readinessCopy.textContent = `${complete}/${total} evidence checks completed locally`;
  };

  const persistProgress = () => {
    const progress = Object.fromEntries(progressInputs.map((input) => [input.dataset.progress, input.checked]));
    localPreference.set(PROGRESS_KEY, JSON.stringify(progress));
    updateReadiness();
  };

  const restoreProgress = () => {
    const progress = savedProgress();
    progressInputs.forEach((input) => {
      input.checked = Boolean(progress[input.dataset.progress]);
    });
    updateReadiness();
  };

  const resetAllProgress = () => {
    if (!window.confirm("Clear the readiness checklist stored in this browser?")) return;
    progressInputs.forEach((input) => {
      input.checked = false;
    });
    localPreference.remove(PROGRESS_KEY);
    updateReadiness();
    announce("Readiness checklist reset.");
  };

  const openHashTarget = () => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (!id) return;
    const target = document.getElementById(id);
    if (!target) return;
    let parent = target.parentElement;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
  };

  const setActiveNavigation = () => {
    const links = [...document.querySelectorAll(".toc a[href^='#']")];
    const byId = new Map(links.map((link) => [link.getAttribute("href").slice(1), link]));
    const sections = [...document.querySelectorAll("main section[id]")];
    if (!("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        links.forEach((link) => link.removeAttribute("aria-current"));
        byId.get(visible.target.id)?.setAttribute("aria-current", "location");
      },
      { rootMargin: "-18% 0px -68% 0px", threshold: [0.05, 0.25, 0.6] }
    );
    sections.forEach((section) => observer.observe(section));
  };

  const copyCode = async (button) => {
    const target = document.getElementById(button.dataset.copyTarget || "");
    if (!target) {
      announce("Copy target unavailable.");
      return;
    }
    try {
      await navigator.clipboard.writeText(target.textContent);
      const original = button.textContent;
      button.textContent = "Copied";
      announce("Configuration text copied. Replace every placeholder before use.");
      window.setTimeout(() => {
        button.textContent = original;
      }, 1600);
    } catch (error) {
      announce(`Copy failed: ${error instanceof Error ? error.message : "clipboard permission denied"}`);
    }
  };

  const preparePrint = () => {
    printOpenState = [...document.querySelectorAll("details")].map((item) => [item, item.open]);
    printOpenState.forEach(([item]) => {
      item.open = true;
    });
  };

  const restoreAfterPrint = () => {
    printOpenState.forEach(([item, wasOpen]) => {
      item.open = wasOpen;
    });
    printOpenState = [];
    document.body.classList.remove("print-cheat-only");
  };

  const markFreshness = () => {
    document.querySelectorAll(".freshness[data-reviewed]").forEach((element) => {
      const reviewed = new Date(`${element.dataset.reviewed}T00:00:00Z`);
      if (Number.isNaN(reviewed.valueOf())) return;
      const days = Math.floor((Date.now() - reviewed.valueOf()) / 86_400_000);
      const age = Math.max(0, days);
      element.textContent = age > 90 ? `Review sources: ${age} days old` : `Sources reviewed ${element.dataset.reviewed}`;
      element.classList.toggle("medium", age > 90);
    });
  };

  applyTheme(preferredTheme());
  restoreProgress();
  applyFilters();
  updateExpandLabel();
  openHashTarget();
  setActiveNavigation();
  markFreshness();

  themeButton?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    localPreference.set(THEME_KEY, next);
    applyTheme(next);
  });
  searchInput?.addEventListener("input", applyFilters);
  categorySelect?.addEventListener("change", applyFilters);
  clearButton?.addEventListener("click", clearFilters);
  expandButton?.addEventListener("click", toggleAllDetails);
  printButton?.addEventListener("click", () => window.print());
  printCheatButton?.addEventListener("click", () => {
    document.body.classList.add("print-cheat-only");
    window.print();
  });
  resetProgress?.addEventListener("click", resetAllProgress);
  progressInputs.forEach((input) => input.addEventListener("change", persistProgress));
  document.querySelectorAll("details.card").forEach((item) => item.addEventListener("toggle", updateExpandLabel));
  document.querySelectorAll("[data-copy-target]").forEach((button) => {
    button.addEventListener("click", () => copyCode(button));
  });
  window.addEventListener("hashchange", openHashTarget);
  window.addEventListener("beforeprint", preparePrint);
  window.addEventListener("afterprint", restoreAfterPrint);
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
      event.preventDefault();
      searchInput?.focus();
    }
    if (event.key === "Escape" && document.activeElement === searchInput) clearFilters();
  });
})();
