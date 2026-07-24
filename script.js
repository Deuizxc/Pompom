const MODES = {
  work: 25 * 60,
  shortBreak: 5 * 60,
  longBreak: 15 * 60,
};

let currentMode = "work";
let timeLeft = MODES[currentMode];
let timerInterval = null;
let isRunning = false;

const display = document.getElementById("time-display");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const modeBtns = document.querySelectorAll(".mode-btn");
const taskInput = document.getElementById("task-input");
const taskList = document.getElementById("task-list");

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playAlert() {
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1);
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.start();
  oscillator.stop(audioCtx.currentTime + 1);
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
  document.title = `${formatTime(timeLeft)} - Noir Timer`;
}

function switchMode(mode) {
  currentMode = mode;
  timeLeft = MODES[currentMode];
  updateDisplay();

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

let tasks = JSON.parse(localStorage.getItem("noirTasks")) || [];

function saveTasks() {
  localStorage.setItem("noirTasks", JSON.stringify(tasks));
}

function renderTasks() {
  taskList.innerHTML = "";
  tasks.forEach((task, index) => {
    const li = document.createElement("li");
    li.className = "task-item";

    const span = document.createElement("span");
    span.className = `task-text ${task.completed ? "completed" : ""}`;
    span.textContent = task.text;
    span.onclick = () => toggleTask(index);

    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.innerHTML = "×";
    delBtn.onclick = () => deleteTask(index);

    li.appendChild(span);
    li.appendChild(delBtn);
    taskList.appendChild(li);
  });
}

function addTask(text) {
  if (!text.trim()) return;
  tasks.push({ text, completed: false });
  saveTasks();
  renderTasks();
}

function toggleTask(index) {
  tasks[index].completed = !tasks[index].completed;
  saveTasks();
  renderTasks();
}

function deleteTask(index) {
  tasks.splice(index, 1);
  saveTasks();
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
