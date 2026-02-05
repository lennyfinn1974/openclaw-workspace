"""
Sovereign Storage System
========================

Multi-format persistent storage combining:
- JSONL for structured logs and records
- Markdown for human-readable documents
- SQLite for fast queries and aggregations

Storage Philosophy:
    - JSONL for append-only event streams
    - Markdown for readable context files
    - SQLite for queryable state
    - All formats sync for consistency
"""

import asyncio
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import logging

logger = logging.getLogger("sovereign.storage")


class SovereignStorage:
    """Multi-format storage system for Sovereign workspace."""

    def __init__(self, data_path: Path):
        self.data_path = Path(data_path)
        self._ensure_structure()
        self._db = self._init_database()
        self._write_lock = asyncio.Lock()

    def _ensure_structure(self):
        """Create storage directory structure."""
        dirs = [
            self.data_path,
            self.data_path / "jsonl",
            self.data_path / "markdown",
            self.data_path / "cache",
        ]
        for d in dirs:
            d.mkdir(parents=True, exist_ok=True)

    def _init_database(self) -> sqlite3.Connection:
        """Initialize SQLite database."""
        db_path = self.data_path / "sovereign.db"
        conn = sqlite3.connect(str(db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row

        # Create tables
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                collection TEXT NOT NULL,
                key TEXT,
                data TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE INDEX IF NOT EXISTS idx_records_collection
            ON records(collection);

            CREATE INDEX IF NOT EXISTS idx_records_key
            ON records(collection, key);

            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS tags (
                record_id INTEGER,
                tag TEXT NOT NULL,
                FOREIGN KEY (record_id) REFERENCES records(id),
                PRIMARY KEY (record_id, tag)
            );

            CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);
        """)
        conn.commit()
        return conn

    async def append_jsonl(self, filename: str, record: Dict[str, Any]) -> bool:
        """Append record to JSONL file."""
        async with self._write_lock:
            try:
                filepath = self.data_path / "jsonl" / filename
                record["_timestamp"] = datetime.now().isoformat()

                with open(filepath, "a") as f:
                    f.write(json.dumps(record) + "\n")

                # Also store in SQLite for querying
                collection = filename.replace(".jsonl", "")
                self._db.execute(
                    "INSERT INTO records (collection, data) VALUES (?, ?)",
                    (collection, json.dumps(record)),
                )
                self._db.commit()

                return True
            except Exception as e:
                logger.error(f"JSONL append error: {e}")
                return False

    async def read_jsonl(
        self, filename: str, limit: int = 100, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Read records from JSONL file."""
        filepath = self.data_path / "jsonl" / filename
        if not filepath.exists():
            return []

        records = []
        with open(filepath, "r") as f:
            for i, line in enumerate(f):
                if i < offset:
                    continue
                if len(records) >= limit:
                    break
                try:
                    records.append(json.loads(line.strip()))
                except json.JSONDecodeError:
                    continue
        return records

    async def write_markdown(
        self,
        filename: str,
        content: str,
        frontmatter: Optional[Dict[str, Any]] = None,
    ) -> bool:
        """Write markdown file with optional frontmatter."""
        async with self._write_lock:
            try:
                filepath = self.data_path / "markdown" / filename

                # Build content with frontmatter
                if frontmatter:
                    frontmatter["_updated"] = datetime.now().isoformat()
                    fm_lines = ["---"]
                    for k, v in frontmatter.items():
                        if isinstance(v, list):
                            fm_lines.append(f"{k}: {json.dumps(v)}")
                        else:
                            fm_lines.append(f"{k}: {v}")
                    fm_lines.append("---\n")
                    full_content = "\n".join(fm_lines) + content
                else:
                    full_content = content

                filepath.write_text(full_content)

                # Store in SQLite
                collection = "markdown"
                key = filename.replace(".md", "")
                self._db.execute(
                    """INSERT OR REPLACE INTO records (collection, key, data, updated_at)
                       VALUES (?, ?, ?, CURRENT_TIMESTAMP)""",
                    (collection, key, json.dumps({"content": content, "frontmatter": frontmatter})),
                )
                self._db.commit()

                return True
            except Exception as e:
                logger.error(f"Markdown write error: {e}")
                return False

    async def read_markdown(self, filename: str) -> Optional[Dict[str, Any]]:
        """Read markdown file, parsing frontmatter."""
        filepath = self.data_path / "markdown" / filename
        if not filepath.exists():
            return None

        content = filepath.read_text()
        result = {"content": content, "frontmatter": None}

        # Parse frontmatter
        if content.startswith("---"):
            parts = content.split("---", 2)
            if len(parts) >= 3:
                frontmatter = {}
                for line in parts[1].strip().split("\n"):
                    if ":" in line:
                        k, v = line.split(":", 1)
                        v = v.strip()
                        # Try to parse JSON values
                        try:
                            v = json.loads(v)
                        except json.JSONDecodeError:
                            pass
                        frontmatter[k.strip()] = v
                result["frontmatter"] = frontmatter
                result["content"] = parts[2].strip()

        return result

    def query(
        self,
        collection: str,
        where: Optional[Dict[str, Any]] = None,
        limit: int = 100,
        order_by: str = "created_at DESC",
    ) -> List[Dict[str, Any]]:
        """Query records from SQLite."""
        sql = f"SELECT * FROM records WHERE collection = ?"
        params = [collection]

        if where:
            for key, value in where.items():
                # JSON path query
                sql += f" AND json_extract(data, '$.{key}') = ?"
                params.append(json.dumps(value) if isinstance(value, (dict, list)) else value)

        sql += f" ORDER BY {order_by} LIMIT ?"
        params.append(limit)

        cursor = self._db.execute(sql, params)
        results = []
        for row in cursor.fetchall():
            record = json.loads(row["data"])
            record["_id"] = row["id"]
            record["_created_at"] = row["created_at"]
            results.append(record)

        return results

    def get_by_key(self, collection: str, key: str) -> Optional[Dict[str, Any]]:
        """Get a specific record by collection and key."""
        cursor = self._db.execute(
            "SELECT * FROM records WHERE collection = ? AND key = ? ORDER BY updated_at DESC LIMIT 1",
            (collection, key),
        )
        row = cursor.fetchone()
        if row:
            record = json.loads(row["data"])
            record["_id"] = row["id"]
            return record
        return None

    async def set_metadata(self, key: str, value: Any) -> bool:
        """Set a metadata value."""
        try:
            self._db.execute(
                """INSERT OR REPLACE INTO metadata (key, value, updated_at)
                   VALUES (?, ?, CURRENT_TIMESTAMP)""",
                (key, json.dumps(value)),
            )
            self._db.commit()
            return True
        except Exception as e:
            logger.error(f"Metadata set error: {e}")
            return False

    def get_metadata(self, key: str, default: Any = None) -> Any:
        """Get a metadata value."""
        cursor = self._db.execute(
            "SELECT value FROM metadata WHERE key = ?", (key,)
        )
        row = cursor.fetchone()
        if row:
            return json.loads(row["value"])
        return default

    def get_status(self) -> Dict[str, Any]:
        """Get storage status and statistics."""
        cursor = self._db.execute(
            "SELECT collection, COUNT(*) as count FROM records GROUP BY collection"
        )
        collections = {row["collection"]: row["count"] for row in cursor.fetchall()}

        # Get disk usage
        total_size = 0
        for path in self.data_path.rglob("*"):
            if path.is_file():
                total_size += path.stat().st_size

        return {
            "data_path": str(self.data_path),
            "collections": collections,
            "total_records": sum(collections.values()),
            "disk_usage_mb": round(total_size / (1024 * 1024), 2),
            "database_path": str(self.data_path / "sovereign.db"),
        }

    def close(self):
        """Close database connection."""
        self._db.close()
