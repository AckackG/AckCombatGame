// 模拟 HTML 结构，确保 game.js 在执行 new World() 时能够获取到 DOM 元素
document.body.innerHTML = `
  <canvas id="gameCanvas" width="800" height="600"></canvas>
  <div class="info">
    <div id="fps"></div>
    <div id="stat"></div>
    <div id="perf"></div>
    <div id="debufinfo"></div>
  </div>
  <div id="units"><div></div></div>
  <button id="button1"></button>
  <button id="btn-pause"></button>
  <button id="button2"></button>
  <button id="button3"></button>
  <button id="button4"></button>
  <button id="button5"></button>
  <button id="unitdummy"></button>
  <button id="playerdummy"></button>
  <div id="main-menu"></div>
  <div id="game-container"></div>
  <button id="btn-campaign"></button>
  <button id="btn-sandbox"></button>
  <button id="btn-database"></button>
  <div id="database-container"></div>
  <div id="db-content"></div>
  <button id="btn-db-back"></button>
`;

// Mock getContext
HTMLCanvasElement.prototype.getContext = () => {
  return {
    clearRect: () => {},
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    fillRect: () => {},
    fillText: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
    setTransform: () => {},
    drawImage: () => {},
    createPattern: () => ({ setTransform: () => {} }),
  };
};
