"""
Logging utility for YouTube Automation System
"""

import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional

def setup_logger(name: str, level: str = "INFO", log_file: Optional[str] = None) -> logging.Logger:
    """
    Set up a logger with console and file output
    
    Args:
        name: Logger name
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional log file path
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper()))
    
    # Clear existing handlers
    logger.handlers.clear()
    
    # Create formatter
    formatter = logging.Formatter(
        '%(asctime)s | %(name)s | %(levelname)s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler
    if log_file is None:
        log_file = f"logs/{name}_{datetime.now().strftime('%Y%m%d')}.log"
    
    # Create logs directory
    Path("logs").mkdir(exist_ok=True)
    
    file_handler = logging.FileHandler(log_file)
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(formatter)
    logger.addHandler(file_handler)
    
    return logger

class YouTubeLogger:
    """Specialized logger for YouTube automation with emojis and structured output"""
    
    def __init__(self, name: str):
        self.logger = setup_logger(name)
    
    def step_start(self, step: str, description: str):
        """Log the start of a step"""
        self.logger.info(f"🚀 {step}: {description}")
    
    def step_complete(self, step: str, result: str = ""):
        """Log the completion of a step"""
        self.logger.info(f"✅ {step} completed" + (f": {result}" if result else ""))
    
    def step_error(self, step: str, error: str):
        """Log an error in a step"""
        self.logger.error(f"❌ {step} failed: {error}")
    
    def progress(self, current: int, total: int, description: str = ""):
        """Log progress"""
        percent = (current / total) * 100
        self.logger.info(f"📊 Progress: {current}/{total} ({percent:.1f}%)" + (f" - {description}" if description else ""))
    
    def upload_status(self, status: str, details: str = ""):
        """Log upload status"""
        emoji = {
            'uploading': '📤',
            'processing': '⚙️',
            'completed': '✅',
            'failed': '❌',
            'scheduled': '⏰'
        }.get(status, '📝')
        
        self.logger.info(f"{emoji} Upload {status}" + (f": {details}" if details else ""))
    
    def analytics(self, metric: str, value: str):
        """Log analytics information"""
        self.logger.info(f"📈 {metric}: {value}")
    
    def warning(self, message: str):
        """Log a warning"""
        self.logger.warning(f"⚠️ {message}")
    
    def debug(self, message: str):
        """Log debug information"""
        self.logger.debug(f"🔍 {message}")
    
    def info(self, message: str):
        """Log general information"""
        self.logger.info(message)
    
    def error(self, message: str):
        """Log an error"""
        self.logger.error(message)