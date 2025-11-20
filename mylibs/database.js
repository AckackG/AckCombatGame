import Guns_Data from "../data/weapons_data.js";

// DOM 元素获取
const btn_db_entry = document.getElementById("btn-database");
const btn_db_back = document.getElementById("btn-db-back");
const db_container = document.getElementById("database-container");
const main_menu = document.getElementById("main-menu");
const db_content = document.getElementById("db-content");

/**
 * 计算并返回格式化的武器数据 HTML 字符串
 * 包含由基础属性计算出的 DPS 和格式化的时间
 */
function render_weapon_card(key, gun) {
  // 计算衍生数据
  const dps_burst = Math.round(gun.burst * gun.damage * (gun.rpm / 60));
  const reload_sec = (gun.ReloadTime / 1000).toFixed(1);
  const is_special = gun.special ? "special" : "";
  const type_label = gun.special ? "SPECIAL WEAPON" : "STANDARD ISSUE";

  // 简单的进度条百分比计算 (基于游戏内的大致最大值，用于视觉展示)
  const p_dmg = Math.min((gun.damage / 100) * 100, 100);
  const p_rpm = Math.min((gun.rpm / 1200) * 100, 100);
  const p_rng = Math.min((gun.range / 1000) * 100, 100);

  // 格式化名称：去除下划线
  const displayName = gun.wname.replace(/_/g, " ");

  return `
    <div class="weapon-card ${is_special}">
        <div class="w-header" style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <!-- 修复：改用 div，强制不换行，强制不收缩 -->
            <div class="w-name" style="font-weight: normal; white-space: nowrap; flex-shrink: 0; margin-right: 10px;">${displayName}</div>
            <div class="w-type" style="white-space: nowrap; flex-shrink: 0;">${type_label}</div>
        </div>
        <div class="w-desc">${gun.desc}</div>
        
        <div class="w-stats">
            <div class="stat-group">
                <div class="stat-row"><span>DMG</span><span class="stat-val">${gun.damage}x${gun.burst}</span></div>
                <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${p_dmg}%"></div></div>
            </div>
            <div class="stat-group">
                <div class="stat-row"><span>RPM</span><span class="stat-val">${gun.rpm}</span></div>
                <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${p_rpm}%"></div></div>
            </div>
            <div class="stat-group">
                <div class="stat-row"><span>RANGE</span><span class="stat-val">${gun.range}</span></div>
                <div class="stat-bar-bg"><div class="stat-bar-fill" style="width:${p_rng}%"></div></div>
            </div>
             <div class="stat-group">
                <div class="stat-row"><span>RECOIL</span><span class="stat-val">${gun.recoil}°</span></div>
            </div>
             <div class="stat-group">
                <div class="stat-row"><span>MAG</span><span class="stat-val">${gun.magsize}</span></div>
            </div>
             <div class="stat-group">
                <div class="stat-row"><span>RELOAD</span><span class="stat-val">${reload_sec}s</span></div>
            </div>
             <div class="stat-group" style="grid-column: span 2; margin-top:5px; border-top:1px dashed #555; padding-top:5px;">
                <div class="stat-row"><span>DPS (Burst)</span><span class="stat-val" style="color: #0f0;">${dps_burst}</span></div>
            </div>
        </div>
    </div>
  `;
}

/**
 * 初始化数据库视图
 * 清空旧内容并重新生成列表
 */
function init_database() {
  db_content.innerHTML = "";

  // 遍历数据并渲染
  Object.keys(Guns_Data).forEach((key) => {
    const gun = Guns_Data[key];
    db_content.innerHTML += render_weapon_card(key, gun);
  });
}

// --- 事件监听 ---

// 进入数据库页面
btn_db_entry.addEventListener("click", () => {
  init_database(); // 每次进入重新渲染，确保数据最新
  main_menu.style.display = "none";
  db_container.style.display = "flex";
});

// 返回主菜单
btn_db_back.addEventListener("click", () => {
  db_container.style.display = "none";
  main_menu.style.display = "flex"; // 使用 flex 以保持居中布局
});
