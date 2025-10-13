async function fetchAudioFiles() {
  const response = await fetch('audioFiles.json');
  const data = await response.json();
  return data.audioFiles; // ✅ extract the array
}

async function init() {
  const audioFiles = await fetchAudioFiles();
  await loadFiles(audioFiles); // ✅ pass array into loadFiles
  setupEventListeners(audioFiles);
}





const ctx = new (window.AudioContext || window.webkitAudioContext)();
let buffers = [], sources = [], gains = [], analysers = [], peakHolds = [], soloStates = [], startTime = null;
let isMuted = false, duration = 60, loopStart = 0, loopEnd = 60;
let isLooping = false;
let isPlaying = false;

// Attach event listeners once audioFiles are ready
function setupEventListeners(audioFiles) {
      document.getElementById("sliderA").oninput = e => {
        loopStart = parseFloat(e.target.value);
        if (loopStart >= loopEnd) loopStart = loopEnd - 0.1;
      };
      document.getElementById("sliderB").oninput = e => {
        loopEnd = parseFloat(e.target.value);
        if (loopEnd <= loopStart) loopEnd = loopStart + 0.1;
      };
      
      document.getElementById("load").addEventListener("click", () => loadFiles(audioFiles));

      document.getElementById("play").addEventListener("click", () => playFrom(loopStart));
      document.getElementById("stop").addEventListener("click", stopAll);
      document.getElementById("mute").addEventListener("click", () => { isMuted = true; updateSolo(); });
      document.getElementById("unmute").addEventListener("click", () => { isMuted = false; updateSolo(); });
}
async function loadFiles(audioFiles) {
  const loadingDisplay = document.getElementById("loading");
  buffers = [];
  let loadedCount = 0;

  const promises = audioFiles.map(async (track, i) => {
    try {
      const response = await fetch(track.url);
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      buffers[i] = audioBuffer;

      if (!gains[i]) gains[i] = ctx.createGain();

      loadedCount++;
      loadingDisplay.textContent = `Loading: ${loadedCount} / ${audioFiles.length} files`;
    } catch (err) {
      loadingDisplay.textContent = `❌ Error loading: ${track.name}`;
      console.error(`Failed to load ${track.name}`, err);
    }
  });

  await Promise.all(promises); // ✅ Wait until all are loaded

  duration = Math.max(...buffers.map(b => b.duration));
  document.getElementById("playheadSlider").max = duration.toFixed(2);
  document.getElementById("playheadSlider").oninput = e => {
    const newTime = parseFloat(e.target.value);
    stopAll();
    playFrom(newTime);
  };

  document.getElementById("sliderA").max = duration.toFixed(1);
  document.getElementById("sliderB").max = duration.toFixed(1);
  document.getElementById("sliderB").value = duration.toFixed(1);
  loopEnd = duration;

  loadingDisplay.textContent = `✅ All ${loadedCount} files loaded`;
  createUI();
  // drawAmplitude();
}

init();

function createUI() {
  const container = document.getElementById("tracks");
  container.innerHTML = "";
  audioFiles.forEach((track, i) => {
    const div = document.createElement("div");
    div.className = "track";
    div.innerHTML = `
      <div class="track-name">${track.name}</div>
      <button onclick="jumpTo(${track.sec})">^</button>
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
function drawAmplitude() {
  const canvas = document.getElementById("amplitudeGraph");
  const ctx2d = canvas.getContext("2d");
  ctx2d.clearRect(0, 0, canvas.width, canvas.height);

  if (!buffers[0]) return; // Use first buffer as example

  const data = buffers[0].getChannelData(0); // mono or left channel
  const step = Math.floor(data.length / canvas.width);
  const amp = canvas.height / 2;

  ctx2d.beginPath();
  ctx2d.moveTo(0, amp);

  for (let i = 0; i < canvas.width; i++) {
    const min = data[i * step];
    const y = amp - min * amp;
    ctx2d.lineTo(i, y);
  }

  ctx2d.strokeStyle = "#0f0";
  ctx2d.lineWidth = 1;
  ctx2d.stroke();
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

  document.getElementById("playheadSlider").value = elapsed.toFixed(2);
  document.getElementById("playhead").textContent = `Playhead: ${elapsed.toFixed(2)}s`;

  //const playheadLine = document.getElementById("playhead-line");
  const canvas = document.getElementById("amplitudeGraph");
  const percent = elapsed / duration;
  const canvasWidth = canvas.width || canvas.getBoundingClientRect().width;
  //playheadLine.style.left = `${percent * canvas.width}px`;

  if (elapsed >= loopEnd && !isLooping) {
    isLooping = true;
    stopAll();
    setTimeout(() => {
      playFrom(loopStart);
      isLooping = false;
    }, 100); // small delay to ensure stopAll completes
  }
}


function jumpTo(seconds) {
  playheadSlider.value = seconds;
  stopAll();
  playFrom(seconds);
}

function playFrom(offset) {
    if (!isFinite(offset)) {
  console.warn("Invalid offset:", offset);
  return;
}
  if (isPlaying) return;
  isPlaying = true;
  startTime = ctx.currentTime - offset;
  sources = []; gains = []; analysers = [];

buffers.forEach((buf, i) => {
  const src = ctx.createBufferSource();
  src.buffer = buf;
    
  if (!gains[i]) gains[i] = ctx.createGain(); 
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;

  src.connect(gains[i]).connect(analyser).connect(ctx.destination);
  src.start(0, offset);

  sources[i] = src;
  analysers[i] = analyser;
});


  updateSolo();
  updateMeters();
}

function stopAll() {
  sources.forEach(src => {
    try { src.stop(); } catch {}
  });
  sources = [];
  startTime = null;
  isPlaying = false;
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
  playFrom(loopStart);
}
/*
function stopAll() {
  sources.forEach(src => {
    if (src && typeof src.stop === "function") {
      try { src.stop(); } catch (e) { console.warn("Already stopped:", e); }
    }
  });
  sources = [];
  startTime = null;
}
*/
function muteAll() {
  isMuted = true;
  updateSolo();
}

function unmuteAll() {
  isMuted = false;
  updateSolo();
}

function updateSolo() {
  const anySolo = soloStates.includes(true);
  gains.forEach((gain, i) => {
    if (!gain) return;
    const active = anySolo ? soloStates[i] : true;
    gain.gain.value = isMuted ? 0 : (active ? 1 : 0);
  });
}



document.getElementById("play").addEventListener("click", playAll); 
document.getElementById("stop").addEventListener("click", stopAll); 
document.getElementById("mute").addEventListener("click", muteAll); 
document.getElementById("unmute").addEventListener("click", unmuteAll);
