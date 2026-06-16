import { gunVolume } from "./config.js";

class SoundManager {
  constructor() {
    if (SoundManager.instance) {
      return SoundManager.instance;
    }
    this.sounds = {};
    this.audioPool = [];
    this.maxConcurrentSounds = 20; // Max sounds playing at once
    this.defaultGunSounds = [];
    this.soundPaths = {
      // units
      death_monster: "assets/sounds/units/death_monster.ogg",
      levelup: "assets/sounds/units/levelup.ogg",
      spawn: "assets/sounds/units/spawn.ogg",
      // gun 开头是默认枪声，加入随机池， weapon 里没有指定 soundType 时使用
      gun1: "assets/sounds/weapons/gun1.ogg",
      gun2: "assets/sounds/weapons/gun2.ogg",
      gun3: "assets/sounds/weapons/gun3.ogg",
      gun4: "assets/sounds/weapons/gun4.ogg",
      gun5: "assets/sounds/weapons/gun5.ogg",
      gun6: "assets/sounds/weapons/gun6.ogg",
      gl: "assets/sounds/weapons/grenade_launcher.ogg",
      big_gun: "assets/sounds/weapons/big_gun.ogg", //tmp 寻找更好的
      rpg: "assets/sounds/weapons/rpg.ogg", //tmp 寻找更好的
    };

    for (let i = 0; i < this.maxConcurrentSounds; i++) {
      this.audioPool.push(new Audio());
    }

    SoundManager.instance = this;
  }

  async preload() {
    console.log("Preloading sounds...");
    const soundPromises = [];

    for (const key in this.soundPaths) {
      const path = this.soundPaths[key];
      const promise = fetch(path)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Sound file not found: ${path}`);
          }
          return response.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          this.sounds[key] = url;
          if (key.startsWith("gun")) {
            this.defaultGunSounds.push(key);
          }
          console.log(`Loaded sound: ${key}`);
        })
        .catch((error) => {
          console.warn(error.message);
        });
      soundPromises.push(promise);
    }

    await Promise.all(soundPromises);
    console.log("Sound preloading complete.");
  }

  play(soundName, { volume = 1.0, position = null } = {}) {
    if (!this.sounds[soundName]) {
      // console.warn(`Sound not found or not loaded: ${soundName}`);
      return;
    }

    const audio = this.getAudioFromPool();
    if (!audio) {
      // console.warn("Sound pool exhausted.");
      return;
    }

    audio.src = this.sounds[soundName];
    if (soundName.startsWith("gun")) {
      audio.volume = volume * gunVolume;
    } else {
      audio.volume = volume;
    }

    // 简单的 2D 音效位置模拟 (左/右声道)
    // if (position && viewport) {
    //     const pan = (position.x - viewport.x) / (viewport.width / 2);
    //     audio.pan = Math.max(-1, Math.min(1, pan)); // not a standard property
    // }

    audio.play().catch((e) => console.error("Error playing sound:", e));
  }

  getAudioFromPool() {
    const availableAudio = this.audioPool.find((audio) => audio.paused || audio.ended);
    if (availableAudio) {
      availableAudio.onended = () => {
        // Ready for reuse, no need to do anything special here for basic pooling
      };
    }
    return availableAudio;
  }

  getRandomGunSound() {
    if (this.defaultGunSounds.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * this.defaultGunSounds.length);
    return this.defaultGunSounds[randomIndex];
  }
}

const soundManager = new SoundManager();
export default soundManager;
