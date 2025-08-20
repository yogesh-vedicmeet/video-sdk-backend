import { config } from "./config";

// LiveKit Configuration for Self-Hosted Server
export const LIVEKIT_CONFIG = {
  // Self-hosted server URL
  SERVER_URL: config.livekitUrl,
  
  // API Keys (from your self-hosted server)
  API_KEY: config.livekitApiKey,
  API_SECRET: config.livekitApiSecret,
  
  // Connection options
  CONNECTION_OPTIONS: {
    autoSubscribe: true,
    adaptiveStream: true,
    dynacast: true,
    stopLocalTrackOnUnpublish: true,
  },
  
  // Room options
  ROOM_OPTIONS: {
    adaptiveStream: true,
    dynacast: true,
    stopLocalTrackOnUnpublish: true,
  },
  
  // Default room settings
  DEFAULT_ROOM_SETTINGS: {
    maxParticipants: 20,
    emptyTimeout: 10 * 60, // 10 minutes
    maxMetadataSize: 1024,
  },
  
  // Video/audio settings
  MEDIA_SETTINGS: {
    video: {
      width: 1280,
      height: 720,
      frameRate: 30,
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },
};

// Environment-specific configuration
export const getLiveKitConfig = () => {
  const isDevelopment = true;
  
  return {
    ...LIVEKIT_CONFIG,
    SERVER_URL: isDevelopment 
      ? 'ws://localhost:7880' 
      : 'wss://your-production-domain.com', // Update for production
  };
};

