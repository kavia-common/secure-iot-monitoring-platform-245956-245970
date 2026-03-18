# IoT Security Monitoring Frontend

This React application is the web dashboard for the IoT Security Monitoring demo. It authenticates against the backend, fetches MongoDB-backed dashboard data through REST APIs, and subscribes to live updates over Socket.IO.

## Required environment variables

The real `.env` file is managed outside the repository. Use `iot_security_frontend/.env.example` as the contract.

| Variable | Purpose | Local demo value |
| --- | --- | --- |
| `REACT_APP_API_BASE_URL` | Backend REST origin | `http://localhost:3001` |
| `REACT_APP_SOCKET_URL` | Backend Socket.IO origin | `http://localhost:3001` |

For preview/deployed environments, point both values to the backend container URL.

## Local demo flow

1. Start the MongoDB database workspace and seed demo data.
2. Start the backend with a valid `JWT_SECRET`.
3. Start the frontend:
   - `cd iot_security_frontend`
   - `npm install`
   - `npm start`
4. Open the app and sign in with one of the seeded demo users:
   - `admin@iotsecure.demo / Admin123!`
   - `analyst@iotsecure.demo / User123!`

## What the frontend validates

- `GET /` for backend health and MongoDB readiness.
- `POST /api/auth/login` and `GET /api/auth/me` for authentication.
- `GET /api/stats/overview`, `GET /api/devices`, and `GET /api/events` for protected demo data.
- `POST /api/devices/:id/trigger` for end-to-end event simulation.
- Socket.IO realtime channels for device, event, and stats broadcasts.
