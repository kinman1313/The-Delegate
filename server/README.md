# Server

## Overview

This server is a core component of the application, responsible for handling backend logic, managing data, and providing APIs for client-side interactions. It serves as the central hub for processing requests, interacting with the database, and delivering data to users.

## Prerequisites

Before you begin, ensure you have the following software and tools installed:

- [Node.js](https://nodejs.org/) (version X.X.X or higher)
- [npm](https://www.npmjs.com/) (version X.X.X or higher) or [Yarn](https://yarnpkg.com/) (version X.X.X or higher)
- [MongoDB](https://www.mongodb.com/) (version X.X.X or higher)

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-name>/server
    ```

2.  **Install dependencies:**
    Using npm:
    ```bash
    npm install
    ```
    Or using Yarn:
    ```bash
    yarn install
    ```

## Configuration

1.  **Environment Variables:**
    The server uses environment variables for configuration. Create a `.env` file in the `server` directory by copying the example file:
    ```bash
    cp .env.example .env
    ```
    Modify the `.env` file with your specific settings. Key variables include:
    ```
    PORT=3000
    MONGODB_URI=mongodb://localhost:27017/your-database-name
    JWT_SECRET=your-jwt-secret
    SEARCH_API_KEY=your-search-api-key # For WebSearchTool

    # Rate Limiting (max requests per window)
    AUTH_RATE_LIMIT_MAX=20
    LLM_API_RATE_LIMIT_MAX=100
    AGENT_RATE_LIMIT_MAX=60
    FILE_UPLOAD_RATE_LIMIT_MAX=50
    GENERAL_API_RATE_LIMIT_MAX=200
    # Optional: Rate limit window durations (in milliseconds)
    # AUTH_RATE_LIMIT_WINDOW_MS=900000 (15 minutes)
    # LLM_API_RATE_LIMIT_WINDOW_MS=3600000 (1 hour)
    # ... and so on for AGENT, FILE_UPLOAD, GENERAL
    ```

    **Note:** Make sure your MongoDB instance is running and accessible. The JWT_SECRET should be a long, random string for security.

## Running the Server

To start the server, run the following command:

Using npm:
```bash
npm start
```

Or using Yarn:
```bash
yarn start
```

The server will typically run on `http://localhost:PORT`, where `PORT` is the value specified in your `.env` file (default is 3000).

## API Endpoints

The server exposes various API routes. Key routes include:

-   **User Authentication:**
    -   `POST /api/users/register`: Creates a new user.
    -   `POST /api/users/login`: Authenticates a user and returns a JWT.
-   **API Keys:**
    -   `POST /api/keys`: Adds or updates an API key for a user and provider.
    -   `GET /api/keys`: Retrieves providers for which a user has API keys.
-   **LLM Chat Proxy:**
    -   `POST /api/chat/:provider`: Proxies chat requests to the specified LLM provider.
-   **File Management:**
    -   `POST /api/files/upload`: Uploads a file.
    -   `GET /api/files/:fileId/download`: Downloads a specific file.
    -   `GET /api/files`: Lists files for a user/conversation.
    -   `POST /api/files/:fileId/process`: Processes a file for operations like summarization.
-   **Agent System:**
    -   `POST /api/agent/execute`: Processes a user request using the agent orchestrator.
    -   `GET /api/agent/tools`: Retrieves a list of available agent tools.
    -   `GET /api/agent/history`: Retrieves agent execution history for a conversation.

*(This is not an exhaustive list. Refer to `server/server.ts` for all routes.)*

## Security Features

-   **Helmet:** Applies various HTTP headers to enhance security (e.g., XSS protection, CSP).
-   **Rate Limiting:** Protects against brute-force and denial-of-service attacks by limiting request rates on sensitive endpoints. Configurable via `.env` variables.
-   **Input Validation:** User inputs on critical routes (like authentication) are validated to prevent common vulnerabilities.
-   **Authentication:** Uses JWTs to secure API endpoints.

## Error Handling

The server uses a centralized error handling mechanism. Errors are returned in a standardized JSON format:

```json
{
  "status": "error" | "fail", // "fail" for 4xx, "error" for 5xx
  "errorType": "SpecificErrorType", // e.g., "ValidationError", "AuthenticationError"
  "message": "A descriptive error message."
  // "stack": "...", // Included in development mode
  // "errorCode": "..." // Optional application-specific error code
}
```
This ensures consistent error responses across all API endpoints.

## Agent Architecture

The server includes an agent system designed to understand user requests, select appropriate tools, execute them, and synthesize a response.

-   **`AgentOrchestrator`**: The core component that manages the lifecycle of a task. It uses a `ToolBelt` to access available tools.
-   **`Tool`**: An interface for capabilities the agent can use (e.g., `WebSearchTool`, `DocumentAnalysisTool`).
-   **`ToolBelt`**: Manages the registration and retrieval of tools.
-   **`Task`**: Represents a user's request and its processing state.
-   **`AgentResponse`**: The structured output from the agent, including the final answer and the execution path.

The agent system is extensible, allowing new tools to be added to enhance its capabilities. The primary interaction point is the `/api/agent/execute` endpoint.

## Project Structure

The server directory is organized as follows:

```
server/
├── .env.example         # Example environment variables
├── .env                 # Environment variables (ignored by Git)
├── .gitignore           # Specifies intentionally untracked files that Git should ignore
├── node_modules/        # Project dependencies (ignored by Git)
├── src/
│   ├── config/          # Configuration files (potentially rateLimits.ts if separated)
│   ├── controllers/     # Request handlers (if refactored from server.ts)
│   ├── middleware/      # Custom middleware (auth.ts, errorHandler.ts, etc.)
│   ├── models/          # Database schemas and models (User, Conversation, etc.)
│   ├── routes/          # API route definitions (if refactored from server.ts)
│   ├── services/        # Business logic services (documentProcessor.ts, etc.)
│   ├── agent/           # Agent-related logic (Orchestrator, Tools, etc.)
│   └── types/           # TypeScript type definitions (if centralized)
├── package.json         # Project metadata and dependencies
├── yarn.lock / package-lock.json # Lockfile for dependencies
├── tsconfig.json        # TypeScript compiler configuration
└── README.md            # This file
```

-   **`src/`**: Contains the main source code for the server.
    -   **`middleware/`**: Holds custom middleware like `errorHandler.ts`.
    -   **`services/`**: Contains services like `documentProcessor.ts`.
    -   **`agent/`**: Contains the agent framework components.
-   **`server.ts`**: The main entry point for the Express application, sets up middleware, routes, and starts the server.
-   **`package.json`**: Lists project dependencies and scripts.
-   **`.env.example`**: Provides a template for environment variables.

*(The project structure might evolve as the application grows. Consider refactoring routes and controllers into separate files/directories for better organization.)*
