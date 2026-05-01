import { build } from 'vite';
import path from 'path';

async function run() {
  try {
    await build({
      root: process.cwd(),
      logLevel: 'info',
      define: {
        'process.env.TEST_KEY': undefined
      }
    });
    console.log("Build success");
  } catch (e) {
    console.error("Build failed", e);
  }
}
run();
