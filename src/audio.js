class AudioEngine {
    // stuff that does things (we just want stuff initialized to null to start)
    constructor() {
        this.audioContext = null;
        this.micSource = null;
        this.micStream = null;
        this.gainNode = null;
        this.compressor = null;
        this.EQBands = {
            highpass: null,
            lowmid: null,
            presence: null,
            highshelf: null
        }
        this.destination = null;
        this.selectedInputDeviceID = null;
        this.selectedOutputDeviceID = null;
        this.outputAudio = null;
    }

    // get all input and output devices from the system
    async getListOfAudioDevices() {
        // requesting microphone permissions
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();

        const inputs = devices.filter(device => device.kind === 'audioinput');
        const outputs = devices.filter(device => device.kind === 'audiooutput');

        return {inputs, outputs};
    }

    // processing functions, sorta like mic filters
    createEQChain() {
        // highpass filter, removes low rumble/background noises, below ~80Hz
        const highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 80;
        highpass.Q.value = 0.7;

        // lowmid filter, fixues muddiness around 300hz
        const lowmid = this.audioContext.createBiquadFilter();
        lowmid.type = 'peaking';
        lowmid.frequency.value = 300;
        lowmid.Q.value = 1.0;
        lowmid.gain.value = -5; // reduce gain to cut muddiness

        // presence filter, boosts voice clarity around 3-4kHz
        const presence = this.audioContext.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = 3000;
        presence.Q.value = 1.0;
        presence.gain.value = 4;

        // highshelf filter, adds brightness above 10kHz
        const highshelf = this.audioContext.createBiquadFilter();
        highshelf.type = 'highshelf';
        highshelf.frequency.value = 10000;
        highshelf.gain.value = 3;

        return {highpass, lowmid, presence, highshelf};
    }

    createCompressor() {
        const compressor = this.audioContext.createDynamicsCompressor();
        
        // the threshold we'll use for audio is -10dB, before the compression kicks in
        compressor.threshold.value = -10;

        // knee, which controls how gradually the compressor applies gain reduction as the input level exceeds the threshold
        compressor.knee.value = 20;

        // ratio of compression, 4:1 means for every 4dB above the threshold, the output will only increase by 1dB
        compressor.ratio.value = 2;

        // attack, which is how quickly the compressor responds to audio that exceeds the threshold, we'll set this to 5ms for now
        compressor.attack.value = 0.02;

        // release, which is how quickly the compression lets go after the signal drops (we'll use like 200ms)
        compressor.release.value = 0.3;

        return compressor;
    }

    // passthrough for the mic input to mic output (based on selected route)
    async startAudioPassthrough(inputDeviceID, outputDeviceID) {
        await this.stopProcesses(); // this is to prevent multiple sessions being active concurrently

        this.selectedInputDeviceID = inputDeviceID;
        this.selectedOutputDeviceID = outputDeviceID;

        this.audioContext = new AudioContext();

        // get selected microphone input
        this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                deviceID: {exact: inputDeviceID},
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        // we can put this into some sort of audio graph apparently? sickkkkk
        this.micSource = this.audioContext.createMediaStreamSource(this.micStream);

        // gain node, let's us control our mic volume
        this.gainNode = this.audioContext.createGain();
        this.gainNode.gain.value = 1; // default to full blast baby

        // compressor node
        this.compressor = this.createCompressor();

        // EQ chain nodes
        this.EQBands = this.createEQChain();

        // creating the output stream destination (which is what the modified input will be routed to later)
        this.destination = this.audioContext.createMediaStreamDestination();

        // connection: mic -> gain -> compressor -> highpass -> lowmid -> presence -> highshelf -> destination
        this.micSource.connect(this.gainNode);
        this.gainNode.connect(this.compressor);
        this.compressor.connect(this.EQBands.highpass);
        this.EQBands.highpass.connect(this.EQBands.lowmid);
        this.EQBands.lowmid.connect(this.EQBands.presence);
        this.EQBands.presence.connect(this.EQBands.highshelf);
        this.EQBands.highshelf.connect(this.destination);

        // now we route the output stream to selected output device (in this case, the virtual cable that we need to install arghh)
        const outputAudio = new Audio();
        outputAudio.srcObject = this.destination.stream;
        await outputAudio.setSinkId(this.selectedOutputDeviceID);
        outputAudio.play();

        this.outputAudio = outputAudio;

        console.log('Passthrough initialized with input device ID:', this.selectedInputDeviceID, 'and output device ID:', this.selectedOutputDeviceID);
    }

    async stopProcesses() {
        if (this.micStream) {
            this.micStream.getTracks().forEach(t => t.stop());
            this.micStream = null;
        }

        if (this.audioContext) {
            await this.audioContext.close();
            this.audioContext = null;
        }

        if (this.outputAudio) {
            this.outputAudio.pause();
            this.outputAudio = null;
        }

        console.log('Audio stopped');
    }

    setMicVolume(value) {
        if (this.gainNode) this.gainNode.gain.value = value;
    }

    // EQ setters
    setHighPassFrequency(value) {
        if (this.EQBands.highpass) this.EQBands.highpass.frequency.value = value;
    }

    setLowMidGain(value) {
        if (this.EQBands.lowmid) this.EQBands.lowmid.gain.value = value;
    }

    setLowMidFrequency(value) {
        if (this.EQBands.lowmid) this.EQBands.lowmid.frequency.value = value;
    }

    setPresenceGain(value) {
        if (this.EQBands.presence) this.EQBands.presence.gain.value = value;
    }

    setPresenceFrequency(value) {
        if (this.EQBands.presence) this.EQBands.presence.frequency.value = value;
    }

    setHighShelfGain(value) {
        if (this.EQBands.highshelf) this.EQBands.highshelf.gain.value = value;
    }

    // setters for just compressors (for our cool sliders later)
    setCompressorThreshold(value) {
        if (this.compressor) this.compressor.threshold.value = value;
    }

    setCompressorRatio(value) {
        if (this.compressor) this.compressor.ratio.value = value;
    }

    // creating soundboard audio chiain
    createSoundboardChain() {
        // boost the gain, cranking up the volume
        const soundGain = this.audioContext.createGain();
        soundGain.gain.value = this.soundboardVolume ?? 1.2;

        // limiter, which is the hard ceiling so audio never goes too crazy
        const limiter = this.audioContext.createDynamicsCompressor();
        limiter.threshold.value = -3 // ceiling is at -3dB
        limiter.knee.value = 3;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.15;

        // chain the gain -> limiter
        soundGain.connect(limiter);

        return {soundGain, limiter}
    }

    // play sound file through same stream as mic passthrough
    async playSound(filePath) {
        if (!this.audioContext || !this.destination) {
            console.warn('Passthrough is not currently active - initialize passthrough before using the soundboard');
            return;
        }

        const fileURL = `file:///${filePath.replace(/\\/g, '/')}`;

        // grab audio file and decode
        const response = await fetch(fileURL);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

        // building a new limiter chain for the soundboard audio
        const {soundGain, limiter} = this.createSoundboardChain();
        
        // create a buffer source, then we link it to the audio graph via connect
        const sourceForVirtualCable = this.audioContext.createBufferSource();
        sourceForVirtualCable.buffer = audioBuffer;
        sourceForVirtualCable.connect(soundGain);
        limiter.connect(this.destination);
        sourceForVirtualCable.start();

        // also route to local audio so we hear it on our speakers as well
        const localAudio = new Audio();
        localAudio.src = fileURL;
        localAudio.volume = 0.7;
        localAudio.play();


        return new Promise(resolve => {
            sourceForVirtualCable.onended = () => {
                localAudio.pause();
                resolve();
            };
        });
    }
}

const audioEngine = new AudioEngine();