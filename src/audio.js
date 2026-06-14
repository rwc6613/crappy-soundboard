class AudioEngine {
    // stuff that does things (we just want stuff initialized to null to start)
    constructor() {
        this.audioContext = null;
        this.micSource = null;
        this.micStream = null;
        this.gainNode = null;
        this.destination = null;
        this.selectedInputDeviceID = null;
        this.selectedOutputDeviceID = null;
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

        // creating the output stream destination (which is what the modified input will be routed to later)
        this.destination = this.audioContext.createMediaStreamDestination();

        // connection: mic -> gain -> destination
        this.micSource.connect(this.gainNode);
        this.gainNode.connect(this.destination);

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
        if (this.gainNode) {
            this.gainNode.gain.value = value;
        }
    }
}

const audioEngine = new AudioEngine();