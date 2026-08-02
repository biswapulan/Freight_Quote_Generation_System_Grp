# Freight_Quote_System
An AI-powered Freight Quote Generation System developed using React and Django to simplify logistics, shipment management, and intelligent freight quote generation.

## Deployment Notes

### Frontend on Vercel

Use the `client` folder as the Vercel project root.

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

The `client/vercel.json` file is included so React Router pages like `/login` and `/dashboard` work when opened directly.

Vercel environment variable:

```env
VITE_API_BASE_URL=https://freight-quote-generation-system-grp.onrender.com/api
```

After the first Vercel deployment, copy the production URL, for example:

```text
https://your-frontend.vercel.app
```

### Backend on Render

Set these backend environment variables on Render:

```env
DEBUG=False
ALLOWED_HOSTS=freight-quote-generation-system-grp.onrender.com
CORS_ALLOWED_ORIGINS=https://your-frontend.vercel.app
CSRF_TRUSTED_ORIGINS=https://your-frontend.vercel.app
```

Keep `SECRET_KEY`, `MONGO_URI`, and `MONGO_DB_NAME` set on Render as secrets. Do not add those values to Vercel.

For local frontend development, include both origins on the backend:

```env
CORS_ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
CSRF_TRUSTED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app
```
