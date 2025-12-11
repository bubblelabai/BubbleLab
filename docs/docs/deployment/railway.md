# Deploying BubbleLab on Railway

This guide explains how to deploy the BubbleLab backend on **Railway** using
Railway’s standard “Deploy from GitHub” workflow for **Node.js applications**.

No custom infrastructure or Docker configuration is required.

---

## Prerequisites

Before you begin, ensure you have:

- A GitHub account
- A Railway account (https://railway.app)
- BubbleLab source code pushed to a GitHub repository
- Node.js project with a `package.json`
- A working `start` script that launches the server

---

## How Railway Deploys Node.js Applications

Railway automatically detects Node.js applications by the presence of a
`package.json` file.

During deployment, Railway:

1. Installs dependencies
2. Runs the build command (if defined)
3. Executes the `start` command
4. Injects runtime environment variables (including `PORT`)

**Important:**  
Your server **must listen on `process.env.PORT`**. Hard-coding ports (e.g. `3000`)
will cause the deployment to fail.

Example:

```js
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`BubbleLab server running on port ${port}`);
});
```

## Deployment Steps

### Step 1: Push BubbleLab to GitHub

Ensure your BubbleLab repository is pushed to GitHub:

```bash
git status
git push origin main

```

### Step 2: Create a Railway Project

1. Log in to the Railway dashboard
2. Click New Project
3. Select Deploy from GitHub Repo
4. Choose your BubbleLab repository
5. Railway will automatically begin the first deployment.

### Step 3: Confirm Build and Start Commands

Railway attempts to auto-detect commands from package.json.

Example configuration:

```
{
  "scripts": {
    "build": "npm run build",
    "start": "node dist/index.js"
  }
}
```

#### If auto-detection fails:

- Open the service in the Railway dashboard
- Set the Build Command and Start Command manually

### Environment Variables

BubbleLab requires environment variables to function correctly.

#### Add Variables in Railway

1. Open your BubbleLab service in Railway
2. Navigate to Variables
3. Add required keys, for example:

```
OPENROUTER_API_KEY=your_key_here
GOOGLE_API_KEY=your_key_here
DATABASE_URL=your_database_url
NODE_ENV=production

```

### Notes

- Railway automatically provides the PORT variable
- Do not commit secrets to the repository
