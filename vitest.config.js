import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom', // 模拟浏览器环境，解决 game.js 中的 document 报错
    setupFiles: ['./tests/setup.js'], // 在测试运行前加载全局 DOM mock
  },
});
