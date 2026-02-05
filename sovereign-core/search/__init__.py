"""
Hybrid Search System
====================

Combines multiple search strategies:
- Vector similarity (embeddings) for semantic search
- SQLite FTS5 for fast text search
- File system glob for path matching
- Tag-based filtering

Search Priority:
    1. Exact match (highest priority)
    2. Vector similarity (semantic)
    3. Full-text search (keyword)
    4. Fuzzy match (fallback)
"""

import asyncio
import hashlib
import json
import logging
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import re

logger = logging.getLogger("sovereign.search")


class HybridSearch:
    """Hybrid search combining vector, text, and file search."""

    def __init__(self, index_path: Path):
        self.index_path = Path(index_path)
        self._ensure_structure()
        self._db = self._init_database()
        self._embeddings_cache: Dict[str, List[float]] = {}

    def _ensure_structure(self):
        """Create index directory structure."""
        self.index_path.mkdir(parents=True, exist_ok=True)

    def _init_database(self) -> sqlite3.Connection:
        """Initialize search database with FTS5."""
        db_path = self.index_path / "search.db"
        conn = sqlite3.connect(str(db_path), check_same_thread=False)
        conn.row_factory = sqlite3.Row

        # Create tables
        conn.executescript("""
            -- Main content table
            CREATE TABLE IF NOT EXISTS content (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content_hash TEXT UNIQUE NOT NULL,
                content TEXT NOT NULL,
                source TEXT,
                content_type TEXT DEFAULT 'text',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );

            -- FTS5 full-text search
            CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
                content,
                source,
                content='content',
                content_rowid='id'
            );

            -- Triggers to keep FTS in sync
            CREATE TRIGGER IF NOT EXISTS content_ai AFTER INSERT ON content BEGIN
                INSERT INTO content_fts(rowid, content, source)
                VALUES (new.id, new.content, new.source);
            END;

            CREATE TRIGGER IF NOT EXISTS content_ad AFTER DELETE ON content BEGIN
                INSERT INTO content_fts(content_fts, rowid, content, source)
                VALUES ('delete', old.id, old.content, old.source);
            END;

            CREATE TRIGGER IF NOT EXISTS content_au AFTER UPDATE ON content BEGIN
                INSERT INTO content_fts(content_fts, rowid, content, source)
                VALUES ('delete', old.id, old.content, old.source);
                INSERT INTO content_fts(rowid, content, source)
                VALUES (new.id, new.content, new.source);
            END;

            -- Metadata table
            CREATE TABLE IF NOT EXISTS metadata (
                content_id INTEGER,
                key TEXT NOT NULL,
                value TEXT NOT NULL,
                FOREIGN KEY (content_id) REFERENCES content(id),
                PRIMARY KEY (content_id, key)
            );

            -- Tags table
            CREATE TABLE IF NOT EXISTS tags (
                content_id INTEGER,
                tag TEXT NOT NULL,
                FOREIGN KEY (content_id) REFERENCES content(id),
                PRIMARY KEY (content_id, tag)
            );

            CREATE INDEX IF NOT EXISTS idx_tags_tag ON tags(tag);

            -- Vector embeddings table (simplified - stores as JSON)
            CREATE TABLE IF NOT EXISTS embeddings (
                content_id INTEGER PRIMARY KEY,
                embedding TEXT NOT NULL,
                model TEXT DEFAULT 'local',
                FOREIGN KEY (content_id) REFERENCES content(id)
            );
        """)
        conn.commit()
        return conn

    async def index_content(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        tags: Optional[List[str]] = None,
        source: str = "unknown",
    ) -> int:
        """Index content for search."""
        # Generate content hash
        content_hash = hashlib.sha256(content.encode()).hexdigest()

        # Check if already indexed
        cursor = self._db.execute(
            "SELECT id FROM content WHERE content_hash = ?", (content_hash,)
        )
        existing = cursor.fetchone()
        if existing:
            return existing["id"]

        # Insert content
        cursor = self._db.execute(
            "INSERT INTO content (content_hash, content, source) VALUES (?, ?, ?)",
            (content_hash, content, source),
        )
        content_id = cursor.lastrowid

        # Add metadata
        if metadata:
            for key, value in metadata.items():
                self._db.execute(
                    "INSERT OR REPLACE INTO metadata (content_id, key, value) VALUES (?, ?, ?)",
                    (content_id, key, json.dumps(value) if isinstance(value, (dict, list)) else str(value)),
                )

        # Add tags
        if tags:
            for tag in tags:
                self._db.execute(
                    "INSERT OR REPLACE INTO tags (content_id, tag) VALUES (?, ?)",
                    (content_id, tag.lower()),
                )

        # Generate and store embedding
        embedding = await self._generate_embedding(content)
        if embedding:
            self._db.execute(
                "INSERT OR REPLACE INTO embeddings (content_id, embedding) VALUES (?, ?)",
                (content_id, json.dumps(embedding)),
            )

        self._db.commit()
        logger.debug(f"Indexed content: {content_id} ({len(content)} chars)")
        return content_id

    async def query(
        self,
        query_text: str,
        limit: int = 10,
        tags: Optional[List[str]] = None,
        source_filter: Optional[str] = None,
        search_type: str = "hybrid",
    ) -> List[Dict[str, Any]]:
        """Search indexed content."""
        results = []

        if search_type in ("hybrid", "fts"):
            # Full-text search
            fts_results = self._fts_search(query_text, limit * 2)
            results.extend(fts_results)

        if search_type in ("hybrid", "vector"):
            # Vector similarity search
            vector_results = await self._vector_search(query_text, limit * 2)
            results.extend(vector_results)

        # Deduplicate and merge scores
        merged = self._merge_results(results)

        # Apply filters
        if tags:
            merged = [r for r in merged if self._has_tags(r["id"], tags)]
        if source_filter:
            merged = [r for r in merged if source_filter in r.get("source", "")]

        # Sort by combined score
        merged.sort(key=lambda x: x.get("score", 0), reverse=True)

        return merged[:limit]

    def _fts_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Full-text search using FTS5."""
        # Escape special FTS5 characters
        safe_query = re.sub(r'[^\w\s]', ' ', query)
        terms = safe_query.split()

        if not terms:
            return []

        # Build FTS5 query
        fts_query = " OR ".join(terms)

        try:
            cursor = self._db.execute(
                """
                SELECT c.id, c.content, c.source, c.created_at,
                       bm25(content_fts) as score
                FROM content_fts
                JOIN content c ON content_fts.rowid = c.id
                WHERE content_fts MATCH ?
                ORDER BY score
                LIMIT ?
                """,
                (fts_query, limit),
            )

            results = []
            for row in cursor.fetchall():
                results.append({
                    "id": row["id"],
                    "content": row["content"][:500],  # Truncate
                    "source": row["source"],
                    "created_at": row["created_at"],
                    "score": -row["score"],  # BM25 scores are negative
                    "match_type": "fts",
                })
            return results
        except sqlite3.OperationalError as e:
            logger.warning(f"FTS search error: {e}")
            return []

    async def _vector_search(self, query: str, limit: int) -> List[Dict[str, Any]]:
        """Vector similarity search."""
        query_embedding = await self._generate_embedding(query)
        if not query_embedding:
            return []

        # Get all embeddings (in production, use vector DB)
        cursor = self._db.execute(
            """
            SELECT e.content_id, e.embedding, c.content, c.source, c.created_at
            FROM embeddings e
            JOIN content c ON e.content_id = c.id
            """
        )

        results = []
        for row in cursor.fetchall():
            stored_embedding = json.loads(row["embedding"])
            similarity = self._cosine_similarity(query_embedding, stored_embedding)
            results.append({
                "id": row["content_id"],
                "content": row["content"][:500],
                "source": row["source"],
                "created_at": row["created_at"],
                "score": similarity,
                "match_type": "vector",
            })

        # Sort by similarity
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    async def _generate_embedding(self, text: str) -> Optional[List[float]]:
        """Generate embedding for text.

        In production, use actual embedding model (OpenAI, local model, etc.)
        This is a simple hash-based pseudo-embedding for demonstration.
        """
        # Check cache
        text_hash = hashlib.md5(text.encode()).hexdigest()
        if text_hash in self._embeddings_cache:
            return self._embeddings_cache[text_hash]

        # Simple pseudo-embedding based on character frequencies
        # In production, replace with real embedding API
        embedding = [0.0] * 128

        # Character frequency features
        for i, char in enumerate(text.lower()[:1000]):
            idx = ord(char) % 128
            embedding[idx] += 1.0 / (i + 1)

        # Normalize
        magnitude = sum(x * x for x in embedding) ** 0.5
        if magnitude > 0:
            embedding = [x / magnitude for x in embedding]

        self._embeddings_cache[text_hash] = embedding
        return embedding

    def _cosine_similarity(self, vec1: List[float], vec2: List[float]) -> float:
        """Calculate cosine similarity between two vectors."""
        if len(vec1) != len(vec2):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        magnitude1 = sum(x * x for x in vec1) ** 0.5
        magnitude2 = sum(x * x for x in vec2) ** 0.5

        if magnitude1 == 0 or magnitude2 == 0:
            return 0.0

        return dot_product / (magnitude1 * magnitude2)

    def _merge_results(self, results: List[Dict]) -> List[Dict]:
        """Merge and deduplicate results from multiple search types."""
        merged: Dict[int, Dict] = {}

        for result in results:
            content_id = result["id"]
            if content_id in merged:
                # Combine scores
                existing = merged[content_id]
                existing["score"] = (existing["score"] + result["score"]) / 2
                existing["match_types"] = list(
                    set(existing.get("match_types", [existing.get("match_type", "")]) + [result.get("match_type", "")])
                )
            else:
                result["match_types"] = [result.get("match_type", "")]
                merged[content_id] = result

        return list(merged.values())

    def _has_tags(self, content_id: int, tags: List[str]) -> bool:
        """Check if content has any of the specified tags."""
        placeholders = ",".join("?" * len(tags))
        cursor = self._db.execute(
            f"SELECT 1 FROM tags WHERE content_id = ? AND tag IN ({placeholders})",
            [content_id] + [t.lower() for t in tags],
        )
        return cursor.fetchone() is not None

    def search_files(
        self,
        workspace: Path,
        pattern: str = "*",
        extensions: Optional[List[str]] = None,
    ) -> List[Path]:
        """Search files in workspace by pattern."""
        workspace = Path(workspace)
        if not workspace.exists():
            return []

        files = list(workspace.rglob(pattern))

        if extensions:
            files = [f for f in files if f.suffix.lower() in extensions]

        return sorted(files, key=lambda p: p.stat().st_mtime, reverse=True)

    def get_stats(self) -> Dict[str, Any]:
        """Get search index statistics."""
        cursor = self._db.execute("SELECT COUNT(*) as count FROM content")
        content_count = cursor.fetchone()["count"]

        cursor = self._db.execute("SELECT COUNT(*) as count FROM embeddings")
        embedding_count = cursor.fetchone()["count"]

        cursor = self._db.execute("SELECT COUNT(DISTINCT tag) as count FROM tags")
        tag_count = cursor.fetchone()["count"]

        return {
            "index_path": str(self.index_path),
            "indexed_content": content_count,
            "embeddings": embedding_count,
            "unique_tags": tag_count,
            "cache_size": len(self._embeddings_cache),
        }

    def clear_index(self) -> bool:
        """Clear all indexed content."""
        try:
            self._db.executescript("""
                DELETE FROM tags;
                DELETE FROM metadata;
                DELETE FROM embeddings;
                DELETE FROM content;
            """)
            self._db.commit()
            self._embeddings_cache.clear()
            logger.info("Search index cleared")
            return True
        except Exception as e:
            logger.error(f"Clear index error: {e}")
            return False

    def close(self):
        """Close database connection."""
        self._db.close()
