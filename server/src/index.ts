import app from './app.js';
import { env } from './config/env.js';

if (!env.IS_VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`);
    console.log(`Health check: http://localhost:${env.PORT}/health`);
  });
}

export default app;
