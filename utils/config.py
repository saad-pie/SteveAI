"""
Configuration management for YouTube Automation System
"""

import json
import os
from pathlib import Path
from typing import Dict, Any

class Config:
    """Configuration manager for the automation system"""
    
    def __init__(self, config_path: str = "config/config.json"):
        self.config_path = config_path
        self.config = self._load_config()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load configuration from JSON file"""
        config_file = Path(self.config_path)
        
        if not config_file.exists():
            # Create default config if it doesn't exist
            self._create_default_config()
        
        with open(config_file, 'r') as f:
            config = json.load(f)
        
        # Override with environment variables if they exist
        self._load_env_overrides(config)
        
        return config
    
    def _create_default_config(self):
        """Create default configuration file"""
        default_config = {
            "openai": {
                "api_key": "",
                "model": "gpt-3.5-turbo",
                "max_tokens": 2000
            },
            "tts": {
                "service": "ttsmaker",  # ttsmaker, freetts, elevenlabs
                "voice": "en-US-1",
                "speed": 1.0,
                "api_key": ""
            },
            "video": {
                "resolution": "1920x1080",
                "fps": 30,
                "duration_padding": 5,
                "background_music": true,
                "auto_captions": true
            },
            "thumbnail": {
                "width": 1280,
                "height": 720,
                "style": "youtube",
                "ai_service": "bing_dalle"  # bing_dalle, hotpot, canva
            },
            "youtube": {
                "client_secrets_file": "config/client_secrets.json",
                "oauth2_storage_file": "config/oauth2_credentials.json",
                "default_privacy": "private",  # private, unlisted, public
                "default_category": "28"  # Science & Technology
            },
            "automation": {
                "batch_delay": 30,  # seconds between operations
                "max_retries": 3,
                "cleanup_temp": true
            },
            "analytics": {
                "track_keywords": true,
                "social_blade_api": "",
                "update_interval": 3600  # seconds
            },
            "stock_footage": {
                "pixabay_api": "",
                "pexels_api": "",
                "unsplash_api": ""
            }
        }
        
        # Create config directory
        Path("config").mkdir(exist_ok=True)
        
        with open(self.config_path, 'w') as f:
            json.dump(default_config, f, indent=2)
    
    def _load_env_overrides(self, config: Dict[str, Any]):
        """Load environment variable overrides"""
        env_mappings = {
            "OPENAI_API_KEY": ["openai", "api_key"],
            "ELEVENLABS_API_KEY": ["tts", "api_key"],
            "PIXABAY_API_KEY": ["stock_footage", "pixabay_api"],
            "PEXELS_API_KEY": ["stock_footage", "pexels_api"],
            "UNSPLASH_API_KEY": ["stock_footage", "unsplash_api"],
            "SOCIAL_BLADE_API": ["analytics", "social_blade_api"],
        }
        
        for env_var, config_path in env_mappings.items():
            value = os.getenv(env_var)
            if value:
                current = config
                for key in config_path[:-1]:
                    current = current[key]
                current[config_path[-1]] = value
    
    def get(self, *keys) -> Any:
        """Get configuration value by nested keys"""
        current = self.config
        for key in keys:
            if isinstance(current, dict) and key in current:
                current = current[key]
            else:
                return None
        return current
    
    def set(self, value: Any, *keys):
        """Set configuration value by nested keys"""
        current = self.config
        for key in keys[:-1]:
            if key not in current:
                current[key] = {}
            current = current[key]
        current[keys[-1]] = value
    
    def save(self):
        """Save current configuration to file"""
        with open(self.config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def get_openai_config(self) -> Dict[str, Any]:
        """Get OpenAI configuration"""
        return self.get("openai") or {}
    
    def get_tts_config(self) -> Dict[str, Any]:
        """Get TTS configuration"""
        return self.get("tts") or {}
    
    def get_video_config(self) -> Dict[str, Any]:
        """Get video configuration"""
        return self.get("video") or {}
    
    def get_youtube_config(self) -> Dict[str, Any]:
        """Get YouTube configuration"""
        return self.get("youtube") or {}
    
    def get_thumbnail_config(self) -> Dict[str, Any]:
        """Get thumbnail configuration"""
        return self.get("thumbnail") or {}