import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Power, Lightbulb, Thermometer, Shield, Home } from 'lucide-react';

interface Command {
  id: string;
  text: string;
  timestamp: Date;
  action: string;
  device?: string;
  value?: string;
}

interface Device {
  id: string;
  name: string;
  type: 'light' | 'temperature' | 'security' | 'power';
  status: boolean;
  value?: number;
  icon: React.ReactNode;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionError extends Event {
  error: string;
  message: string;
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const SpeechRecognition: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [commands, setCommands] = useState<Command[]>([]);
  const [devices, setDevices] = useState<Device[]>([
    { id: '1', name: 'Living Room Light', type: 'light', status: false, icon: <Lightbulb className="w-5 h-5" /> },
    { id: '2', name: 'Bedroom Light', type: 'light', status: false, icon: <Lightbulb className="w-5 h-5" /> },
    { id: '3', name: 'Thermostat', type: 'temperature', status: true, value: 22, icon: <Thermometer className="w-5 h-5" /> },
    { id: '4', name: 'Security System', type: 'security', status: true, icon: <Shield className="w-5 h-5" /> },
    { id: '5', name: 'Main Power', type: 'power', status: true, icon: <Power className="w-5 h-5" /> },
  ]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      setIsSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscript(finalTranscript);
          processCommand(finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event: SpeechRecognitionError) => {
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setAudioLevel(0);
      };
    } else {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const processCommand = (commandText: string) => {
    const lowerCommand = commandText.toLowerCase();
    let action = 'Unknown';
    let device = '';
    let value = '';

    // Light commands
    if (lowerCommand.includes('turn on') && lowerCommand.includes('light')) {
      action = 'Turn On';
      if (lowerCommand.includes('living room')) {
        device = 'Living Room Light';
        updateDeviceStatus('1', true);
      } else if (lowerCommand.includes('bedroom')) {
        device = 'Bedroom Light';
        updateDeviceStatus('2', true);
      }
    } else if (lowerCommand.includes('turn off') && lowerCommand.includes('light')) {
      action = 'Turn Off';
      if (lowerCommand.includes('living room')) {
        device = 'Living Room Light';
        updateDeviceStatus('1', false);
      } else if (lowerCommand.includes('bedroom')) {
        device = 'Bedroom Light';
        updateDeviceStatus('2', false);
      }
    }
    // Temperature commands
    else if (lowerCommand.includes('set temperature')) {
      action = 'Set Temperature';
      device = 'Thermostat';
      const tempMatch = lowerCommand.match(/(\d+)/);
      if (tempMatch) {
        value = tempMatch[1] + '°C';
        updateDeviceValue('3', parseInt(tempMatch[1]));
      }
    }
    // Security commands
    else if (lowerCommand.includes('arm security') || lowerCommand.includes('enable security')) {
      action = 'Arm Security';
      device = 'Security System';
      updateDeviceStatus('4', true);
    } else if (lowerCommand.includes('disarm security') || lowerCommand.includes('disable security')) {
      action = 'Disarm Security';
      device = 'Security System';
      updateDeviceStatus('4', false);
    }
    // Power commands
    else if (lowerCommand.includes('power on') || lowerCommand.includes('turn on power')) {
      action = 'Power On';
      device = 'Main Power';
      updateDeviceStatus('5', true);
    } else if (lowerCommand.includes('power off') || lowerCommand.includes('turn off power')) {
      action = 'Power Off';
      device = 'Main Power';
      updateDeviceStatus('5', false);
    }

    const newCommand: Command = {
      id: Date.now().toString(),
      text: commandText,
      timestamp: new Date(),
      action,
      device,
      value,
    };

    setCommands(prev => [newCommand, ...prev.slice(0, 9)]);
  };

  const updateDeviceStatus = (id: string, status: boolean) => {
    setDevices(prev => prev.map(device => 
      device.id === id ? { ...device, status } : device
    ));
  };

  const updateDeviceValue = (id: string, value: number) => {
    setDevices(prev => prev.map(device => 
      device.id === id ? { ...device, value } : device
    ));
  };

  const startListening = async () => {
    if (!recognitionRef.current) return;

    try {
      // Request microphone access for audio visualization
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(analyserRef.current);
      analyserRef.current.fftSize = 256;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateAudioLevel = () => {
        if (analyserRef.current && isListening) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(Math.min(average / 128, 1));
          animationRef.current = requestAnimationFrame(updateAudioLevel);
        }
      };

      recognitionRef.current.start();
      setIsListening(true);
      setError(null);
      updateAudioLevel();
    } catch (err) {
      setError('Microphone access denied');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsListening(false);
    setAudioLevel(0);
  };

  const getDeviceStatusColor = (device: Device) => {
    if (device.type === 'security') {
      return device.status ? 'bg-red-500' : 'bg-gray-500';
    }
    return device.status ? 'bg-green-500' : 'bg-gray-500';
  };

  const getDeviceStatusText = (device: Device) => {
    switch (device.type) {
      case 'light':
        return device.status ? 'On' : 'Off';
      case 'temperature':
        return `${device.value}°C`;
      case 'security':
        return device.status ? 'Armed' : 'Disarmed';
      case 'power':
        return device.status ? 'On' : 'Off';
      default:
        return 'Unknown';
    }
  };

  if (!isSupported) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="text-center">
            <VolumeX className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Not Supported</h2>
            <p className="text-gray-300">
              Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Home className="w-8 h-8 text-blue-500 mr-3" />
            <h1 className="text-4xl font-bold">Smart Home Control</h1>
          </div>
          <p className="text-gray-400">Voice-controlled device management system</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Voice Control Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
              <h2 className="text-2xl font-bold mb-6 text-center">Voice Control</h2>
              
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <button
                    onClick={isListening ? stopListening : startListening}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 ${
                      isListening 
                        ? 'bg-red-500 hover:bg-red-600 scale-110' 
                        : 'bg-blue-500 hover:bg-blue-600'
                    }`}
                  >
                    {isListening ? (
                      <MicOff className="w-10 h-10" />
                    ) : (
                      <Mic className="w-10 h-10" />
                    )}
                  </button>
                  
                  {isListening && (
                    <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-pulse">
                      <div 
                        className="absolute inset-0 rounded-full bg-red-500 opacity-30"
                        style={{
                          transform: `scale(${1 + audioLevel * 0.3})`,
                          transition: 'transform 0.1s ease-out'
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="text-center">
                  <p className="text-lg font-semibold mb-2">
                    {isListening ? 'Listening...' : 'Click to start'}
                  </p>
                  <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-500 transition-all duration-100"
                      style={{ width: `${audioLevel * 100}%` }}
                    />
                  </div>
                </div>

                {error && (
                  <div className="bg-red-900 text-red-200 p-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="w-full">
                  <h3 className="font-semibold mb-2">Sample Commands:</h3>
                  <div className="space-y-1 text-sm text-gray-300">
                    <p>• "Turn on living room light"</p>
                    <p>• "Set temperature to 24"</p>
                    <p>• "Arm security system"</p>
                    <p>• "Turn off bedroom light"</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Device Status Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
              <h2 className="text-2xl font-bold mb-6 text-center">Device Status</h2>
              
              <div className="space-y-4">
                {devices.map((device) => (
                  <div key={device.id} className="bg-gray-700 rounded-lg p-4 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="text-gray-300">
                        {device.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold">{device.name}</h3>
                        <p className="text-sm text-gray-400">{device.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">
                        {getDeviceStatusText(device)}
                      </span>
                      <div className={`w-3 h-3 rounded-full ${getDeviceStatusColor(device)}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Command History Panel */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 shadow-xl">
              <h2 className="text-2xl font-bold mb-6 text-center">Command History</h2>
              
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {commands.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No commands yet</p>
                ) : (
                  commands.map((command) => (
                    <div key={command.id} className="bg-gray-700 rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-blue-400">{command.action}</span>
                        <span className="text-xs text-gray-400">
                          {command.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-300 mb-1">"{command.text}"</p>
                      {command.device && (
                        <p className="text-xs text-gray-400">
                          Device: {command.device}
                          {command.value && ` (${command.value})`}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* System Architecture Info */}
        <div className="mt-8 bg-gray-800 rounded-lg p-6 shadow-xl">
          <h2 className="text-2xl font-bold mb-4 text-center">System Architecture</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div className="bg-gray-700 rounded-lg p-4">
              <Volume2 className="w-8 h-8 text-blue-500 mx-auto mb-2" />
              <h3 className="font-semibold mb-2">Speech Recognition</h3>
              <p className="text-sm text-gray-300">Web Speech API captures and processes voice commands</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <Home className="w-8 h-8 text-green-500 mx-auto mb-2" />
              <h3 className="font-semibold mb-2">Command Processing</h3>
              <p className="text-sm text-gray-300">Natural language processing interprets user intent</p>
            </div>
            <div className="bg-gray-700 rounded-lg p-4">
              <Power className="w-8 h-8 text-purple-500 mx-auto mb-2" />
              <h3 className="font-semibold mb-2">Device Control</h3>
              <p className="text-sm text-gray-300">Commands sent to embedded boards via IoT protocols</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeechRecognition;