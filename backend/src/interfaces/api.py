import logging
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from src.interfaces.schemas import SensorDataRequest, SensorDataResponse, PubSubRequest, DeviceCommandRequest
from src.application.use_cases import StoreSensorDataUseCase, ExportSensorDataCsvUseCase, SendCommandUseCase
from src.infrastructure.firestore_repository import FirestoreSensorRepository
from src.infrastructure.mqtt_client import mqtt_service
import os

router = APIRouter()
logger = logging.getLogger(__name__)

_repository = FirestoreSensorRepository()
_mqtt_topic = os.getenv("MQTT_TOPIC")

def get_use_case():
    return StoreSensorDataUseCase(_repository)

def get_mqtt_use_case():
    return SendCommandUseCase(mqtt_service, _mqtt_topic)

@router.post("/device/command")
async def send_device_command(
    request: DeviceCommandRequest, use_case: SendCommandUseCase = Depends(get_mqtt_use_case)
):
    try:
        success = use_case.execute(status=request.status)
        if success:
            return {"message": f"Command {request.status} sent successfully"}
        else:
            # If use_case returns False, it means MQTT failed despite retry attempts
            raise HTTPException(
                status_code=503, 
                detail="MQTT broker is currently unavailable or rejected the command. Please check backend logs."
            )
    except HTTPException as he:
        raise he
    except Exception as e:
        error_msg = f"Failed to send command to MQTT broker: {str(e)}"
        logger.error(error_msg, exc_info=True)
        raise HTTPException(status_code=500, detail=error_msg)


@router.post("/sensors", response_model=SensorDataResponse)
async def store_sensor_data(
    request: SensorDataRequest, use_case: StoreSensorDataUseCase = Depends(get_use_case)
):
    try:
        stored_data = use_case.execute(
            temperature=request.temperature,
            humidity=request.humidity,
            state=request.state,
            aiclass=request.aiclass,
            aiconfidence=request.aiconfidence,
            alert=request.alert,
            msg=request.msg,
            level=request.level,
        )
        logger.info("Successfully stored sensor data from direct API")
        return SensorDataResponse(
            temperature=stored_data.temperature,
            humidity=stored_data.humidity,
            state=stored_data.state,
            aiclass=stored_data.aiclass,
            aiconfidence=stored_data.aiconfidence,
            alert=stored_data.alert,
            msg=stored_data.msg,
            level=stored_data.level,
            timestamp=stored_data.timestamp.isoformat(),
        )
    except Exception as e:
        logger.error(f"Error storing sensor data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sensors/pubsub", status_code=204)
async def store_pubsub_data(
    request: PubSubRequest, use_case: StoreSensorDataUseCase = Depends(get_use_case)
):
    try:
        data = request.message.decoded_data
        logger.info(f"Received Pub/Sub message: {data}")

        state = data.get("state") or data.get("status") or "unknown"

        use_case.execute(
            temperature=data.get("temperature", 0.0),
            humidity=data.get("humidity", 0.0),
            state=state,
            aiclass=data.get("aiclass", 0),
            aiconfidence=data.get("aiconfidence", 0),
            alert=data.get("alert", "NORMAL"),
            msg=data.get("msg", "Environment is optimal"),
            level=data.get("level", "INFO"),
        )
        return
    except Exception as e:
        logger.error(f"Error processing Pub/Sub message: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error processing message: {str(e)}"
        )

@router.get("/sensors/export")
async def export_sensor_data():
    try:
        use_case = ExportSensorDataCsvUseCase(_repository)
        csv_string = use_case.execute()
        return Response(
            content=csv_string,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=sensor_data.csv"}
        )
    except Exception as e:
        logger.error(f"Error exporting sensor data: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
