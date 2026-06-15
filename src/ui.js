const {ipcRenderer, shell} = require('electron');
const path = require('path');
const fs = require('fs');

// state of soundboard. "Pads" refers to the buttons that we click to play the sounds
const state = {
    soundsFolder: localStorage.getItem('soundsFolder') || '',
    allPads: [],
    filteredPads:[],
};

// element references
const elements = {
    // navigation
    navBtns: document.querySelectorAll('.nav-btn'),
    views: document.querySelectorAll('.view'),
    viewTitle: document.getElementById('view-title'),

    // status
    statusBadge: document.getElementById('status-badge'),
    statusText: document.getElementById('status-text'),

    // soundboard
    searchInput: document.getElementById('search-input'),
    padGrid: document.getElementById('pad-grid'),
    noSounds: document.getElementById('no-sounds'),

    // mixer sliders
    sliderVolume: document.getElementById('sliderVolume'),
    sliderThreshold: document.getElementById('sliderThreshold'),
    sliderRatio: document.getElementById('sliderRatio'),
    sliderHPF: document.getElementById('sliderHPF'),
    sliderLowMid: document.getElementById('sliderLowMid'),
    sliderPresence: document.getElementById('sliderPresence'),
    sliderHighShelf: document.getElementById('sliderHighShelf'),

    // mixer values
    valVolume: document.getElementById('valVolume'),
    valThreshold: document.getElementById('valThreshold'),
    valRatio: document.getElementById('valRatio'),
    valHPF: document.getElementById('valHPF'),
    valLowMid: document.getElementById('valLowMid'),
    valPresence: document.getElementById('valPresence'),
    valHighShelf: document.getElementById('valHighShelf'),

    // settings
    inputSelect: document.getElementById('inputSelect'),
    outputSelect: document.getElementById('outputSelect'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    folderPath: document.getElementById('folderPath'),
    browseFolderBtn: document.getElementById('browseFolderBtn'),
    loadFolderBtn: document.getElementById('loadFolderBtn'),
};

// switching between the different views
const viewTitles = {
    soundboard: 'Soundboard',
    mixer: 'Mixer / EQ',
    settings: 'Settings',
}

elements.navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.view;

        elements.navBtns.forEach(b => b.classList.remove('active'));
        elements.views.forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(`view-${target}`).classList.add('active');
        elements.viewTitle.textContent = viewTitles[target];
    });
});

// status setter function
function setStatus(text, live = false) {
    elements.statusText.textContent = text;
    elements.statusBadge.classList.toggle('live', live);
}

// device selection dropdown functions
async function populateDeviceLists() {
    const {inputs, outputs} = await audioEngine.getListOfAudioDevices();

    elements.inputSelect.innerHTML = '';
    elements.outputSelect.innerHTML = '';

    inputs.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Microphone ${elements.inputSelect.length + 1}`;
        elements.inputSelect.appendChild(option);
    });

    outputs.forEach(device => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.textContent = device.label || `Output ${elements.outputSelect.length + 1}`;
        elements.outputSelect.appendChild(option);
    });

    // restore the previously selected devices if they still exist
    const savedInput = localStorage.getItem('selectedInputDeviceID');
    const savedOutput = localStorage.getItem('selectedOutputDeviceID');
    if (savedInput) elements.inputSelect.value = savedInput;
    if (savedOutput) elements.outputSelect.value = savedOutput;
}

// passthrough controls
elements.startBtn.addEventListener('click', async () => {
    const inputID = elements.inputSelect.value;
    const outputID = elements.outputSelect.value;

    localStorage.setItem('selectedInputDeviceID', inputID);
    localStorage.setItem('selectedOutputDeviceID', outputID);

    await audioEngine.startAudioPassthrough(inputID, outputID);
    setStatus('Live', true);
});

elements.stopBtn.addEventListener('click', async () => {
    await audioEngine.stopProcesses();
    setStatus('Idle', false);
});

// mixer slider controls
function bindSlider(slider, valueElement, formatter, audioFn) {
    slider.addEventListener('input', () => {
        const value = parseFloat(slider.value);
        valueElement.textContent = formatter(value);
        audioFn(value);
    });
}

bindSlider(elements.sliderVolume,    elements.valVolume,    v => v.toFixed(2), v => audioEngine.setMicVolume(v));
bindSlider(elements.sliderThreshold, elements.valThreshold, v => `${v} dB`, v => audioEngine.setCompressorThreshold(v));
bindSlider(elements.sliderRatio,     elements.valRatio,     v => `${v}:1`, v => audioEngine.setCompressorRatio(v));
bindSlider(elements.sliderHPF,       elements.valHPF,       v => `${v} Hz`, v => audioEngine.setHighPassFrequency(v));
bindSlider(elements.sliderLowMid,    elements.valLowMid,    v => `${v > 0 ? '+' : ''}${v} dB`, v => audioEngine.setLowMidGain(v));
bindSlider(elements.sliderPresence,  elements.valPresence,  v => `${v > 0 ? '+' : ''}${v} dB`, v => audioEngine.setPresenceGain(v));
bindSlider(elements.sliderHighShelf, elements.valHighShelf, v => `${v > 0 ? '+' : ''}${v} dB`, v => audioEngine.setHighShelfGain(v));

// sounds folder management
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.m4a'];

function scanFolder(folderPath) {
    if (!folderPath || !fs.existsSync(folderPath)) return [];

    return fs.readdirSync(folderPath)
        .filter(file => AUDIO_EXTENSIONS.includes(path.extname(file).toLowerCase()))
        .map(file => ({
            name: path.basename(file, path.extname(file)), // for filenames without extensions
            filePath: path.join(folderPath, file),
        }));
}

// generating/rendering our sound pads
function renderPads(pads) {
    // clear existing pads (except for the "no sounds" message)
    Array.from(elements.padGrid.children).forEach(child => {
        if (child.id !== 'no-sounds') child.remove();
    });

    if (pads.length === 0) {
        elements.noSounds.style.display = 'block';
        return;
    }

    elements.noSounds.style.display = 'none';

    pads.forEach(({name, filePath}) => {
        const pad = document.createElement('div');
        pad.className = 'pad';
        pad.dataset.path = filePath;
        pad.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>${name}</span>
        `;

        pad.addEventListener('click', () => playPad(pad, filePath));
        elements.padGrid.appendChild(pad);
    })
}

function playPad(padElement, filePath) {
    // prevent double-clicking
    if (padElement.classList.contains('playing')) return;

    padElement.classList.add('playing');
    audioEngine.playSound(filePath).then(() => {
        padElement.classList.remove('playing');
    });
}

// search feature for souundboard
elements.searchInput.addEventListener('input', () => {
    const query = elements.searchInput.value.trim().toLowerCase();
    const filteredQuery = query
        ? state.allPads.filter(pad => pad.name.toLowerCase().includes(query))
        : state.allPads;

    renderPads(filteredQuery);
});

// folder browsing (which uses an Electron dialog)
elements.browseFolderBtn.addEventListener('click', async () => {
    const {dialog} = require('@electron/remote');

    const result = await dialog.showOpenDialog({
        properties: ['openDirectory'],
    });

    if (!result.canceled && result.filePaths.length > 0) {
        elements.folderPath.value = result.filePaths[0];
    }
})

// loading folder
elements.loadFolderBtn.addEventListener('click', () => {
    const folder = elements.folderPath.value.trim();
    if (!folder) return;

    state.soundsFolder = folder;
    localStorage.setItem('soundsFolder', folder);

    state.allPads = scanFolder(folder);
    renderPads(state.allPads);

    // switching to soundboard view so all pads can be seen and displayed
    elements.navBtns.forEach(b => b.classList.remove('active'));
    elements.views.forEach(v => v.classList.remove('active'));
    document.querySelector('[data-view="soundboard"').classList.add('active');
    document.getElementById('view-soundboard').classList.add('active');
    elements.viewTitle.textContent = 'Soundboard';

    setStatus(`${state.allPads.length} sounds loaded`, false);
});

// initialization
(async () => {
    await populateDeviceLists();

    // restore saved folder for local device, then load pads
    if (state.soundsFolder) {
        elements.folderPath.value = state.soundsFolder;
        state.allPads = scanFolder(state.soundsFolder);
        renderPads(state.allPads);
    } else {
        elements.noSounds.style.display = 'block';
    }

    setStatus('Idle', false);
})();