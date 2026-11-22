(() => {
  "use strict";

  const STORAGE_KEY = "ombre-du-dojo-v1";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const LEVEL_W = 2200;

  // Painted décor keys + altimetry (world Y of walkable tops). Matches Japanese BGs.
  // Segments: { x0, x1, y } ground strips; platforms: { x, y, w }
  const DECORS = {
    forest: {
      bg: "bgForest",
      ground: [
        { x0: 0, x1: 500, y: 0.78 },
        { x0: 500, x1: 900, y: 0.74 },
        { x0: 900, x1: 1400, y: 0.76 },
        { x0: 1400, x1: 2200, y: 0.72 },
      ],
      platforms: [
        { x: 420, y: 0.58, w: 160 },
        { x: 780, y: 0.52, w: 140 },
        { x: 1100, y: 0.56, w: 180 },
        { x: 1500, y: 0.5, w: 150 },
        { x: 1850, y: 0.54, w: 160 },
      ],
    },
    sakura: {
      bg: "bgSakura",
      ground: [
        { x0: 0, x1: 600, y: 0.8 },
        { x0: 600, x1: 1200, y: 0.76 },
        { x0: 1200, x1: 2200, y: 0.78 },
      ],
      platforms: [
        { x: 350, y: 0.6, w: 140 },
        { x: 700, y: 0.55, w: 170 },
        { x: 1050, y: 0.5, w: 130 },
        { x: 1450, y: 0.57, w: 160 },
        { x: 1800, y: 0.52, w: 150 },
      ],
    },
    bamboo: {
      bg: "bgBamboo",
      ground: [{ x0: 0, x1: 2200, y: 0.77 }],
      platforms: [
        { x: 300, y: 0.58, w: 120 },
        { x: 600, y: 0.5, w: 140 },
        { x: 950, y: 0.55, w: 160 },
        { x: 1350, y: 0.48, w: 130 },
        { x: 1700, y: 0.56, w: 150 },
      ],
    },
    temple: {
      bg: "bgTemple",
      ground: [
        { x0: 0, x1: 800, y: 0.79 },
        { x0: 800, x1: 1600, y: 0.75 },
        { x0: 1600, x1: 2200, y: 0.77 },
      ],
      platforms: [
        { x: 400, y: 0.58, w: 200 },
        { x: 900, y: 0.52, w: 180 },
        { x: 1300, y: 0.56, w: 160 },
        { x: 1750, y: 0.5, w: 170 },
      ],
    },
    pagoda: {
      bg: "bgPagoda",
      ground: [
        { x0: 0, x1: 700, y: 0.8 },
        { x0: 700, x1: 1400, y: 0.73 },
        { x0: 1400, x1: 2200, y: 0.76 },
      ],
      platforms: [
        { x: 280, y: 0.62, w: 130 },
        { x: 620, y: 0.54, w: 150 },
        { x: 1000, y: 0.48, w: 140 },
        { x: 1400, y: 0.55, w: 160 },
        { x: 1850, y: 0.5, w: 140 },
      ],
    },
    castle: {
      bg: "bgCastle",
      ground: [{ x0: 0, x1: 2200, y: 0.78 }],
      platforms: [
        { x: 350, y: 0.6, w: 180 },
        { x: 750, y: 0.52, w: 160 },
        { x: 1150, y: 0.58, w: 200 },
        { x: 1600, y: 0.5, w: 170 },
      ],
    },
    dojo: {
      bg: "bgDojo",
      ground: [{ x0: 0, x1: 2200, y: 0.76 }],
      platforms: [
        { x: 400, y: 0.55, w: 160 },
        { x: 900, y: 0.5, w: 180 },
        { x: 1400, y: 0.55, w: 160 },
      ],
    },
    boss: {
      bg: "bgBoss",
      ground: [
        { x0: 0, x1: 500, y: 0.8 },
        { x0: 500, x1: 1700, y: 0.74 },
        { x0: 1700, x1: 2200, y: 0.78 },
      ],
      platforms: [
        { x: 500, y: 0.55, w: 150 },
        { x: 1000, y: 0.48, w: 180 },
        { x: 1500, y: 0.55, w: 150 },
      ],
    },
  };
  const DECOR_CYCLE = ["forest", "sakura", "bamboo", "temple", "pagoda", "dojo", "castle"];

  const OUTFITS = [
    { id: "shadow", name: "Ombre", desc: "Tenue shinobi classique", cost: 0, sprite: "hero", owned: true },
    { id: "crimson", name: "Pourpre", desc: "Tenue cramoisie + scarf", cost: 120, sprite: "crimson", owned: false },
    { id: "snow", name: "Neige", desc: "Camouflage blanc", cost: 160, sprite: "snow", owned: false },
  ];
  const WEAPON_MAX_LEVEL = 5;
  const SHURIKEN_MAX = 10;
  const WEAPONS = [
    {
      id: "katana",
      name: "Katana",
      desc: "Lame équilibrée (mêlée) — améliorable",
      cost: 0,
      dmg: 0,
      range: 0,
      owned: true,
      levelDmg: 4,
      levelRange: 5,
      upgradeBase: 40,
      upgradeStep: 30,
    },
    {
      id: "shuriken",
      name: "Shuriken",
      desc: "Arme secondaire — shuriken / U · en plus de la mêlée",
      cost: 0,
      dmg: 2,
      range: 40,
      owned: true,
      sidearm: true,
      ranged: true,
      speed: 0.7,
      levelDmg: 3,
      levelRange: 8,
      upgradeBase: 45,
      upgradeStep: 32,
    },
    {
      id: "nodachi",
      name: "Nodachi",
      desc: "+6 dégâts, +12 portée mêlée — améliorable",
      cost: 140,
      dmg: 6,
      range: 12,
      owned: false,
      levelDmg: 5,
      levelRange: 6,
      upgradeBase: 55,
      upgradeStep: 40,
    },
    {
      id: "sai",
      name: "Sais jumeaux",
      desc: "+4 dégâts, plus rapide — améliorable",
      cost: 110,
      dmg: 4,
      range: -4,
      owned: false,
      speed: 0.85,
      levelDmg: 3,
      levelRange: 3,
      upgradeBase: 50,
      upgradeStep: 35,
    },
  ];
  const UPGRADES = [
    { id: "hp", name: "Vitalité", desc: "+25 PV max", base: 35, step: 20, max: 8 },
    { id: "dmg", name: "Lame", desc: "+4 dégâts mêlée", base: 40, step: 25, max: 10 },
    { id: "spd", name: "Agilité", desc: "+8% vitesse", base: 45, step: 30, max: 6 },
    { id: "jump", name: "Ressort", desc: "Saut plus haut", base: 40, step: 28, max: 4 },
    { id: "kick", name: "Raclée", desc: "Coup de pied plus fort", base: 50, step: 30, max: 6 },
    { id: "armor", name: "Armure", desc: "-8% dégâts reçus", base: 50, step: 32, max: 5 },
  ];

  const ASSETS = {
    hero: "assets/chars/sv-hero.png",
    crimson: "assets/chars/sv-outfit-crimson.png",
    snow: "assets/chars/sv-outfit-snow.png",
    bandit: "assets/chars/sv-bandit.png",
    kunoichi: "assets/chars/sv-kunoichi.png",
    oni: "assets/chars/sv-oni.png",
    boss: "assets/chars/sv-boss.png",
    bgForest: "assets/bg/bg-forest.jpg",
    bgSakura: "assets/bg/bg-sakura.jpg",
    bgBamboo: "assets/bg/bg-bamboo.jpg",
    bgTemple: "assets/bg/bg-temple.jpg",
    bgPagoda: "assets/bg/bg-pagoda.jpg",
    bgDojo: "assets/bg/bg-dojo.jpg",
    bgCastle: "assets/bg/bg-castle.jpg",
    bgBoss: "assets/bg/bg-boss.jpg",
    bgRooftops: "assets/bg/bg-rooftops.jpg",
  };
  const img = {};
  let assetsReady = false;

  const defaultWeaponLevels = () => ({ katana: 1, shuriken: 1, nodachi: 1, sai: 1 });

  const defaultSave = () => ({
    gold: 0,
    level: 1,
    outfit: "shadow",
    weapon: "katana",
    ownedOutfits: ["shadow"],
    ownedWeapons: ["katana", "shuriken"],
    weaponLevels: defaultWeaponLevels(),
    shuriken: SHURIKEN_MAX,
    upgrades: { hp: 0, dmg: 0, spd: 0, jump: 0, kick: 0, armor: 0 },
  });

  let save = load();
  let state = "menu";
  let shopTab = "upgrades";
  let player = null;
  let enemies = [];
  let particles = [];
  let pickups = [];
  let projectiles = [];
  let floatTexts = [];
  let spawnQueue = [];
  let spawnTimer = 0;
  let clearTimer = 0;
  let shake = 0;
  let time = 0;
  let lastTs = 0;
  let hitStop = 0;
  let cameraX = 0;
  let viewH = 720;
  let decorId = "forest";
  let decorIdx = 0;
  let bgBlend = 1;
  let prevDecorId = "forest";
  let bgFlash = 0;

  const input = {
    left: false,
    right: false,
    down: false,
    jump: false,
    jumpPressed: false,
    attack: false,
    attackPressed: false,
    kick: false,
    kickPressed: false,
    throw: false,
    throwPressed: false,
    defend: false,
  };

  const $ = (id) => document.getElementById(id);
  const screens = {
    menu: $("screen-menu"),
    shop: $("screen-shop"),
    pause: $("screen-pause"),
    over: $("screen-over"),
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultSave();
      const p = JSON.parse(raw);
      return {
        ...defaultSave(),
        ...p,
        upgrades: { ...defaultSave().upgrades, ...(p.upgrades || {}) },
        weaponLevels: { ...defaultWeaponLevels(), ...(p.weaponLevels || {}) },
        ownedOutfits: p.ownedOutfits || ["shadow"],
        ownedWeapons: Array.from(
          new Set([...(p.ownedWeapons || ["katana", "shuriken"]), "shuriken"]).filter((id) => id)
        ),
        weapon: p.weapon === "shuriken" ? "katana" : p.weapon || "katana",
        shuriken: Math.max(0, Math.min(SHURIKEN_MAX, p.shuriken != null ? p.shuriken : SHURIKEN_MAX)),
      };
    } catch {
      return defaultSave();
    }
  }
  let toastTimer = 0;
  function showToast(msg) {
    const el = $("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.classList.add("hidden"), 220);
    }, 1600);
  }

  function persist(opts = {}) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      if (opts.toast) showToast(opts.toast === true ? "Progression sauvegardée" : String(opts.toast));
      updateSaveSummary();
      return true;
    } catch (err) {
      showToast("Sauvegarde impossible");
      return false;
    }
  }

  function hasProgress() {
    const wLv = save.weaponLevels || {};
    return (
      save.level > 1 ||
      save.gold > 0 ||
      Object.values(save.upgrades).some((v) => v > 0) ||
      Object.values(wLv).some((v) => v > 1) ||
      (save.ownedOutfits && save.ownedOutfits.length > 1) ||
      (save.ownedWeapons && save.ownedWeapons.length > 1)
    );
  }

  function updateSaveSummary() {
    const summary = $("save-summary");
    const lv = $("save-level");
    const gold = $("save-gold");
    if (lv) lv.textContent = String(save.level);
    if (gold) gold.textContent = String(save.gold);
    if (summary) summary.classList.toggle("hidden", !hasProgress());
  }

  function loadImage(src) {
    return new Promise((resolve) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => resolve(null);
      el.src = src;
    });
  }
  async function loadAllAssets() {
    const entries = Object.entries(ASSETS);
    const loaded = await Promise.all(entries.map(([, s]) => loadImage(s)));
    entries.forEach(([k], i) => {
      img[k] = loaded[i];
    });
    assetsReady = true;
  }

  function decor() {
    return DECORS[decorId] || DECORS.forest;
  }

  function groundYAt(x) {
    const h = viewH;
    const g = decor().ground;
    for (let i = 0; i < g.length; i++) {
      if (x >= g[i].x0 && x <= g[i].x1) return g[i].y * h;
    }
    return g[g.length - 1].y * h;
  }

  function platformsWorld() {
    const h = viewH;
    return (decor().platforms || []).map((p) => ({
      x: p.x,
      y: p.y * h,
      w: p.w,
      h: 14,
    }));
  }

  function supportY(x, feetY, maxDrop) {
    let best = groundYAt(x);
    platformsWorld().forEach((p) => {
      if (x >= p.x && x <= p.x + p.w) {
        const top = p.y;
        if (feetY <= top + 8 && feetY >= top - maxDrop && top < best) best = top;
      }
    });
    return best;
  }

  function cycleDecor(strong) {
    prevDecorId = decorId;
    if (strong) {
      decorId = "boss";
      bgFlash = 1;
      shake = Math.max(shake, 16);
    } else {
      decorIdx = (decorIdx + 1) % DECOR_CYCLE.length;
      decorId = DECOR_CYCLE[decorIdx];
    }
    bgBlend = 0;
  }

  function meleeWeapons() {
    return WEAPONS.filter((w) => !w.sidearm);
  }

  function sidearmStats() {
    return WEAPONS.find((w) => w.id === "shuriken") || WEAPONS.find((w) => w.sidearm);
  }

  function weaponStats() {
    const w = WEAPONS.find((x) => x.id === save.weapon);
    if (w && !w.sidearm) return w;
    return meleeWeapons()[0] || WEAPONS[0];
  }

  function weaponLevel(id) {
    if (!save.weaponLevels) save.weaponLevels = defaultWeaponLevels();
    const lv = save.weaponLevels[id] || 1;
    return Math.max(1, Math.min(WEAPON_MAX_LEVEL, lv));
  }

  function weaponUpgradeCost(id) {
    const w = WEAPONS.find((x) => x.id === id);
    if (!w) return 9999;
    const lv = weaponLevel(id);
    if (lv >= WEAPON_MAX_LEVEL) return 0;
    return (w.upgradeBase || 40) + (w.upgradeStep || 30) * (lv - 1);
  }

  function weaponBonus(w) {
    const lv = weaponLevel(w.id);
    const steps = lv - 1;
    return {
      level: lv,
      dmg: (w.dmg || 0) + steps * (w.levelDmg || 3),
      range: (w.range || 0) + steps * (w.levelRange || 4),
      speed: (w.speed || 1) * Math.max(0.55, 1 - steps * 0.04),
      stars: w.ranged ? Math.min(5, 2 + Math.floor(steps / 1) + (steps >= 4 ? 1 : 0)) : 0,
    };
  }

  function applyWeaponStatsToPlayer() {
    if (!player) return;
    const s = statsFromSave();
    player.dmg = s.dmg;
    player.range = s.range;
    player.attackCdMax = s.attackCdMax;
    player.kickDmg = s.kickDmg;
  }

  function cycleWeapon() {
    const owned = meleeWeapons().filter((w) => save.ownedWeapons.includes(w.id));
    if (owned.length < 2) return;
    const i = owned.findIndex((w) => w.id === save.weapon);
    const next = owned[(i + 1) % owned.length];
    save.weapon = next.id;
    applyWeaponStatsToPlayer();
    persist();
    updateHud();
    const b = weaponBonus(next);
    showToast(`${next.name} Nv.${b.level}`);
  }
  function outfitSpriteKey() {
    const o = OUTFITS.find((x) => x.id === save.outfit) || OUTFITS[0];
    return o.sprite;
  }

  function statsFromSave() {
    const u = save.upgrades;
    const w = weaponStats();
    const b = weaponBonus(w);
    const maxHp = 120 + u.hp * 25;
    return {
      maxHp,
      hp: maxHp,
      dmg: 14 + u.dmg * 4 + b.dmg,
      kickDmg: 10 + u.kick * 5,
      speed: 230 * (1 + u.spd * 0.08),
      jump: 460 + u.jump * 30,
      range: 62 + b.range,
      attackCdMax: 0.3 * b.speed,
      armor: Math.min(0.45, 0.05 + u.armor * 0.08),
      weaponLevel: b.level,
    };
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      if (el) el.classList.toggle("hidden", k !== name);
    });
    const playing = name === null;
    const hud = $("hud");
    const controls = $("controls");
    const pause = $("btn-pause");
    if (hud) hud.classList.toggle("hidden", !playing);
    if (controls) controls.classList.toggle("hidden", !playing);
    if (pause) pause.classList.toggle("hidden", !playing);
    // Keep canvas out of the hit-test path so menu/buttons always receive clicks
    if (canvas) canvas.style.pointerEvents = "none";
  }

  function updateContinueBtn() {
    const has = hasProgress();
    const cont = $("btn-continue");
    const play = $("btn-play");
    const saveMenu = $("btn-save-menu");
    if (cont) {
      cont.classList.toggle("hidden", !has);
      cont.classList.toggle("primary", has);
      cont.classList.toggle("ghost", !has);
      cont.textContent = has ? `Continuer (niv. ${save.level})` : "Continuer";
    }
    if (play) {
      play.classList.toggle("primary", !has);
      play.classList.toggle("ghost", has);
      play.textContent = has ? "Nouvelle partie" : "Jouer";
    }
    if (saveMenu) saveMenu.classList.toggle("hidden", !has);
    updateSaveSummary();
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    viewH = h;
  }

  function makePlayer() {
    const s = statsFromSave();
    const gy = groundYAt(160);
    return {
      x: 160,
      y: gy,
      vx: 0,
      vy: 0,
      w: 56,
      h: 110,
      facing: 1,
      onGround: true,
      attacking: 0,
      kicking: 0,
      defending: 0,
      attackCd: 0,
      kickCd: 0,
      throwCd: 0,
      flip: 0,
      flipAngle: 0,
      flipping: false,
      spin: 0,
      slash: 0,
      kickSwing: 0,
      invuln: 0,
      hitFlash: 0,
      anim: 0,
      gait: 0,
      lean: 0,
      squash: 0,
      pose: "idle",
      ...s,
    };
  }

  function isBossLevel(lv) {
    return lv > 0 && lv % 5 === 0;
  }

  /** Progressive enemy rank tied to stage (and optional within-wave bump). */
  function enemyRank(stageLv, waveIndex) {
    const base = Math.max(1, stageLv | 0);
    const wave = Math.max(0, waveIndex | 0);
    return base + Math.floor(wave / 3);
  }

  /** Smooth power curve: gentle early, steady climb later. */
  function enemyScale(rank) {
    const r = Math.max(1, rank);
    return 0.68 + (r - 1) * 0.11 + Math.pow(r - 1, 1.2) * 0.012;
  }

  function pickEnemyType(lv, waveIndex) {
    const progress = Math.min(1, (lv - 1) / 12);
    const late = Math.min(0.25, waveIndex * 0.04);
    const roll = Math.random();
    // Unlock / weight tougher types as stages rise
    const oniChance = lv >= 3 ? 0.08 + progress * 0.28 + late : 0;
    const kunoChance = lv >= 2 ? 0.2 + progress * 0.25 + late * 0.5 : 0;
    if (roll < oniChance) return "oni";
    if (roll < oniChance + kunoChance) return "kunoichi";
    return "bandit";
  }

  function buildSpawnQueue(lv) {
    const q = [];
    if (isBossLevel(lv)) {
      const escorts = 1 + Math.floor(lv / 10);
      for (let i = 0; i < escorts; i++) {
        q.push({ type: pickEnemyType(lv, i), delay: 0.45 + i * 0.35, wave: i });
      }
      q.push({ type: lv >= 15 ? "oni" : "bandit", delay: 0.7, wave: escorts });
      q.push({ type: "boss", delay: 1.35, wave: escorts + 1 });
      return q;
    }
    // Count climbs every stage, soft cap to avoid overwhelm
    const n = Math.min(14, 3 + Math.floor((lv - 1) * 0.7) + (lv >= 8 ? 1 : 0));
    const spacing = Math.max(0.38, 0.85 - lv * 0.025);
    for (let i = 0; i < n; i++) {
      q.push({ type: pickEnemyType(lv, i), delay: 0.55 + i * spacing, wave: i });
    }
    // Mid/late stages: occasional elite pack finale
    if (lv >= 6 && Math.random() < 0.45 + Math.min(0.4, lv * 0.03)) {
      q.push({ type: lv >= 8 ? "oni" : "kunoichi", delay: 0.9, wave: n });
    }
    return q;
  }

  function spawnEnemy(type, waveIndex) {
    const lv = save.level;
    const rank = enemyRank(lv, waveIndex);
    const sc = enemyScale(rank);
    // Always arrive in front of the hero (to their right), never from behind.
    const heroX = player ? player.x : 160;
    const frontMin = heroX + 240;
    const camFront = cameraX + window.innerWidth * 0.88;
    const x = Math.min(LEVEL_W - 60, Math.max(frontMin, camFront) + Math.random() * 50);
    const gy = groundYAt(x);
    const defs = {
      bandit: { w: 64, h: 112, hp: 24, dmg: 7, speed: 130, gold: 12, sprite: "bandit" },
      kunoichi: { w: 52, h: 108, hp: 18, dmg: 9, speed: 165, gold: 14, sprite: "kunoichi" },
      oni: { w: 78, h: 130, hp: 70, dmg: 14, speed: 90, gold: 20, sprite: "oni" },
      boss: { w: 100, h: 150, hp: 220, dmg: 18, speed: 105, gold: 100, sprite: "boss" },
    };
    const d = defs[type] || defs.bandit;
    const bossMult = type === "boss" ? 1 + Math.floor(lv / 5) * 0.28 : 1;
    const elite = type !== "boss" && rank >= 6 && Math.random() < Math.min(0.35, 0.08 + rank * 0.02);
    const eliteMult = elite ? 1.28 : 1;
    const hp = Math.round(d.hp * sc * bossMult * eliteMult);
    const dmg = Math.round(d.dmg * (0.9 + sc * 0.55) * bossMult * (elite ? 1.15 : 1));
    const speed = d.speed + rank * 4.5 + (elite ? 18 : 0);
    enemies.push({
      type,
      sprite: d.sprite,
      rank,
      elite: !!elite,
      x,
      y: gy,
      w: d.w * (elite ? 1.06 : 1),
      h: d.h * (elite ? 1.06 : 1),
      vx: 0,
      vy: 0,
      hp,
      maxHp: hp,
      dmg,
      speed,
      gold: d.gold + rank * 2 + (elite ? 8 : 0),
      facing: -1,
      attackCd: Math.max(0.18, 0.55 - rank * 0.018),
      attackWind: 0,
      defending: 0,
      defendCd: Math.max(0.15, 0.45 - rank * 0.012) + Math.random() * 0.25,
      hopCd: Math.max(0.35, 0.8 - rank * 0.02) + Math.random() * 0.5,
      hitFlash: 0,
      anim: Math.random() * 8,
      swing: 0,
      onGround: true,
      gait: Math.random() * 10,
      lean: 0,
      squash: 0,
      windup: 0,
      aggression: Math.min(1.35, 0.85 + rank * 0.035),
      pose: "run",
    });
    if (type === "boss") cycleDecor(true);
  }

  function skipToNextLevel() {
    if (state === "play" || state === "pause" || state === "won" || state === "dead" || state === "shop") {
      if (state === "play" || state === "pause") {
        save.gold += 10 + save.level * 2;
        save.level += 1;
        persist({ toast: `Niv. ${save.level} sauvegardé` });
      }
      startLevel();
    }
  }

  function startLevel() {
    decorIdx = (save.level - 1) % DECOR_CYCLE.length;
    decorId = isBossLevel(save.level) ? "boss" : DECOR_CYCLE[decorIdx];
    prevDecorId = decorId;
    bgBlend = 1;
    bgFlash = 0;
    player = makePlayer();
    player.invuln = save.level <= 2 ? 2 : 1.2;
    enemies = [];
    particles = [];
    pickups = [];
    projectiles = [];
    floatTexts = [];
    cameraX = 0;
    spawnQueue = buildSpawnQueue(save.level);
    spawnTimer = 0.35;
    clearTimer = 0;
    shake = 0;
    hitStop = 0;
    state = "play";
    showScreen(null);
    updateHud();
  }

  function updateHud() {
    if (!player) return;
    const hpBar = $("hp-bar");
    const hpText = $("hp-text");
    const gold = $("gold-hud");
    const level = $("level-label");
    const wave = $("wave-label");
    const weapon = $("weapon-chip");
    if (hpBar) hpBar.style.transform = `scaleX(${Math.max(0, player.hp / player.maxHp)})`;
    if (hpText) hpText.textContent = `${Math.ceil(player.hp)}`;
    if (gold) gold.textContent = `${save.gold}`;
    if (level) {
      const threat = enemyRank(save.level, 0);
      level.textContent = isBossLevel(save.level)
        ? `Boss ${save.level} · Menace ${threat}`
        : `Niv. ${save.level} · Menace ${threat}`;
    }
    if (wave) wave.textContent = `${enemies.filter((e) => e.hp > 0).length + spawnQueue.length}`;
    if (weapon) {
      const w = weaponStats();
      weapon.textContent = `${w.name} Nv.${weaponLevel(w.id)}`;
    }
    const shCount = $("shuriken-count");
    const shHud = $("shuriken-hud");
    const ammo = save.shuriken != null ? save.shuriken : SHURIKEN_MAX;
    if (shCount) shCount.textContent = String(ammo);
    if (shHud) {
      shHud.classList.toggle("empty", ammo <= 0);
      shHud.innerHTML = `Shuri <span id="shuriken-count">${ammo}</span>/${SHURIKEN_MAX}`;
    }
  }

  function upgradeCost(id) {
    const u = UPGRADES.find((x) => x.id === id);
    return u.base + u.step * (save.upgrades[id] || 0);
  }

  function renderShop() {
    $("shop-gold").textContent = String(save.gold);
    $("shop-next").textContent = String(save.level);
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.tab === shopTab));
    const list = $("shop-list");
    list.innerHTML = "";

    if (shopTab === "upgrades") {
      UPGRADES.forEach((u) => {
        const lv = save.upgrades[u.id] || 0;
        const cost = upgradeCost(u.id);
        const maxed = lv >= u.max;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "shop-item";
        btn.disabled = maxed || save.gold < cost;
        btn.innerHTML = `<span class="name">${u.name} <small>Nv.${lv}/${u.max}</small></span>
          <span class="price">${maxed ? "MAX" : cost + " ◆"}</span>
          <span class="desc">${u.desc}</span>`;
        btn.onclick = () => {
          if (maxed || save.gold < cost) return;
          save.gold -= cost;
          save.upgrades[u.id] = lv + 1;
          persist();
          renderShop();
        };
        list.appendChild(btn);
      });
    } else if (shopTab === "outfits") {
      OUTFITS.forEach((o) => {
        const owned = save.ownedOutfits.includes(o.id);
        const eq = save.outfit === o.id;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "shop-item" + (eq ? " equipped" : "");
        btn.disabled = !owned && save.gold < o.cost;
        btn.innerHTML = `<span class="name">${o.name}${eq ? " ✓" : ""}</span>
          <span class="price">${owned ? (eq ? "ÉQUIPÉ" : "Équiper") : o.cost + " ◆"}</span>
          <span class="desc">${o.desc}</span>`;
        btn.onclick = () => {
          if (!owned) {
            if (save.gold < o.cost) return;
            save.gold -= o.cost;
            save.ownedOutfits.push(o.id);
          }
          save.outfit = o.id;
          persist();
          renderShop();
        };
        list.appendChild(btn);
      });
    } else {
      WEAPONS.forEach((w) => {
        const owned = w.sidearm || save.ownedWeapons.includes(w.id);
        const eq = !w.sidearm && save.weapon === w.id;
        const lv = weaponLevel(w.id);
        const b = weaponBonus(w);
        const upCost = weaponUpgradeCost(w.id);
        const maxed = lv >= WEAPON_MAX_LEVEL;
        const wrap = document.createElement("div");
        wrap.className = "weapon-shop-row";

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "shop-item" + (eq ? " equipped" : "") + (w.sidearm ? " sidearm-item" : "");
        btn.disabled = !owned && save.gold < w.cost;
        const powerHint = owned
          ? `Nv.${lv}/${WEAPON_MAX_LEVEL} · +${b.dmg} dmg · +${b.range} portée${w.sidearm ? ` · ${b.stars} étoiles (secondaire ★)` : " (mêlée □)"}`
          : w.desc;
        const priceLabel = w.sidearm
          ? "SECONDAIRE"
          : owned
            ? eq
              ? "ÉQUIPÉ"
              : "Équiper"
            : w.cost + " ◆";
        btn.innerHTML = `<span class="name">${w.name}${eq ? " ✓" : ""}${w.sidearm ? " ★" : ""} <small>Nv.${owned ? lv : 1}</small></span>
          <span class="price">${priceLabel}</span>
          <span class="desc">${powerHint}</span>`;
        btn.onclick = () => {
          if (w.sidearm) {
            showToast("Shuriken toujours actifs (★)");
            return;
          }
          if (!owned) {
            if (save.gold < w.cost) return;
            save.gold -= w.cost;
            save.ownedWeapons.push(w.id);
            if (!save.weaponLevels) save.weaponLevels = defaultWeaponLevels();
            save.weaponLevels[w.id] = save.weaponLevels[w.id] || 1;
          }
          save.weapon = w.id;
          applyWeaponStatsToPlayer();
          persist();
          renderShop();
          updateHud();
        };
        wrap.appendChild(btn);

        if (owned) {
          const up = document.createElement("button");
          up.type = "button";
          up.className = "shop-item weapon-upgrade";
          up.disabled = maxed || save.gold < upCost;
          up.innerHTML = `<span class="name">Améliorer ${w.name}</span>
            <span class="price">${maxed ? "MAX" : upCost + " ◆"}</span>
            <span class="desc">${maxed ? "Puissance maximale" : `Nv.${lv} → ${lv + 1} (+${w.levelDmg || 3} dmg${w.sidearm ? ", +étoiles" : ", +" + (w.levelRange || 4) + " portée"})`}</span>`;
          up.onclick = () => {
            if (maxed || save.gold < upCost) return;
            save.gold -= upCost;
            if (!save.weaponLevels) save.weaponLevels = defaultWeaponLevels();
            save.weaponLevels[w.id] = lv + 1;
            if (eq || w.sidearm) applyWeaponStatsToPlayer();
            persist({ toast: `${w.name} Nv.${lv + 1}` });
            renderShop();
            updateHud();
          };
          wrap.appendChild(up);
        }
        if (w.sidearm) {
          const ammo = save.shuriken != null ? save.shuriken : SHURIKEN_MAX;
          const need = SHURIKEN_MAX - ammo;
          const packCost = Math.max(15, need * 4);
          const refill = document.createElement("button");
          refill.type = "button";
          refill.className = "shop-item weapon-upgrade";
          refill.disabled = need <= 0 || save.gold < packCost;
          refill.innerHTML = `<span class="name">Recharger shuriken</span>
            <span class="price">${need <= 0 ? "PLEIN" : packCost + " ◆"}</span>
            <span class="desc">Munitions ${ammo}/${SHURIKEN_MAX}${need > 0 ? ` · +${need} ★` : ""}</span>`;
          refill.onclick = () => {
            if (need <= 0 || save.gold < packCost) return;
            save.gold -= packCost;
            refillShuriken(need, "Shuriken rechargés (10)");
            renderShop();
          };
          wrap.appendChild(refill);
        }
        list.appendChild(wrap);
      });
    }
  }

  function openShop() {
    state = "shop";
    showScreen("shop");
    renderShop();
  }

  function levelWon() {
    state = "won";
    const bonus = 28 + save.level * 6 + (isBossLevel(save.level) ? 80 : 0);
    save.gold += bonus;
    save.level += 1;
    if (save.shuriken == null) save.shuriken = SHURIKEN_MAX;
    save.shuriken = Math.min(SHURIKEN_MAX, save.shuriken + 3);
    persist({ toast: `Niv. ${save.level} sauvegardé` });
    const next = $("over-title");
    const msg = $("over-msg");
    const shop = $("btn-shop-after");
    const retry = $("btn-retry");
    const nextBtn = $("btn-next-after");
    if (next) next.textContent = "Victoire !";
    if (msg) msg.textContent = `Niveau terminé. +${bonus} ◆ — or ${save.gold}`;
    if (shop) shop.classList.remove("hidden");
    if (retry) retry.classList.add("hidden");
    if (nextBtn) nextBtn.classList.remove("hidden");
    showScreen("over");
  }

  function levelLost() {
    state = "dead";
    persist();
    const next = $("over-title");
    const msg = $("over-msg");
    const shop = $("btn-shop-after");
    const retry = $("btn-retry");
    const nextBtn = $("btn-next-after");
    if (next) next.textContent = "Défaite";
    if (msg) msg.textContent = `Niveau ${save.level}. Or conservé: ${save.gold} ◆`;
    if (shop) shop.classList.remove("hidden");
    if (retry) retry.classList.remove("hidden");
    if (nextBtn) nextBtn.classList.remove("hidden");
    showScreen("over");
  }

  function addParticles(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 240,
        vy: -Math.random() * 200 - 40,
        life: 0.35 + Math.random() * 0.4,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }
  function addFloat(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 0.75, vy: -48 });
  }

  function hurtPlayer(amount, fromX) {
    if (!player || player.invuln > 0 || player.hp <= 0) return;
    if (player.defending > 0 || input.defend) {
      const blocked = Math.max(1, Math.round(amount * 0.25 * (1 - player.armor)));
      player.hp -= blocked;
      player.invuln = 0.35;
      player.hitFlash = 0.12;
      player.vx += fromX < player.x ? 60 : -60;
      addParticles(player.x, player.y - 50, "#a8c8f0", 6);
      addFloat(player.x, player.y - 70, "PARÉ", "#a8c8f0");
      shake = 4;
      if (player.hp <= 0) {
        player.hp = 0;
        levelLost();
      }
      return;
    }
    const dmg = Math.max(1, Math.round(amount * (1 - player.armor)));
    player.hp -= dmg;
    player.invuln = save.level <= 3 ? 1 : 0.75;
    player.hitFlash = 0.22;
    player.pose = "hurt";
    player.squash = 0.28;
    player.vx += fromX < player.x ? 160 : -160;
    player.vy = -140;
    shake = 10;
    addParticles(player.x, player.y - 40, "#c23b3b", 10);
    addFloat(player.x, player.y - 70, `-${dmg}`, "#ff8a7a");
    if (player.hp <= 0) {
      player.hp = 0;
      levelLost();
    }
  }

  function hurtEnemy(e, amount, knock) {
    if (e.defending > 0) {
      const blocked = Math.max(1, Math.round(amount * 0.3));
      e.hp -= blocked;
      e.hitFlash = 0.1;
      e.vx += knock * 0.25;
      e.defending = Math.max(e.defending, 0.18);
      addFloat(e.x, e.y - e.h - 8, "PARÉ", "#a8c8f0");
      addParticles(e.x, e.y - e.h * 0.5, "#a8c8f0", 4);
      if (e.hp <= 0) e.hp = 0;
      else return;
    } else {
      e.hp -= amount;
      e.hitFlash = 0.16;
      e.pose = "hurt";
      e.squash = 0.3;
      e.vx += knock;
      e.vy = Math.min(e.vy, -60);
      hitStop = Math.max(hitStop, 0.04);
      addParticles(e.x, e.y - e.h * 0.5, "#e8a84a", 7);
      addFloat(e.x, e.y - e.h - 8, `-${amount}`, "#ffe2a8");
    }
    if (e.hp <= 0) {
      e.hp = 0;
      save.gold += e.gold;
      persist();
      addFloat(e.x, e.y - e.h, `+${e.gold}`, "#e8a84a");
      addParticles(e.x, e.y - e.h * 0.4, "#3ecf9a", 14);
      if (Math.random() < 0.4) {
        pickups.push({
          x: e.x,
          y: e.y - 30,
          vy: -100,
          kind: Math.random() < 0.5 ? "gold" : "heart",
          value: Math.random() < 0.5 ? 12 + Math.floor(save.level / 2) : 20,
          life: 8,
        });
      }
      shake = Math.max(shake, e.type === "boss" ? 18 : 7);
      cycleDecor(e.type === "boss");
    }
  }

  function tryAttack() {
    tryKatana();
  }

  function tryKatana() {
    if (!player || player.attackCd > 0 || player.kicking > 0 || player.defending > 0.05) return;
    const aerial = !player.onGround;
    player.attacking = aerial ? 0.32 : 0.26;
    player.slash = 1;
    player.attackCd = player.attackCdMax * (aerial ? 0.85 : 1);
    player.pose = "attack";
    if (aerial) {
      player.spin = Math.max(player.spin, 0.55);
      player.vy = Math.min(player.vy, -40);
    }
    const range = player.range + (aerial ? 10 : 0);
    const ax = player.x + player.facing * (player.w * 0.2 + range * 0.5);
    const yTol = aerial ? 90 : 70;
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      if (Math.abs(e.x - ax) < range + e.w * 0.3 && Math.abs(e.y - player.y) < yTol) {
        if (Math.random() < (e.type === "boss" ? 0.55 : e.type === "kunoichi" ? 0.4 : 0.28) && e.defending <= 0) {
          e.defending = 0.35;
          e.pose = "defend";
        }
        hurtEnemy(e, Math.round(player.dmg * (aerial ? 1.15 : 1)), player.facing * (aerial ? 200 : 160));
      }
    });
    addParticles(ax, player.y - (aerial ? 55 : 40), "#f0d9a8", aerial ? 9 : 5);
  }

  function tryThrowShuriken() {
    if (!player || player.throwCd > 0 || player.defending > 0.05) return;
    if (save.shuriken == null) save.shuriken = SHURIKEN_MAX;
    if (save.shuriken <= 0) {
      showToast("Plus de shuriken");
      player.throwCd = 0.35;
      return;
    }
    const side = sidearmStats();
    if (!side) return;
    const aerial = !player.onGround;
    const b = weaponBonus(side);
    const want = Math.min(5, b.stars + (aerial ? 1 : 0));
    const count = Math.min(want, save.shuriken, SHURIKEN_MAX);
    if (count <= 0) return;
    save.shuriken -= count;
    persist();
    updateHud();
    player.throwCd = 0.28 * b.speed;
    player.pose = "attack";
    player.slash = 0.35;
    const baseDmg = Math.max(8, Math.round((14 + (save.upgrades.dmg || 0) * 4 + b.dmg) * 0.9));
    const speedBonus = 620 + b.level * 25;
    for (let i = 0; i < count; i++) {
      const spread = (i - (count - 1) / 2) * (48 + b.level * 2);
      projectiles.push({
        x: player.x + player.facing * 28,
        y: player.y - player.h * 0.55 + spread * 0.12,
        vx: player.facing * (speedBonus + Math.abs(player.vx) * 0.2),
        vy: aerial ? -40 + i * 22 : spread * 0.18,
        life: 1.25 + b.level * 0.08,
        rot: Math.random() * Math.PI,
        spin: player.facing * (14 + Math.random() * 6),
        dmg: baseDmg,
        hit: new Set(),
      });
    }
    addParticles(player.x + player.facing * 30, player.y - player.h * 0.55, "#d8dde8", 5);
  }

  function refillShuriken(amount, toast) {
    if (save.shuriken == null) save.shuriken = SHURIKEN_MAX;
    const before = save.shuriken;
    save.shuriken = Math.min(SHURIKEN_MAX, save.shuriken + amount);
    if (save.shuriken > before) {
      persist(toast ? { toast } : {});
      updateHud();
    }
  }

  function updateProjectiles(dt) {
    projectiles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 40 * dt;
      p.rot += p.spin * dt;
      enemies.forEach((e) => {
        if (e.hp <= 0 || p.hit.has(e)) return;
        if (Math.abs(e.x - p.x) < e.w * 0.35 && Math.abs(e.y - e.h * 0.5 - p.y) < e.h * 0.45) {
          p.hit.add(e);
          if (Math.random() < 0.2 && e.defending <= 0) {
            e.defending = 0.25;
            e.pose = "defend";
          }
          hurtEnemy(e, p.dmg, Math.sign(p.vx) * 120);
          addParticles(p.x, p.y, "#c0c8d8", 4);
          p.life = Math.min(p.life, 0.05);
        }
      });
    });
    projectiles = projectiles.filter((p) => p.life > 0 && p.x > -40 && p.x < LEVEL_W + 40);
  }

  function drawShuriken(p) {
    const sx = p.x - cameraX;
    ctx.save();
    ctx.translate(sx, p.y);
    ctx.rotate(p.rot);
    ctx.fillStyle = "#c5ccd6";
    ctx.strokeStyle = "#2a3038";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(3, -3);
      ctx.lineTo(0, -11);
      ctx.lineTo(-3, -3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = "#8a9098";
    ctx.fill();
    ctx.restore();
  }

  function tryKick() {
    if (!player || player.kickCd > 0 || player.attacking > 0 || player.defending > 0.05) return;
    const aerial = !player.onGround;
    player.kicking = aerial ? 0.36 : 0.3;
    player.kickSwing = 1;
    player.kickCd = aerial ? 0.48 : 0.55;
    player.pose = "kick";
    player.vx += player.facing * (aerial ? 240 : 180);
    if (aerial) {
      player.spin = Math.max(player.spin, 0.7);
      player.vy = Math.min(player.vy, -80);
    }
    const range = aerial ? 58 : 48;
    const ax = player.x + player.facing * (player.w * 0.25 + range * 0.5);
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      if (Math.abs(e.x - ax) < range + e.w * 0.3 && Math.abs(e.y - player.y) < (aerial ? 85 : 60)) {
        if (Math.random() < 0.25 && e.defending <= 0) {
          e.defending = 0.3;
          e.pose = "defend";
        }
        hurtEnemy(e, Math.round(player.kickDmg * (aerial ? 1.2 : 1)), player.facing * (aerial ? 280 : 220));
        e.vy = aerial ? -280 : -220;
      }
    });
    addParticles(ax, player.y - (aerial ? 35 : 20), "#3ecf9a", aerial ? 10 : 6);
  }

  function applyPhysics(ent, dt, isPlayer) {
    const grav = !ent.onGround
      ? ent.vy < 0
        ? 1350
        : 1750 // heavier fall for natural arc
      : 1500;
    const prevGround = ent.onGround;
    ent.vy += grav * dt;
    // air drag
    if (!ent.onGround) ent.vx *= 1 - Math.min(0.55, dt * 1.1);
    ent.x += ent.vx * dt;
    ent.y += ent.vy * dt;
    const feet = ent.y;
    const support = supportY(ent.x, feet, isPlayer ? 28 : 22);
    if (ent.vy >= 0 && feet >= support - 2) {
      const impact = Math.min(1, Math.abs(ent.vy) / 900);
      ent.y = support;
      ent.vy = 0;
      ent.onGround = true;
      if (!prevGround) {
        ent.squash = Math.max(ent.squash || 0, 0.22 + impact * 0.35);
        ent.landDust = 1;
      }
      if (!isPlayer) ent.vx *= 0.88;
      else if (Math.abs(ent.vx) < 12) ent.vx *= 0.7;
    } else {
      ent.onGround = false;
      if (ent.vy < -80) ent.squash = Math.min(ent.squash || 0, -0.08); // stretch up
    }
    platformsWorld().forEach((plat) => {
      if (ent.x > plat.x && ent.x < plat.x + plat.w && ent.vy >= 0) {
        if (feet >= plat.y - 6 && feet <= plat.y + 16) {
          ent.y = plat.y;
          ent.vy = 0;
          ent.onGround = true;
        }
      }
    });
    ent.x = Math.max(40, Math.min(LEVEL_W - 40, ent.x));
    // recover squash toward neutral
    if (ent.squash) ent.squash += (0 - ent.squash) * Math.min(1, dt * 10);
  }

  function gaitSpeed(ent) {
    return Math.min(18, 7 + Math.abs(ent.vx) * 0.048);
  }

  function maybeFootstep(ent, isPlayer) {
    if (!ent.onGround || Math.abs(ent.vx) < 22) return;
    const phase = ent.gait || ent.anim;
    const plant = Math.sin(phase);
    const prev = ent._prevPlant || 0;
    if (prev <= 0 && plant > 0.72) {
      const dir = ent.facing || 1;
      addParticles(ent.x - dir * 8, ent.y - 2, "rgba(210,195,160,0.7)", isPlayer ? 4 : 3);
      if (isPlayer) shake = Math.max(shake, 0.8);
      ent.squash = Math.max(ent.squash || 0, 0.08);
    }
    ent._prevPlant = plant;
  }

  function easeToward(current, target, dt, rate) {
    return current + (target - current) * Math.min(1, dt * rate);
  }

  function updatePlayer(dt) {
    const p = player;
    const moving = Math.abs(p.vx) > 16;
    if (p.onGround && moving) p.gait += Math.abs(p.vx) * dt * 0.075;
    else if (p.onGround) p.gait += dt * 0.9; // slow idle sway seed
    p.anim += dt * (p.onGround && moving ? gaitSpeed(p) : 2.6);
    if (p.attackCd > 0) p.attackCd -= dt;
    if (p.kickCd > 0) p.kickCd -= dt;
    if (p.throwCd > 0) p.throwCd -= dt;
    if (p.attacking > 0) p.attacking -= dt;
    if (p.kicking > 0) p.kicking -= dt;
    if (p.defending > 0) p.defending -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;
    if (p.slash > 0) p.slash = Math.max(0, p.slash - dt * 3.2);
    if (p.kickSwing > 0) p.kickSwing = Math.max(0, p.kickSwing - dt * 2.8);
    if (p.spin > 0) p.spin = Math.max(0, p.spin - dt);

    // Somersault: ease-in-out spin (~1 full turn in air)
    if (p.flipping) {
      const t = Math.min(1, p.flipAngle / (Math.PI * 2));
      const rate = 11 + Math.sin(t * Math.PI) * 8;
      p.flipAngle += dt * rate;
      if (Math.floor(p.flipAngle / 0.5) !== Math.floor((p.flipAngle - dt * rate) / 0.5)) {
        addParticles(p.x, p.y - p.h * 0.45, "rgba(232,168,74,0.4)", 1);
      }
      if (p.flipAngle >= Math.PI * 2.05) p.flipping = false;
    }

    const guarding = input.defend;
    if (guarding && p.onGround && p.attacking <= 0 && p.kicking <= 0) {
      p.defending = 0.12;
    }

    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;
    const want = move * p.speed * (guarding && p.onGround ? 0.32 : p.onGround ? 1 : 0.72);
    const accel = p.onGround ? (move !== 0 ? 14 : 18) : 7;
    const prevVx = p.vx;
    p.vx = easeToward(p.vx, want, dt, accel);
    // body lean from acceleration
    p.lean = easeToward(p.lean || 0, Math.max(-0.22, Math.min(0.22, (p.vx - prevVx) * 0.004 + move * 0.08)), dt, 12);
    if (move !== 0 && !guarding) p.facing = move > 0 ? 1 : -1;

    if (p.hitFlash > 0.05) p.pose = "hurt";
    else if (p.defending > 0.05 || guarding) p.pose = "defend";
    else if (p.attacking > 0) p.pose = "attack";
    else if (p.kicking > 0) p.pose = "kick";
    else if (!p.onGround) p.pose = p.flipping || p.flipAngle > 0.15 ? "flip" : "jump";
    else if (moving) p.pose = "run";
    else p.pose = "idle";

    if (input.jumpPressed && p.onGround && !guarding) {
      p.vy = -p.jump * 1.08;
      p.onGround = false;
      p.flipping = true;
      p.flipAngle = 0;
      p.flip = 1;
      p.spin = 1;
      p.squash = -0.12;
      p.vx += move * 40;
      addParticles(p.x, p.y - 4, "rgba(255,230,180,0.65)", 6);
    }
    input.jumpPressed = false;
    if (!guarding) {
      if (input.attackPressed) tryAttack();
      if (input.kickPressed) tryKick();
      if (input.throwPressed) tryThrowShuriken();
    }
    input.attackPressed = false;
    input.kickPressed = false;
    input.throwPressed = false;

    const wasAir = !p.onGround;
    applyPhysics(p, dt, true);
    if (wasAir && p.onGround) {
      p.flipping = false;
      p.flipAngle = 0;
      p.flip = 0;
      p.spin = 0;
      addParticles(p.x, p.y - 2, "rgba(200,190,160,0.7)", 5);
    }
    maybeFootstep(p, true);
  }

  function updateEnemies(dt) {
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      const weight = e.type === "oni" || e.type === "boss" ? 0.72 : e.type === "kunoichi" ? 1.25 : 1;
      if (e.onGround && Math.abs(e.vx) > 18) e.gait = (e.gait || 0) + Math.abs(e.vx) * dt * 0.07 * weight;
      e.anim += dt * (Math.abs(e.vx) > 18 ? gaitSpeed(e) * weight : 2.8);
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;
      if (e.defending > 0) e.defending -= dt;
      if (e.defendCd > 0) e.defendCd -= dt;
      if (e.hopCd > 0) e.hopCd -= dt;
      if (e.swing > 0) e.swing = Math.max(0, e.swing - dt * 2.5);
      if (e.windup == null) e.windup = 0;

      if (e.x < player.x - 40) {
        e.x = Math.min(LEVEL_W - 60, player.x + Math.max(280, window.innerWidth * 0.55));
        e.y = groundYAt(e.x);
        e.vx = -Math.abs(e.speed) * 0.6;
      }
      const dx = player.x - e.x;
      const dist = Math.abs(dx);
      e.facing = dx >= 0 ? 1 : -1;
      const playerThreatening =
        (player.attacking > 0 || player.kicking > 0 || player.slash > 0.2 || player.kickSwing > 0.2) &&
        dist < 110 &&
        Math.abs(player.y - e.y) < 90;

      if (playerThreatening && e.defendCd <= 0 && e.attackWind <= 0 && Math.random() < 0.55) {
        e.defending = e.type === "boss" ? 0.5 : e.type === "oni" ? 0.38 : 0.28;
        e.defendCd = e.type === "kunoichi" ? 0.75 : 1.1;
        e.pose = "defend";
        e.vx *= 0.25;
      }

      let wantVx = 0;
      if (e.defending > 0) {
        e.pose = "defend";
        wantVx = 0;
      } else if (e.attackWind > 0) {
        e.attackWind -= dt;
        e.pose = "attack";
        e.swing = Math.max(e.swing, 0.8);
        wantVx = e.facing * e.speed * 0.15;
        if (e.attackWind <= 0) {
          const reach = e.type === "boss" ? 80 : e.type === "oni" ? 55 : 45;
          if (Math.abs(e.x - player.x) < reach && Math.abs(e.y - player.y) < 70) {
            hurtPlayer(e.dmg, e.x);
          }
          const cdBase = e.type === "kunoichi" ? 0.7 : e.type === "oni" ? 1.2 : 0.95;
          e.attackCd = Math.max(0.28, cdBase / (e.aggression || 1));
        }
      } else {
        const aggr = e.aggression || 1;
        const stop = (e.type === "boss" ? 60 : e.type === "oni" ? 48 : 38) / Math.min(1.25, aggr);
        if (dist > stop + 40) {
          // approach with slight speed pulse (natural stride)
          const pulse = 0.88 + Math.sin((e.gait || e.anim) * 0.5) * 0.12;
          wantVx = e.facing * e.speed * pulse * weight * Math.min(1.2, aggr);
          e.pose = "run";
          if (e.onGround && e.hopCd <= 0 && dist > 160 && Math.random() < 0.008 * weight * aggr) {
            e.vy = e.type === "kunoichi" ? -300 : e.type === "oni" ? -180 : -230;
            e.onGround = false;
            e.hopCd = Math.max(0.55, 1.4 / aggr) + Math.random();
            e.pose = "jump";
            e.squash = -0.1;
          }
        } else if (dist > stop) {
          // slow close-in + brief windup pause (higher ranks wind up faster)
          wantVx = e.facing * e.speed * 0.35 * aggr;
          e.pose = "idle";
          e.windup += dt;
          const windNeed = Math.max(0.08, 0.2 / aggr);
          if (e.attackCd <= 0 && e.windup > windNeed) {
            e.attackWind = Math.max(0.1, (e.type === "kunoichi" ? 0.16 : 0.28) / aggr);
            e.swing = 1;
            e.windup = 0;
            e.squash = 0.12;
          }
        } else {
          wantVx = 0;
          e.pose = Math.sin(e.anim) > 0.3 ? "guard" : "idle";
          e.windup += dt;
          if (e.attackCd <= 0 && e.windup > Math.max(0.06, 0.14 / aggr)) {
            e.attackWind = Math.max(0.1, (e.type === "kunoichi" ? 0.18 : 0.3) / aggr);
            e.swing = 1;
            e.windup = 0;
          }
        }
      }
      const accel = e.onGround ? (e.type === "oni" || e.type === "boss" ? 5 : 9) : 4;
      e.vx = easeToward(e.vx, wantVx, dt, accel);
      e.lean = easeToward(e.lean || 0, Math.max(-0.18, Math.min(0.18, e.facing * (Math.abs(e.vx) / (e.speed + 1)) * 0.12)), dt, 8);
      applyPhysics(e, dt, false);
      maybeFootstep(e, false);
    });
    enemies = enemies.filter((e) => e.hp > 0 || e.hitFlash > 0);
  }

  function updatePickups(dt) {
    pickups.forEach((p) => {
      p.life -= dt;
      p.vy += 700 * dt;
      p.y += p.vy * dt;
      const g = supportY(p.x, p.y, 20);
      if (p.y >= g - 8) {
        p.y = g - 8;
        p.vy = 0;
      }
      if (player && Math.abs(p.x - player.x) < 36 && Math.abs(p.y - (player.y - 30)) < 50) {
        if (p.kind === "gold") {
          save.gold += p.value;
          persist();
          addFloat(p.x, p.y, `+${p.value}`, "#e8a84a");
        } else {
          player.hp = Math.min(player.maxHp, player.hp + p.value);
          addFloat(p.x, p.y, `+${p.value}`, "#3ecf9a");
        }
        p.life = 0;
      }
    });
    pickups = pickups.filter((p) => p.life > 0);
  }

  function updateFx(dt) {
    particles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 500 * dt;
    });
    particles = particles.filter((p) => p.life > 0);
    floatTexts.forEach((f) => {
      f.life -= dt;
      f.y += f.vy * dt;
    });
    floatTexts = floatTexts.filter((f) => f.life > 0);
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (bgBlend < 1) bgBlend = Math.min(1, bgBlend + dt * 2.8);
    if (bgFlash > 0) bgFlash = Math.max(0, bgFlash - dt * 1.5);
  }

  function update(dt) {
    if (state !== "play" || !player) return;
    if (hitStop > 0) {
      hitStop -= dt;
      updateHud();
      return;
    }
    time += dt;
    if (spawnQueue.length) {
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        const next = spawnQueue.shift();
        spawnEnemy(next.type, next.wave != null ? next.wave : 0);
        spawnTimer = next.delay || 0.6;
      }
    }
    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateFx(dt);

    const target = player.x - window.innerWidth * 0.32;
    cameraX += (target - cameraX) * Math.min(1, dt * 4);
    cameraX = Math.max(0, Math.min(LEVEL_W - window.innerWidth, cameraX));

    if (!enemies.some((e) => e.hp > 0) && spawnQueue.length === 0) {
      clearTimer += dt;
      if (clearTimer > 0.55) levelWon();
    }
    updateHud();
  }

  function drawBg(key, w, h, alpha) {
    const im = img[key];
    if (!im || alpha < 0.02) return;
    const imgH = h;
    const imgW = (im.width / im.height) * imgH;
    const scroll = cameraX * 0.35;
    const offset = -((scroll % imgW) + imgW) % imgW;
    ctx.globalAlpha = alpha;
    for (let x = offset - imgW; x < w + imgW; x += imgW - 1) {
      ctx.drawImage(im, x, 0, imgW, imgH);
    }
    ctx.globalAlpha = 1;
  }

  function drawBackground(w, h) {
    ctx.fillStyle = "#070d12";
    ctx.fillRect(0, 0, w, h);
    const cur = (DECORS[decorId] || DECORS.forest).bg;
    const prev = (DECORS[prevDecorId] || DECORS.forest).bg;
    if (bgBlend < 1 && prev !== cur) {
      drawBg(prev, w, h, 1 - bgBlend);
      drawBg(cur, w, h, bgBlend);
    } else {
      drawBg(cur, w, h, 1);
    }
    if (bgFlash > 0) {
      ctx.fillStyle = `rgba(255,200,120,${bgFlash * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawPlatformsDebugOptional() {
    // ledge highlights so platforms read against painted décor
    platformsWorld().forEach((p) => {
      const sx = p.x - cameraX;
      ctx.fillStyle = "rgba(8,14,18,0.45)";
      ctx.fillRect(sx, p.y + 2, p.w, 8);
      ctx.fillStyle = "rgba(232,168,74,0.42)";
      ctx.fillRect(sx, p.y, p.w, 5);
      ctx.fillStyle = "rgba(255,236,190,0.55)";
      ctx.fillRect(sx, p.y, p.w, 2);
    });
  }

  function limbColor(isPlayer, alpha) {
    return isPlayer ? `rgba(28, 36, 44,${alpha})` : `rgba(72, 38, 28,${alpha})`;
  }

  /** Articulated thigh+shin so walk reads clearly on ninja and enemies. */
  function drawWalkLegs(ent, drawH, walking, isPlayer) {
    if (!walking) return;
    const phase = ent.gait || ent.anim;
    const amp = Math.max(0.55, Math.min(1.15, Math.abs(ent.vx) / Math.max(90, (ent.speed || 160) * 0.55)));
    const hipY = -drawH * 0.32;
    const thigh = drawH * 0.26;
    const shin = drawH * 0.24;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    function leg(side, swing) {
      const hipX = side * 7;
      const hipAngle = swing * 0.72 * amp;
      const kneeBend = 0.35 + Math.max(0, -swing) * 0.55 * amp;
      const kx = hipX + Math.sin(hipAngle) * thigh;
      const ky = hipY + Math.cos(hipAngle) * thigh;
      const footAngle = hipAngle + kneeBend;
      const fx = kx + Math.sin(footAngle) * shin;
      const fy = Math.min(-2, ky + Math.cos(footAngle) * shin);
      ctx.strokeStyle = limbColor(isPlayer, 0.92);
      ctx.lineWidth = Math.max(7, drawH * 0.07);
      ctx.beginPath();
      ctx.moveTo(hipX, hipY);
      ctx.lineTo(kx, ky);
      ctx.lineTo(fx, fy);
      ctx.stroke();
      // foot
      ctx.fillStyle = limbColor(isPlayer, 0.95);
      ctx.beginPath();
      ctx.ellipse(fx + side * 4, fy + 1, 10, 4, swing * 0.2, 0, Math.PI * 2);
      ctx.fill();
      // knee joint
      ctx.fillStyle = "rgba(232,168,74,0.35)";
      ctx.beginPath();
      ctx.arc(kx, ky, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    const a = Math.sin(phase);
    leg(-1, a);
    leg(1, -a);
  }

  /** Opposite arm swing while walking. */
  function drawWalkArms(ent, drawH, walking, isPlayer) {
    if (!walking) return;
    const phase = ent.gait || ent.anim;
    const a = Math.sin(phase);
    const amp = Math.max(0.5, Math.min(1.1, Math.abs(ent.vx) / Math.max(90, (ent.speed || 160) * 0.55)));
    const shoulder = -drawH * 0.58;
    const armLen = drawH * 0.28;
    ctx.lineCap = "round";
    ctx.strokeStyle = limbColor(isPlayer, 0.85);
    ctx.lineWidth = Math.max(5, drawH * 0.05);

    function arm(side, swing) {
      const sx = side * 9;
      const ang = -0.15 + swing * 0.85 * amp;
      const ex = sx + Math.sin(ang) * armLen;
      const ey = shoulder + Math.cos(ang) * armLen;
      ctx.beginPath();
      ctx.moveTo(sx, shoulder);
      ctx.quadraticCurveTo(sx + side * 6, shoulder + armLen * 0.45, ex, ey);
      ctx.stroke();
    }
    arm(-1, -a); // opposite to front leg
    arm(1, a);
  }

  /** Sword arm + katana blade driven by attack progress t∈[0..1]. */
  function drawKatanaArms(ent, drawH, t, isPlayer) {
    const shoulderY = -drawH * 0.56;
    const rearX = -10;
    const swordShoulderX = 8;
    // wind-up → cut → follow-through
    const ease = t < 0.25 ? t / 0.25 : t < 0.7 ? 0.15 + ((t - 0.25) / 0.45) * 0.85 : 1;
    const swordAng = -2.1 + ease * 3.1; // overhead to low slash
    const armLen = drawH * 0.3;
    const handX = swordShoulderX + Math.cos(swordAng) * armLen;
    const handY = shoulderY + Math.sin(swordAng) * armLen;

    ctx.lineCap = "round";
    // rear arm braced
    ctx.strokeStyle = limbColor(isPlayer, 0.88);
    ctx.lineWidth = Math.max(5, drawH * 0.048);
    ctx.beginPath();
    ctx.moveTo(rearX, shoulderY);
    ctx.quadraticCurveTo(rearX - 8, shoulderY + 18, rearX - 4, shoulderY + 32);
    ctx.stroke();

    // sword arm
    ctx.lineWidth = Math.max(6, drawH * 0.055);
    ctx.beginPath();
    ctx.moveTo(swordShoulderX, shoulderY);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // hand
    ctx.fillStyle = isPlayer ? "rgba(232,200,150,0.9)" : "rgba(210,160,120,0.9)";
    ctx.beginPath();
    ctx.arc(handX, handY, 5, 0, Math.PI * 2);
    ctx.fill();

    // katana blade from hand along slash direction
    const bladeLen = isPlayer ? 46 : 38;
    const tipX = handX + Math.cos(swordAng) * bladeLen;
    const tipY = handY + Math.sin(swordAng) * bladeLen;
    ctx.strokeStyle = isPlayer ? "rgba(240,220,170,0.98)" : "rgba(255,170,140,0.95)";
    ctx.lineWidth = isPlayer ? 3.5 : 3;
    ctx.beginPath();
    ctx.moveTo(handX, handY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // edge flash
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(handX + Math.cos(swordAng) * 6, handY + Math.sin(swordAng) * 6);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // slash trail
    if (ease > 0.2 && ease < 0.95) {
      ctx.strokeStyle = isPlayer ? "rgba(232,168,74,0.55)" : "rgba(255,120,90,0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(swordShoulderX, shoulderY, armLen + bladeLen * 0.55, swordAng - 0.85, swordAng);
      ctx.stroke();
    }
  }

  function drawSplitWalkSprite(spr, drawW, drawH, phase, walking, flipping) {
    if (!spr) return;
    if (flipping) {
      ctx.save();
      ctx.scale(0.9, 0.76);
      ctx.drawImage(spr, -drawW * 0.5, -drawH * 0.9, drawW, drawH);
      ctx.restore();
      return;
    }
    if (!walking) {
      ctx.drawImage(spr, -drawW * 0.5, -drawH, drawW, drawH);
      return;
    }
    const stride = Math.sin(phase);
    const bob = Math.abs(Math.sin(phase)) * 6;
    const lean = stride * 0.12;
    // crop sprite to torso only so articulated legs replace the frozen lower half
    const split = 0.52;
    const torsoH = drawH * split;
    const srcTorsoH = spr.height * split;

    ctx.save();
    ctx.translate(stride * 2, -drawH + torsoH * 0.5 - bob);
    ctx.rotate(-lean);
    ctx.drawImage(spr, 0, 0, spr.width, srcTorsoH, -drawW * 0.5, -torsoH * 0.5, drawW, torsoH);
    ctx.restore();
  }

  function drawActor(ent, spriteKey, isPlayer) {
    const spr = img[spriteKey] || img.hero;
    const sx = ent.x - cameraX;
    const walking =
      ent.onGround &&
      Math.abs(ent.vx) > 14 &&
      ent.pose !== "attack" &&
      ent.pose !== "kick" &&
      ent.pose !== "defend" &&
      ent.pose !== "hurt";
    const flipping = isPlayer && (ent.flipping || (ent.flipAngle || 0) > 0.05) && !ent.onGround;
    const idle = ent.pose === "idle" || ent.pose === "guard";
    const phase = ent.gait || ent.anim;
    const stride = Math.sin(phase);
    const breath = Math.sin(ent.anim * 1.4) * 1.2;
    const bob = flipping
      ? 0
      : walking
        ? Math.abs(Math.sin(phase)) * 5.5
        : idle
          ? breath
          : !ent.onGround
            ? Math.min(4, Math.abs(ent.vy) * 0.004)
            : 0;

    const sq = ent.squash || 0;
    const bodyLean = ent.lean || 0;

    ctx.save();
    ctx.translate(sx, ent.y + bob);

    let rot = bodyLean * (isPlayer ? ent.facing : -ent.facing);
    if (isPlayer && flipping) {
      rot = -ent.facing * ent.flipAngle;
    } else if (isPlayer) {
      if (ent.attacking > 0 && !ent.onGround) rot += -ent.facing * (1 - ent.attacking / 0.35) * 0.65;
      if (ent.kicking > 0 && !ent.onGround) rot += -ent.facing * 0.7;
      if (!ent.onGround && !flipping) rot += -ent.facing * Math.max(-0.15, Math.min(0.2, -ent.vy * 0.00025));
    } else if (!ent.onGround) {
      rot += Math.sin(ent.anim * 1.6) * 0.12;
    }
    if (walking) rot += stride * 0.06;
    ctx.rotate(rot);
    const look = isPlayer ? ent.facing : -ent.facing;
    ctx.scale(look, 1);

    let sxScale = 1 + Math.max(0, sq) * 0.55 - Math.min(0, sq) * 0.35;
    let syScale = 1 - Math.max(0, sq) * 0.45 + Math.min(0, sq) * 0.55;
    if (flipping) {
      sxScale *= 0.88;
      syScale *= 0.74;
    } else if (walking) {
      sxScale *= 1 + Math.sin(phase * 2) * 0.035;
      syScale *= 1 - Math.abs(Math.sin(phase)) * 0.045;
    } else if (ent.pose === "defend" || ent.pose === "guard") {
      sxScale *= 0.94;
      syScale *= 1.03;
    } else if (ent.pose === "attack") {
      sxScale *= 1.05;
      syScale *= 0.96;
    } else if (ent.pose === "kick") {
      sxScale *= 1.08;
      syScale *= 0.93;
    } else if (idle) {
      sxScale *= 1 + Math.sin(ent.anim * 1.4) * 0.012;
      syScale *= 1 - Math.sin(ent.anim * 1.4) * 0.012;
    } else if (!ent.onGround) {
      sxScale *= 0.96;
      syScale *= 1.04;
    }
    ctx.scale(sxScale, syScale);

    if (ent.hitFlash > 0) ctx.globalAlpha = 0.55 + Math.sin(time * 45) * 0.3;
    if (isPlayer && ent.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.4;

    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(walking ? stride * 4 : 0, -2, ent.w * (walking ? 0.48 : flipping ? 0.26 : 0.38), walking ? 4 : 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawH = ent.h;
    const drawW = spr ? (spr.width / spr.height) * drawH : ent.w * 0.7;
    if (spr) {
      drawSplitWalkSprite(spr, drawW, drawH, phase, walking, flipping);
    } else {
      ctx.fillStyle = isPlayer ? "#3a4650" : "#6a3a28";
      ctx.fillRect(-ent.w * 0.3, -ent.h, ent.w * 0.6, ent.h);
    }

    const attackingNow =
      (isPlayer && ent.attacking > 0) || (!isPlayer && ent.pose === "attack" && (ent.swing || 0) > 0);
    const kickingNow = (isPlayer && ent.kicking > 0) || (!isPlayer && ent.pose === "kick");

    // Legs always when grounded and moving (including light combat shuffle)
    if (!flipping && ent.onGround && Math.abs(ent.vx) > 10 && !kickingNow) {
      drawWalkLegs(ent, drawH, true, isPlayer);
    }
    if (walking && !flipping && !attackingNow) {
      drawWalkArms(ent, drawH, true, isPlayer);
    }
    if (flipping) {
      ctx.strokeStyle = "rgba(232,168,74,0.4)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, -drawH * 0.45, drawH * 0.2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Katana: arm swing drives the blade
    if (attackingNow) {
      const progress = isPlayer
        ? 1 - Math.min(1, ent.attacking / 0.32)
        : Math.min(1, Math.max(0, 1 - (ent.swing || 0)));
      drawKatanaArms(ent, drawH, progress, isPlayer);
    }

    // Kick: extended striking leg
    if (kickingNow) {
      const t = isPlayer ? 1 - Math.min(1, ent.kicking / 0.36) : 0.7;
      ctx.strokeStyle = limbColor(isPlayer, 0.95);
      ctx.lineWidth = Math.max(7, drawH * 0.07);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(4, -drawH * 0.3);
      ctx.quadraticCurveTo(18 + t * 10, -drawH * 0.12, 28 + t * 36, -drawH * (0.22 - t * 0.1));
      ctx.stroke();
      ctx.fillStyle = "rgba(62,207,154,0.85)";
      ctx.beginPath();
      ctx.arc(28 + t * 36, -drawH * (0.22 - t * 0.1), 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // guard / shield silhouette
    if (ent.pose === "defend" || ent.pose === "guard" || (isPlayer && ent.defending > 0)) {
      ctx.strokeStyle = "rgba(168,200,240,0.85)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(ent.w * 0.12, -ent.h * 0.45, 22, -0.9, 0.9);
      ctx.stroke();
      ctx.fillStyle = "rgba(168,200,240,0.18)";
      ctx.beginPath();
      ctx.arc(ent.w * 0.12, -ent.h * 0.45, 20, -0.9, 0.9);
      ctx.fill();
    }

    if (!isPlayer && ent.elite) {
      ctx.strokeStyle = "rgba(232,168,74,0.55)";
      ctx.lineWidth = 2;
      ctx.strokeRect(-ent.w * 0.28, -ent.h * 0.98, ent.w * 0.56, ent.h * 0.96);
    }

    ctx.restore();

    if (!isPlayer) {
      const barY = ent.y - ent.h - 18;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(sx - 26, barY, 52, 5);
      ctx.fillStyle = ent.type === "boss" ? "#e8a84a" : ent.elite ? "#f0b85a" : "#c23b3b";
      ctx.fillRect(sx - 26, barY, 52 * Math.max(0, ent.hp / ent.maxHp), 5);
      ctx.fillStyle = ent.elite ? "#f0b85a" : "#d8cfc0";
      ctx.font = "600 11px Teko, Impact, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Nv.${ent.rank || 1}${ent.elite ? " ★" : ""}`, sx, barY - 3);
      ctx.textAlign = "left";
    }
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (state === "menu" || state === "shop") {
      decorId = DECOR_CYCLE[(Math.max(1, save.level) - 1) % DECOR_CYCLE.length];
      prevDecorId = decorId;
      bgBlend = 1;
    }
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawBackground(w, h);
    drawPlatformsDebugOptional();

    pickups.forEach((p) => {
      ctx.fillStyle = p.kind === "gold" ? "#e8a84a" : "#3ecf9a";
      ctx.beginPath();
      ctx.arc(p.x - cameraX, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    enemies.forEach((e) => {
      if (e.hp > 0 || e.hitFlash > 0) drawActor(e, e.sprite, false);
    });
    if (player) drawActor(player, outfitSpriteKey(), true);
    projectiles.forEach(drawShuriken);

    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - cameraX, p.y, p.size, p.size);
    });
    ctx.globalAlpha = 1;
    floatTexts.forEach((f) => {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = "700 16px Teko, sans-serif";
      ctx.fillText(f.text, f.x - cameraX, f.y);
    });
    ctx.globalAlpha = 1;

    const vig = ctx.createRadialGradient(w * 0.5, h * 0.45, h * 0.2, w * 0.5, h * 0.5, h * 0.78);
    vig.addColorStop(0, "transparent");
    vig.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function loop(ts) {
    const dt = Math.min(0.033, (ts - lastTs) / 1000 || 0.016);
    lastTs = ts;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function bindControls() {
    document.querySelectorAll(".ctrl").forEach((btn) => {
      const act = btn.dataset.act;
      const set = (v) => {
        if (act === "left") input.left = v;
        if (act === "right") input.right = v;
        if (act === "defend") input.defend = v;
        if (act === "jump") {
          if (v && !input.jump) input.jumpPressed = true;
          input.jump = v;
        }
        if (act === "attack") {
          if (v && !input.attack) input.attackPressed = true;
          input.attack = v;
        }
        if (act === "kick") {
          if (v && !input.kick) input.kickPressed = true;
          input.kick = v;
        }
        if (act === "throw") {
          if (v && !input.throw) input.throwPressed = true;
          input.throw = v;
        }
        btn.classList.toggle("active", v);
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        set(true);
      });
      const up = () => set(false);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("lostpointercapture", up);
    });

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "ArrowLeft" || e.code === "KeyQ") input.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
      if (e.code === "KeyL" || e.code === "ShiftLeft" || e.code === "ShiftRight") input.defend = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyZ") {
        input.jump = true;
        input.jumpPressed = true;
        e.preventDefault();
      }
      if (e.code === "KeyJ" || e.code === "KeyA") input.attackPressed = true;
      if (e.code === "KeyK" || e.code === "KeyE") input.kickPressed = true;
      if (e.code === "KeyU" || e.code === "KeyF") input.throwPressed = true;
      if (e.code === "KeyN" && (state === "play" || state === "pause")) {
        skipToNextLevel();
      }
      if ((e.code === "KeyC" || e.code === "Tab") && state === "play") {
        e.preventDefault();
        cycleWeapon();
      }
      if (e.code === "Escape" && state === "play") {
        state = "pause";
        showScreen("pause");
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyQ") input.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
      if (e.code === "KeyL" || e.code === "ShiftLeft" || e.code === "ShiftRight") input.defend = false;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyZ") input.jump = false;
    });
  }

  function manualSave() {
    persist({ toast: "Progression sauvegardée" });
  }

  function bindUi() {
    $("btn-play").onclick = () => {
      if (hasProgress()) {
        const ok = window.confirm("Effacer la sauvegarde et recommencer au niveau 1 ?");
        if (!ok) return;
      }
      save = defaultSave();
      persist({ toast: "Nouvelle partie" });
      updateContinueBtn();
      startLevel();
    };
    $("btn-continue").onclick = () => {
      save = load();
      updateContinueBtn();
      startLevel();
    };
    const installHome = $("btn-install-home");
    if (installHome) {
      installHome.onclick = async () => {
        const promptEvt = window.__ombreInstallPrompt;
        if (promptEvt) {
          promptEvt.prompt();
          await promptEvt.userChoice;
          window.__ombreInstallPrompt = null;
          showToast("Icône ajoutée");
          return;
        }
        window.location.href = "telecharger.html";
      };
    }
    $("btn-next-level").onclick = () => {
      persist();
      startLevel();
    };
    const skip = $("btn-skip-level");
    if (skip) skip.onclick = () => skipToNextLevel();
    const nextAfter = $("btn-next-after");
    if (nextAfter) nextAfter.onclick = () => {
      persist();
      startLevel();
    };
    const pauseNext = $("btn-pause-next");
    if (pauseNext) pauseNext.onclick = () => skipToNextLevel();
    ["btn-save-menu", "btn-save-shop", "btn-save-pause"].forEach((id) => {
      const el = $(id);
      if (el) el.onclick = () => manualSave();
    });
    $("btn-menu-from-shop").onclick = () => {
      persist({ toast: "Progression sauvegardée" });
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    };
    $("btn-pause").onclick = () => {
      if (state !== "play") return;
      persist();
      state = "pause";
      showScreen("pause");
    };
    $("btn-resume").onclick = () => {
      state = "play";
      showScreen(null);
    };
    $("btn-quit").onclick = () => {
      persist({ toast: "Progression sauvegardée" });
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    };
    $("btn-retry").onclick = () => startLevel();
    $("btn-shop-after").onclick = () => openShop();
    $("btn-menu-over").onclick = () => {
      persist();
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    };
    document.querySelectorAll(".tab").forEach((t) => {
      t.onclick = () => {
        shopTab = t.dataset.tab;
        renderShop();
      };
    });
    window.addEventListener("beforeunload", () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
      } catch (_) {}
    });
  }

  window.OmbreDuDojo = {
    cycleDecor: (boss) => cycleDecor(!!boss),
    getDecor: () => decorId,
  };

  resize();
  window.addEventListener("resize", resize);
  bindControls();
  bindUi();
  updateContinueBtn();
  showScreen("menu");
  player = makePlayer();

  loadAllAssets().then(() => requestAnimationFrame(loop));
  (function waitBoot() {
    if (assetsReady) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.fillStyle = "#070d12";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e8a84a";
    ctx.font = "700 28px Teko, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Chargement…", w / 2, h / 2);
    requestAnimationFrame(waitBoot);
  })();
})();
