#!/usr/bin/env python3
"""
QMD Search System - Quantum Memory Database
Comprehensive knowledge indexing and retrieval system
"""

import os
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import hashlib

class QMDSearch:
    def __init__(self, workspace_path: str = "."):
        self.workspace_path = Path(workspace_path)
        self.index_file = self.workspace_path / "qmd_index.json"
        self.config_file = self.workspace_path / "qmd_config.json"
        self.knowledge_index = {}
        self.config = self._load_config()
        
    def _load_config(self) -> Dict[str, Any]:
        """Load QMD configuration"""
        default_config = {
            "file_patterns": ["*.md"],
            "exclude_dirs": ["node_modules", ".git", "dist", "build"],
            "exclude_files": ["package-lock.json", "yarn.lock"],
            "categories": {
                "core_memory": ["MEMORY.md", "SOUL.md", "USER.md", "IDENTITY.md"],
                "operational": ["AGENTS.md", "TOOLS.md", "HEARTBEAT.md"],
                "workflows": ["*WORKFLOW*.md", "*PROCESS*.md", "*GUIDE*.md"],
                "projects": ["README.md", "PROJECT*.md", "*SUMMARY*.md"],
                "daily_memory": ["memory/*.md"],
                "analysis": ["*analysis*.md", "*ANALYSIS*.md"],
                "documentation": ["*DOCUMENTATION*.md", "*DOC*.md"]
            },
            "keywords": {
                "high_priority": ["breakthrough", "success", "critical", "security", "cost"],
                "technical": ["api", "integration", "system", "code", "implementation"],
                "strategic": ["pattern", "framework", "methodology", "approach"],
                "learning": ["lesson", "insight", "discovery", "principle"]
            }
        }
        
        if self.config_file.exists():
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    # Merge with defaults
                    for key, value in default_config.items():
                        if key not in config:
                            config[key] = value
                    return config
            except Exception as e:
                print(f"Error loading config: {e}")
                
        return default_config
    
    def _save_config(self):
        """Save current configuration"""
        with open(self.config_file, 'w') as f:
            json.dump(self.config, f, indent=2)
    
    def _get_file_hash(self, filepath: Path) -> str:
        """Get file content hash for change detection"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                return hashlib.md5(content.encode()).hexdigest()
        except:
            return ""
    
    def _classify_file(self, filepath: Path) -> List[str]:
        """Classify file into categories"""
        categories = []
        rel_path = str(filepath.relative_to(self.workspace_path))
        filename = filepath.name
        
        for category, patterns in self.config["categories"].items():
            for pattern in patterns:
                if "/" in pattern:
                    # Directory pattern
                    if Path(rel_path).match(pattern):
                        categories.append(category)
                else:
                    # Filename pattern
                    if Path(filename).match(pattern):
                        categories.append(category)
        
        # Default category
        if not categories:
            categories.append("general")
            
        return categories
    
    def _extract_keywords(self, content: str) -> Dict[str, List[str]]:
        """Extract keywords from content by priority"""
        keywords = {priority: [] for priority in self.config["keywords"]}
        
        for priority, words in self.config["keywords"].items():
            for word in words:
                # Case-insensitive search for whole words
                pattern = r'\b' + re.escape(word.lower()) + r'\b'
                matches = re.findall(pattern, content.lower())
                if matches:
                    keywords[priority].extend(matches)
        
        return keywords
    
    def _extract_metadata(self, filepath: Path, content: str) -> Dict[str, Any]:
        """Extract metadata from file content"""
        metadata = {
            "file_path": str(filepath.relative_to(self.workspace_path)),
            "filename": filepath.name,
            "size": len(content),
            "line_count": len(content.split('\n')),
            "last_modified": datetime.fromtimestamp(filepath.stat().st_mtime).isoformat(),
            "hash": self._get_file_hash(filepath)
        }
        
        # Extract title (first # heading)
        title_match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
        if title_match:
            metadata["title"] = title_match.group(1).strip()
        
        # Extract headings
        headings = re.findall(r'^#+\s+(.+)$', content, re.MULTILINE)
        metadata["headings"] = headings[:10]  # First 10 headings
        
        # Extract cross-references (file mentions)
        file_refs = re.findall(r'`([A-Z_]+\.md)`', content)
        metadata["cross_references"] = list(set(file_refs))
        
        # Extract dates
        date_pattern = r'\d{4}-\d{2}-\d{2}'
        dates = re.findall(date_pattern, content)
        metadata["dates_mentioned"] = list(set(dates))
        
        return metadata
    
    def build_index(self) -> Dict[str, Any]:
        """Build comprehensive knowledge index"""
        print("Building QMD knowledge index...")
        
        index = {
            "created": datetime.now().isoformat(),
            "total_files": 0,
            "files": {},
            "categories": {},
            "keywords": {},
            "cross_references": {}
        }
        
        # Find all matching files
        for pattern in self.config["file_patterns"]:
            for filepath in self.workspace_path.rglob(pattern):
                # Skip excluded directories
                if any(excluded in str(filepath) for excluded in self.config["exclude_dirs"]):
                    continue
                    
                # Skip excluded files
                if filepath.name in self.config["exclude_files"]:
                    continue
                
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    # Extract all information
                    categories = self._classify_file(filepath)
                    keywords = self._extract_keywords(content)
                    metadata = self._extract_metadata(filepath, content)
                    
                    # Create file entry
                    file_key = str(filepath.relative_to(self.workspace_path))
                    index["files"][file_key] = {
                        "categories": categories,
                        "keywords": keywords,
                        "metadata": metadata,
                        "content_preview": content[:500] + "..." if len(content) > 500 else content
                    }
                    
                    # Update category index
                    for category in categories:
                        if category not in index["categories"]:
                            index["categories"][category] = []
                        index["categories"][category].append(file_key)
                    
                    # Update keyword index
                    for priority, words in keywords.items():
                        if priority not in index["keywords"]:
                            index["keywords"][priority] = {}
                        for word in words:
                            if word not in index["keywords"][priority]:
                                index["keywords"][priority][word] = []
                            index["keywords"][priority][word].append(file_key)
                    
                    # Update cross-reference index
                    for ref in metadata["cross_references"]:
                        if ref not in index["cross_references"]:
                            index["cross_references"][ref] = []
                        index["cross_references"][ref].append(file_key)
                    
                    index["total_files"] += 1
                    
                except Exception as e:
                    print(f"Error processing {filepath}: {e}")
        
        # Save index
        self.knowledge_index = index
        with open(self.index_file, 'w') as f:
            json.dump(index, f, indent=2)
        
        print(f"Index built: {index['total_files']} files indexed")
        return index
    
    def load_index(self) -> bool:
        """Load existing index"""
        if not self.index_file.exists():
            return False
        
        try:
            with open(self.index_file, 'r') as f:
                self.knowledge_index = json.load(f)
            return True
        except Exception as e:
            print(f"Error loading index: {e}")
            return False
    
    def search(self, query: str, category: Optional[str] = None, 
               max_results: int = 10) -> List[Dict[str, Any]]:
        """Search the knowledge base"""
        if not self.knowledge_index:
            if not self.load_index():
                print("No index found. Building index...")
                self.build_index()
        
        results = []
        query_lower = query.lower()
        
        for file_key, file_data in self.knowledge_index["files"].items():
            # Category filter
            if category and category not in file_data["categories"]:
                continue
            
            score = 0
            matches = []
            
            # Search in title
            title = file_data["metadata"].get("title", "")
            if query_lower in title.lower():
                score += 10
                matches.append(f"Title: {title}")
            
            # Search in content preview
            content = file_data["content_preview"]
            if query_lower in content.lower():
                score += 5
                # Find context around match
                index = content.lower().find(query_lower)
                start = max(0, index - 50)
                end = min(len(content), index + len(query) + 50)
                context = content[start:end]
                matches.append(f"Content: ...{context}...")
            
            # Search in headings
            for heading in file_data["metadata"]["headings"]:
                if query_lower in heading.lower():
                    score += 7
                    matches.append(f"Heading: {heading}")
            
            # Keyword priority bonus
            for priority, words in file_data["keywords"].items():
                if query_lower in [w.lower() for w in words]:
                    if priority == "high_priority":
                        score += 15
                    elif priority == "strategic":
                        score += 10
                    else:
                        score += 5
            
            if score > 0:
                results.append({
                    "file": file_key,
                    "score": score,
                    "matches": matches,
                    "categories": file_data["categories"],
                    "metadata": file_data["metadata"],
                    "preview": content[:200] + "..." if len(content) > 200 else content
                })
        
        # Sort by score and return top results
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:max_results]
    
    def get_file_content(self, file_path: str) -> Optional[str]:
        """Get full content of a file"""
        try:
            full_path = self.workspace_path / file_path
            with open(full_path, 'r', encoding='utf-8') as f:
                return f.read()
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
            return None
    
    def get_category_files(self, category: str) -> List[str]:
        """Get all files in a category"""
        if not self.knowledge_index:
            self.load_index()
        
        return self.knowledge_index.get("categories", {}).get(category, [])
    
    def get_cross_references(self, filename: str) -> List[str]:
        """Get files that reference this file"""
        if not self.knowledge_index:
            self.load_index()
        
        return self.knowledge_index.get("cross_references", {}).get(filename, [])
    
    def stats(self) -> Dict[str, Any]:
        """Get index statistics"""
        if not self.knowledge_index:
            self.load_index()
        
        return {
            "total_files": self.knowledge_index.get("total_files", 0),
            "categories": {cat: len(files) for cat, files in 
                          self.knowledge_index.get("categories", {}).items()},
            "created": self.knowledge_index.get("created", "Unknown"),
            "index_file_exists": self.index_file.exists()
        }

def main():
    """Command-line interface for QMD Search"""
    import sys
    
    qmd = QMDSearch()
    
    if len(sys.argv) < 2:
        print("QMD Search System")
        print("Commands:")
        print("  build-index    - Build/rebuild the knowledge index")
        print("  search <query> - Search the knowledge base")
        print("  stats          - Show index statistics")
        print("  categories     - List all categories")
        return
    
    command = sys.argv[1]
    
    if command == "build-index":
        qmd.build_index()
        
    elif command == "search":
        if len(sys.argv) < 3:
            print("Usage: search <query>")
            return
        query = " ".join(sys.argv[2:])
        results = qmd.search(query)
        
        print(f"Search results for '{query}':")
        print("-" * 50)
        
        for i, result in enumerate(results, 1):
            print(f"{i}. {result['file']} (Score: {result['score']})")
            print(f"   Categories: {', '.join(result['categories'])}")
            print(f"   Matches: {'; '.join(result['matches'][:2])}")
            print(f"   Preview: {result['preview']}")
            print()
            
    elif command == "stats":
        stats = qmd.stats()
        print("QMD Index Statistics:")
        print(f"Total files: {stats['total_files']}")
        print(f"Index created: {stats['created']}")
        print("Categories:")
        for category, count in stats['categories'].items():
            print(f"  {category}: {count} files")
            
    elif command == "categories":
        stats = qmd.stats()
        print("Available categories:")
        for category in stats['categories'].keys():
            print(f"  {category}")
    
    else:
        print(f"Unknown command: {command}")

if __name__ == "__main__":
    main()