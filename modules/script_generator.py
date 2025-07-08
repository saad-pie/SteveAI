"""
AI Script Generator for YouTube Videos
Supports OpenAI GPT and free alternatives
"""

import asyncio
import aiohttp
import json
import re
from typing import Dict, Any, List
from pathlib import Path

class ScriptGenerator:
    """Generate engaging YouTube scripts using AI"""
    
    def __init__(self, config):
        self.config = config
        self.openai_config = config.get_openai_config()
    
    async def generate_script(self, topic: str, audience: str, tone: str, video_id: str) -> Dict[str, Any]:
        """
        Generate a complete YouTube script
        
        Args:
            topic: Video topic
            audience: Target audience
            tone: Video tone (engaging/educational/funny)
            video_id: Unique video identifier
            
        Returns:
            Dictionary containing script and metadata
        """
        # Create script prompt
        prompt = self._create_script_prompt(topic, audience, tone)
        
        # Try OpenAI first, then fall back to free alternatives
        script_content = await self._generate_with_openai(prompt)
        
        if not script_content:
            script_content = await self._generate_with_free_api(prompt)
        
        if not script_content:
            # Fallback to template-based generation
            script_content = self._generate_fallback_script(topic, audience, tone)
        
        # Process and structure the script
        structured_script = self._structure_script(script_content, topic)
        
        # Save script to file
        script_file = f"output/scripts/{video_id}_script.txt"
        with open(script_file, 'w', encoding='utf-8') as f:
            f.write(script_content)
        
        return {
            'script': script_content,
            'structured': structured_script,
            'file_path': script_file,
            'word_count': len(script_content.split()),
            'estimated_duration': self._estimate_duration(script_content),
            'topic': topic,
            'audience': audience,
            'tone': tone
        }
    
    def _create_script_prompt(self, topic: str, audience: str, tone: str) -> str:
        """Create an optimized prompt for script generation"""
        
        tone_instructions = {
            'engaging': 'Use an enthusiastic, captivating tone with strong hooks and emotional appeals.',
            'educational': 'Use a clear, informative tone with step-by-step explanations and examples.',
            'funny': 'Use humor, jokes, and entertaining elements while keeping the content informative.'
        }
        
        prompt = f"""
Write a compelling YouTube video script about "{topic}" for {audience}.

REQUIREMENTS:
- Tone: {tone_instructions.get(tone, 'engaging')}
- Duration: 8-12 minutes (1200-1800 words)
- Include a strong hook in the first 15 seconds
- Structure with clear sections and transitions
- Include call-to-action at the end
- Optimize for YouTube retention and engagement

SCRIPT STRUCTURE:
1. HOOK (0-15 seconds): Grab attention immediately
2. INTRODUCTION (15-30 seconds): What viewers will learn
3. MAIN CONTENT (6-10 minutes): Core information with 3-5 key points
4. CONCLUSION (1-2 minutes): Summary and call-to-action

ENGAGEMENT ELEMENTS:
- Ask questions to viewers
- Use "you" language 
- Include surprising facts or statistics
- Add pattern interrupts every 30-60 seconds
- Use power words and emotional triggers

TARGET AUDIENCE: {audience}
TOPIC FOCUS: {topic}

Write the complete script now:
"""
        return prompt
    
    async def _generate_with_openai(self, prompt: str) -> str:
        """Generate script using OpenAI API"""
        api_key = self.openai_config.get('api_key')
        if not api_key:
            return ""
        
        try:
            headers = {
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json'
            }
            
            data = {
                'model': self.openai_config.get('model', 'gpt-3.5-turbo'),
                'messages': [
                    {'role': 'system', 'content': 'You are a professional YouTube script writer who creates engaging, SEO-optimized content.'},
                    {'role': 'user', 'content': prompt}
                ],
                'max_tokens': self.openai_config.get('max_tokens', 2000),
                'temperature': 0.7
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    'https://api.openai.com/v1/chat/completions',
                    headers=headers,
                    json=data
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return result['choices'][0]['message']['content'].strip()
                    else:
                        print(f"OpenAI API error: {response.status}")
                        return ""
        
        except Exception as e:
            print(f"Error with OpenAI API: {str(e)}")
            return ""
    
    async def _generate_with_free_api(self, prompt: str) -> str:
        """Generate script using free alternatives (Hugging Face, etc.)"""
        
        # Try Hugging Face Inference API (free tier)
        try:
            headers = {
                'Content-Type': 'application/json'
            }
            
            # Use a free model for text generation
            data = {
                'inputs': prompt,
                'parameters': {
                    'max_length': 1500,
                    'temperature': 0.7,
                    'do_sample': True
                }
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    'https://api-inference.huggingface.co/models/gpt2-large',
                    headers=headers,
                    json=data
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        if isinstance(result, list) and len(result) > 0:
                            return result[0].get('generated_text', '').strip()
                    
        except Exception as e:
            print(f"Error with free API: {str(e)}")
        
        return ""
    
    def _generate_fallback_script(self, topic: str, audience: str, tone: str) -> str:
        """Generate a basic script using templates as fallback"""
        
        hooks = [
            f"What if I told you that {topic.lower()} could completely change your life?",
            f"You won't believe what I discovered about {topic.lower()}...",
            f"Everyone is talking about {topic.lower()}, but here's what they're missing...",
            f"In the next few minutes, I'm going to show you everything about {topic.lower()}..."
        ]
        
        conclusions = [
            "If you found this video helpful, make sure to like and subscribe for more content like this!",
            "What do you think about this? Let me know in the comments below!",
            "Thanks for watching! Don't forget to hit that notification bell so you never miss our latest videos!"
        ]
        
        script = f"""
{hooks[0]}

Hey everyone! Welcome back to the channel. Today we're diving deep into {topic}, and I promise you're going to learn something that will benefit {audience} like yourself.

Here's what we'll cover in today's video:
- The fundamentals of {topic}
- Why this matters for {audience}
- Practical tips you can implement today
- Common mistakes to avoid
- My personal recommendations

Let's get started!

[MAIN CONTENT SECTION]

First, let's talk about what {topic} really means. For {audience}, this is particularly important because...

[Continue with 3-5 main points about the topic]

Point 1: Understanding the basics
Point 2: Why it matters
Point 3: How to get started
Point 4: Advanced tips
Point 5: Common pitfalls

[CONCLUSION]

So there you have it - everything you need to know about {topic}. Remember, the key is to start with the basics and gradually build your knowledge.

{conclusions[0]}

And if you have any questions about {topic}, drop them in the comments below. I read every single one and try to respond as quickly as possible.

That's all for today's video. I'll see you in the next one!
"""
        
        return script.strip()
    
    def _structure_script(self, script: str, topic: str) -> Dict[str, Any]:
        """Structure script into sections with timestamps"""
        
        # Estimate reading speed (150 words per minute average)
        words = script.split()
        total_words = len(words)
        
        # Try to identify sections
        sections = []
        current_time = 0
        
        # Simple section detection based on common patterns
        lines = script.split('\n')
        current_section = ""
        current_words = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            line_words = len(line.split())
            current_words += line_words
            current_section += line + " "
            
            # Estimate time for this section (150 words per minute)
            section_duration = (current_words / 150) * 60
            
            # New section if we hit certain keywords or duration
            if any(keyword in line.lower() for keyword in ['next', 'now', 'so', 'here', 'first', 'second', 'finally']) and current_words > 50:
                sections.append({
                    'content': current_section.strip(),
                    'start_time': current_time,
                    'duration': section_duration,
                    'word_count': current_words
                })
                current_time += section_duration
                current_section = ""
                current_words = 0
        
        # Add remaining content as final section
        if current_section:
            sections.append({
                'content': current_section.strip(),
                'start_time': current_time,
                'duration': (current_words / 150) * 60,
                'word_count': current_words
            })
        
        return {
            'sections': sections,
            'total_duration': current_time + ((current_words / 150) * 60),
            'total_words': total_words,
            'topic': topic
        }
    
    def _estimate_duration(self, script: str) -> float:
        """Estimate video duration in minutes based on script length"""
        words = len(script.split())
        # Average speaking pace: 150 words per minute
        return words / 150
    
    def get_seo_keywords(self, topic: str) -> List[str]:
        """Extract SEO keywords from topic"""
        # Simple keyword extraction
        keywords = []
        
        # Split topic into words and create variations
        words = re.findall(r'\w+', topic.lower())
        keywords.extend(words)
        
        # Add common YouTube keywords
        keywords.extend([
            'tutorial', 'guide', 'how to', 'tips', 'best', 'review',
            '2024', 'free', 'easy', 'beginner', 'advanced'
        ])
        
        return list(set(keywords))