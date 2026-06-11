import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import filesRoutes from './routes/files.routes';
import foldersRoutes from './routes/folders.routes';
import linksRoutes from './routes/links.routes';
import publicRoutes from './routes/public.routes';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import { errorMiddleware } from './middleware/error.middleware';

dotenv.config();

export const app = express();

// Middlewares
app.use(helmet());

// Configuración de CORS: permite múltiples orígenes y URLs de Cloudflare Tunnel
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
const allowedOrigins = corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);

/** localhost y 127.0.0.1 con el mismo puerto cuentan como el mismo sitio para el usuario, pero el navegador los trata como orígenes distintos. */
function expandLocalhostAliases(origins: string[]): string[] {
  const set = new Set(origins);
  for (const o of origins) {
    try {
      const u = new URL(o);
      if (u.hostname === 'localhost') {
        u.hostname = '127.0.0.1';
        set.add(u.toString());
      } else if (u.hostname === '127.0.0.1') {
        u.hostname = 'localhost';
        set.add(u.toString());
      }
    } catch {
      /* ignore */
    }
  }
  return Array.from(set);
}

const allowedOriginsExpanded = expandLocalhostAliases(allowedOrigins);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origen (ej: Postman, mobile apps)
    if (!origin) {
      return callback(null, true);
    }

    // Permitir si está en la lista de orígenes permitidos (incl. alias localhost ↔ 127.0.0.1)
    if (allowedOriginsExpanded.includes(origin)) {
      return callback(null, true);
    }
    
    // Permitir automáticamente cualquier URL de Cloudflare Tunnel
    if (origin.includes('trycloudflare.com')) {
      return callback(null, true);
    }
    
    // Permitir automáticamente cualquier URL de ngrok
    if (origin.includes('ngrok-free.dev') || origin.includes('ngrok.io')) {
      return callback(null, true);
    }
    
    // Denegar otros orígenes
    callback(new Error('No permitido por CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes públicas (sin autenticación)
app.use('/v', publicRoutes);

// Routes con autenticación
app.use('/api/auth', authRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/folders', foldersRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorMiddleware);

