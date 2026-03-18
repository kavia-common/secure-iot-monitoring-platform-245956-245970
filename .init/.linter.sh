#!/bin/bash
cd /home/kavia/workspace/code-generation/secure-iot-monitoring-platform-245956-245970/iot_security_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

