from google.cloud import firestore
from src.domain.entities import SensorData
from src.infrastructure.firestore_repository import FirestoreSensorRepository
from datetime import datetime, timezone
import os

# Set PYTHONPATH to include src
import sys
sys.path.append(os.path.join(os.getcwd(), 'src'))

def test_save():
    project_id = "lab-iot-493715"
    db = firestore.Client(project=project_id)
    repo = FirestoreSensorRepository()
    repo.collection = db.collection("sensor_data")
    
    data = SensorData(
        temperature=22.2,
        humidity=44.4,
        state="test",
        aiclass=1,
        aiconfidence=99,
        timestamp=datetime.now(timezone.utc)
    )
    
    print(f"Attempting to save: {data.to_dict()}")
    repo.save(data)
    print("Save call completed. Check Firestore or run check_firestore.py")

if __name__ == "__main__":
    test_save()
