const API_BASE = "http://127.0.0.1:5000";

// ---------- View switching ----------
const navLinks = document.querySelectorAll(".nav-link");
const views = { scan: document.getElementById("view-scan"), history: document.getElementById("view-history") };

navLinks.forEach(btn => {
  btn.addEventListener("click", () => {
    navLinks.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    Object.entries(views).forEach(([key, el]) => el.hidden = key !== btn.dataset.view);
    if (btn.dataset.view === "history") loadHistory();
  });
});

// ---------- Upload ----------
const scanPort = document.getElementById("scanPort");
const fileInput = document.getElementById("fileInput");
const portIdle = document.getElementById("portIdle");
const portLoading = document.getElementById("portLoading");
const previewImg = document.getElementById("previewImg");
const ringFill = document.getElementById("ringFill");
const resultsPanel = document.getElementById("resultsPanel");

scanPort.addEventListener("click", () => fileInput.click());
scanPort.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") fileInput.click(); });

["dragover", "dragleave", "drop"].forEach(evt => {
  scanPort.addEventListener(evt, e => e.preventDefault());
});
scanPort.addEventListener("drop", e => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.hidden = false;
  portIdle.hidden = true;
  portLoading.hidden = false;
  ringFill.style.stroke = "#2EC4B6";
  ringFill.style.strokeDashoffset = 628;

  const formData = new FormData();
  formData.append("image", file);

  fetch(`${API_BASE}/api/predict`, { method: "POST", body: formData })
    .then(res => {
      if (!res.ok) throw new Error("Prediction failed");
      return res.json();
    })
    .then(data => showResult(data))
    .catch(err => {
      portLoading.hidden = true;
      portIdle.hidden = false;
      previewImg.hidden = true;
      alert("Something went wrong analyzing that image. Make sure the backend server (app.py) is running.");
      console.error(err);
    });
}

const severityColors = { 1: "#2EC4B6", 2: "#FFB627", 3: "#FF6B4A", 4: "#E63946" };
const severityMarkerPos = { 1: 12, 2: 38, 3: 64, 4: 90 };

function showResult(data) {
  portLoading.hidden = true;

  const color = severityColors[data.severity.level] || "#2EC4B6";
  ringFill.style.stroke = color;
  const circumference = 628;
  const offset = circumference - (data.glaucoma_confidence_pct / 100) * circumference;
  requestAnimationFrame(() => { ringFill.style.strokeDashoffset = offset; });

  document.getElementById("severityDot").style.background = color;
  document.getElementById("resultLabel").textContent = data.prediction;
  document.getElementById("resultSub").textContent = `Severity: ${data.severity.label}`;
  document.getElementById("confidenceNum").textContent = `${data.confidence_pct}%`;
  document.getElementById("actionText").textContent = data.severity.action;

  const marker = document.getElementById("scaleMarker");
  marker.style.left = `${severityMarkerPos[data.severity.level]}%`;

  resultsPanel.hidden = false;
  resultsPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });

  window._lastResult = data;
}

// ---------- History ----------
function loadHistory() {
  fetch(`${API_BASE}/api/history`)
    .then(res => res.json())
    .then(items => renderHistory(items))
    .catch(err => console.error(err));
}

function renderHistory(items) {
  const grid = document.getElementById("historyGrid");
  const empty = document.getElementById("historyEmpty");
  grid.innerHTML = "";

  if (!items.length) { empty.hidden = false; return; }
  empty.hidden = true;

  items.forEach(item => {
    const color = severityColors[item.severity.level] || "#2EC4B6";
    const card = document.createElement("div");
    card.className = "history-card";
    card.innerHTML = `
      <div class="history-thumb-wrap" style="--dot-color:${color}">
        <div style="width:100%;height:100%;background:${color}22;display:flex;align-items:center;justify-content:center;font-family:'IBM Plex Mono';font-weight:600;color:${color}">
          ${item.glaucoma_confidence_pct}%
        </div>
      </div>
      <p>${item.severity.label}</p>
      <span>${item.filename}</span>
    `;
    grid.appendChild(card);
  });
}

// ---------- Chat (UI shell — wiring comes in next phase) ----------
const chatToggle = document.getElementById("chatToggle");
const chatPanel = document.getElementById("chatPanel");
const chatClose = document.getElementById("chatClose");
const chatBody = document.getElementById("chatBody");
const chatInput = document.getElementById("chatInput");
const chatSend = document.getElementById("chatSend");
const askAboutResult = document.getElementById("askAboutResult");

chatToggle.addEventListener("click", () => chatPanel.hidden = !chatPanel.hidden);
chatClose.addEventListener("click", () => chatPanel.hidden = true);
askAboutResult.addEventListener("click", () => { chatPanel.hidden = false; });

function addChatMsg(text, from) {
  const div = document.createElement("div");
  div.className = `chat-msg chat-msg-${from}`;
  div.textContent = text;
  chatBody.appendChild(div);
  chatBody.scrollTop = chatBody.scrollHeight;
}

function sendChat() {
  const text = chatInput.value.trim();
  if (!text) return;
  addChatMsg(text, "user");
  chatInput.value = "";

  const resultContext = window._lastResult
    ? `${window._lastResult.prediction}, ${window._lastResult.confidence_pct}% confidence, severity: ${window._lastResult.severity.label}`
    : null;

  fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, result_context: resultContext }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.reply) addChatMsg(data.reply, "bot");
      else addChatMsg("Sorry, something went wrong. Please try again.", "bot");
    })
    .catch(() => addChatMsg("Sorry, something went wrong. Please try again.", "bot"));
}

chatSend.addEventListener("click", sendChat);
chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });