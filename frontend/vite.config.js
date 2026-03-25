import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/** 开发阶段：Vite 开发服务器对静态资源/HMR 放开跨域（仅 npm run dev 生效） */
const devCors = {
  origin: true,
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  preflightContinue: false
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  /**
   * 开发时 /api 转发目标，须与后端监听地址一致（backend 默认 PORT=3001）。
   * 若出现 Cannot GET /api/calendar/...：说明请求已到后端但进程是旧代码 → 请在 backend 目录重启 npm run dev。
   */
  const proxyTarget = env.VITE_PROXY_TARGET || 'http://127.0.0.1:3001';

  const apiProxy = {
    '/api': {
      target: proxyTarget,
      changeOrigin: true,
      secure: false
    }
  };

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          /** 仅拆 recharts，避免与 antd/react 的循环 chunk；路由 lazy 已拆业务页 */
          manualChunks(id) {
            if (id.includes('node_modules') && id.includes('recharts')) {
              return 'recharts';
            }
          }
        }
      }
    },
    server: {
      port: 5173,
      host: true,
      allowedHosts: true,
      cors: devCors,
      proxy: apiProxy
    },
    /** 与 dev 一致：npm run preview 时把 /api 转到后端，否则会出现 404 Not Found */
    preview: {
      port: 4173,
      host: true,
      proxy: apiProxy
    }
  };
});
