const audioFiles = [/* your 24-track array here */];
const ctx = new (window.AudioContext || window.webkitAudioContext)();
let buffers = [], sources = [], gains = [], analysers = [], peakHolds = [], soloStates = [], startTime = null;
let isMuted = false, duration = 60, loopStart = 0, loopEnd = 60;

document.getElementById("sliderA").oninput = e => {
  loopStart = parseFloat(e.target.value);
  if (loopStart >= loopEnd) loopStart = loopEnd - 0.1;
};
document.getElementById("sliderB").oninput = e => {
  loopEnd = parseFloat(e.target.value);
  if (loopEnd <= loopStart) loopEnd = loopStart + 0.1;
};

document.getElementById("load").addEventListener("click", loadFiles);
document.getElementById("play").addEventListener("click", () => playFrom(0));
document.getElementById("stop").addEventListener("click", stopAll);
document.getElementById("mute").addEventListener("click", () => { isMuted = true; updateSolo(); });
document.getElementById("unmute").addEventListener("click", () => { isMuted = false; updateSolo(); });

async function loadFiles() {
  const loadingDisplay = document.getElementById("loading");
  buffers = [];
  let loadedCount = 0;

  for (let track of audioFiles) {
    try {
      const response = await fetch(track.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      buffers.push(audioBuffer);
      loadedCount++;
      loadingDisplay.textContent = `Loading: ${loadedCount} / ${audioFiles.length} files`;
    } catch (err) {
      loadingDisplay.textContent = `❌ Error loading: ${track.name}`;
      console.error(`Failed to load ${track.name}`, err);
    }
  }

  duration = Math.max(...buffers.map(b => b.duration));
  document.getElementById("sliderA").max = duration.toFixed(1);
  document.getElementById("sliderB").max = duration.toFixed(1);
  document.getElementById("sliderB").value = duration.toFixed(1);
  loopEnd = duration;

  loadingDisplay.textContent = `✅ All ${loadedCount} files loaded`;
  createUI();
}

function createUI() {
  const container = document.getElementById("tracks");
  container.innerHTML = "";
  audioFiles.forEach((track, i) => {
    const div = document.createElement("div");
    div.className = "track";
    div.innerHTML = `
      <div class="track-name">${track.name}</div>
      <button class="solo-btn" data-index="${i}">Solo</button>
      <div class="meter" id="meter-${i}">
        <div class="meter-fill" id="fill-${i}"></div>
        <div class="peak-hold" id="peak-${i}"></div>
      </div>
    `;
    container.appendChild(div);
    peakHolds[i] = 0;
    soloStates[i] = false;
  });

  document.querySelectorAll(".solo-btn").forEach(btn => {
    btn.addEventListener("click", e => {
      const i = +e.target.dataset.index;
      soloStates[i] = !soloStates[i];
      e.target.classList.toggle("active", soloStates[i]);
      updateSolo();
    });
  });
}

function updateSolo() {
  const anySolo = soloStates.includes(true);
  gains.forEach((gain, i) => {
    const active = anySolo ? soloStates[i] : true;
    gain.gain.value = isMuted ? 0 : (active ? 1 : 0);
  });
}

function updateMeters() {
  analysers.forEach((analyser, i) => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const peak = Math.max(...data);
    const percent = peak / 255;
    const dB = 20 * Math.log10(percent || 0.0001);
    const fill = document.getElementById(`fill-${i}`);
    const peakBar = document.getElementById(`peak-${i}`);

    fill.style.width = `${percent * 100}%`;

    if (dB > peakHolds[i]) {
      peakHolds[i] = dB;
    } else {
      peakHolds[i] -= 0.5;
    }

    const peakPercent = Math.pow(10, peakHolds[i] / 20);
    peakBar.style.left = `${Math.min(peakPercent * 100, 100)}%`;
  });

  updatePlayhead();
  requestAnimationFrame(updateMeters);
}

function updatePlayhead() {
  if (!startTime) return;
  const elapsed = ctx.currentTime - startTime;
  document.getElementById("playhead").textContent = `Playhead: ${elapsed.toFixed(2)}s`;

  const playheadLine = document.getElementById("playhead-line");
  const canvas = document.getElementById("amplitudeGraph");
  const percent = elapsed / duration;
  playheadLine.style.left = `${percent * canvas.width}px`;

  if (elapsed >= loopEnd) {
    stopAll();
    playFrom(loopStart);
  }
}

function playFrom(offset) {
  startTime = ctx.currentTime - offset;
  sources = []; gains = []; analysers = [];

  buffers.forEach((buf, i) => {
    const src = ctx.createBufferSource();
    src.buffer = buf;

    const gain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;

    src.connect(gain).connect(analyser).connect(ctx.destination);
    src.start(0, offset);

    sources[i] = src;
    gains[i] = gain;
    analysers[i] = analyser;
  });

  updateSolo();      // wendet Solo/Mute-Logik an
  updateMeters();    // startet die Anzeige der Pegel und Playhead
}
async function playAll() {
  if (buffers.length === 0) {
    await loadFiles();
    createUI();
    duration = Math.max(...buffers.map(b => b.duration));
    document.getElementById("sliderA").max = duration.toFixed(1);
    document.getElementById("sliderB").max = duration.toFixed(1);
    document.getElementById("sliderB").value = duration.toFixed(1);
    loopEnd = duration;
  }
  playFrom(0);
}
function stopAll() { sources.forEach(src => { try { src.stop(); } catch {} }); 
sources = []; 
startTime = null;
 } 
function muteAll() { gains.forEach(g => g.gain.value = 0); 
isMuted = true; 
} 
function unmuteAll() { gains.forEach(g => g.gain.value = 1); 
isMuted = false; 
} 
document.getElementById("play").addEventListener("click", playAll); 
document.getElementById("stop").addEventListener("click", stopAll); 
document.getElementById("mute").addEventListener("click", muteAll); 
document.getElementById("unmute").addEventListener("click", unmuteAll);
