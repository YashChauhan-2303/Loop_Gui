let port;
let reader;
let writer;
let keepReading = true;
let buffer = ''; // Buffer to accumulate partial data
const CRITICAL_TEMP = 120; // Critical temperature threshold in Celsius

// Safety functions
function showTemperatureAlert(temp) {
    alert(`WARNING: LIM Temperature Critical (${temp}°C)\nEmergency Brakes Engaged!`);
}

async function activateEmergencyBrakes() {
    if (writer) {
        try {
            await writer.write("EMERGENCY_BRAKE\n");
            console.log("Emergency brakes activated due to critical temperature");
            
            // Trigger emergency brake button visual feedback
            const emergencyButton = document.getElementById('emergencyBrake');
            if (emergencyButton) {
                emergencyButton.style.backgroundColor = '#ff0000';
            }
        } catch (error) {
            console.error("Failed to activate emergency brakes:", error);
        }
    }
}

function calculateSpeed(acceleration) {
    return Math.abs(acceleration); // Simple conversion of acceleration to speed
}

async function handleData(data) {
    try {
        console.log('Parsed data:', data);

        // Handle temperature
        if (data.temperature !== undefined) {
            const temp = parseFloat(data.temperature);
            console.log('Temperature received:', temp);
            const tempDisplay = document.getElementById('motor-temp');
            if (tempDisplay) {
                tempDisplay.textContent = `${temp.toFixed(1)}°C`;
                console.log('Temperature display updated');
            } else {
                console.error('Temperature display element not found');
            }
            if (temp > CRITICAL_TEMP) {
                showTemperatureAlert(temp);
                await activateEmergencyBrakes();
            }
        }

        // Handle IMU acceleration
        if (data.accel && Array.isArray(data.accel)) {
            const maxAccel = Math.max(...data.accel.map(Math.abs));
            const speed = calculateSpeed(maxAccel);
            const speedElement = document.getElementById('speed-value');
            if (speedElement) {
                speedElement.textContent = `${speed.toFixed(2)} m/s`;
                console.log('Speed display updated');
            } else {
                console.error('Speed display element not found');
            }
        }

        // Handle voltage readings
        if (data.VB1 !== undefined && data.VB2 !== undefined && data.VB3 !== undefined) {
            const inverterVoltage = document.getElementById('Inverter-voltage');
            const lvsVoltage = document.getElementById('LVS-voltage');
            const contacterVoltage = document.getElementById('Contacter-voltage');
            if (inverterVoltage) {
                inverterVoltage.textContent = `${data.VB1}V`;
            }
            if (lvsVoltage) {
                lvsVoltage.textContent = `${data.VB2}V`;
            }
            if (contacterVoltage) {
                contacterVoltage.textContent = `${data.VB3}V`;
            }
        }
        
        // (Other data handling code if any...)
    } catch (error) {
        console.error('Error processing data:', error);
    }
}

// Relay control functions
async function controlRelay(relay, state) {
    console.time(`Relay ${relay}_${state}`);
    if (writer) {
        try {
            await writer.write(`${relay}_${state}\n`);
            console.timeEnd(`Relay ${relay}_${state}`);
        } catch (error) {
            console.error(`Failed to control relay ${relay}:`, error);
        }
    }
}

document.addEventListener('DOMContentLoaded', (event) => {
    console.log('Document loaded');
    const connectButton = document.getElementById('connectESP32');
    const podStartButton = document.getElementById('brakeRelease');
    const lvStartButton = document.getElementById('LVEngage');
    const launchpadStartButton = document.getElementById('launchpadStart');
    const inverterStartButton = document.getElementById('InverterStart');

    if (connectButton) {
        console.log('Connect button found');
        connectButton.addEventListener('click', async () => {
            console.log('Connect button clicked');
            try {
                // Request and open serial port
                port = await navigator.serial.requestPort();
                await port.open({ baudRate: 115200 });
                console.log('Serial port opened successfully');

                // Setup streams
                const textDecoder = new TextDecoderStream();
                port.readable.pipeTo(textDecoder.writable);
                reader = textDecoder.readable.getReader();

                const textEncoder = new TextEncoderStream();
                textEncoder.readable.pipeTo(port.writable);
                writer = textEncoder.writable.getWriter();
                
                // Update connection button
                connectButton.classList.add('connected');
                console.log('Connected to ESP32');

                // Continuously read data
                while (keepReading) {
                    const { value, done } = await reader.read();
                    if (done) {
                        console.log('Reader done');
                        reader.releaseLock();
                        break;
                    }

                    buffer += value; // Append incoming data to the buffer
                    console.log('Accumulated buffer:', buffer);

                    // Check if the buffer contains a complete JSON string
                    let endOfJson = buffer.indexOf('}') + 1;
                    if (endOfJson > 0) {
                        const jsonString = buffer.substring(0, endOfJson); // Extract the complete JSON string
                        buffer = buffer.substring(endOfJson); // Keep the remaining data in the buffer

                        try {
                            // Parse the complete JSON string
                            const data = JSON.parse(jsonString);
                            await handleData(data);
                        } catch (error) {
                            console.error('Error parsing data:', error);
                            console.log('Unparsed data:', jsonString);
                        }
                    }
                }
            } catch (error) {
                console.error('Connection error:', error);

                // Update connection button
                connectButton.classList.remove('connected');

                // Update status (example: parent ESP is "esp-status-1")
                const statusDisplay = document.getElementById('esp-status-1');
                if (statusDisplay) {
                    statusDisplay.textContent = "Error";
                    statusDisplay.classList.remove('online');
                    statusDisplay.classList.add('offline');
                }
            }
        });
    } else {
        console.error('Connect button not found');
    }

    // POD START button toggle functionality
    if (podStartButton) {
        console.log('POD START button found');
        podStartButton.addEventListener('click', async () => {
            console.log('POD START button clicked');
            if (podStartButton.classList.contains('active')) {
                podStartButton.classList.remove('active');
                podStartButton.style.backgroundColor = 'green';
                podStartButton.textContent = 'POD START';
                await controlRelay('a', 'OFF'); // Relay A OFF
            } else {
                podStartButton.classList.add('active');
                podStartButton.style.backgroundColor = 'red';
                podStartButton.textContent = 'POD STOP';
                await controlRelay('A', 'ON'); // Relay A ON
            }
        });
    } else {
        console.error('POD START button not found');
    }

    // LV START button toggle functionality
    if (lvStartButton) {
        console.log('LV START button found');
        lvStartButton.addEventListener('click', async () => {
            console.log('LV START button clicked');
            if (lvStartButton.classList.contains('active')) {
                lvStartButton.classList.remove('active');
                lvStartButton.style.backgroundColor = 'green';
                lvStartButton.textContent = 'LV START';
                await controlRelay('B', 'OFF'); // Relay B OFF
            } else {
                lvStartButton.classList.add('active');
                lvStartButton.style.backgroundColor = 'red';
                lvStartButton.textContent = 'LV STOP';
                await controlRelay('b', 'ON'); // Relay B ON
            }
        });
    } else {
        console.error('LV START button not found');
    }

    // Launchpad START button toggle functionality
    if (launchpadStartButton) {
        console.log('Launchpad START button found');
        launchpadStartButton.addEventListener('click', async () => {
            console.log('Launchpad START button clicked');
            if (launchpadStartButton.classList.contains('active')) {
                launchpadStartButton.classList.remove('active');
                launchpadStartButton.style.backgroundColor = 'green';
                launchpadStartButton.textContent = 'Launchpad START';
                await controlRelay('c', 'OFF'); // Relay C OFF
            } else {
                launchpadStartButton.classList.add('active');
                launchpadStartButton.style.backgroundColor = 'red';
                launchpadStartButton.textContent = 'Launchpad STOP';
                await controlRelay('C', 'ON'); // Relay C ON
            }
        });
    } else {
        console.error('Launchpad START button not found');
    }

    // Inverter START button toggle functionality
    if (inverterStartButton) {
        console.log('Inverter START button found');
        inverterStartButton.addEventListener('click', async () => {
            console.log('Inverter START button clicked');
            if (inverterStartButton.classList.contains('active')) {
                inverterStartButton.classList.remove('active');
                inverterStartButton.style.backgroundColor = 'green';
                inverterStartButton.textContent = 'Inverter START';
                await controlRelay('D', 'OFF'); // Relay D OFF
            } else {
                inverterStartButton.classList.add('active');
                inverterStartButton.style.backgroundColor = 'red';
                inverterStartButton.textContent = 'Inverter STOP';
                await controlRelay('d', 'ON'); // Relay D ON
            }
        });
    } else {
        console.error('Inverter START button not found');
    }

    // Emergency brake control
    const emergencyBrakeButton = document.getElementById('emergencyBrake');
    if (emergencyBrakeButton) {
        emergencyBrakeButton.addEventListener('click', async () => {
            console.log('EMERGENCY STOP button clicked');
            await activateEmergencyBrakes();
        });
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    keepReading = false;
    if (reader) reader.cancel();
    if (writer) writer.releaseLock();
    if (port) port.close();
});
