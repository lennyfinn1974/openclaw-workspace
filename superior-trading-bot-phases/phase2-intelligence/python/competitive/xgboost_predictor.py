"""
Per-bot XGBoost Models
Predicts buy/sell/hold probabilities from 20D behavioral + indicator features.
Retrains every 100 trades per bot with exponential sample weighting.
"""
import numpy as np
from typing import Dict, Any

try:
    import xgboost as xgb
    HAS_XGB = True
except ImportError:
    HAS_XGB = False

from sklearn.ensemble import GradientBoostingClassifier


class XGBoostPredictor:
    def __init__(self):
        self.models: Dict[str, Any] = {}  # botId -> trained model
        self.train_counts: Dict[str, int] = {}

    def train(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        bot_id = payload.get('botId', '')
        features = np.array(payload.get('features', []), dtype=np.float64)
        labels = np.array(payload.get('labels', []), dtype=np.int32)
        sample_weights = payload.get('sampleWeights')

        if len(features) < 10 or len(labels) < 10:
            return {'botId': bot_id, 'trained': False,
                    'reason': 'insufficient_data', 'sampleCount': len(features)}

        # Exponential sample weighting if not provided
        if sample_weights is None:
            n = len(features)
            decay = 0.99
            sample_weights = [decay ** (n - 1 - i) for i in range(n)]
        sample_weights = np.array(sample_weights, dtype=np.float64)

        # Ensure all 3 classes present
        unique_labels = set(labels)
        if len(unique_labels) < 2:
            return {'botId': bot_id, 'trained': False,
                    'reason': 'single_class', 'sampleCount': len(features)}

        if HAS_XGB:
            model = self._train_xgb(features, labels, sample_weights)
        else:
            model = self._train_sklearn(features, labels, sample_weights)

        self.models[bot_id] = model
        self.train_counts[bot_id] = len(features)

        # Compute training accuracy
        preds = model.predict(features) if HAS_XGB else model.predict(features)
        accuracy = float(np.mean(preds == labels))

        return {
            'botId': bot_id,
            'trained': True,
            'sampleCount': len(features),
            'accuracy': round(accuracy, 4),
            'classDistribution': {
                'buy': int(np.sum(labels == 0)),
                'sell': int(np.sum(labels == 1)),
                'hold': int(np.sum(labels == 2))
            }
        }

    def _train_xgb(self, features, labels, weights):
        n_classes = len(set(labels))
        params = {
            'max_depth': 4,
            'objective': 'multi:softprob',
            'num_class': max(n_classes, 3),
            'eval_metric': 'mlogloss',
            'learning_rate': 0.1,
            'n_estimators': 100,
            'verbosity': 0,
            'random_state': 42
        }
        model = xgb.XGBClassifier(**params)
        model.fit(features, labels, sample_weight=weights)
        return model

    def _train_sklearn(self, features, labels, weights):
        model = GradientBoostingClassifier(
            max_depth=4, n_estimators=100, learning_rate=0.1, random_state=42
        )
        model.fit(features, labels, sample_weight=weights)
        return model

    def predict(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        bot_id = payload.get('botId', '')
        features = np.array(payload.get('features', []), dtype=np.float64).reshape(1, -1)

        if bot_id not in self.models:
            return {
                'botId': bot_id,
                'predicted': False,
                'reason': 'no_model'
            }

        model = self.models[bot_id]
        probs = model.predict_proba(features)[0]

        # Ensure 3 classes
        if len(probs) < 3:
            probs = list(probs) + [0.0] * (3 - len(probs))

        predicted_class = int(np.argmax(probs))
        actions = ['buy', 'sell', 'hold']

        return {
            'botId': bot_id,
            'predicted': True,
            'buyProb': round(float(probs[0]), 4),
            'sellProb': round(float(probs[1]), 4),
            'holdProb': round(float(probs[2]) if len(probs) > 2 else 0, 4),
            'predictedAction': actions[predicted_class],
            'confidence': round(float(max(probs)), 4),
            'modelAccuracy': round(self.train_counts.get(bot_id, 0) / 100, 2)
        }

    def predict_all(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        predictions_input = payload.get('predictions', {})
        results = {}

        for bot_id, features in predictions_input.items():
            result = self.predict({'botId': bot_id, 'features': features})
            results[bot_id] = result

        return {'predictions': results, 'botCount': len(results)}
