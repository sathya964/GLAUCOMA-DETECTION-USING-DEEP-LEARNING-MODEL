// The glaucoma model runs right in the browser with TensorFlow.js.
// Convert outputs/best_model.keras into public/model/ (see README) for this to work.
const MODEL_URL = "/model/model.json";
const IMG_SIZE = 224;
const HISTORY_KEY = "clearsight-history";

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

  analyzeImage(file)
    .then(data => showResult(data))
    .catch(err => {
      portLoading.hidden = true;
      portIdle.hidden = false;
      previewImg.hidden = true;
      alert(err.userMessage || "Something went wrong analyzing that image. Please try a different JPG or PNG fundus photo.");
      console.error(err);
    });
}

// ---------- Model ----------
let modelPromise = null;

function loadModel() {
  if (!modelPromise) {
    modelPromise = fetch(MODEL_URL)
      .then(res => {
        if (!res.ok) {
          const err = new Error(`Model not found at ${MODEL_URL} (HTTP ${res.status})`);
          err.userMessage = "The AI model hasn't been added to this site yet. Convert best_model.keras to TensorFlow.js and put it in public/model/ (see the README).";
          throw err;
        }
        return res.json();
      })
      .then(json => json.format === "graph-model" ? tf.loadGraphModel(MODEL_URL) : tf.loadLayersModel(MODEL_URL))
      .catch(err => { modelPromise = null; throw err; });
  }
  return modelPromise;
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      const err = new Error("Could not read image");
      err.userMessage = "That file couldn't be read as an image. Please upload a JPG or PNG.";
      reject(err);
    };
    img.src = URL.createObjectURL(file);
  });
}

async function analyzeImage(file) {
  const [model, img] = await Promise.all([loadModel(), readImage(file)]);

  // Same preprocessing as app.py: resize to 224x224 (nearest, like Keras load_img) and scale to 0-1.
  const input = tf.tidy(() =>
    tf.image.resizeNearestNeighbor(tf.browser.fromPixels(img, 3), [IMG_SIZE, IMG_SIZE])
      .toFloat().div(255).expandDims(0)
  );
  let output = model.predict(input);
  if (Array.isArray(output)) output = output[0];
  const rawScore = (await output.data())[0];
  input.dispose();
  output.dispose();

  const isGlaucoma = rawScore >= 0.5;
  const glaucomaConfidencePct = round1(rawScore * 100);

  const result = {
    id: crypto.randomUUID(),
    prediction: isGlaucoma ? "Glaucoma indicators detected" : "No glaucoma indicators detected",
    is_glaucoma: isGlaucoma,
    confidence_pct: round1((isGlaucoma ? rawScore : 1 - rawScore) * 100),
    glaucoma_confidence_pct: glaucomaConfidencePct,
    severity: getSeverity(glaucomaConfidencePct),
    filename: file.name,
  };

  saveToHistory(result);
  return result;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function getSeverity(confidencePct) {
  if (confidencePct < 30) return { label: "Low risk", action: "No immediate concern. A routine yearly eye checkup is still recommended.", level: 1 };
  if (confidencePct < 60) return { label: "Moderate - Monitor", action: "Consider seeing an eye doctor within 1-3 months.", level: 2 };
  if (confidencePct < 85) return { label: "High concern", action: "Recommended to see an eye doctor within 2-4 weeks.", level: 3 };
  return { label: "Urgent", action: "Please see an eye doctor as soon as possible.", level: 4 };
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

// ---------- History (kept in this browser) ----------
function getHistory() {
  try {
    return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || [];
  } catch {
    return [];
  }
}

function saveToHistory(result) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify([result, ...getHistory()]));
}

function loadHistory() {
  renderHistory(getHistory());
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
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
      <span>${escapeHtml(item.filename)}</span>
    `;
    grid.appendChild(card);
  });
}

// ---------- Chat ----------
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

  fetch("/api/chat", {
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