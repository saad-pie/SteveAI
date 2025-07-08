#!/usr/bin/env python3
"""
🎬💡 AI-Powered YouTube Automation System
Main orchestration script for fully automated YouTube content workflow
"""

import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

from modules.script_generator import ScriptGenerator
from modules.voiceover_generator import VoiceoverGenerator  
from modules.video_creator import VideoCreator
from modules.thumbnail_generator import ThumbnailGenerator
from modules.metadata_generator import MetadataGenerator
from modules.uploader import YouTubeUploader
from modules.analytics_tracker import AnalyticsTracker
from utils.config import Config
from utils.logger import setup_logger

class YouTubeAutomation:
    """Main automation orchestrator"""
    
    def __init__(self, config_path: str = "config/config.json"):
        """Initialize the automation system"""
        self.config = Config(config_path)
        self.logger = setup_logger("youtube_automation")
        
        # Initialize modules
        self.script_generator = ScriptGenerator(self.config)
        self.voiceover_generator = VoiceoverGenerator(self.config)
        self.video_creator = VideoCreator(self.config)
        self.thumbnail_generator = ThumbnailGenerator(self.config)
        self.metadata_generator = MetadataGenerator(self.config)
        self.uploader = YouTubeUploader(self.config)
        self.analytics_tracker = AnalyticsTracker(self.config)
        
        # Create output directories
        self._create_directories()
    
    def _create_directories(self):
        """Create necessary output directories"""
        directories = [
            "output/scripts",
            "output/audio", 
            "output/videos",
            "output/thumbnails",
            "output/metadata",
            "logs",
            "temp"
        ]
        
        for directory in directories:
            Path(directory).mkdir(parents=True, exist_ok=True)
    
    async def create_video(self, topic: str, target_audience: str, tone: str = "engaging") -> Dict[str, Any]:
        """
        Create a complete video from topic to upload
        
        Args:
            topic: Video topic/subject
            target_audience: Target audience description
            tone: Video tone (engaging/educational/funny)
            
        Returns:
            Dictionary containing all created assets and metadata
        """
        self.logger.info(f"🚀 Starting video creation for topic: {topic}")
        
        # Generate unique video ID
        video_id = f"video_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        try:
            # Step 1: Generate Script
            self.logger.info("✍️ Generating script...")
            script_data = await self.script_generator.generate_script(
                topic=topic,
                audience=target_audience,
                tone=tone,
                video_id=video_id
            )
            
            # Step 2: Generate Voiceover
            self.logger.info("🔊 Generating voiceover...")
            audio_file = await self.voiceover_generator.generate_voiceover(
                script=script_data['script'],
                video_id=video_id
            )
            
            # Step 3: Create Video
            self.logger.info("🎬 Creating video...")
            video_file = await self.video_creator.create_video(
                script=script_data['script'],
                audio_file=audio_file,
                topic=topic,
                video_id=video_id
            )
            
            # Step 4: Generate Thumbnail  
            self.logger.info("🖼️ Generating thumbnail...")
            thumbnail_file = await self.thumbnail_generator.generate_thumbnail(
                topic=topic,
                script=script_data['script'],
                video_id=video_id
            )
            
            # Step 5: Generate Metadata
            self.logger.info("📝 Generating metadata...")
            metadata = await self.metadata_generator.generate_metadata(
                topic=topic,
                script=script_data['script'],
                video_id=video_id
            )
            
            # Compile all assets
            video_assets = {
                'video_id': video_id,
                'topic': topic,
                'script': script_data,
                'audio_file': audio_file,
                'video_file': video_file,
                'thumbnail_file': thumbnail_file,
                'metadata': metadata,
                'created_at': datetime.now().isoformat(),
                'status': 'ready_for_upload'
            }
            
            # Save video data
            self._save_video_data(video_assets)
            
            self.logger.info(f"✅ Video creation completed: {video_id}")
            return video_assets
            
        except Exception as e:
            self.logger.error(f"❌ Error creating video: {str(e)}")
            raise
    
    async def upload_video(self, video_assets: Dict[str, Any], schedule_time: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Upload video to YouTube
        
        Args:
            video_assets: Video assets from create_video()
            schedule_time: Optional schedule time for upload
            
        Returns:
            Upload result with video URL and analytics
        """
        self.logger.info(f"📤 Uploading video: {video_assets['video_id']}")
        
        try:
            upload_result = await self.uploader.upload_video(
                video_file=video_assets['video_file'],
                thumbnail_file=video_assets['thumbnail_file'],
                metadata=video_assets['metadata'],
                schedule_time=schedule_time
            )
            
            # Update video data with upload info
            video_assets.update({
                'upload_result': upload_result,
                'status': 'uploaded',
                'uploaded_at': datetime.now().isoformat()
            })
            
            self._save_video_data(video_assets)
            
            self.logger.info(f"✅ Video uploaded successfully: {upload_result.get('video_url', 'N/A')}")
            return upload_result
            
        except Exception as e:
            self.logger.error(f"❌ Error uploading video: {str(e)}")
            raise
    
    async def full_automation_workflow(self, video_ideas: list, schedule_hours_apart: int = 24) -> list:
        """
        Complete automation workflow for multiple videos
        
        Args:
            video_ideas: List of video idea dictionaries
            schedule_hours_apart: Hours between scheduled uploads
            
        Returns:
            List of processed video results
        """
        self.logger.info(f"🔄 Starting full automation workflow for {len(video_ideas)} videos")
        
        results = []
        base_schedule_time = datetime.now() + timedelta(hours=1)  # Start 1 hour from now
        
        for i, idea in enumerate(video_ideas):
            try:
                # Create video
                video_assets = await self.create_video(
                    topic=idea['topic'],
                    target_audience=idea.get('audience', 'general'),
                    tone=idea.get('tone', 'engaging')
                )
                
                # Calculate schedule time
                schedule_time = base_schedule_time + timedelta(hours=i * schedule_hours_apart)
                
                # Upload video (scheduled)
                upload_result = await self.upload_video(video_assets, schedule_time)
                
                results.append({
                    'video_assets': video_assets,
                    'upload_result': upload_result,
                    'scheduled_for': schedule_time.isoformat()
                })
                
                self.logger.info(f"✅ Processed video {i+1}/{len(video_ideas)}")
                
                # Brief pause between videos
                await asyncio.sleep(2)
                
            except Exception as e:
                self.logger.error(f"❌ Error processing video {i+1}: {str(e)}")
                results.append({
                    'error': str(e),
                    'video_idea': idea
                })
        
        self.logger.info(f"🏁 Workflow completed. {len([r for r in results if 'error' not in r])}/{len(video_ideas)} videos processed successfully")
        return results
    
    def _save_video_data(self, video_assets: Dict[str, Any]):
        """Save video data to JSON file"""
        output_file = f"output/metadata/{video_assets['video_id']}_data.json"
        
        with open(output_file, 'w') as f:
            json.dump(video_assets, f, indent=2, default=str)
    
    async def get_analytics_report(self, days: int = 30) -> Dict[str, Any]:
        """Get analytics report for recent videos"""
        return await self.analytics_tracker.get_channel_analytics(days)

async def main():
    """Main entry point"""
    automation = YouTubeAutomation()
    
    # Example usage
    if len(sys.argv) > 1:
        if sys.argv[1] == "single":
            # Create single video
            result = await automation.create_video(
                topic="10 AI Tools That Will Change Your Life in 2024",
                target_audience="tech enthusiasts and entrepreneurs",
                tone="engaging"
            )
            print(f"✅ Video created: {result['video_id']}")
            
        elif sys.argv[1] == "batch":
            # Batch process multiple videos
            video_ideas = [
                {
                    "topic": "5 Free AI Tools for Content Creation", 
                    "audience": "content creators",
                    "tone": "engaging"
                },
                {
                    "topic": "How to Automate Your YouTube Channel with AI",
                    "audience": "YouTubers", 
                    "tone": "educational"
                },
                {
                    "topic": "AI vs Humans: Who Creates Better Content?",
                    "audience": "general tech audience",
                    "tone": "funny"
                }
            ]
            
            results = await automation.full_automation_workflow(video_ideas)
            print(f"✅ Processed {len(results)} videos")
            
        elif sys.argv[1] == "analytics":
            # Get analytics report
            report = await automation.get_analytics_report(30)
            print("📊 Analytics Report:")
            print(json.dumps(report, indent=2))
    
    else:
        print("🎬 YouTube Automation System")
        print("Usage:")
        print("  python main.py single    - Create single video")
        print("  python main.py batch     - Process multiple videos")
        print("  python main.py analytics - Get analytics report")

if __name__ == "__main__":
    asyncio.run(main())