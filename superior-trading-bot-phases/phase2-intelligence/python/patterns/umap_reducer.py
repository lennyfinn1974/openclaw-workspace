"""
UMAP Dimensionality Reduction: 20D behavioral vectors → 5D embeddings.
Tuned for small sample sizes (~21 bots).
"""
import numpy as np
from typing import Dict, Any, List

try:
    import umap
    HAS_UMAP = True
except ImportError:
    HAS_UMAP = False


class UMAPReducer:
    def reduce(self, payload: Dict[str, Any],
               n_neighbors: int = 5, min_dist: float = 0.1) -> Dict[str, Any]:
        """Reduce feature vectors from 20D to 5D using UMAP."""
        features = payload.get('features', {})
        if not features:
            return {'embeddings': {}, 'botIds': [], 'dimensions': 5}

        bot_ids = sorted(features.keys())
        matrix = np.array([features[bid] for bid in bot_ids], dtype=np.float64)

        # Standardize features
        means = matrix.mean(axis=0)
        stds = matrix.std(axis=0)
        stds[stds == 0] = 1.0
        matrix_norm = (matrix - means) / stds

        n_samples = len(bot_ids)
        target_dim = 5

        if n_samples < 4:
            # Too few samples for UMAP — use PCA fallback
            return self._pca_fallback(bot_ids, matrix_norm, target_dim)

        if not HAS_UMAP:
            return self._pca_fallback(bot_ids, matrix_norm, target_dim)

        # UMAP with params tuned for small samples
        actual_neighbors = min(n_neighbors, n_samples - 1)
        reducer = umap.UMAP(
            n_components=target_dim,
            n_neighbors=actual_neighbors,
            min_dist=min_dist,
            metric='euclidean',
            random_state=42
        )
        embedded = reducer.fit_transform(matrix_norm)

        embeddings = {}
        for i, bid in enumerate(bot_ids):
            embeddings[bid] = embedded[i].tolist()

        return {'embeddings': embeddings, 'botIds': bot_ids, 'dimensions': target_dim}

    def _pca_fallback(self, bot_ids: List[str], matrix: np.ndarray,
                      target_dim: int) -> Dict[str, Any]:
        """PCA fallback when UMAP unavailable or too few samples."""
        from sklearn.decomposition import PCA

        n_components = min(target_dim, matrix.shape[0], matrix.shape[1])
        pca = PCA(n_components=n_components, random_state=42)
        embedded = pca.fit_transform(matrix)

        # Pad to target_dim if needed
        if embedded.shape[1] < target_dim:
            padding = np.zeros((embedded.shape[0], target_dim - embedded.shape[1]))
            embedded = np.hstack([embedded, padding])

        embeddings = {}
        for i, bid in enumerate(bot_ids):
            embeddings[bid] = embedded[i].tolist()

        return {'embeddings': embeddings, 'botIds': bot_ids, 'dimensions': target_dim,
                'method': 'pca_fallback'}
