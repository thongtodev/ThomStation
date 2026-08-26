(() => {
  "use strict";

  const categoryNames = {
    dsp: "JGKiD",
    soundcloud: "SoundCloud",
    underground: "Underground",
    dalab: "Da LAB",
  };
  const catalogPrefix = "window.CATALOG = ";
  const settingsKey = "jgkid-admin-repository";
  let catalog = structuredClone(window.CATALOG || []);
  let selectedId = "";
  let repositorySha = "";
  let token = "";
  let connected = false;
  let dirty = false;
  let listFilter = "all";
  let listSort = "newest";

  const byId = (id) => document.getElementById(id);
  const elements = {
    owner: byId("repo-owner"), repo: byId("repo-name"), branch: byId("repo-branch"), path: byId("repo-path"), token: byId("repo-token"),
    connect: byId("connect-button"), badge: byId("connection-badge"), connectionMessage: byId("connection-message"),
    list: byId("admin-list"), search: byId("admin-search"), sort: byId("admin-sort"), publish: byId("publish-button"), add: byId("new-track"),
    filterButtons: [...document.querySelectorAll("[data-admin-filter]")],
    form: byId("track-form"), id: byId("track-id"), title: byId("track-title"), artist: byId("track-artist"), category: byId("track-category"), year: byId("track-year"),
    date: byId("track-date"), meta: byId("track-meta"), detail: byId("track-detail"), note: byId("track-note"), primary: byId("track-primary"),
    links: byId("link-rows"), addLink: byId("add-link"), remove: byId("delete-track"), reset: byId("cancel-edit"),
    editorMode: byId("editor-mode"), editorMessage: byId("editor-message"), linkTemplate: byId("link-row-template"),
  };

  const normalize = (value) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
  const clone = (value) => JSON.parse(JSON.stringify(value));

  function setMessage(element, text, type = "") {
    element.textContent = text;
    element.className = "message" + (type ? " " + type : "");
  }

  function setDirty(value) {
    dirty = value;
    elements.publish.disabled = !connected || !dirty;
    elements.publish.textContent = dirty ? "Đăng thay đổi" : "Đã cập nhật";
  }

  function loadSavedRepository() {
    try {
      const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}");
      elements.owner.value = saved.owner || "";
      elements.repo.value = saved.repo || "";
      elements.branch.value = saved.branch || "main";
      elements.path.value = saved.path || "catalog.js";
    } catch (_) { /* Bỏ qua dữ liệu cũ không hợp lệ. */ }
  }

  function repositorySettings() {
    return {
      owner: elements.owner.value.trim(),
      repo: elements.repo.value.trim(),
      branch: elements.branch.value.trim() || "main",
      path: elements.path.value.trim() || "catalog.js",
    };
  }

  function apiUrl(settings) {
    return "https://api.github.com/repos/" + encodeURIComponent(settings.owner) + "/" + encodeURIComponent(settings.repo) + "/contents/" + settings.path.split("/").map(encodeURIComponent).join("/");
  }

  function githubHeaders() {
    return {
      Accept: "application/vnd.github+json",
      Authorization: "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  function decodeBase64(value) {
    const binary = atob(value.replace(/\s/g, ""));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < bytes.length; index += chunk) binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
    return btoa(binary);
  }

  function parseCatalog(source) {
    const match = source.match(/^\s*window\.CATALOG\s*=\s*([\s\S]*);\s*$/);
    if (!match) throw new Error("File catalog.js không đúng định dạng của website.");
    const parsed = JSON.parse(match[1]);
    if (!Array.isArray(parsed)) throw new Error("Danh mục không phải là một danh sách hợp lệ.");
    return parsed;
  }

  async function githubError(response) {
    let message = "GitHub từ chối yêu cầu (" + response.status + ").";
    try {
      const body = await response.json();
      if (body.message) message = body.message;
    } catch (_) { /* Giữ thông báo mặc định. */ }
    if (response.status === 401) return "Mã truy cập không đúng hoặc đã hết hạn.";
    if (response.status === 403) return "Mã truy cập chưa có quyền đọc và ghi nội dung repository.";
    if (response.status === 404) return "Không tìm thấy repository hoặc file catalog.js. Hãy kiểm tra tên và quyền truy cập.";
    if (response.status === 409) return "Dữ liệu trên GitHub vừa thay đổi. Hãy bấm Kết nối lại rồi thử đăng lại.";
    return message;
  }

  async function connectRepository() {
    const settings = repositorySettings();
    token = elements.token.value.trim();
    if (!settings.owner || !settings.repo || !token) {
      setMessage(elements.connectionMessage, "Hãy nhập chủ repository, tên repository và GitHub token.", "error");
      return;
    }

    elements.connect.disabled = true;
    elements.connect.textContent = "Đang kết nối…";
    setMessage(elements.connectionMessage, "Đang đọc danh mục từ GitHub…");
    try {
      const response = await fetch(apiUrl(settings) + "?ref=" + encodeURIComponent(settings.branch), { headers: githubHeaders(), cache: "no-store" });
      if (!response.ok) throw new Error(await githubError(response));
      const data = await response.json();
      catalog = parseCatalog(decodeBase64(data.content));
      repositorySha = data.sha;
      connected = true;
      localStorage.setItem(settingsKey, JSON.stringify(settings));
      elements.badge.textContent = "Đã kết nối";
      elements.badge.classList.add("connected");
      renderList();
      clearForm();
      setDirty(false);
      setMessage(elements.connectionMessage, "Đã tải danh mục. Bạn có thể bắt đầu chỉnh sửa.", "success");
    } catch (error) {
      connected = false;
      elements.badge.textContent = "Chưa kết nối";
      elements.badge.classList.remove("connected");
      setDirty(false);
      setMessage(elements.connectionMessage, error.message || "Không thể kết nối GitHub.", "error");
    } finally {
      elements.connect.disabled = false;
      elements.connect.textContent = connected ? "Kết nối lại" : "Kết nối";
    }
  }

  function createLinkRow(link = { label: "", url: "" }) {
    const row = elements.linkTemplate.content.firstElementChild.cloneNode(true);
    row.querySelector(".link-label").value = link.label || "";
    row.querySelector(".link-url").value = link.url || "";
    row.querySelector(".remove-link").addEventListener("click", () => row.remove());
    elements.links.appendChild(row);
  }

  function clearForm() {
    selectedId = "";
    elements.form.reset();
    elements.category.value = "dsp";
    elements.id.value = "";
    elements.links.innerHTML = "";
    createLinkRow({ label: "Spotify", url: "" });
    createLinkRow({ label: "YouTube", url: "" });
    elements.editorMode.textContent = "THÊM MỚI";
    elements.remove.hidden = true;
    setMessage(elements.editorMessage, "");
    renderList();
  }

  function selectTrack(id) {
    const track = catalog.find((item) => item.id === id);
    if (!track) return;
    selectedId = id;
    elements.id.value = track.id;
    elements.title.value = track.title || "";
    elements.artist.value = track.artist || "";
    elements.category.value = track.category || "dsp";
    elements.year.value = track.year || "";
    elements.date.value = track.date || "";
    elements.meta.value = track.meta || "";
    elements.detail.value = track.detail || "";
    elements.note.value = track.note || "";
    elements.primary.value = track.primary || "";
    elements.links.innerHTML = "";
    (track.links || []).forEach(createLinkRow);
    if (!track.links || !track.links.length) createLinkRow();
    elements.editorMode.textContent = "ĐANG SỬA";
    elements.remove.hidden = false;
    setMessage(elements.editorMessage, "");
    renderList();
    if (window.innerWidth < 721) document.querySelector(".editor-card").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderList() {
    const needle = normalize(elements.search.value.trim());
    const tracks = catalog
      .filter((track) => {
        const inCategory = listFilter === "all" || track.category === listFilter;
        const searchable = [track.title, track.artist, track.meta, track.detail, track.note, track.year].filter(Boolean).join(" ");
        return inCategory && (!needle || normalize(searchable).includes(needle));
      })
      .sort((a, b) => {
        if (listSort === "az") return String(a.title || "").localeCompare(String(b.title || ""), "vi");
        const aValue = a.date || String(a.year || 0);
        const bValue = b.date || String(b.year || 0);
        return listSort === "newest" ? bValue.localeCompare(aValue) : aValue.localeCompare(bValue);
      });
    elements.filterButtons.forEach((button) => {
      const active = button.dataset.adminFilter === listFilter;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    elements.list.innerHTML = "";
    if (!tracks.length) {
      const empty = document.createElement("p");
      empty.className = "admin-list-empty";
      empty.textContent = "Không tìm thấy bài phù hợp.";
      elements.list.appendChild(empty);
      return;
    }
    tracks.forEach((track) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "admin-track" + (track.id === selectedId ? " active" : "");
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      const artist = document.createElement("small");
      const category = document.createElement("span");
      title.textContent = track.title;
      artist.textContent = track.artist;
      category.textContent = categoryNames[track.category] || track.category;
      copy.append(title, artist);
      button.append(copy, category);
      button.addEventListener("click", () => selectTrack(track.id));
      elements.list.appendChild(button);
    });
  }

  function formLinks() {
    return [...elements.links.querySelectorAll(".link-row")].map((row) => ({
      label: row.querySelector(".link-label").value.trim(),
      url: row.querySelector(".link-url").value.trim(),
    })).filter((link) => link.label && link.url);
  }

  function makeId(category) {
    return category + "-custom-" + Date.now().toString(36);
  }

  function saveTrack(event) {
    event.preventDefault();
    if (!elements.form.reportValidity()) return;
    const links = formLinks();
    if (!links.length) {
      setMessage(elements.editorMessage, "Hãy thêm ít nhất một link nghe nhạc.", "error");
      return;
    }
    const category = elements.category.value;
    const track = {
      id: selectedId || makeId(category),
      category,
      title: elements.title.value.trim(),
      artist: elements.artist.value.trim(),
      year: elements.year.value ? Number(elements.year.value) : null,
      date: elements.date.value,
      meta: elements.meta.value.trim(),
      detail: elements.detail.value.trim(),
      primary: elements.primary.value.trim(),
      links,
      note: elements.note.value.trim(),
    };
    const index = catalog.findIndex((item) => item.id === selectedId);
    if (index >= 0) catalog[index] = track;
    else catalog.unshift(track);
    selectedId = track.id;
    if (listFilter !== "all") listFilter = track.category;
    setDirty(true);
    renderList();
    selectTrack(track.id);
    setMessage(elements.editorMessage, index >= 0 ? "Đã lưu chỉnh sửa vào danh sách." : "Đã thêm bài vào danh sách.", "success");
  }

  function deleteTrack() {
    const track = catalog.find((item) => item.id === selectedId);
    if (!track || !window.confirm("Xóa “" + track.title + "” khỏi danh mục?")) return;
    catalog = catalog.filter((item) => item.id !== selectedId);
    setDirty(true);
    clearForm();
    setMessage(elements.editorMessage, "Đã xóa bài khỏi danh sách. Bấm “Đăng thay đổi” để cập nhật website.", "success");
  }

  async function publishCatalog() {
    if (!connected || !dirty) return;
    const settings = repositorySettings();
    elements.publish.disabled = true;
    elements.publish.textContent = "Đang đăng…";
    setMessage(elements.connectionMessage, "Đang cập nhật website…");
    try {
      const source = catalogPrefix + JSON.stringify(catalog) + ";\n";
      const response = await fetch(apiUrl(settings), {
        method: "PUT",
        headers: { ...githubHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Cập nhật danh mục âm nhạc",
          content: encodeBase64(source),
          sha: repositorySha,
          branch: settings.branch,
        }),
      });
      if (!response.ok) throw new Error(await githubError(response));
      const data = await response.json();
      repositorySha = data.content.sha;
      setDirty(false);
      setMessage(elements.connectionMessage, "Đã đăng thành công. GitHub Pages có thể cần 1–2 phút để hiển thị dữ liệu mới.", "success");
    } catch (error) {
      setDirty(true);
      setMessage(elements.connectionMessage, error.message || "Không thể đăng thay đổi.", "error");
    }
  }

  elements.connect.addEventListener("click", connectRepository);
  elements.search.addEventListener("input", renderList);
  elements.sort.addEventListener("change", () => {
    listSort = elements.sort.value;
    renderList();
  });
  elements.filterButtons.forEach((button) => button.addEventListener("click", () => {
    listFilter = button.dataset.adminFilter;
    renderList();
  }));
  elements.add.addEventListener("click", () => { clearForm(); elements.title.focus(); });
  elements.addLink.addEventListener("click", () => createLinkRow());
  elements.reset.addEventListener("click", clearForm);
  elements.remove.addEventListener("click", deleteTrack);
  elements.form.addEventListener("submit", saveTrack);
  elements.publish.addEventListener("click", publishCatalog);
  window.addEventListener("beforeunload", (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = "";
  });

  loadSavedRepository();
  renderList();
  clearForm();
})();
