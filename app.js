(() => {
  "use strict";

  const catalog = window.CATALOG || [];
  const names = {
    dsp: "JGKiD",
    soundcloud: "SoundCloud",
    underground: "Underground",
    dalab: "Da LAB",
  };

  const state = { query: "", filter: "all", sort: "newest" };
  const grid = document.getElementById("track-grid");
  const empty = document.getElementById("empty-state");
  const search = document.getElementById("search-input");
  const clearSearch = document.getElementById("clear-search");
  const sort = document.getElementById("sort-select");
  const signalToast = document.getElementById("signal-toast");
  const filterButtons = [...document.querySelectorAll("[data-filter]")];
  let toastTimer;

  const normalize = (value) => String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi");

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const categoryCounts = catalog.reduce((counts, track) => {
    counts[track.category] = (counts[track.category] || 0) + 1;
    return counts;
  }, { all: catalog.length });

  const filteredTracks = () => {
    const needle = normalize(state.query.trim());
    const tracks = catalog.filter((track) => {
      const inSection = state.filter === "all" || track.category === state.filter;
      const text = normalize([track.title, track.artist, track.meta, track.detail, track.note, track.year].filter(Boolean).join(" "));
      return inSection && (!needle || text.includes(needle));
    });

    return [...tracks].sort((a, b) => {
      if (state.sort === "az") return a.title.localeCompare(b.title, "vi");
      const av = a.date || String(a.year || 0);
      const bv = b.date || String(b.year || 0);
      return state.sort === "newest" ? bv.localeCompare(av) : av.localeCompare(bv);
    });
  };

  const savedLinks = (track) => {
    const links = (track.links || []).filter((item) => item && item.url);
    if (track.primary && !links.some((item) => item.url === track.primary)) {
      links.unshift({ label: "Liên kết chính", url: track.primary });
    }
    return links;
  };

  const isYouTube = (item) => /youtube|youtu\.be/i.test(String(item.label || "") + " " + String(item.url || ""));
  const isSoundCloud = (item) => /soundcloud/i.test(String(item.label || "") + " " + String(item.url || ""));

  const destinationFor = (track, links) => {
    const youtube = links.find(isYouTube);
    if (youtube) return { ...youtube, platform: "YouTube" };

    if (track.category === "soundcloud") {
      const soundcloud = links.find(isSoundCloud);
      if (soundcloud) return { ...soundcloud, platform: "SoundCloud" };
    }

    const stored = links.find((item) => item.url === track.primary) || links[0];
    return stored ? { ...stored, platform: stored.label || "liên kết đã lưu" } : null;
  };

  const platformClass = (item) => {
    const value = normalize(String(item.label || "") + " " + String(item.url || ""));
    if (value.includes("youtube") || value.includes("youtu.be")) return "youtube";
    if (value.includes("soundcloud")) return "soundcloud";
    if (value.includes("spotify")) return "spotify";
    if (value.includes("apple")) return "apple";
    return "archive";
  };

  const platformNames = {
    youtube: "YouTube",
    spotify: "Spotify",
    soundcloud: "SoundCloud",
    apple: "Apple Music",
    archive: "Liên kết lưu trữ",
  };

  const platformIcons = {
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22.2 7.1a2.7 2.7 0 0 0-1.9-1.9C18.6 4.8 12 4.8 12 4.8s-6.6 0-8.3.4a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 1.4 12a28 28 0 0 0 .4 4.9 2.7 2.7 0 0 0 1.9 1.9c1.7.4 8.3.4 8.3.4s6.6 0 8.3-.4a2.7 2.7 0 0 0 1.9-1.9 28 28 0 0 0 .4-4.9 28 28 0 0 0-.4-4.9Z" fill="currentColor"/><path d="m9.8 15.3 5.7-3.3-5.7-3.3v6.6Z" fill="#071426"/></svg>',
    spotify: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M6.8 9.2c3.6-1 7.8-.7 10.8 1M7.5 12.2c3-.8 6.5-.5 9.2.9M8.2 15c2.5-.6 5.2-.4 7.5.7" fill="none" stroke="#071426" stroke-width="1.55" stroke-linecap="round"/></svg>',
    soundcloud: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><rect x="2" y="11.2" width="1.7" height="5.3" rx=".85"/><rect x="4.5" y="9.2" width="1.7" height="7.3" rx=".85"/><rect x="7" y="7.5" width="1.7" height="9" rx=".85"/><path d="M10 16.5V8.2a5.7 5.7 0 0 1 9.3 3.1h.5a2.6 2.6 0 1 1 0 5.2H10Z"/></g></svg>',
    apple: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor"/><path d="M15.9 6.6v8.1a2.8 2.8 0 1 1-1.2-2.3V8.7l-5.3 1.1v6a2.8 2.8 0 1 1-1.2-2.3V8.1l7.7-1.5Z" fill="#071426"/></svg>',
    archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.2 13.8a4 4 0 0 0 5.7 0l2.2-2.2a4 4 0 0 0-5.7-5.7l-1.2 1.2M13.8 10.2a4 4 0 0 0-5.7 0l-2.2 2.2a4 4 0 0 0 5.7 5.7l1.2-1.2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  };

  const cardHtml = (track) => {
    const links = savedLinks(track);
    const destination = destinationFor(track, links);
    const linksHtml = links.map((item) => {
      const platform = platformClass(item);
      const platformName = platformNames[platform];
      return '<a class="platform-link platform-' + platform + '" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener noreferrer" title="' + platformName + '" aria-label="Mở ' + escapeHtml(track.title) + ' trên ' + platformName + '">' +
        platformIcons[platform] + '<span class="sr-only">' + platformName + '</span></a>';
    }).join("");

    const overlay = destination
      ? '<a class="card-overlay" href="' + escapeHtml(destination.url) + '" target="_blank" rel="noopener noreferrer" aria-label="Mở ' + escapeHtml(track.title) + ' trên ' + escapeHtml(destination.platform) + ' trong tab mới"></a>'
      : "";

    return '<article class="track-card category-' + escapeHtml(track.category) + '">' +
      overlay +
      '<div class="card-top"><span class="category-pill">' + escapeHtml(names[track.category]) + '</span><span class="year">' + escapeHtml(track.year || "—") + '</span></div>' +
      '<div class="track-copy"><h3>' + escapeHtml(track.title) + '</h3><p class="artist">' + escapeHtml(track.artist) + '</p></div>' +
      '<div class="platform-links" aria-label="Các nền tảng nghe">' + linksHtml + '</div>' +
      '<div class="card-foot"><span>Nghe bài hát</span><i aria-hidden="true">↗</i></div>' +
      '</article>';
  };

  const render = () => {
    const tracks = filteredTracks();
    grid.innerHTML = tracks.map(cardHtml).join("");
    grid.hidden = tracks.length === 0;
    empty.hidden = tracks.length !== 0;
    clearSearch.hidden = !state.query;
    filterButtons.forEach((button) => {
      const active = button.dataset.filter === state.filter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
      const count = button.querySelector("span");
      if (count) count.textContent = categoryCounts[button.dataset.filter] || 0;
    });
  };

  const transmitSignal = (card) => {
    if (!card) return;
    document.querySelectorAll(".track-card.transmitting").forEach((item) => item.classList.remove("transmitting"));
    card.classList.add("transmitting");
    signalToast.classList.add("visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      card.classList.remove("transmitting");
      signalToast.classList.remove("visible");
    }, 1100);
  };

  search.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  clearSearch.addEventListener("click", () => {
    state.query = "";
    search.value = "";
    search.focus();
    render();
  });

  sort.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });

  filterButtons.forEach((button) => button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    render();
  }));

  grid.addEventListener("pointerdown", (event) => transmitSignal(event.target.closest(".track-card")));
  grid.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") transmitSignal(event.target.closest(".track-card"));
  });

  document.getElementById("reset-filters").addEventListener("click", () => {
    state.query = "";
    state.filter = "all";
    search.value = "";
    render();
  });

  render();
})();
