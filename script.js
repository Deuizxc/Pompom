const DEFAULT_MODES = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

// Custom durations (in seconds) persist across reloads; fall back to defaults.
const MODES = { ...DEFAULT_MODES, ...loadCustomDurations() };

function loadCustomDurations() {
  try {
    return JSON.parse(localStorage.getItem("pomodoroDurations")) || {};
  } catch {
    return {};
  }
}

function saveCustomDurations() {
  localStorage.setItem("pomodoroDurations", JSON.stringify(MODES));
}

let currentMode = "work";
let timeLeft = MODES[currentMode];
let timerInterval = null;
let isRunning = false;

const DIAL_CIRCUMFERENCE = 553;

const body = document.body;
const display = document.getElementById("time-display");
const dialProgress = document.getElementById("dial-progress");
const timeEditInput = document.getElementById("time-edit-input");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const modeBtns = document.querySelectorAll(".mode-btn");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");
const currentTaskEl = document.getElementById("current-task");

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Plays a short ascending three-note chime so it's clearly audible/distinct
// from a single beep, without needing an external audio file.
function playAlert() {
  if (audioCtx.state === "suspended") audioCtx.resume();

  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  const noteDuration = 0.28;

  notes.forEach((freq, i) => {
    const startTime = audioCtx.currentTime + i * noteDuration;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(freq, startTime);

    gainNode.gain.setValueAtTime(0.0001, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.15, startTime + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(
      0.0001,
      startTime + noteDuration,
    );

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + noteDuration);
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function updateDisplay() {
  display.textContent = formatTime(timeLeft);
  document.title = `${formatTime(timeLeft)} - Pomodoro timer`;
  updateDialProgress();
}

function updateDialProgress() {
  const total = MODES[currentMode];
  const progress = total > 0 ? (total - timeLeft) / total : 0;
  const offset = DIAL_CIRCUMFERENCE * (1 - progress);
  dialProgress.style.strokeDashoffset = offset;
}

function switchMode(mode) {
  currentMode = mode;
  timeLeft = MODES[currentMode];
  updateDisplay();
  body.dataset.mode = mode;

  modeBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
  });

  if (isRunning) toggleTimer();
}

function toggleTimer() {
  if (isRunning) {
    clearInterval(timerInterval);
    startBtn.textContent = "Start";
  } else {
    if (audioCtx.state === "suspended") audioCtx.resume();
    timerInterval = setInterval(() => {
      timeLeft--;
      updateDisplay();

      if (timeLeft <= 0) {
        clearInterval(timerInterval);
        isRunning = false;
        startBtn.textContent = "Start";
        playAlert();
      }
    }, 1000);
    startBtn.textContent = "Pause";
  }
  isRunning = !isRunning;
}

function resetTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  timeLeft = MODES[currentMode];
  startBtn.textContent = "Start";
  updateDisplay();
}

// --- Editable duration ---
// Click the time display (only while stopped) to type a new minute value
// for the current mode. Enter/blur confirms, Escape cancels.
function openTimeEditor() {
  if (isRunning) return;

  timeEditInput.value = Math.round(MODES[currentMode] / 60);
  display.classList.add("hidden");
  timeEditInput.classList.remove("hidden");
  timeEditInput.focus();
  timeEditInput.select();
}

function closeTimeEditor(commit) {
  timeEditInput.classList.add("hidden");
  display.classList.remove("hidden");

  if (commit) {
    let minutes = parseInt(timeEditInput.value, 10);
    if (Number.isFinite(minutes) && minutes > 0) {
      minutes = Math.min(minutes, 180);
      MODES[currentMode] = minutes * 60;
      saveCustomDurations();
      timeLeft = MODES[currentMode];
      updateDisplay();
    }
  }
}

display.addEventListener("click", openTimeEditor);

timeEditInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    closeTimeEditor(true);
  } else if (e.key === "Escape") {
    closeTimeEditor(false);
  }
});

timeEditInput.addEventListener("blur", () => closeTimeEditor(true));

// --- Tasks ---
let tasks = JSON.parse(localStorage.getItem("pomodoroTasks")) || [];
let nextTaskId = tasks.reduce((max, t) => Math.max(max, t.id || 0), 0) + 1;
let activeTaskId = localStorage.getItem("pomodoroActiveTaskId");
activeTaskId = activeTaskId ? Number(activeTaskId) : null;

function saveTasks() {
  localStorage.setItem("pomodoroTasks", JSON.stringify(tasks));
}

function saveActiveTask() {
  if (activeTaskId === null) {
    localStorage.removeItem("pomodoroActiveTaskId");
  } else {
    localStorage.setItem("pomodoroActiveTaskId", String(activeTaskId));
  }
}

function renderCurrentTask() {
  const active = tasks.find((t) => t.id === activeTaskId);
  currentTaskEl.innerHTML = "";

  if (!active) return;

  const dot = document.createElement("span");
  dot.className = "current-task-dot";

  const text = document.createElement("span");
  text.className = "current-task-text";
  text.textContent = active.text;

  currentTaskEl.appendChild(dot);
  currentTaskEl.appendChild(text);
}

function renderTasks() {
  taskList.innerHTML = "";

  if (tasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "task-empty";
    empty.textContent = "No tasks yet";
    taskList.appendChild(empty);
    renderCurrentTask();
    return;
  }

  tasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = `task-item ${task.id === activeTaskId ? "is-active" : ""}`;

    const main = document.createElement("div");
    main.className = "task-main";

    const pinBtn = document.createElement("button");
    pinBtn.className = `pin-btn ${task.id === activeTaskId ? "is-active" : ""}`;
    pinBtn.innerHTML = "&#9679;";
    pinBtn.title =
      task.id === activeTaskId
        ? "Unset as current task"
        : "Set as current task";
    pinBtn.onclick = () => setActiveTask(task.id);

    const span = document.createElement("span");
    span.className = `task-text ${task.completed ? "completed" : ""}`;
    span.textContent = task.text;
    span.onclick = () => toggleTask(task.id);

    main.appendChild(pinBtn);
    main.appendChild(span);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = "&times;";
    delBtn.title = "Delete task";
    delBtn.onclick = () => deleteTask(task.id);

    li.appendChild(main);
    li.appendChild(delBtn);
    taskList.appendChild(li);
  });

  renderCurrentTask();
}

function addTask(text) {
  if (!text.trim()) return;
  tasks.push({ id: nextTaskId++, text: text.trim(), completed: false });
  saveTasks();
  renderTasks();
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderTasks();
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  if (activeTaskId === id) {
    activeTaskId = null;
    saveActiveTask();
  }
  saveTasks();
  renderTasks();
}

function setActiveTask(id) {
  activeTaskId = activeTaskId === id ? null : id;
  saveActiveTask();
  renderTasks();
}

startBtn.addEventListener("click", toggleTimer);
resetBtn.addEventListener("click", resetTimer);

modeBtns.forEach((btn) => {
  btn.addEventListener("click", (e) => switchMode(e.target.dataset.mode));
});

taskInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    addTask(e.target.value);
    e.target.value = "";
  }
});

updateDisplay();
renderTasks();
