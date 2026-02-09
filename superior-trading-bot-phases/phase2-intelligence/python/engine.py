"""
Phase 2 Intelligence ML Engine
Reads JSON requests from stdin, writes JSON responses to stdout.
All logging goes to stderr.
"""
import sys
import json
import time
import traceback
import importlib

# Lazy-load heavy modules to speed up startup
_modules = {}

def _get_module(name):
    if name not in _modules:
        if name == 'shapley':
            from shapley.attribution import ShapleyAttribution
            _modules[name] = ShapleyAttribution()
        elif name == 'patterns':
            from patterns.feature_extraction import FeatureExtractor
            from patterns.umap_reducer import UMAPReducer
            from patterns.hdbscan_clusterer import HDBSCANClusterer
            _modules['feature_extractor'] = FeatureExtractor()
            _modules['umap_reducer'] = UMAPReducer()
            _modules['hdbscan_clusterer'] = HDBSCANClusterer()
            _modules[name] = True
        elif name == 'xgboost':
            from competitive.xgboost_predictor import XGBoostPredictor
            _modules['xgboost'] = XGBoostPredictor()
        elif name == 'crowding':
            from competitive.crowding import CrowdingDetector
            _modules['crowding'] = CrowdingDetector()
        elif name == 'niche':
            from competitive.niche_discovery import NicheDiscovery
            _modules['niche'] = NicheDiscovery()
        elif name == 'fingerprint':
            from fingerprint.regime_matrix import RegimeMatrixBuilder
            _modules['regime_matrix'] = RegimeMatrixBuilder()
            _modules[name] = True
    return _modules.get(name)


def handle_request(req: dict) -> dict:
    req_type = req.get('type', '')
    payload = req.get('payload', {})
    start = time.time()

    try:
        if req_type == 'health:ping':
            result = {'status': 'ok', 'version': '2.0.0', 'timestamp': time.time()}

        elif req_type == 'shapley:batch':
            mod = _get_module('shapley')
            result = mod.compute_batch(payload)

        elif req_type == 'patterns:extract_features':
            _get_module('patterns')
            extractor = _modules['feature_extractor']
            result = extractor.extract(payload)

        elif req_type == 'patterns:cluster':
            _get_module('patterns')
            reducer = _modules['umap_reducer']
            clusterer = _modules['hdbscan_clusterer']
            features = payload.get('features', {})
            n_neighbors = payload.get('nNeighbors', 5)
            min_dist = payload.get('minDist', 0.1)
            min_cluster_size = payload.get('minClusterSize', 3)
            reduced = reducer.reduce({'features': features}, n_neighbors=n_neighbors, min_dist=min_dist)
            result = clusterer.cluster(reduced, min_cluster_size=min_cluster_size)

        elif req_type == 'competitive:train':
            _get_module('xgboost')
            result = _modules['xgboost'].train(payload)

        elif req_type == 'competitive:predict':
            _get_module('xgboost')
            result = _modules['xgboost'].predict(payload)

        elif req_type == 'competitive:predict_all':
            _get_module('xgboost')
            result = _modules['xgboost'].predict_all(payload)

        elif req_type == 'competitive:crowding':
            _get_module('crowding')
            result = _modules['crowding'].detect(payload)

        elif req_type == 'competitive:niches':
            _get_module('niche')
            result = _modules['niche'].analyze(payload)

        elif req_type == 'fingerprint:regime_matrix':
            _get_module('fingerprint')
            builder = _modules['regime_matrix']
            result = builder.build(payload)

        else:
            return {
                'id': req.get('id'),
                'type': f'{req_type}:error',
                'success': False,
                'error': f'Unknown request type: {req_type}',
                'payload': None,
                'processingTimeMs': round((time.time() - start) * 1000)
            }

        elapsed = round((time.time() - start) * 1000)
        return {
            'id': req.get('id'),
            'type': f'{req_type}:result',
            'success': True,
            'payload': result,
            'processingTimeMs': elapsed
        }

    except Exception as e:
        elapsed = round((time.time() - start) * 1000)
        log(f'Error handling {req_type}: {traceback.format_exc()}')
        return {
            'id': req.get('id'),
            'type': f'{req_type}:error',
            'success': False,
            'error': str(e),
            'payload': None,
            'processingTimeMs': elapsed
        }


def log(msg: str):
    print(f'[ML Engine] {msg}', file=sys.stderr, flush=True)


def main():
    log('Starting Phase 2 ML Engine...')
    log('Ready for requests on stdin')

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as e:
            log(f'Invalid JSON: {e}')
            continue

        response = handle_request(req)
        sys.stdout.write(json.dumps(response) + '\n')
        sys.stdout.flush()


if __name__ == '__main__':
    main()
