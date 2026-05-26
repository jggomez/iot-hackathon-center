from pydantic import BaseModel

import base64
import json
from pydantic import BaseModel, field_validator
from typing import Any, Dict

class SensorDataRequest(BaseModel):
    temperature: float
    humidity: float
    state: str
    aiclass: int = 0
    aiconfidence: int = 0
    alert: str = "NORMAL"
    msg: str = "Environment is optimal"
    level: str = "INFO"

class PubSubMessage(BaseModel):
    data: str
    messageId: str
    publishTime: str

    @property
    def decoded_data(self) -> Dict[str, Any]:
        try:
            decoded_bytes = base64.b64decode(self.data)
            return json.loads(decoded_bytes.decode('utf-8'))
        except Exception as e:
            raise ValueError(f"Invalid base64 or JSON data: {str(e)}")

class PubSubRequest(BaseModel):
    message: PubSubMessage

class SensorDataResponse(BaseModel):
    temperature: float
    humidity: float
    state: str
    aiclass: int = 0
    aiconfidence: int = 0
    alert: str = "NORMAL"
    msg: str = ""
    level: str = "INFO"
    timestamp: str
    message: str = "Data stored successfully"

class DeviceCommandRequest(BaseModel):
    status: str
