from src.domain.entities import SensorData
from src.domain.repositories import SensorRepository
from datetime import datetime, timezone

class StoreSensorDataUseCase:
    def __init__(self, repository: SensorRepository):
        self.repository = repository

    def execute(self, temperature: float, humidity: float, state: str, aiclass: int = 0, aiconfidence: int = 0, alert: str = "NORMAL", msg: str = "Environment is optimal", level: str = "INFO") -> SensorData:
        sensor_data = SensorData(
            temperature=temperature,
            humidity=humidity,
            state=state,
            aiclass=aiclass,
            aiconfidence=aiconfidence,
            alert=alert,
            msg=msg,
            level=level,
            timestamp=datetime.now(timezone.utc)
        )
        self.repository.save(sensor_data)
        
        return sensor_data

import csv
import io

class ExportSensorDataCsvUseCase:
    def __init__(self, repository: SensorRepository):
        self.repository = repository

    def execute(self) -> str:
        data = self.repository.get_all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["timestamp", "temperature", "humidity", "state", "aiclass", "aiconfidence", "alert", "msg", "level"])
        for entry in data:
            writer.writerow([
                entry.timestamp.isoformat(), 
                entry.temperature, 
                entry.humidity, 
                entry.state,
                entry.aiclass,
                entry.aiconfidence,
                entry.alert,
                entry.msg,
                entry.level
            ])

        return output.getvalue()

class SendCommandUseCase:
    def __init__(self, mqtt_service, topic: str):
        self.mqtt_service = mqtt_service
        self.topic = topic

    def execute(self, status: str):
        message = {"status": status}
        return self.mqtt_service.publish(self.topic, message)
