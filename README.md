# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

---

# LoL Tool Backend API

This project includes a Node.js backend server to handle uploading League of Legends match data.

## Setup

1.  **Configure Database:** Copy your MySQL database credentials into `db_config.js`.

    ```javascript
    // db_config.js
    export const dbConfig = {
      host: 'YOUR_RDS_HOST',
      user: 'YOUR_RDS_USER',
      password: 'YOUR_RDS_PASSWORD',
      database: 'YOUR_RDS_DB',
      port: 16816,
    };
    ```

2.  **Install Dependencies:** Run the following command to install required packages for both the frontend and backend.
    ```bash
    npm install
    ```

## Running the API Server

To start the backend server, run the following command. The server will listen on `http://localhost:3001`.

```bash
node server.js
```

## API Endpoint

### Upload Match Data

- **URL:** `/api/upload-match`
- **Method:** `POST`
- **Description:** Receives a single match data JSON object and saves the normalized data into the MySQL database. This replaces the functionality of the original `register.py` script.
- **Request Body:** The raw JSON object from the game's match history API.

    ```json
    {
      "id": 1234567890,
      "region": "NA",
      "participants": [ ... ],
      "teams": [ ... ],
      ...
    }
    ```
