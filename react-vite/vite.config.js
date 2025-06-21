import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url'
import path from "node:path";
import * as fs from "node:fs/promises";
const _dirname = dirname(fileURLToPath(import.meta.url));

const neutralino = () => {
  let config;

  return {
    name: 'neutralino',

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    async transformIndexHtml(html) {
      const regex =
          /<script src="http:\/\/localhost:(\d+)\/__neutralino_globals\.js"><\/script>/;

      if (config.mode === 'production') {
        return html.replace(
            regex,
            '<script src="%PUBLIC_URL%/__neutralino_globals.js"></script>'
        );
      }

      if (config.mode === 'development') {
        const auth_info_file = await fs.readFile(
            path.join(_dirname, '..', '.tmp', 'auth_info.json'),
            {
              encoding: 'utf-8',
            }
        );
        const auth_info = JSON.parse(auth_info_file);
        const port = auth_info.nlPort;
        console.log(port)
        return html.replace(
            regex,
            `<script src="http://localhost:${port}/__neutralino_globals.js"></script>`
        );
      }

      return html;
    },
  };
};
//,tailwindcss(),autoprefixer()
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(),neutralino()],
  build: {
    outDir: 'build',
  },
})
