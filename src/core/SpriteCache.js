// mylibs/SpriteCache.js
const cache = {};

// 设置一个全局的清晰度倍数，2 表示由 2x 的分辨率
// 如果觉得 Zoom=5 时还是很糊，可以改成 3 或 4
const CACHE_SCALE = 1.0;

export function getCachedCircle(color, radius, borderColor = null) {
  // 这样 11.123 和 11.156 都会变成 "11.1"，共用一个缓存
  const safeRadius = radius.toFixed(1);
  const key = `${color}-${safeRadius}-${borderColor}`;

  if (cache[key]) {
    return cache[key];
  }

  const canvas = document.createElement("canvas");

  // --- 关键修改开始 ---
  // 我们在内存里画一个更大的圆
  const drawRadius = radius * CACHE_SCALE;

  const padding = 2;
  const diameter = drawRadius * 2;

  canvas.width = diameter + padding * 2;
  canvas.height = diameter + padding * 2;

  const ctx = canvas.getContext("2d");
  const center = canvas.width / 2;

  ctx.beginPath();
  ctx.arc(center, center, drawRadius, 0, Math.PI * 2); // 画大圆
  ctx.fillStyle = color;
  ctx.fill();

  if (borderColor) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1 * CACHE_SCALE; // 线宽也要对应放大，否则放大后线太细
    ctx.stroke();
  }
  // --- 关键修改结束 ---

  cache[key] = canvas;
  return canvas;
}

// 导出比例，渲染时要用
export const spriteScale = CACHE_SCALE;
