"""
Predictive Churn Model using Random Forest
==========================================

Purpose:
  Predicts account churn probability within 60 days using:
  - Login frequency velocity (30-day rolling window)
  - Support ticket volume and severity trends
  - NPS score trends
  - Renewal proximity

Usage:
  python scripts/churn_prediction.py --account_id <uuid> --predict
  python scripts/churn_prediction.py --train --input data/accounts_historical.csv

Output:
  - Churn probability (0.0 - 1.0)
  - Top feature importances (JSON)
  - Recommendations for intervention
"""

import os
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import numpy as np
import pandas as pd

try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
    import joblib
except ImportError:
    print("Error: Required packages not installed.")
    print("Run: pip install scikit-learn pandas numpy joblib psycopg2-binary")
    sys.exit(1)

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
except ImportError:
    print("Error: psycopg2 not installed. Run: pip install psycopg2-binary")
    sys.exit(1)


class ChurnPredictor:
    """
    Machine learning model for predicting account churn within 60 days.
    """
    
    MODEL_PATH = "models/churn_model.pkl"
    SCALER_PATH = "models/churn_scaler.pkl"
    FEATURE_NAMES = [
        'login_frequency_30d',
        'login_velocity_trend',
        'support_tickets_30d',
        'critical_tickets_count',
        'urgent_tickets_count',
        'avg_resolution_time_hours',
        'nps_score',
        'nps_trend',
        'days_to_renewal',
        'renewal_probability',
        'usage_score',
        'support_score',
        'engagement_trend'
    ]
    
    def __init__(self, db_connection_string: str):
        """Initialize predictor with database connection."""
        self.conn_string = db_connection_string
        self.model = None
        self.scaler = None
        self._load_model()
    
    def _load_model(self):
        """Load pre-trained model if exists."""
        if os.path.exists(self.MODEL_PATH):
            self.model = joblib.load(self.MODEL_PATH)
            self.scaler = joblib.load(self.SCALER_PATH)
            print(f"✓ Loaded model from {self.MODEL_PATH}")
        else:
            print("⚠ No pre-trained model found. Train first using --train flag.")
    
    def _get_db_connection(self):
        """Establish database connection."""
        try:
            conn = psycopg2.connect(self.conn_string)
            return conn
        except Exception as e:
            print(f"Error connecting to database: {e}")
            sys.exit(1)
    
    def _fetch_account_features(self, account_id: str) -> Dict[str, float]:
        """
        Fetch all features for an account from database.
        
        Returns:
            Dictionary of feature values for the account
        """
        conn = self._get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get account and health data
            cur.execute("""
                SELECT
                    a.id,
                    a.status,
                    hs.overall_score,
                    hs.usage_score,
                    hs.notes as health_details,
                    rd.days_to_renewal,
                    rd.renewal_probability,
                    rd.churn_risk_flag
                FROM accounts a
                LEFT JOIN health_scores hs ON a.id = hs.account_id
                    AND hs.calculated_at = (
                        SELECT MAX(calculated_at) 
                        FROM health_scores 
                        WHERE account_id = a.id
                    )
                LEFT JOIN renewal_data rd ON a.id = rd.account_id
                    AND rd.created_at = (
                        SELECT MAX(created_at)
                        FROM renewal_data
                        WHERE account_id = a.id
                    )
                WHERE a.id = %s
            """, (account_id,))
            
            account_data = cur.fetchone()
            if not account_data:
                raise ValueError(f"Account {account_id} not found")
            
            # Get login frequency (30-day window)
            cur.execute("""
                SELECT COUNT(*) as login_count
                FROM usage_events
                WHERE account_id = %s
                  AND event_type = 'login'
                  AND created_at > NOW() - INTERVAL '30 days'
            """, (account_id,))
            
            login_data = cur.fetchone()
            login_frequency = login_data['login_count'] if login_data else 0
            
            # Get login velocity (trend comparison: last 7 days vs 7-14 days)
            cur.execute("""
                SELECT
                    SUM(CASE WHEN created_at > NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as recent_7d,
                    SUM(CASE WHEN created_at > NOW() - INTERVAL '14 days' AND created_at <= NOW() - INTERVAL '7 days' THEN 1 ELSE 0 END) as prior_7d
                FROM usage_events
                WHERE account_id = %s
                  AND event_type = 'login'
            """, (account_id,))
            
            velocity_data = cur.fetchone()
            recent = velocity_data['recent_7d'] or 0
            prior = velocity_data['prior_7d'] or 1  # Avoid division by zero
            login_velocity = (recent - prior) / prior if prior > 0 else 0
            
            # Get support ticket metrics
            cur.execute("""
                SELECT
                    COUNT(*) as total_tickets,
                    SUM(CASE WHEN severity = 'Critical' THEN 1 ELSE 0 END) as critical_count,
                    SUM(CASE WHEN severity = 'Urgent' THEN 1 ELSE 0 END) as urgent_count,
                    AVG(CASE 
                        WHEN resolved_at IS NOT NULL 
                        THEN EXTRACT(HOUR FROM (resolved_at - created_at))
                        ELSE NULL 
                    END) as avg_resolution_hours
                FROM support_tickets
                WHERE account_id = %s
                  AND created_at > NOW() - INTERVAL '30 days'
                  AND status IN ('Resolved', 'Closed')
            """, (account_id,))
            
            ticket_data = cur.fetchone()
            tickets_30d = ticket_data['total_tickets'] if ticket_data else 0
            critical_tickets = ticket_data['critical_count'] or 0
            urgent_tickets = ticket_data['urgent_count'] or 0
            avg_resolution = ticket_data['avg_resolution_hours'] or 0
            
            # Get NPS data (from crm_attributes if available, else default)
            # In production, this would come from survey integration
            nps_score = 50  # Placeholder
            nps_trend = 0    # Placeholder
            
            # Get engagement trend (health score change over time)
            cur.execute("""
                SELECT
                    overall_score,
                    LAG(overall_score) OVER (ORDER BY calculated_at) as prev_score
                FROM health_scores
                WHERE account_id = %s
                ORDER BY calculated_at DESC
                LIMIT 2
            """, (account_id,))
            
            engagement_rows = cur.fetchall()
            engagement_trend = 0
            if len(engagement_rows) == 2:
                current = engagement_rows[0]['overall_score'] or 50
                previous = engagement_rows[1]['overall_score'] or 50
                engagement_trend = current - previous
            
            # Assemble feature dict
            features = {
                'login_frequency_30d': float(login_frequency),
                'login_velocity_trend': float(login_velocity),
                'support_tickets_30d': float(tickets_30d),
                'critical_tickets_count': float(critical_tickets),
                'urgent_tickets_count': float(urgent_tickets),
                'avg_resolution_time_hours': float(avg_resolution),
                'nps_score': float(nps_score),
                'nps_trend': float(nps_trend),
                'days_to_renewal': float(account_data['days_to_renewal'] or 180),
                'renewal_probability': float(account_data['renewal_probability'] or 0.5),
                'usage_score': float(account_data['usage_score'] or 50),
                'support_score': float(100 - (critical_tickets * 20 + urgent_tickets * 10)),  # Derived
                'engagement_trend': float(engagement_trend)
            }
            
            return features
        
        finally:
            cur.close()
            conn.close()
    
    def predict(self, account_id: str) -> Dict:
        """
        Predict churn probability for an account.
        
        Args:
            account_id: UUID of account to predict for
            
        Returns:
            Dictionary with:
                - churn_probability: 0.0 - 1.0
                - risk_level: 'Low', 'Medium', 'High', 'Critical'
                - feature_importances: Top features driving the prediction
                - recommendations: Suggested intervention actions
        """
        if not self.model:
            raise RuntimeError("Model not trained. Run with --train flag first.")
        
        # Fetch features from database
        features = self._fetch_account_features(account_id)
        
        # Prepare feature array in same order as training
        X = np.array([[features[fn] for fn in self.FEATURE_NAMES]])
        
        # Normalize using stored scaler
        X_scaled = self.scaler.transform(X)
        
        # Get prediction and probability
        churn_prob = self.model.predict_proba(X_scaled)[0][1]  # Probability of churn
        
        # Get feature importances
        importances = self.model.feature_importances_
        feature_importance_dict = dict(zip(self.FEATURE_NAMES, importances))
        top_features = sorted(feature_importance_dict.items(), key=lambda x: x[1], reverse=True)[:5]
        
        # Determine risk level
        if churn_prob < 0.2:
            risk_level = 'Low'
        elif churn_prob < 0.4:
            risk_level = 'Medium'
        elif churn_prob < 0.7:
            risk_level = 'High'
        else:
            risk_level = 'Critical'
        
        # Generate recommendations
        recommendations = self._generate_recommendations(features, churn_prob, top_features)
        
        return {
            'account_id': account_id,
            'churn_probability': float(churn_prob),
            'risk_level': risk_level,
            'prediction_date': datetime.now().isoformat(),
            'feature_importances': [
                {'feature': fname, 'importance': float(fimportance)}
                for fname, fimportance in top_features
            ],
            'top_risk_factors': [fname for fname, _ in top_features],
            'recommendations': recommendations
        }
    
    def _generate_recommendations(self, features: Dict, churn_prob: float, top_features: List) -> List[str]:
        """Generate intervention recommendations based on prediction."""
        recommendations = []
        
        if churn_prob > 0.6:
            # Critical churn risk
            recommendations.append("🚨 URGENT: Schedule executive business review")
            recommendations.append("Assign dedicated CSM if not already assigned")
            recommendations.append("Review contract terms and pricing concerns")
        
        # Feature-specific recommendations
        feature_names = [f[0] for f in top_features]
        
        if 'login_frequency_30d' in feature_names and features['login_frequency_30d'] < 5:
            recommendations.append("📊 Low engagement detected: Analyze feature adoption barriers")
            recommendations.append("Action: Send educational content about core use cases")
        
        if 'critical_tickets_count' in feature_names and features['critical_tickets_count'] > 0:
            recommendations.append("⚠️ Critical support issues unresolved: Escalate immediately")
            recommendations.append("Action: Provide dedicated technical support")
        
        if 'days_to_renewal' in feature_names and features['days_to_renewal'] < 90:
            recommendations.append("⏰ Renewal approaching: Begin retention campaign")
            recommendations.append("Action: Prepare renewal presentation with expansion opportunities")
        
        if 'login_velocity_trend' in feature_names and features['login_velocity_trend'] < -0.3:
            recommendations.append("📉 Declining usage trend: Investigate root cause")
            recommendations.append("Action: Interview key users about blockers or concerns")
        
        if not recommendations:
            recommendations.append("Continue monitoring account health")
            recommendations.append("Schedule quarterly business review")
        
        return recommendations
    
    def train(self, data_path: str, test_split: float = 0.2):
        """
        Train Random Forest model on historical data.
        
        Args:
            data_path: CSV file with historical account data including churn labels
            test_split: Fraction of data to use for testing
        """
        print(f"📖 Loading training data from {data_path}")
        
        # Load data
        df = pd.read_csv(data_path)
        
        # Extract features and target
        X = df[self.FEATURE_NAMES].fillna(0)
        y = df['churned'].astype(int)  # Binary: 0=retained, 1=churned
        
        # Split and normalize
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_split, random_state=42
        )
        
        self.scaler = StandardScaler()
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Train Random Forest
        print("🎓 Training Random Forest classifier...")
        self.model = RandomForestClassifier(
            n_estimators=100,
            max_depth=15,
            min_samples_split=10,
            min_samples_leaf=5,
            random_state=42,
            n_jobs=-1,
            class_weight='balanced'
        )
        self.model.fit(X_train_scaled, y_train)
        
        # Evaluate
        train_score = self.model.score(X_train_scaled, y_train)
        test_score = self.model.score(X_test_scaled, y_test)
        
        print(f"✓ Training accuracy: {train_score:.3f}")
        print(f"✓ Testing accuracy: {test_score:.3f}")
        
        # Save model
        os.makedirs("models", exist_ok=True)
        joblib.dump(self.model, self.MODEL_PATH)
        joblib.dump(self.scaler, self.SCALER_PATH)
        print(f"✓ Model saved to {self.MODEL_PATH}")
        
        # Print feature importances
        importances = self.model.feature_importances_
        feature_importance = sorted(
            zip(self.FEATURE_NAMES, importances),
            key=lambda x: x[1],
            reverse=True
        )
        
        print("\n📊 Feature Importances:")
        for fname, fimportance in feature_importance[:5]:
            print(f"  {fname}: {fimportance:.3f}")


def main():
    """CLI entry point."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Account Churn Prediction Model")
    parser.add_argument(
        '--db-url',
        default=os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/customer_success'),
        help='Database connection URL'
    )
    parser.add_argument('--predict', action='store_true', help='Predict churn for account')
    parser.add_argument('--account-id', help='Account UUID to predict')
    parser.add_argument('--train', action='store_true', help='Train new model')
    parser.add_argument('--input', help='CSV file for training')
    
    args = parser.parse_args()
    
    predictor = ChurnPredictor(args.db_url)
    
    if args.train:
        if not args.input:
            print("Error: --input required for training")
            sys.exit(1)
        predictor.train(args.input)
    
    elif args.predict:
        if not args.account_id:
            print("Error: --account-id required for prediction")
            sys.exit(1)
        
        result = predictor.predict(args.account_id)
        print(json.dumps(result, indent=2))
    
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
