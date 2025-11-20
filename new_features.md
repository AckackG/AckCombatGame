# 音效系统
1. 新建文件和目录结构
在项目根目录创建一个 assets/sounds/ 文件夹，用于存放所有音效文件。
assets/sounds/weapons/: 存放武器射击音效 (e.g., rifle_01.wav, rifle_02.wav, rocket_launch.wav)。
assets/sounds/units/: 存放单位相关音效 (e.g., death_01.wav, spawn.wav, level_up.wav)。
在 mylibs/ 目录下创建一个新文件 sound_manager.js，用来编写音效管理器的逻辑。

2. Sound Manager 的设计
这个管理器应该是一个单例对象或类，并具备以下功能：
preload(): 遍历一个音效列表，加载所有音频资源。在 main.js 中游戏初始化时调用一次。
play(soundName, options): 这是唯一的播放入口。
soundName: 要播放的音效名称，例如 'rifle_shot'。
options: 一个包含额外参数的对象，例如 { position: {x, y}, volume: 0.8, priority: 1 }。
内部维护一个 Audio 对象池。
内部实现发声数限制和优先级判断逻辑。
3. 逻辑集成步骤（在何处调用）
射击音效:
位置: mylibs/weapons.js -> GunBasic 类的 _generate_bullets 方法内。
逻辑: 在 for 循环生成子弹时，调用 SoundManager.play('rifle_shot', { position: { x, y } })。为了区分不同武器，你可以在 weapons_data.js 中为每把枪增加一个 soundType 字段，如 soundType: "rifle" 或 soundType: "shotgun"。
出生音效:
位置: objects/units.js -> Unit 类的 constructor 构造函数内。
逻辑: 在构造函数的末尾，调用 SoundManager.play('spawn', { position: { x: this.x, y: this.y } })。
死亡音效:
位置: mylibs/logic.js -> target_killed 函数内。
逻辑: 这是处理单位死亡的中心函数，在这里调用 SoundManager.play('death', { position: { x: target.x, y: target.y } }) 是最合适的。


# 逻辑
- 初始化时，如果音效文件不存在，音效不加入播放列表
- 创建一个array，里面有若干 gun1 gun2 开头的音效文件，当武器属性里没有指定soundType时，创建时随机选取一种音效作为 实例属性，创建子弹时始终调用这个音效。