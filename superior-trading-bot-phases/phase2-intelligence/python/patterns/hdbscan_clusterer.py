"""
HDBSCAN Clustering: Groups bots into strategy archetypes.
Expected output: 3-7 clusters from 21 bots.
"""
import numpy as np
from typing import Dict, Any

try:
    import hdbscan
    HAS_HDBSCAN = True
except ImportError:
    HAS_HDBSCAN = False

from sklearn.metrics import silhouette_score


class HDBSCANClusterer:
    def cluster(self, embeddings_result: Dict[str, Any],
                min_cluster_size: int = 3) -> Dict[str, Any]:
        """Cluster 5D embeddings into archetypes."""
        embeddings = embeddings_result.get('embeddings', {})
        if not embeddings:
            return {'archetypes': [], 'assignments': {}, 'noise': [],
                    'silhouetteScore': 0, 'timestamp': 0}

        bot_ids = sorted(embeddings.keys())
        matrix = np.array([embeddings[bid] for bid in bot_ids], dtype=np.float64)

        n_samples = len(bot_ids)
        if n_samples < min_cluster_size * 2:
            # Too few for meaningful clustering — use single cluster
            return self._single_cluster(bot_ids, matrix)

        if HAS_HDBSCAN:
            labels = self._hdbscan_cluster(matrix, min_cluster_size)
        else:
            labels = self._kmeans_fallback(matrix, min_cluster_size)

        return self._build_result(bot_ids, matrix, labels)

    def _hdbscan_cluster(self, matrix: np.ndarray, min_cluster_size: int) -> np.ndarray:
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=2,
            metric='euclidean',
            cluster_selection_method='eom'
        )
        return clusterer.fit_predict(matrix)

    def _kmeans_fallback(self, matrix: np.ndarray, min_cluster_size: int) -> np.ndarray:
        """K-means fallback when HDBSCAN unavailable."""
        from sklearn.cluster import KMeans

        n_samples = matrix.shape[0]
        # Try 3-7 clusters, pick best silhouette
        best_score = -1
        best_labels = np.zeros(n_samples, dtype=int)

        max_k = min(7, n_samples // min_cluster_size)
        for k in range(3, max_k + 1):
            km = KMeans(n_clusters=k, random_state=42, n_init=10)
            labels = km.fit_predict(matrix)
            if len(set(labels)) > 1:
                score = silhouette_score(matrix, labels)
                if score > best_score:
                    best_score = score
                    best_labels = labels

        return best_labels

    def _build_result(self, bot_ids, matrix, labels):
        unique_labels = set(labels)
        unique_labels.discard(-1)  # remove noise label

        archetypes = []
        assignments = {}
        noise = []

        for label in sorted(unique_labels):
            member_indices = [i for i, l in enumerate(labels) if l == label]
            member_bots = [bot_ids[i] for i in member_indices]
            centroid = matrix[member_indices].mean(axis=0).tolist()

            archetype = {
                'id': int(label),
                'label': f'Archetype-{label}',
                'memberBotIds': member_bots,
                'centroid5D': centroid,
                'dominantTraits': self._infer_traits(matrix[member_indices]),
                'avgPerformance': 0  # filled by TS coordinator
            }
            archetypes.append(archetype)
            for bid in member_bots:
                idx = bot_ids.index(bid)
                dist = float(np.linalg.norm(matrix[idx] - np.array(centroid)))
                assignments[bid] = {
                    'archetypeId': int(label),
                    'distance': dist,
                    'coords5D': matrix[idx].tolist()
                }

        # Noise points
        noise_indices = [i for i, l in enumerate(labels) if l == -1]
        noise = [bot_ids[i] for i in noise_indices]
        for bid in noise:
            idx = bot_ids.index(bid)
            assignments[bid] = {
                'archetypeId': -1,
                'distance': 0,
                'coords5D': matrix[idx].tolist()
            }

        # Silhouette score (only if 2+ clusters)
        sil_score = 0.0
        non_noise = [l for l in labels if l != -1]
        if len(set(non_noise)) > 1 and len(non_noise) > 2:
            mask = labels != -1
            sil_score = float(silhouette_score(matrix[mask], labels[mask]))

        return {
            'archetypes': archetypes,
            'assignments': assignments,
            'noise': noise,
            'silhouetteScore': round(sil_score, 4),
            'clusterCount': len(archetypes)
        }

    def _infer_traits(self, member_matrix: np.ndarray):
        """Infer dominant traits from feature means."""
        means = member_matrix.mean(axis=0)
        # Feature indices map to behavioral dimensions
        trait_names = [
            'high_frequency', 'long_holding', 'variable_holding',
            'buy_biased', 'direction_flipper',
            'large_positions', 'variable_sizing',
            'trend_up_affinity', 'trend_down_affinity',
            'range_trader', 'volatility_seeker',
            'rsi_contrarian', 'bb_mean_reverter',
            'macd_follower', 'trend_follower',
            'high_win_rate', 'high_returns',
            'sharpe_optimizer', 'low_drawdown',
            'high_confidence'
        ]
        # Top 3 traits by absolute magnitude
        top_indices = np.argsort(np.abs(means))[-3:][::-1]
        traits = []
        for idx in top_indices:
            if idx < len(trait_names):
                traits.append(trait_names[idx])
        return traits

    def _single_cluster(self, bot_ids, matrix):
        centroid = matrix.mean(axis=0).tolist()
        assignments = {}
        for i, bid in enumerate(bot_ids):
            dist = float(np.linalg.norm(matrix[i] - np.array(centroid)))
            assignments[bid] = {
                'archetypeId': 0,
                'distance': dist,
                'coords5D': matrix[i].tolist()
            }
        return {
            'archetypes': [{
                'id': 0,
                'label': 'Archetype-0',
                'memberBotIds': bot_ids,
                'centroid5D': centroid,
                'dominantTraits': ['all_bots'],
                'avgPerformance': 0
            }],
            'assignments': assignments,
            'noise': [],
            'silhouetteScore': 0,
            'clusterCount': 1
        }
