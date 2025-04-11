/*********************************************************
 * GLOBAL STATE
 *********************************************************/
let globalSentences = [];
let currentSentenceIndex = -1;
let audioCache = {};
let isStopped = false;
let isPaused = false;
const DEFAULT_MIN_SENTENCE_LENGTH = 150;

/*********************************************************
 * DOM ELEMENTS
 *********************************************************/
const advancedToggle = document.getElementById('advancedToggle');
// Note: advancedSettings div is no longer used for accordion, but might be referenced elsewhere if not cleaned up fully.
// const advancedSettings = document.getElementById('advancedSettings');
const apiKeyInput = document.getElementById('apiKey');
const minSentenceLengthInput = document.getElementById('minSentenceLength');
const textContainer = document.getElementById('textContainer');
const processTextBtn = document.getElementById('processTextBtn');
const clearTextBtn = document.getElementById('clearTextBtn');
const playBtn = document.getElementById('playBtn');
const pauseBtn = document.getElementById('pauseBtn');
const stopBtn = document.getElementById('stopBtn');
const audioPlayer = document.getElementById('audioPlayer');
const statusBar = document.getElementById('statusBar');
const voiceSelect = document.getElementById('voiceSelect');
const fileInput = document.getElementById('fileInput');
const chooseFileBtn = document.getElementById('chooseFileBtn');
const fontSizeInput = document.getElementById('fontSize');
const settingsModal = document.getElementById('settingsModal'); // Added modal elements
const settingsOverlay = document.getElementById('settingsOverlay');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');

/*********************************************************
 * SETTINGS MODAL HANDLING
 *********************************************************/
function openSettingsModal() {
  settingsOverlay.classList.add('visible');
  settingsModal.classList.add('visible');
}

function closeSettingsModal() {
  settingsOverlay.classList.remove('visible');
  settingsModal.classList.remove('visible');
}

advancedToggle.addEventListener('click', openSettingsModal);
closeSettingsBtn.addEventListener('click', closeSettingsModal);
settingsOverlay.addEventListener('click', closeSettingsModal); // Close when clicking overlay

/*********************************************************
 * STATUS BAR & ERROR HANDLING
 *********************************************************/
function showStatus(msg, isError = false) {
  statusBar.textContent = (isError ? "Error: " : "Status: ") + msg;
  statusBar.style.color = isError ? '#dc3545' : '#555'; // Use red for errors
  statusBar.style.fontWeight = isError ? 'bold' : 'normal';
  console.log((isError ? "Error: " : "Status: ") + msg);
}

/*********************************************************
 * FONT SIZE HANDLING
 *********************************************************/
const DEFAULT_FONT_SIZE = 1; // Default font size in rem

function applyFontSize(size) {
  const validSize = Math.max(0.5, Math.min(3, parseFloat(size) || DEFAULT_FONT_SIZE)); // Clamp between 0.5 and 3
  document.documentElement.style.setProperty('--text-container-font-size', `${validSize}rem`);
  // Update input value in case it was clamped or invalid
  if (fontSizeInput.value !== validSize.toString()) {
      fontSizeInput.value = validSize;
  }
}

/*********************************************************
 * LOAD/SAVE SETTINGS
 *********************************************************/
function loadSettings() {
  // API Key
  if (localStorage.getItem('googleTtsApiKey')) {
    apiKeyInput.value = localStorage.getItem('googleTtsApiKey');
  }
  // Min Sentence Length
  if (localStorage.getItem('minSentenceLength')) {
    minSentenceLengthInput.value = localStorage.getItem('minSentenceLength');
  } else {
    minSentenceLengthInput.value = DEFAULT_MIN_SENTENCE_LENGTH;
  }
  // Font Size
  const savedFontSize = localStorage.getItem('fontSize');
  if (savedFontSize) {
    fontSizeInput.value = savedFontSize;
    applyFontSize(savedFontSize); // Apply loaded font size
  } else {
    fontSizeInput.value = DEFAULT_FONT_SIZE;
    applyFontSize(DEFAULT_FONT_SIZE); // Apply default font size
  }
  // Selected Voice (handled in updateVoiceDropdown)
}

// --- Event Listeners for Saving Settings ---
apiKeyInput.addEventListener('change', () => {
  localStorage.setItem('googleTtsApiKey', apiKeyInput.value);
  showStatus("API Key updated.");
});

minSentenceLengthInput.addEventListener('change', () => {
  localStorage.setItem('minSentenceLength', minSentenceLengthInput.value);
  showStatus("Min Sentence Length updated to " + minSentenceLengthInput.value);
});

fontSizeInput.addEventListener('change', () => {
  const newSize = fontSizeInput.value;
  applyFontSize(newSize); // Apply the new size (handles clamping)
  localStorage.setItem('fontSize', fontSizeInput.value); // Save the potentially clamped value
  showStatus(`Font size updated to ${fontSizeInput.value}rem.`);
});

voiceSelect.addEventListener('change', () => {
  localStorage.setItem("selectedVoice", voiceSelect.value);
});


/*********************************************************
 * MODE SELECTOR & ACTIONS
 *********************************************************/
document.querySelectorAll('input[name="inputMode"]').forEach(radio => {
  radio.addEventListener('change', handleModeChange);
});
function handleModeChange() {
  textContainer.innerHTML = "";
  globalSentences = [];
  audioCache = {};
  currentSentenceIndex = -1;
  playBtn.disabled = true;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  fileInput.value = ""; // Reset file input when mode changes
  const mode = document.querySelector('input[name="inputMode"]:checked').value;
  if (mode === "manual") {
    textContainer.setAttribute("contenteditable", "true");
    processTextBtn.style.display = "inline-block";
    clearTextBtn.style.display = "inline-block";
    document.getElementById('uploadSection').style.display = "none";
  } else {
    textContainer.setAttribute("contenteditable", "false");
    processTextBtn.style.display = "none";
    clearTextBtn.style.display = "none";
    document.getElementById('uploadSection').style.display = "flex";
  }
}

/*********************************************************
 * MANUAL MODE
 *********************************************************/
processTextBtn.addEventListener('click', () => {
  processText(textContainer.innerText);
  textContainer.setAttribute("contenteditable", "false"); // Keep non-editable after processing
});
clearTextBtn.addEventListener('click', () => {
  // Add confirmation if text area is not empty
  if (textContainer.innerText.trim() !== "" && !confirm("Are you sure you want to clear the current text?")) {
    return; // User cancelled
  }
  textContainer.innerHTML = "";
  globalSentences = [];
  audioCache = {};
  currentSentenceIndex = -1;
  playBtn.disabled = true;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  textContainer.setAttribute("contenteditable", "true");
  showStatus("Text cleared. Please enter new text.");
});

/*********************************************************
 * FILE UPLOAD MODE
 *********************************************************/
chooseFileBtn.addEventListener('click', (event) => {
  // Reset the input value *before* triggering the click to allow re-selecting the same file
  // This is the fix for the double-dialog issue.
  fileInput.value = "";
  fileInput.click();
});
fileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = evt => {
    textContainer.innerText = evt.target.result;
    processText(evt.target.result);
    // Ensure non-editable in upload mode
    textContainer.setAttribute("contenteditable", "false");
    // DO NOT reset fileInput.value here - it's reset before the click now.
  };
  reader.readAsText(file);
});

/*********************************************************
 * TEXT PROCESSING
 *********************************************************/
function combineSentences(sentences) {
  const minLen = parseInt(minSentenceLengthInput.value) || DEFAULT_MIN_SENTENCE_LENGTH;
  let combined = [];
  let buffer = "";
  sentences.forEach((s, i) => {
    if (typeof s !== "string") return;
    let sentence = s.trim();
    if (!sentence) return;
    buffer = buffer ? buffer + " " + sentence : sentence;
    if (buffer.length >= minLen || i === sentences.length - 1) {
      combined.push(buffer);
      buffer = "";
    }
  });
  return combined;
}

function processText(text) {
  const paragraphs = text.split(/\r?\n\s*\r?\n/);
  globalSentences = [];
  textContainer.innerHTML = "";
  const sentenceSplitRegex = /(?<!\b(?:Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.|Sr\.|Jr\.|b\.))(?<=[.?!])\s+(?=[A-Z])/g;
  paragraphs.forEach((para, pIndex) => {
    const pDiv = document.createElement('div');
    pDiv.classList.add('paragraph');
    if (para.trim() === "") { pDiv.innerHTML = "<br>"; }
    else {
      let raw = para.split(sentenceSplitRegex);
      let finalSentences = combineSentences(raw);
      finalSentences.forEach(sentence => {
        const span = document.createElement('span');
        const globalIndex = globalSentences.length;
        span.id = "sentence_" + globalIndex;
        span.classList.add("sentenceSpan");
        span.textContent = sentence;
        span.addEventListener('click', () => {
          currentSentenceIndex = globalIndex;
          stopPlayback();
          clearHighlight();
          highlightSentence(globalIndex);
          showStatus(`Sentence ${globalIndex + 1} selected. Press Play to start.`);
        });
        pDiv.appendChild(span);
        pDiv.appendChild(document.createTextNode(" "));
        globalSentences.push({ paragraphIndex: pIndex, sentenceText: sentence });
      });
    }
    textContainer.appendChild(pDiv);
  });
  showStatus(`Processed text: ${globalSentences.length} sentences.`);
  playBtn.disabled = (globalSentences.length === 0);
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  audioCache = {};
}

/*********************************************************
 * TTS & PLAYBACK
 *********************************************************/
function wrapInSSML(text) { return `<speak>${text}</speak>`; }

// Add loading state for TTS calls
let isFetchingTTS = false;

async function callTTS(text, sentenceIndex) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    showStatus("Please enter your Google TTS API Key.", true);
    throw new Error("Missing API Key"); // Throw error to stop playback chain
  }
  const selectedOption = voiceSelect.options[voiceSelect.selectedIndex];
  const voiceName = selectedOption.value;
  const languageCode = selectedOption.dataset.language || "en-US";
  const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
  const inputData = voiceName.includes("Chirp") ? { text } : { ssml: wrapInSSML(text) };
  const data = { input: inputData, voice: { languageCode, name: voiceName }, audioConfig: { audioEncoding: "MP3" } };

  isFetchingTTS = true;
  showStatus(`Fetching audio for sentence ${sentenceIndex + 1}...`);

  try {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (!response.ok) {
      const errorData = await response.json();
      const errorMessage = "TTS API Error: " + (errorData.error ? errorData.error.message : response.statusText);
      showStatus(errorMessage, true);
      throw new Error(errorMessage);
    }
    const result = await response.json();
    showStatus(`Received audio for sentence ${sentenceIndex + 1}.`);
    return result.audioContent;
  } catch (error) {
      showStatus(`Failed to fetch TTS for sentence ${sentenceIndex + 1}: ${error.message}`, true);
      throw error;
  } finally {
      isFetchingTTS = false;
  }
}

function base64ToBlobURL(base64, mime) {
  const byteCharacters = atob(base64);
  const byteNumbers = Array.from(byteCharacters, c => c.charCodeAt(0));
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mime });
  return URL.createObjectURL(blob);
}

async function playSentence(index) {
  if (index < 0 || index >= globalSentences.length) return;
  isStopped = false;
  isPaused = false;
  highlightSentence(index);
  if (audioCache[index]) {
    showStatus(`Playing cached audio for sentence ${index + 1}.`);
      audioPlayer.src = audioCache[index];
      pauseBtn.disabled = false;
      stopBtn.disabled = false;
      playBtn.disabled = true;
  } else {
    try {
      const audioContent = await callTTS(globalSentences[index].sentenceText, index);
      if (!audioContent) return;

      const audioURL = base64ToBlobURL(audioContent, "audio/mp3");
      audioCache[index] = audioURL;
      showStatus(`Cached audio for sentence ${index + 1}.`);
      audioPlayer.src = audioURL;
    } catch (error) {
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      clearHighlight();
      return;
    }
  }

  audioPlayer.play().catch(e => {
      showStatus(`Audio playback error: ${e.message}`, true);
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
      clearHighlight();
  });

  pauseBtn.disabled = false;
  stopBtn.disabled = false;
  playBtn.disabled = true;
  currentSentenceIndex = index;

  audioPlayer.onended = () => {
    if (isStopped) return;
    const nextIndex = index + 1;
    if (nextIndex < globalSentences.length) {
      showStatus(`Sentence ${index + 1} ended. Auto-playing sentence ${nextIndex + 1}.`);
      playSentence(nextIndex);
    } else {
      showStatus("Reached end of text.");
      clearHighlight();
      playBtn.disabled = false;
      pauseBtn.disabled = true;
      stopBtn.disabled = true;
    }
  };
  const nextIndex = index + 1;
  if (nextIndex < globalSentences.length && !audioCache[nextIndex]) {
    callTTS(globalSentences[nextIndex].sentenceText, nextIndex) // Pass correct index
      .then(audioContent => {
        if (audioContent) { // Check if TTS succeeded before caching
          audioCache[nextIndex] = base64ToBlobURL(audioContent, "audio/mp3");
          showStatus(`Prefetched and cached sentence ${nextIndex + 1}.`);
        }
      })
      .catch(err => showStatus(`Prefetch error for sentence ${nextIndex + 1}: ${err.message}`, true));
  }
}

function highlightSentence(index) {
  clearHighlight();
  const span = document.getElementById("sentence_" + index);
  if (span) {
    span.classList.add("highlight");
    span.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function clearHighlight() {
  document.querySelectorAll('.sentenceSpan').forEach(s => s.classList.remove('highlight'));
}

function stopPlayback() {
  isStopped = true;
  isPaused = false;
  audioPlayer.pause();
  audioPlayer.currentTime = 0;
  showStatus("Playback stopped by user.");
  stopBtn.disabled = true;
  pauseBtn.disabled = true;
  playBtn.disabled = false;
  clearHighlight();
}

function pausePlayback() {
  if (!isStopped && !isPaused) {
    audioPlayer.pause();
    isPaused = true;
    showStatus("Playback paused.");
    playBtn.disabled = false;
    pauseBtn.disabled = true;
  }
}

function startPlayback() {
  const mode = document.querySelector('input[name="inputMode"]:checked').value;
  // Re-process text only if in manual mode and text might have changed
  if (mode === "manual" && textContainer.getAttribute('contenteditable') === 'true') {
     processText(textContainer.innerText);
     textContainer.setAttribute("contenteditable", "false");
  }

  if (isPaused) {
    isPaused = false;
    showStatus("Playback resumed.");
    audioPlayer.play();
    playBtn.disabled = true;
    pauseBtn.disabled = false;
    stopBtn.disabled = false;
  } else {
    if (globalSentences.length === 0) {
        showStatus("No text processed to play.", true);
        return;
    }
    if (currentSentenceIndex < 0) { currentSentenceIndex = 0; }
    showStatus(`Starting playback from sentence ${currentSentenceIndex + 1}.`);
    playSentence(currentSentenceIndex);
  }
}

playBtn.addEventListener('click', startPlayback);
pauseBtn.addEventListener('click', pausePlayback);
stopBtn.addEventListener('click', stopPlayback);

/*********************************************************
 * VOICE DROPDOWN
 *********************************************************/
function populateVoiceDropdown(voices) {
  voiceSelect.innerHTML = "";
  voices.sort((a, b) => {
    const aChirp = a.name.toLowerCase().includes("chirp");
    const bChirp = b.name.toLowerCase().includes("chirp");
    if (aChirp && !bChirp) return -1;
    if (!aChirp && bChirp) return 1;
    return a.name.localeCompare(b.name);
  });
  voices.forEach(voice => {
    const friendlyName = createFriendlyVoiceLabel(voice);
    const opt = document.createElement('option');
    opt.value = voice.name;
    opt.dataset.language = voice.languageCodes[0];
    opt.textContent = friendlyName;
    voiceSelect.appendChild(opt);
  });
  const savedVoice = localStorage.getItem("selectedVoice");
  if (savedVoice) { voiceSelect.value = savedVoice; }
}
function createFriendlyVoiceLabel(voice) {
  const rawName = voice.name;
  const language = voice.languageCodes[0];
  const gender = voice.ssmlGender;
  let cleaned = rawName.replace(language + "-", "");
  cleaned = cleaned.replace(/-/g, " ");
  return `${cleaned} (${gender.toLowerCase()}) - ${language}`;
}
async function updateVoiceDropdown(force = false) {
  const refreshBtn = document.getElementById('refreshVoicesBtn');
  const originalBtnText = refreshBtn.textContent;
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showStatus("Please enter your API Key to refresh voices.", true);
    return;
  }

  refreshBtn.disabled = true;
  refreshBtn.textContent = "Refreshing...";
  showStatus("Fetching voices...");

  if (!force) {
    const cachedVoices = localStorage.getItem("cachedVoices");
    if (cachedVoices) {
      try {
        const voices = JSON.parse(cachedVoices);
        populateVoiceDropdown(voices);
        showStatus("Loaded voices from cache.");
        refreshBtn.disabled = false;
        refreshBtn.textContent = originalBtnText;
        return;
      } catch(e) {
        console.warn("Could not parse cached voices:", e);
      }
    }
  }

  const url = `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error fetching voices: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    const voices = data.voices.filter(v => v.languageCodes.some(lc => lc.toLowerCase().startsWith("en")));
    populateVoiceDropdown(voices);
    localStorage.setItem("cachedVoices", JSON.stringify(voices));
    showStatus("Voice dropdown updated from API and cached.");
  } catch (error) {
    showStatus(`Error updating voices: ${error.message}`, true);
  } finally {
    refreshBtn.disabled = false;
    refreshBtn.textContent = originalBtnText;
  }
}

// Initial setup
document.addEventListener('DOMContentLoaded', () => {
    loadSettings(); // Load all settings
    updateVoiceDropdown(); // Load voices
    handleModeChange(); // Set initial mode display
});

// Event Listeners
document.querySelectorAll('input[name="inputMode"]').forEach(radio => { radio.addEventListener('change', handleModeChange); });
processTextBtn.addEventListener('click', () => {
  processText(textContainer.innerText);
  textContainer.setAttribute("contenteditable", "false");
});
clearTextBtn.addEventListener('click', () => {
  if (textContainer.innerText.trim() !== "" && !confirm("Are you sure you want to clear the current text?")) {
    return;
  }
  textContainer.innerHTML = "";
  globalSentences = [];
  audioCache = {};
  currentSentenceIndex = -1;
  playBtn.disabled = true;
  pauseBtn.disabled = true;
  stopBtn.disabled = true;
  textContainer.setAttribute("contenteditable", "true");
  showStatus("Text cleared. Please enter new text.");
});
// chooseFileBtn listener defined above
// fileInput listener defined above
playBtn.addEventListener('click', startPlayback);
pauseBtn.addEventListener('click', pausePlayback);
stopBtn.addEventListener('click', stopPlayback);
document.getElementById('refreshVoicesBtn').addEventListener('click', () => updateVoiceDropdown(true));
// Settings modal listeners defined above
// Settings input listeners defined above
