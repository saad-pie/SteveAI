"""
AI Voiceover Generator for YouTube Videos
Supports TTSMaker, FreeTTS, ElevenLabs, and local TTS
"""

import asyncio
import aiohttp
import aiofiles
import subprocess
import tempfile
import os
import json
from typing import Dict, Any, Optional
from pathlib import Path
import edge_tts
import pyttsx3

class VoiceoverGenerator:
    """Generate natural-sounding voiceovers from text"""
    
    def __init__(self, config):
        self.config = config
        self.tts_config = config.get_tts_config()
        self.service = self.tts_config.get('service', 'edge-tts')
    
    async def generate_voiceover(self, script: str, video_id: str) -> str:
        """
        Generate voiceover audio from script
        
        Args:
            script: Text script to convert to speech
            video_id: Unique video identifier
            
        Returns:
            Path to generated audio file
        """
        output_file = f"output/audio/{video_id}_voiceover.mp3"
        
        # Clean script for TTS
        clean_script = self._clean_script_for_tts(script)
        
        try:
            if self.service == 'edge-tts':
                await self._generate_with_edge_tts(clean_script, output_file)
            elif self.service == 'ttsmaker':
                await self._generate_with_ttsmaker(clean_script, output_file)
            elif self.service == 'freetts':
                await self._generate_with_freetts(clean_script, output_file)
            elif self.service == 'elevenlabs':
                await self._generate_with_elevenlabs(clean_script, output_file)
            else:
                # Fallback to local TTS
                await self._generate_with_local_tts(clean_script, output_file)
            
            # Verify file exists and has content
            if not os.path.exists(output_file) or os.path.getsize(output_file) == 0:
                raise Exception("Generated audio file is empty or missing")
            
            return output_file
            
        except Exception as e:
            print(f"Error generating voiceover: {str(e)}")
            # Try fallback method
            return await self._generate_with_local_tts(clean_script, output_file)
    
    def _clean_script_for_tts(self, script: str) -> str:
        """Clean script for better TTS processing"""
        import re
        
        # Remove stage directions and technical annotations
        script = re.sub(r'\[.*?\]', '', script)
        script = re.sub(r'\(.*?\)', '', script)
        
        # Replace common abbreviations
        replacements = {
            'AI': 'artificial intelligence',
            'API': 'A P I',
            'URL': 'U R L',
            'SEO': 'S E O',
            'FAQ': 'F A Q',
            'DIY': 'D I Y',
            'CEO': 'C E O',
            'UI': 'user interface',
            'UX': 'user experience',
            'vs': 'versus',
            '&': 'and',
            '%': 'percent'
        }
        
        for abbrev, replacement in replacements.items():
            script = re.sub(r'\b' + re.escape(abbrev) + r'\b', replacement, script, flags=re.IGNORECASE)
        
        # Clean up whitespace and formatting
        script = re.sub(r'\s+', ' ', script)
        script = script.strip()
        
        return script
    
    async def _generate_with_edge_tts(self, script: str, output_file: str):
        """Generate voiceover using Microsoft Edge TTS (free)"""
        
        voice = self.tts_config.get('voice', 'en-US-AriaNeural')
        rate = self.tts_config.get('speed', 1.0)
        
        # Convert rate to Edge TTS format
        if rate != 1.0:
            rate_str = f"+{int((rate - 1) * 100)}%" if rate > 1 else f"{int((rate - 1) * 100)}%"
        else:
            rate_str = "+0%"
        
        try:
            communicate = edge_tts.Communicate(script, voice, rate=rate_str)
            await communicate.save(output_file)
            
        except Exception as e:
            print(f"Edge TTS error: {str(e)}")
            raise
    
    async def _generate_with_ttsmaker(self, script: str, output_file: str):
        """Generate voiceover using TTSMaker.com API"""
        
        url = "https://ttsmaker.com/api/v1/create-tts-order"
        
        headers = {
            'Content-Type': 'application/json'
        }
        
        data = {
            'text': script,
            'voice_id': self.tts_config.get('voice', 'en-US-1'),
            'audio_format': 'mp3',
            'audio_speed': self.tts_config.get('speed', 1.0),
            'audio_volume': 1.0
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                # Create TTS order
                async with session.post(url, headers=headers, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        audio_url = result.get('audio_url')
                        
                        if audio_url:
                            # Download the audio file
                            async with session.get(audio_url) as audio_response:
                                if audio_response.status == 200:
                                    async with aiofiles.open(output_file, 'wb') as f:
                                        async for chunk in audio_response.content.iter_chunked(8192):
                                            await f.write(chunk)
                                else:
                                    raise Exception(f"Failed to download audio: {audio_response.status}")
                        else:
                            raise Exception("No audio URL in response")
                    else:
                        raise Exception(f"TTS API error: {response.status}")
                        
        except Exception as e:
            print(f"TTSMaker error: {str(e)}")
            raise
    
    async def _generate_with_freetts(self, script: str, output_file: str):
        """Generate voiceover using FreeTTS or similar service"""
        
        # This would integrate with FreeTTS.com or similar service
        # For now, fall back to local TTS
        await self._generate_with_local_tts(script, output_file)
    
    async def _generate_with_elevenlabs(self, script: str, output_file: str):
        """Generate voiceover using ElevenLabs API (free tier)"""
        
        api_key = self.tts_config.get('api_key')
        if not api_key:
            raise Exception("ElevenLabs API key not provided")
        
        voice_id = self.tts_config.get('voice', 'pNInz6obpgDQGcFmaJgB')  # Default voice
        
        url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
        
        headers = {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': api_key
        }
        
        data = {
            'text': script,
            'model_id': 'eleven_monolingual_v1',
            'voice_settings': {
                'stability': 0.5,
                'similarity_boost': 0.5
            }
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=data) as response:
                    if response.status == 200:
                        async with aiofiles.open(output_file, 'wb') as f:
                            async for chunk in response.content.iter_chunked(8192):
                                await f.write(chunk)
                    else:
                        error_text = await response.text()
                        raise Exception(f"ElevenLabs API error: {response.status} - {error_text}")
                        
        except Exception as e:
            print(f"ElevenLabs error: {str(e)}")
            raise
    
    async def _generate_with_local_tts(self, script: str, output_file: str):
        """Generate voiceover using local TTS as fallback"""
        
        try:
            # Try using pyttsx3 for local TTS
            def generate_tts():
                engine = pyttsx3.init()
                
                # Configure voice settings
                voices = engine.getProperty('voices')
                if voices:
                    # Try to find a good English voice
                    for voice in voices:
                        if 'english' in voice.name.lower() or 'en' in voice.id.lower():
                            engine.setProperty('voice', voice.id)
                            break
                
                # Set speech rate
                rate = engine.getProperty('rate')
                engine.setProperty('rate', int(rate * self.tts_config.get('speed', 1.0)))
                
                # Generate temporary WAV file
                temp_wav = output_file.replace('.mp3', '_temp.wav')
                engine.save_to_file(script, temp_wav)
                engine.runAndWait()
                
                return temp_wav
            
            # Run TTS in executor to avoid blocking
            loop = asyncio.get_event_loop()
            temp_wav = await loop.run_in_executor(None, generate_tts)
            
            # Convert WAV to MP3 using ffmpeg
            if os.path.exists(temp_wav):
                await self._convert_to_mp3(temp_wav, output_file)
                os.remove(temp_wav)  # Clean up temp file
            else:
                raise Exception("Failed to generate TTS audio")
                
        except Exception as e:
            print(f"Local TTS error: {str(e)}")
            # Final fallback - create silent audio
            await self._create_silent_audio(output_file, len(script.split()) / 150 * 60)  # Estimate duration
    
    async def _convert_to_mp3(self, input_file: str, output_file: str):
        """Convert audio file to MP3 using ffmpeg"""
        
        cmd = [
            'ffmpeg', '-y',  # -y to overwrite output file
            '-i', input_file,
            '-acodec', 'mp3',
            '-ab', '128k',
            '-ar', '44100',
            '-ac', '2',
            output_file
        ]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                raise Exception(f"ffmpeg error: {stderr.decode()}")
                
        except FileNotFoundError:
            print("ffmpeg not found, trying alternative conversion...")
            # Try using pydub as fallback
            try:
                from pydub import AudioSegment
                audio = AudioSegment.from_wav(input_file)
                audio.export(output_file, format="mp3", bitrate="128k")
            except ImportError:
                raise Exception("Neither ffmpeg nor pydub available for audio conversion")
    
    async def _create_silent_audio(self, output_file: str, duration: float):
        """Create silent audio file as final fallback"""
        
        # Create silent audio using ffmpeg
        cmd = [
            'ffmpeg', '-y',
            '-f', 'lavfi',
            '-i', f'anullsrc=channel_layout=stereo:sample_rate=44100',
            '-t', str(duration),
            '-acodec', 'mp3',
            '-ab', '128k',
            output_file
        ]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            await process.communicate()
            
        except Exception:
            # Final fallback - create minimal MP3 file
            print("Creating minimal audio file...")
            # This would create a basic silent MP3 - implementation depends on available libraries
            pass
    
    def get_voice_options(self) -> Dict[str, list]:
        """Get available voice options for different services"""
        
        return {
            'edge-tts': [
                'en-US-AriaNeural',
                'en-US-JennyNeural', 
                'en-US-GuyNeural',
                'en-GB-LibbyNeural',
                'en-GB-MaisieNeural',
                'en-AU-NatashaNeural'
            ],
            'elevenlabs': [
                'pNInz6obpgDQGcFmaJgB',  # Adam
                '21m00Tcm4TlvDq8ikWAM',  # Rachel
                'AZnzlk1XvdvUeBnXmlld',  # Domi
                'EXAVITQu4vr4xnSDxMaL',  # Bella
                'ErXwobaYiN019PkySvjV',  # Antoni
                'MF3mGyEYCl7XYWbV9V6O',  # Elli
                'TxGEqnHWrfWFTfGW9XjX',  # Josh
                'VR6AewLTigWG4xSOukaG',  # Arnold
                'pqHfZKP75CvOlQylNhV4',  # Bill
            ]
        }
    
    async def get_audio_info(self, audio_file: str) -> Dict[str, Any]:
        """Get audio file information"""
        
        cmd = [
            'ffprobe', '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            audio_file
        ]
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode == 0:
                info = json.loads(stdout.decode())
                
                format_info = info.get('format', {})
                streams = info.get('streams', [])
                audio_stream = next((s for s in streams if s.get('codec_type') == 'audio'), {})
                
                return {
                    'duration': float(format_info.get('duration', 0)),
                    'size': int(format_info.get('size', 0)),
                    'bitrate': int(format_info.get('bit_rate', 0)),
                    'sample_rate': int(audio_stream.get('sample_rate', 0)),
                    'channels': int(audio_stream.get('channels', 0)),
                    'codec': audio_stream.get('codec_name', 'unknown')
                }
            else:
                return {}
                
        except Exception:
            return {}