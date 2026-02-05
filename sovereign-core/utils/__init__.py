"""
Sovereign Utilities
===================

Common utilities for the Sovereign system:
- Token counting and estimation
- Cost calculation
- Formatting helpers
- Async utilities
"""

import asyncio
import hashlib
import json
import re
import time
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
import logging

logger = logging.getLogger("sovereign.utils")

T = TypeVar("T")


# =============================================================================
# Token Estimation
# =============================================================================

def estimate_tokens(text: str) -> int:
    """Estimate token count for text.

    Rough estimation: ~4 characters per token for English text.
    Adjust based on actual tokenizer if needed.
    """
    if not text:
        return 0
    # More accurate: count words and punctuation
    words = len(text.split())
    # Add ~30% for subword tokens
    return int(words * 1.3)


def truncate_to_tokens(text: str, max_tokens: int) -> str:
    """Truncate text to approximate token limit."""
    estimated = estimate_tokens(text)
    if estimated <= max_tokens:
        return text

    # Rough character limit
    char_limit = max_tokens * 4
    if len(text) <= char_limit:
        return text

    # Truncate with ellipsis
    return text[:char_limit - 3] + "..."


# =============================================================================
# Cost Calculation
# =============================================================================

# Model pricing per 1K tokens (as of 2024)
MODEL_PRICING = {
    "claude-3-haiku": {"input": 0.00025, "output": 0.00125},
    "claude-sonnet-4": {"input": 0.003, "output": 0.015},
    "claude-opus-4": {"input": 0.015, "output": 0.075},
    "gpt-3.5-turbo": {"input": 0.0005, "output": 0.0015},
    "gpt-4": {"input": 0.03, "output": 0.06},
    "ollama": {"input": 0.0, "output": 0.0},  # Local models are free
}


def calculate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
) -> float:
    """Calculate cost for a model call."""
    pricing = MODEL_PRICING.get(model, MODEL_PRICING.get("ollama"))
    input_cost = (input_tokens / 1000) * pricing["input"]
    output_cost = (output_tokens / 1000) * pricing["output"]
    return round(input_cost + output_cost, 6)


def format_cost(amount: float) -> str:
    """Format cost as currency string."""
    if amount < 0.01:
        return f"${amount:.4f}"
    elif amount < 1.0:
        return f"${amount:.3f}"
    else:
        return f"${amount:.2f}"


# =============================================================================
# Formatting Helpers
# =============================================================================

def format_duration(seconds: float) -> str:
    """Format duration in human-readable form."""
    if seconds < 1:
        return f"{seconds * 1000:.0f}ms"
    elif seconds < 60:
        return f"{seconds:.1f}s"
    elif seconds < 3600:
        mins = int(seconds // 60)
        secs = int(seconds % 60)
        return f"{mins}m {secs}s"
    else:
        hours = int(seconds // 3600)
        mins = int((seconds % 3600) // 60)
        return f"{hours}h {mins}m"


def format_size(bytes_size: int) -> str:
    """Format byte size in human-readable form."""
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if bytes_size < 1024:
            return f"{bytes_size:.1f} {unit}"
        bytes_size /= 1024
    return f"{bytes_size:.1f} PB"


def format_timestamp(dt: Optional[datetime] = None, fmt: str = "iso") -> str:
    """Format datetime in various formats."""
    dt = dt or datetime.now()
    formats = {
        "iso": "%Y-%m-%dT%H:%M:%S",
        "date": "%Y-%m-%d",
        "time": "%H:%M:%S",
        "human": "%b %d, %Y %I:%M %p",
        "file": "%Y%m%d-%H%M%S",
    }
    return dt.strftime(formats.get(fmt, fmt))


def slugify(text: str) -> str:
    """Convert text to URL-safe slug."""
    # Lowercase
    text = text.lower()
    # Replace spaces and special chars
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")


def truncate(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Truncate text to max length."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)] + suffix


# =============================================================================
# Async Utilities
# =============================================================================

def async_retry(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,),
):
    """Decorator for async retry with exponential backoff."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None
            current_delay = delay

            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries:
                        logger.warning(
                            f"Retry {attempt + 1}/{max_retries} for {func.__name__}: {e}"
                        )
                        await asyncio.sleep(current_delay)
                        current_delay *= backoff

            raise last_exception

        return wrapper
    return decorator


async def run_with_timeout(
    coro,
    timeout: float,
    default: T = None,
) -> T:
    """Run coroutine with timeout, returning default on timeout."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        logger.warning(f"Operation timed out after {timeout}s")
        return default


async def gather_with_limit(
    coros: List,
    limit: int = 5,
) -> List:
    """Run coroutines with concurrency limit."""
    semaphore = asyncio.Semaphore(limit)

    async def limited_coro(coro):
        async with semaphore:
            return await coro

    return await asyncio.gather(*[limited_coro(c) for c in coros])


# =============================================================================
# Hashing and IDs
# =============================================================================

def generate_id(prefix: str = "", length: int = 8) -> str:
    """Generate a unique ID."""
    import uuid
    uid = uuid.uuid4().hex[:length]
    return f"{prefix}{uid}" if prefix else uid


def hash_content(content: str, algorithm: str = "sha256") -> str:
    """Generate hash of content."""
    hasher = hashlib.new(algorithm)
    hasher.update(content.encode())
    return hasher.hexdigest()


def content_fingerprint(content: str) -> str:
    """Generate short fingerprint for content."""
    return hash_content(content)[:12]


# =============================================================================
# JSON Utilities
# =============================================================================

def safe_json_loads(text: str, default: Any = None) -> Any:
    """Safely parse JSON, returning default on error."""
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return default


def safe_json_dumps(obj: Any, default: str = "{}") -> str:
    """Safely serialize to JSON, returning default on error."""
    try:
        return json.dumps(obj, default=str)
    except (TypeError, ValueError):
        return default


class JSONEncoder(json.JSONEncoder):
    """Extended JSON encoder for common types."""

    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        if isinstance(obj, Path):
            return str(obj)
        if isinstance(obj, bytes):
            return obj.decode("utf-8", errors="replace")
        if hasattr(obj, "__dict__"):
            return obj.__dict__
        return super().default(obj)


# =============================================================================
# Path Utilities
# =============================================================================

def ensure_path(path: Union[str, Path]) -> Path:
    """Ensure path exists and return Path object."""
    path = Path(path).expanduser()
    path.mkdir(parents=True, exist_ok=True)
    return path


def safe_read_file(path: Union[str, Path], default: str = "") -> str:
    """Safely read file, returning default on error."""
    try:
        return Path(path).read_text()
    except Exception:
        return default


def safe_write_file(path: Union[str, Path], content: str) -> bool:
    """Safely write file, returning success status."""
    try:
        Path(path).write_text(content)
        return True
    except Exception as e:
        logger.error(f"Failed to write {path}: {e}")
        return False


# =============================================================================
# Rate Limiting
# =============================================================================

class RateLimiter:
    """Simple rate limiter for API calls."""

    def __init__(self, calls_per_minute: int = 60):
        self.calls_per_minute = calls_per_minute
        self.calls: List[float] = []
        self._lock = asyncio.Lock()

    async def acquire(self) -> bool:
        """Acquire permission to make a call."""
        async with self._lock:
            now = time.time()
            minute_ago = now - 60

            # Remove old calls
            self.calls = [t for t in self.calls if t > minute_ago]

            if len(self.calls) >= self.calls_per_minute:
                return False

            self.calls.append(now)
            return True

    async def wait(self) -> None:
        """Wait until a call can be made."""
        while not await self.acquire():
            await asyncio.sleep(0.5)

    def remaining(self) -> int:
        """Get remaining calls in current window."""
        now = time.time()
        minute_ago = now - 60
        recent = [t for t in self.calls if t > minute_ago]
        return max(0, self.calls_per_minute - len(recent))


# =============================================================================
# Timing
# =============================================================================

class Timer:
    """Simple timer for measuring execution time."""

    def __init__(self, name: str = ""):
        self.name = name
        self.start_time: Optional[float] = None
        self.elapsed: float = 0

    def __enter__(self):
        self.start_time = time.time()
        return self

    def __exit__(self, *args):
        self.elapsed = time.time() - self.start_time
        if self.name:
            logger.debug(f"{self.name}: {format_duration(self.elapsed)}")

    async def __aenter__(self):
        self.start_time = time.time()
        return self

    async def __aexit__(self, *args):
        self.elapsed = time.time() - self.start_time
        if self.name:
            logger.debug(f"{self.name}: {format_duration(self.elapsed)}")
