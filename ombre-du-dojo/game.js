(() => {
  "use strict";

  const STORAGE_KEY = "ombre-du-dojo-v1";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");

  const UPGRADES = [
    { id: "hp", name: "Vitalité", desc: "+25 PV max et soins partiels", base: 35, step: 20, max: 8 },
    { id: "dmg", name: "Lame", desc: "+4 dégâts de mêlée", base: 40, step: 25, max: 10 },
    { id: "spd", name: "Agilité", desc: "+8% vitesse de course", base: 45, step: 30, max: 6 },
    { id: "jump", name: "Ressort", desc: "Saut un peu plus haut", base: 40, step: 28, max: 4 },
    { id: "special", name: "Shuriken", desc: "Spécial plus fort / recharge plus vite", base: 55, step: 35, max: 7 },
    { id: "armor", name: "Armure", desc: "-8% dégâts reçus", base: 50, step: 32, max: 5 },
  ];

  const ZONES = ["dojo", "forest", "rooftops", "cave", "fortress"];

  const defaultSave = () => ({
    gold: 0,
    level: 1,
    upgrades: { hp: 0, dmg: 0, spd: 0, jump: 0, special: 0, armor: 0 },
  });

  let save = load();

  const input = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    attack: false,
    attackPressed: false,
    special: false,
    specialPressed: false,
  };

  let state = "menu";
  let player = null;
  let enemies = [];
  let particles = [];
  let ambient = [];
  let pickups = [];
  let projectiles = [];
  let floatTexts = [];
  let cameraX = 0;
  let levelW = 1400;
  let groundY = 420;
  let spawnQueue = [];
  let spawnTimer = 0;
  let levelClearTimer = 0;
  let shake = 0;
  let time = 0;
  let lastTs = 0;
  let bossFight = false;
  let hitStop = 0;
  let zoneName = "dojo";

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
      const parsed = JSON.parse(raw);
      return {
        ...defaultSave(),
        ...parsed,
        upgrades: { ...defaultSave().upgrades, ...(parsed.upgrades || {}) },
      };
    } catch {
      return defaultSave();
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  }

  function upgradeCost(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const lv = save.upgrades[id] || 0;
    return u.base + u.step * lv;
  }

  function statsFromSave() {
    const u = save.upgrades;
    const maxHp = 120 + u.hp * 25;
    return {
      maxHp,
      hp: maxHp,
      dmg: 14 + u.dmg * 4,
      speed: 235 * (1 + u.spd * 0.08),
      jump: 440 + u.jump * 28,
      specialDmg: 24 + u.special * 6,
      specialCd: Math.max(1.2, 3.6 - u.special * 0.35),
      armor: Math.min(0.45, 0.05 + u.armor * 0.08),
    };
  }

  function zoneForLevel(lv) {
    return ZONES[Math.floor((Math.max(1, lv) - 1) / 5) % ZONES.length];
  }

  function showScreen(name) {
    Object.entries(screens).forEach(([k, el]) => {
      el.classList.toggle("hidden", k !== name);
    });
    const playing = name === null;
    $("hud").classList.toggle("hidden", !playing);
    $("controls").classList.toggle("hidden", !playing);
    $("btn-pause").classList.toggle("hidden", !playing);
  }

  function updateContinueBtn() {
    const btn = $("btn-continue");
    const hasProgress = save.level > 1 || save.gold > 0 || Object.values(save.upgrades).some((v) => v > 0);
    btn.classList.toggle("hidden", !hasProgress);
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
    groundY = Math.min(h * 0.74, h - 150);
  }

  function makePlayer() {
    const s = statsFromSave();
    return {
      x: 120,
      y: groundY,
      vx: 0,
      vy: 0,
      w: 40,
      h: 58,
      facing: 1,
      onGround: true,
      attacking: 0,
      attackCd: 0,
      specialCd: 0,
      invuln: 0,
      hitFlash: 0,
      anim: 0,
      pose: "idle",
      ...s,
    };
  }

  function isBossLevel(lv) {
    return lv > 0 && lv % 5 === 0;
  }

  function enemyScale(lv) {
    // Gentler early curve; ramps after level 4
    if (lv <= 3) return 0.72 + (lv - 1) * 0.08;
    return 1 + (lv - 4) * 0.09;
  }

  function buildSpawnQueue(lv) {
    const queue = [];
    if (isBossLevel(lv)) {
      const minions = Math.max(1, 1 + Math.floor(lv / 10));
      for (let i = 0; i < minions; i++) {
        queue.push({ type: i % 2 === 0 ? "assassin" : "monster", delay: 0.7 + i * 0.5 });
      }
      queue.push({ type: "boss", delay: 1.4 });
      return queue;
    }
    const count = lv <= 2 ? 2 : lv <= 4 ? 3 : 3 + Math.floor((lv - 4) * 0.7);
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let type = "assassin";
      if (lv >= 3 && roll > 0.62) type = "monster";
      if (lv >= 8 && roll > 0.85) type = Math.random() > 0.5 ? "assassin" : "monster";
      queue.push({ type, delay: 0.7 + i * 0.85 + Math.random() * 0.2 });
    }
    return queue;
  }

  function spawnEnemy(type) {
    const lv = save.level;
    const sc = enemyScale(lv);
    const fromRight = Math.random() > 0.35;
    const x = fromRight ? cameraX + window.innerWidth + 40 : cameraX - 40;
    let e;
    if (type === "assassin") {
      e = {
        type,
        x,
        y: groundY,
        w: 34,
        h: 52,
        vx: 0,
        vy: 0,
        hp: Math.round(18 * sc),
        maxHp: Math.round(18 * sc),
        dmg: Math.round(5 * sc),
        speed: 130 + lv * 4,
        gold: 10 + lv,
        facing: fromRight ? -1 : 1,
        attackCd: 0.55,
        attackWind: 0,
        hitFlash: 0,
        anim: Math.random() * 10,
        pose: "idle",
        onGround: true,
      };
    } else if (type === "monster") {
      e = {
        type,
        x,
        y: groundY,
        w: 52,
        h: 66,
        vx: 0,
        vy: 0,
        hp: Math.round(55 * sc),
        maxHp: Math.round(55 * sc),
        dmg: Math.round(11 * sc),
        speed: 78 + lv * 2.5,
        gold: 14 + lv * 2,
        facing: fromRight ? -1 : 1,
        attackCd: 1.0,
        attackWind: 0,
        hitFlash: 0,
        anim: Math.random() * 10,
        pose: "idle",
        onGround: true,
      };
    } else {
      const bossSc = sc * (1 + Math.floor(lv / 5) * 0.2);
      e = {
        type: "boss",
        x: cameraX + window.innerWidth * 0.65,
        y: groundY,
        w: 78,
        h: 96,
        vx: 0,
        vy: 0,
        hp: Math.round(180 * bossSc),
        maxHp: Math.round(180 * bossSc),
        dmg: Math.round(15 * bossSc),
        speed: 100 + lv * 2,
        gold: 80 + lv * 15,
        facing: -1,
        attackCd: 1.1,
        attackWind: 0,
        hitFlash: 0,
        anim: 0,
        pose: "idle",
        onGround: true,
        phase: 0,
      };
      bossFight = true;
    }
    enemies.push(e);
  }

  function seedAmbient() {
    ambient = [];
    const n = zoneName === "cave" ? 18 : zoneName === "forest" ? 14 : 10;
    for (let i = 0; i < n; i++) {
      ambient.push({
        x: Math.random() * levelW,
        y: 40 + Math.random() * (groundY - 80),
        vx: (Math.random() - 0.5) * (zoneName === "rooftops" ? 28 : 12),
        vy: (Math.random() - 0.5) * 6,
        size: 1 + Math.random() * 2.5,
        life: 1,
        kind: zoneName === "cave" ? "ember" : zoneName === "forest" ? "leaf" : "dust",
      });
    }
  }

  function startLevel() {
    zoneName = zoneForLevel(save.level);
    player = makePlayer();
    player.invuln = save.level <= 2 ? 2.2 : 1.4;
    enemies = [];
    particles = [];
    pickups = [];
    projectiles = [];
    floatTexts = [];
    cameraX = 0;
    levelW = isBossLevel(save.level) ? 1150 : 1200 + save.level * 35;
    bossFight = false;
    spawnQueue = buildSpawnQueue(save.level);
    spawnTimer = save.level <= 2 ? 1.4 : 1.0;
    levelClearTimer = 0;
    shake = 0;
    hitStop = 0;
    seedAmbient();
    state = "play";
    showScreen(null);
    updateHud();
  }

  function updateHud() {
    if (!player) return;
    const pct = Math.max(0, player.hp / player.maxHp);
    $("hp-bar").style.transform = `scaleX(${pct})`;
    $("hp-text").textContent = `${Math.ceil(player.hp)}`;
    $("gold-hud").textContent = `${save.gold}`;
    $("level-label").textContent = isBossLevel(save.level)
      ? `Boss ${save.level}`
      : `Niv. ${save.level}`;
    const alive = enemies.filter((e) => e.hp > 0).length;
    $("wave-label").textContent = `${alive + spawnQueue.length}`;
    const ready = player.specialCd <= 0;
    $("special-ready").classList.toggle("ready", ready);
    $("special-ready").textContent = ready ? "Spécial" : `${player.specialCd.toFixed(1)}s`;
  }

  function openShop() {
    state = "shop";
    zoneName = zoneForLevel(save.level);
    showScreen("shop");
    $("shop-gold").textContent = String(save.gold);
    $("shop-next").textContent = String(save.level);
    const list = $("shop-list");
    list.innerHTML = "";
    UPGRADES.forEach((u) => {
      const lv = save.upgrades[u.id] || 0;
      const cost = upgradeCost(u.id);
      const maxed = lv >= u.max;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shop-item";
      btn.disabled = maxed || save.gold < cost;
      btn.innerHTML = `
        <span class="name">${u.name} <small>Nv.${lv}/${u.max}</small></span>
        <span class="price">${maxed ? "MAX" : cost + " ◆"}</span>
        <span class="desc">${u.desc}</span>
      `;
      btn.addEventListener("click", () => {
        if (maxed || save.gold < cost) return;
        save.gold -= cost;
        save.upgrades[u.id] = lv + 1;
        persist();
        openShop();
      });
      list.appendChild(btn);
    });
  }

  function levelWon() {
    state = "won";
    const bonus = 25 + save.level * 6 + (isBossLevel(save.level) ? 70 : 0);
    save.gold += bonus;
    save.level += 1;
    persist();
    $("over-title").textContent = "Victoire !";
    $("over-msg").textContent = `Niveau terminé. Bonus +${bonus} ◆ — or total ${save.gold}`;
    $("btn-shop-after").classList.remove("hidden");
    $("btn-retry").classList.add("hidden");
    showScreen("over");
  }

  function levelLost() {
    state = "dead";
    persist();
    $("over-title").textContent = "Défaite";
    $("over-msg").textContent = `Tu tombes au niveau ${save.level}. Or conservé: ${save.gold} ◆`;
    $("btn-shop-after").classList.remove("hidden");
    $("btn-retry").classList.remove("hidden");
    showScreen("over");
  }

  function addParticles(x, y, color, n = 8) {
    for (let i = 0; i < n; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 260,
        vy: -Math.random() * 220 - 40,
        life: 0.35 + Math.random() * 0.45,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function addFloat(x, y, text, color) {
    floatTexts.push({ x, y, text, color, life: 0.75, vy: -48 });
  }

  function nearestEnemy(fromX) {
    let best = null;
    let bestD = Infinity;
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      const d = Math.abs(e.x - fromX);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    });
    return best;
  }

  function hurtPlayer(amount, fromX) {
    if (player.invuln > 0 || player.hp <= 0) return;
    const dmg = Math.max(1, Math.round(amount * (1 - player.armor)));
    player.hp -= dmg;
    player.invuln = save.level <= 3 ? 1.05 : 0.8;
    player.hitFlash = 0.25;
    player.pose = "hurt";
    player.vx += fromX < player.x ? 160 : -160;
    player.vy = -140;
    shake = 10;
    addParticles(player.x, player.y - 30, "#c23b3b", 10);
    addFloat(player.x, player.y - 60, `-${dmg}`, "#ff8a7a");
    if (player.hp <= 0) {
      player.hp = 0;
      levelLost();
    }
  }

  function hurtEnemy(e, amount, knock) {
    e.hp -= amount;
    e.hitFlash = 0.18;
    e.pose = "hurt";
    e.vx += knock;
    hitStop = Math.max(hitStop, 0.04);
    addParticles(e.x, e.y - e.h * 0.5, "#e8a84a", 7);
    addFloat(e.x, e.y - e.h - 10, `-${amount}`, "#ffe2a8");
    if (e.hp <= 0) {
      e.hp = 0;
      save.gold += e.gold;
      addFloat(e.x, e.y - e.h, `+${e.gold}`, "#e8a84a");
      addParticles(e.x, e.y - e.h * 0.4, "#3ecf9a", 14);
      if (Math.random() < 0.4) {
        const kind = Math.random() < 0.45 ? "gold" : "heart";
        pickups.push({
          x: e.x,
          y: e.y - 20,
          vy: -120,
          kind,
          value: kind === "heart" ? 22 + save.upgrades.hp * 2 : 10 + Math.floor(save.level / 2),
          life: 8,
        });
      }
      shake = Math.max(shake, e.type === "boss" ? 16 : 6);
    }
  }

  function tryAttack() {
    if (!player || player.attackCd > 0 || player.attacking > 0) return;
    const foe = nearestEnemy(player.x);
    if (foe && Math.abs(foe.x - player.x) < 220) {
      player.facing = foe.x >= player.x ? 1 : -1;
    }
    player.attacking = 0.26;
    player.attackCd = 0.28;
    player.pose = "attack";
    const range = 58;
    const ax = player.x + player.facing * (player.w * 0.35 + range * 0.5);
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      const dx = e.x - ax;
      const dy = e.y - player.y;
      if (Math.abs(dx) < range + e.w * 0.35 && Math.abs(dy) < 55) {
        hurtEnemy(e, player.dmg, player.facing * 150);
      }
    });
    addParticles(ax, player.y - 28, "#f0d9a8", 5);
  }

  function trySpecial() {
    if (!player || player.specialCd > 0) return;
    const foe = nearestEnemy(player.x);
    if (foe) player.facing = foe.x >= player.x ? 1 : -1;
    player.specialCd = statsFromSave().specialCd;
    player.pose = "attack";
    for (let i = 0; i < 3; i++) {
      projectiles.push({
        x: player.x + player.facing * 20,
        y: player.y - 34 - i * 4,
        vx: player.facing * (500 + i * 20),
        vy: (i - 1) * 36,
        life: 1.1,
        dmg: player.specialDmg,
        friendly: true,
        spin: 0,
      });
    }
    addParticles(player.x, player.y - 30, "#3ecf9a", 8);
  }

  function aabb(a, b) {
    return (
      Math.abs(a.x - b.x) < (a.w + b.w) * 0.45 &&
      Math.abs(a.y - a.h * 0.5 - (b.y - b.h * 0.5)) < (a.h + b.h) * 0.45
    );
  }

  function updatePlayer(dt) {
    const p = player;
    const moving = Math.abs(p.vx) > 25;
    p.anim += dt * (p.onGround && moving ? 11 : 4);
    if (p.attackCd > 0) p.attackCd -= dt;
    if (p.attacking > 0) p.attacking -= dt;
    if (p.specialCd > 0) p.specialCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hitFlash > 0) p.hitFlash -= dt;

    let move = 0;
    if (input.left) move -= 1;
    if (input.right) move += 1;
    p.vx += (move * p.speed - p.vx) * Math.min(1, dt * 12);
    if (move !== 0) {
      p.facing = move > 0 ? 1 : -1;
    } else {
      const foe = nearestEnemy(p.x);
      if (foe && Math.abs(foe.x - p.x) < 320) {
        p.facing = foe.x >= p.x ? 1 : -1;
      }
    }

    if (p.hitFlash > 0.05) p.pose = "hurt";
    else if (p.attacking > 0) p.pose = "attack";
    else if (!p.onGround) p.pose = "jump";
    else if (moving) p.pose = "run";
    else p.pose = "idle";

    if (input.jumpPressed && p.onGround) {
      p.vy = -p.jump;
      p.onGround = false;
      addParticles(p.x, p.y, "rgba(200,220,220,0.45)", 5);
    }
    input.jumpPressed = false;

    if (input.attackPressed) tryAttack();
    input.attackPressed = false;
    if (input.specialPressed) trySpecial();
    input.specialPressed = false;

    p.vy += 1400 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.y >= groundY) {
      p.y = groundY;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
    }
    p.x = Math.max(40, Math.min(levelW - 40, p.x));
  }

  function updateEnemies(dt) {
    enemies.forEach((e) => {
      if (e.hp <= 0) return;
      e.anim += dt * (Math.abs(e.vx) > 20 ? 8 : 4);
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackCd > 0) e.attackCd -= dt;

      if (e.hitFlash > 0.05) e.pose = "hurt";
      else if (e.attackWind > 0) e.pose = "attack";
      else if (Math.abs(e.vx) > 20) e.pose = "run";
      else e.pose = "idle";

      if (e.attackWind > 0) {
        e.attackWind -= dt;
        if (e.attackWind <= 0) {
          const reach = e.type === "boss" ? 74 : e.type === "monster" ? 50 : 42;
          if (Math.abs(e.x - player.x) < reach && Math.abs(e.y - player.y) < 55) {
            hurtPlayer(e.dmg, e.x);
          }
          e.attackCd = e.type === "assassin" ? 0.95 : e.type === "monster" ? 1.35 : 1.15;
        }
        return;
      }

      const dx = player.x - e.x;
      e.facing = dx >= 0 ? 1 : -1;
      const dist = Math.abs(dx);
      const stopDist = e.type === "boss" ? 58 : e.type === "monster" ? 44 : 36;

      if (dist > stopDist) {
        const spd = e.speed * (e.type === "assassin" && dist < 220 ? 1.3 : 1);
        e.vx += (e.facing * spd - e.vx) * Math.min(1, dt * 8);
      } else {
        e.vx *= 0.85;
        if (e.attackCd <= 0) {
          e.attackWind = e.type === "assassin" ? 0.22 : e.type === "monster" ? 0.4 : 0.32;
        }
      }

      if (e.type === "boss" && e.hp < e.maxHp * 0.45 && Math.random() < dt * 0.55) {
        projectiles.push({
          x: e.x,
          y: e.y - 50,
          vx: e.facing * 300,
          vy: -30,
          life: 1.4,
          dmg: Math.round(e.dmg * 0.65),
          friendly: false,
          spin: 0,
        });
      }

      e.x += e.vx * dt;
      e.x = Math.max(60, Math.min(levelW - 60, e.x));

      if (aabb(e, { x: player.x, y: player.y, w: player.w * 0.7, h: player.h * 0.7 }) && e.attackWind <= 0) {
        if (e.type !== "assassin" && e.attackCd <= 0.2) {
          hurtPlayer(Math.round(e.dmg * 0.35), e.x);
          e.attackCd = 0.7;
        }
      }
    });
    enemies = enemies.filter((e) => e.hp > 0 || e.hitFlash > 0);
  }

  function updateProjectiles(dt) {
    projectiles.forEach((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.spin = (p.spin || 0) + dt * 14;
      if (p.friendly) {
        enemies.forEach((e) => {
          if (e.hp <= 0) return;
          if (Math.abs(e.x - p.x) < e.w * 0.45 && Math.abs(e.y - e.h * 0.55 - p.y) < e.h * 0.45) {
            hurtEnemy(e, p.dmg, Math.sign(p.vx) * 80);
            p.life = 0;
          }
        });
      } else if (player && player.hp > 0) {
        if (Math.abs(player.x - p.x) < 22 && Math.abs(player.y - 30 - p.y) < 28) {
          hurtPlayer(p.dmg, p.x);
          p.life = 0;
        }
      }
    });
    projectiles = projectiles.filter((p) => p.life > 0);
  }

  function updatePickups(dt) {
    pickups.forEach((p) => {
      p.life -= dt;
      p.vy += 600 * dt;
      p.y += p.vy * dt;
      if (p.y >= groundY - 10) {
        p.y = groundY - 10;
        p.vy = 0;
      }
      if (player && Math.abs(p.x - player.x) < 30 && Math.abs(p.y - (player.y - 20)) < 38) {
        if (p.kind === "gold") {
          save.gold += p.value;
          addFloat(p.x, p.y, `+${p.value}`, "#e8a84a");
        } else {
          player.hp = Math.min(player.maxHp, player.hp + p.value);
          addFloat(p.x, p.y, `+${p.value}`, "#3ecf9a");
        }
        p.life = 0;
        addParticles(p.x, p.y, p.kind === "gold" ? "#e8a84a" : "#3ecf9a", 6);
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
    ambient.forEach((a) => {
      a.x += a.vx * dt;
      a.y += a.vy * dt + Math.sin(time * 2 + a.x * 0.01) * 4 * dt;
      if (a.x < cameraX - 40) a.x = cameraX + window.innerWidth + 20;
      if (a.x > cameraX + window.innerWidth + 40) a.x = cameraX - 20;
      if (a.y < 20) a.y = groundY - 40;
      if (a.y > groundY - 20) a.y = 60;
    });
    if (shake > 0) shake = Math.max(0, shake - dt * 40);
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
        spawnEnemy(next.type);
        spawnTimer = next.delay || 0.5;
      }
    }

    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updatePickups(dt);
    updateFx(dt);

    const targetCam = player.x - window.innerWidth * 0.35;
    cameraX += (targetCam - cameraX) * Math.min(1, dt * 4);
    cameraX = Math.max(0, Math.min(Math.max(0, levelW - window.innerWidth), cameraX));

    const alive = enemies.some((e) => e.hp > 0);
    if (!alive && spawnQueue.length === 0) {
      levelClearTimer += dt;
      if (levelClearTimer > 0.85) levelWon();
    }

    updateHud();
  }

  // ——— Zone palettes ———
  function zonePalette(boss) {
    const z = zoneName;
    if (z === "forest") {
      return {
        sky0: boss ? "#061410" : "#0a1a14",
        sky1: boss ? "#0e2818" : "#163528",
        sky2: boss ? "#1a3020" : "#214032",
        far: "#0c2218",
        mid: "#143828",
        ground: "#1a2e22",
        groundTop: "#2a4a34",
        accent: "rgba(120,180,90,0.2)",
        moon: "rgba(210,230,200,0.75)",
      };
    }
    if (z === "rooftops") {
      return {
        sky0: boss ? "#0a0c18" : "#0c1420",
        sky1: boss ? "#1a1830" : "#182838",
        sky2: boss ? "#241828" : "#243848",
        far: "#121a28",
        mid: "#1a2838",
        ground: "#1c2430",
        groundTop: "#3a4858",
        accent: "rgba(232,168,74,0.18)",
        moon: "rgba(240,220,180,0.85)",
      };
    }
    if (z === "cave") {
      return {
        sky0: boss ? "#08060a" : "#0a0c10",
        sky1: boss ? "#1a100c" : "#141820",
        sky2: boss ? "#2a1810" : "#1c2428",
        far: "#0e1014",
        mid: "#181c22",
        ground: "#1a1816",
        groundTop: "#3a3028",
        accent: "rgba(212,83,42,0.22)",
        moon: "rgba(232,120,60,0.35)",
      };
    }
    if (z === "fortress") {
      return {
        sky0: boss ? "#100808" : "#101418",
        sky1: boss ? "#2a1010" : "#1c242c",
        sky2: boss ? "#3a1814" : "#283038",
        far: "#18141a",
        mid: "#242028",
        ground: "#1e1c1a",
        groundTop: "#4a3a32",
        accent: "rgba(196,70,48,0.25)",
        moon: "rgba(255,180,120,0.55)",
      };
    }
    // dojo default — ink / lantern / jade (no purple)
    return {
      sky0: boss ? "#050c10" : "#071018",
      sky1: boss ? "#142028" : "#102430",
      sky2: boss ? "#1c2a28" : "#1a2e28",
      far: "#0c1c24",
      mid: "#123038",
      ground: "#152820",
      groundTop: "#1e3a30",
      accent: "rgba(232,168,74,0.28)",
      moon: "rgba(232,220,180,0.9)",
    };
  }

  function drawBackground(w, h) {
    const boss = bossFight || isBossLevel(save.level);
    const pal = zonePalette(boss && state === "play");
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, pal.sky0);
    g.addColorStop(0.42, pal.sky1);
    g.addColorStop(1, pal.sky2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // moon / light
    const moonX = w * 0.78 - cameraX * 0.015;
    const moonY = h * (boss ? 0.12 : 0.16);
    if (zoneName === "cave") {
      const glow = ctx.createRadialGradient(moonX, moonY + 40, 4, moonX, moonY + 40, 90);
      glow.addColorStop(0, pal.moon);
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.fillRect(moonX - 90, moonY - 50, 180, 180);
    } else {
      ctx.beginPath();
      ctx.fillStyle = pal.moon;
      ctx.arc(moonX, moonY, boss ? 42 : 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = pal.sky0;
      ctx.arc(moonX + 12, moonY - 4, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    // far parallax
    ctx.fillStyle = pal.far;
    drawMountains(w, h, cameraX * 0.12, h * 0.46, 95, 0.85);
    ctx.fillStyle = pal.mid;
    drawMountains(w, h, cameraX * 0.28, h * 0.54, 72, 1.1);

    // zone props mid-layer
    drawZoneProps(w, h, cameraX * 0.55, pal, false);
    // near props
    drawZoneProps(w, h, cameraX * 0.85, pal, true);

    // ground
    ctx.fillStyle = pal.ground;
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = pal.groundTop;
    ctx.fillRect(0, groundY, w, 7);

    // ground grain
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let x = -((cameraX * 0.9) % 36); x < w; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, groundY + 8);
      ctx.lineTo(x + 16, Math.min(h, groundY + 80));
      ctx.stroke();
    }

    if (boss) {
      const rim = ctx.createRadialGradient(w * 0.5, groundY - 40, 20, w * 0.5, groundY, w * 0.55);
      rim.addColorStop(0, pal.accent);
      rim.addColorStop(1, "transparent");
      ctx.fillStyle = rim;
      ctx.fillRect(0, groundY - 160, w, 160);
    }

    // ambient motes
    ambient.forEach((a) => {
      const sx = a.x - cameraX;
      if (sx < -20 || sx > w + 20) return;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = a.kind === "ember" ? "#e8783a" : a.kind === "leaf" ? "#8cba6a" : "#c8d8d0";
      if (a.kind === "leaf") {
        ctx.fillRect(sx, a.y, a.size + 1, a.size * 0.6);
      } else {
        ctx.beginPath();
        ctx.arc(sx, a.y, a.size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.globalAlpha = 1;
  }

  function drawMountains(w, h, offset, base, amp, scale) {
    ctx.beginPath();
    ctx.moveTo(-20, h);
    for (let x = -40; x <= w + 40; x += 28) {
      const n = Math.sin((x + offset) * 0.01 * scale) * amp + Math.cos((x + offset) * 0.023) * amp * 0.4;
      ctx.lineTo(x, base - n);
    }
    ctx.lineTo(w + 20, h);
    ctx.closePath();
    ctx.fill();
  }

  function drawZoneProps(w, h, scroll, pal, near) {
    const spacing = near ? 320 : 420;
    const start = -((scroll % spacing) + spacing);
    for (let x = start; x < w + spacing; x += spacing) {
      const gx = x;
      if (zoneName === "dojo") drawTorii(gx + (near ? 40 : 0), groundY, near ? 1 : 0.7, near);
      else if (zoneName === "forest") drawTree(gx + 30, groundY, near ? 1.1 : 0.75, near);
      else if (zoneName === "rooftops") drawRoofline(gx, groundY, near ? 1 : 0.7, near);
      else if (zoneName === "cave") drawStalactite(gx + 50, near ? 0 : 10, near ? 1 : 0.8, near, pal);
      else if (zoneName === "fortress") drawBattlement(gx, groundY, near ? 1 : 0.75, near);
    }
  }

  function drawTorii(x, gy, s, near) {
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(s, s);
    ctx.globalAlpha = near ? 0.85 : 0.45;
    ctx.fillStyle = near ? "#8a3020" : "#5a2418";
    ctx.fillRect(-42, -118, 12, 118);
    ctx.fillRect(30, -118, 12, 118);
    ctx.fillRect(-58, -128, 116, 14);
    ctx.fillRect(-50, -108, 100, 9);
    // highlight
    ctx.fillStyle = "rgba(232,168,74,0.25)";
    ctx.fillRect(-58, -128, 116, 3);
    ctx.restore();
  }

  function drawTree(x, gy, s, near) {
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(s, s);
    ctx.globalAlpha = near ? 0.9 : 0.4;
    ctx.fillStyle = "#2a1c12";
    ctx.fillRect(-6, -70, 12, 70);
    ctx.fillStyle = near ? "#1a3a28" : "#12281c";
    ctx.beginPath();
    ctx.moveTo(0, -150);
    ctx.lineTo(48, -55);
    ctx.lineTo(-48, -55);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -175);
    ctx.lineTo(36, -90);
    ctx.lineTo(-36, -90);
    ctx.closePath();
    ctx.fillStyle = near ? "#245038" : "#163828";
    ctx.fill();
    ctx.restore();
  }

  function drawRoofline(x, gy, s, near) {
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(s, s);
    ctx.globalAlpha = near ? 0.8 : 0.35;
    ctx.fillStyle = near ? "#2a3440" : "#1a222c";
    ctx.fillRect(-20, -90, 100, 90);
    ctx.fillStyle = near ? "#3a4858" : "#243040";
    ctx.beginPath();
    ctx.moveTo(-30, -90);
    ctx.lineTo(30, -130);
    ctx.lineTo(90, -90);
    ctx.closePath();
    ctx.fill();
    // window glow
    if (near) {
      ctx.fillStyle = "rgba(232,168,74,0.35)";
      ctx.fillRect(10, -60, 14, 18);
      ctx.fillRect(40, -60, 14, 18);
    }
    ctx.restore();
  }

  function drawStalactite(x, y, s, near, pal) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = near ? 0.7 : 0.35;
    ctx.fillStyle = "#2a2824";
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(0, near ? 90 : 60);
    ctx.lineTo(18, 0);
    ctx.closePath();
    ctx.fill();
    if (near) {
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(0, 100, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBattlement(x, gy, s, near) {
    ctx.save();
    ctx.translate(x, gy);
    ctx.scale(s, s);
    ctx.globalAlpha = near ? 0.85 : 0.4;
    ctx.fillStyle = near ? "#3a342e" : "#24201c";
    ctx.fillRect(-10, -110, 90, 110);
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(-10 + i * 24, -128, 16, 20);
    }
    ctx.fillStyle = "rgba(196,70,48,0.3)";
    ctx.fillRect(20, -70, 18, 28);
    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawCharacter(ent, isPlayer) {
    const { x, y, w, h, facing, anim, hitFlash, attacking, pose } = ent;
    const sx = x - cameraX;
    const run = pose === "run";
    const bob = pose === "idle" ? Math.sin(anim) * 1.8 : run ? Math.abs(Math.sin(anim)) * 2.5 : 0;
    const legA = run ? Math.sin(anim) * 11 : pose === "jump" ? -8 : Math.sin(anim * 0.5) * 2;
    const armA = pose === "attack" || attacking > 0 ? 28 : run ? -Math.sin(anim) * 10 : Math.sin(anim * 0.6) * 3;

    ctx.save();
    ctx.translate(sx, y - h + bob);
    ctx.scale(facing, 1);

    if (hitFlash > 0) ctx.globalAlpha = 0.5 + Math.sin(time * 50) * 0.3;
    if (isPlayer && ent.invuln > 0 && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.35;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, h - 1, w * 0.42, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const palette = isPlayer
      ? { cloth: "#1a2830", clothHi: "#2a3c48", mask: "#0c1214", trim: "#d4532a", eye: "#e8a84a", skin: "#2a3438" }
      : ent.type === "assassin"
        ? { cloth: "#243038", clothHi: "#344850", mask: "#10161a", trim: "#5a7080", eye: "#3ecf9a", skin: "#2a3438" }
        : ent.type === "monster"
          ? { cloth: "#3a2820", clothHi: "#523828", mask: "#1a1210", trim: "#8a5030", eye: "#e8783a", skin: "#4a3028" }
          : { cloth: "#3a1824", clothHi: "#5a2434", mask: "#140c10", trim: "#e8a84a", eye: "#ff5a4a", skin: "#3a2028" };

    // back arm
    ctx.fillStyle = palette.cloth;
    ctx.save();
    ctx.translate(-w * 0.28, h * 0.32);
    ctx.rotate((-armA * Math.PI) / 180);
    roundRect(-5, 0, 10, h * 0.28, 3);
    ctx.fill();
    ctx.restore();

    // legs with shading
    ctx.fillStyle = palette.cloth;
    ctx.save();
    ctx.translate(-8, h * 0.55);
    ctx.rotate((legA * Math.PI) / 180);
    roundRect(-5, 0, 11, h * 0.42, 3);
    ctx.fill();
    ctx.fillStyle = palette.clothHi;
    ctx.fillRect(-4, 2, 3, h * 0.3);
    ctx.restore();
    ctx.save();
    ctx.translate(8, h * 0.55);
    ctx.rotate((-legA * Math.PI) / 180);
    ctx.fillStyle = palette.cloth;
    roundRect(-5, 0, 11, h * 0.42, 3);
    ctx.fill();
    ctx.restore();

    // torso
    const bodyGrad = ctx.createLinearGradient(-w * 0.3, h * 0.2, w * 0.3, h * 0.55);
    bodyGrad.addColorStop(0, palette.clothHi);
    bodyGrad.addColorStop(0.45, palette.cloth);
    bodyGrad.addColorStop(1, "#0a1014");
    ctx.fillStyle = bodyGrad;
    roundRect(-w * 0.32, h * 0.2, w * 0.64, h * 0.4, 6);
    ctx.fill();

    // sash
    ctx.fillStyle = palette.trim;
    ctx.fillRect(-w * 0.34, h * 0.38, w * 0.68, 5);
    if (isPlayer) {
      ctx.beginPath();
      ctx.moveTo(w * 0.28, h * 0.4);
      ctx.quadraticCurveTo(w * 0.72, h * 0.52 + Math.sin(anim * 2) * 5, w * 0.5, h * 0.72);
      ctx.strokeStyle = palette.trim;
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    // front arm / weapon
    ctx.save();
    ctx.translate(w * 0.22, h * 0.3);
    ctx.rotate((armA * Math.PI) / 180);
    ctx.fillStyle = palette.clothHi;
    roundRect(-4, 0, 9, h * 0.26, 3);
    ctx.fill();
    if (pose === "attack" || attacking > 0 || (!isPlayer && ent.attackWind > 0 && ent.attackWind < 0.15)) {
      ctx.strokeStyle = isPlayer ? "rgba(232,168,74,0.9)" : "rgba(255,110,80,0.75)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(8, 8, 30, -1.1, 0.85);
      ctx.stroke();
      // blade tip flash
      ctx.fillStyle = isPlayer ? "rgba(255,230,180,0.7)" : "rgba(255,160,120,0.55)";
      ctx.beginPath();
      ctx.arc(28, 18, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (ent.type === "assassin" || isPlayer) {
      // sheathed hint
      ctx.fillStyle = "#1a1e22";
      ctx.fillRect(2, 4, 4, 22);
    }
    ctx.restore();

    // head
    ctx.fillStyle = palette.mask;
    ctx.beginPath();
    ctx.ellipse(0, h * 0.14, w * 0.26, w * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // mask wrap highlight
    ctx.strokeStyle = palette.clothHi;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, h * 0.14, w * 0.26, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // eyes
    const eyeGlow = ctx.createRadialGradient(-6, h * 0.12, 0, -6, h * 0.12, 10);
    eyeGlow.addColorStop(0, palette.eye);
    eyeGlow.addColorStop(1, "transparent");
    ctx.fillStyle = eyeGlow;
    ctx.fillRect(-14, h * 0.06, 12, 12);
    ctx.fillStyle = palette.eye;
    ctx.fillRect(-9, h * 0.11, 5, 3);
    ctx.fillRect(4, h * 0.11, 5, 3);

    // boss horns / crown
    if (ent.type === "boss") {
      ctx.fillStyle = palette.trim;
      ctx.beginPath();
      ctx.moveTo(-20, 6);
      ctx.lineTo(-12, -22);
      ctx.lineTo(-4, 8);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(20, 6);
      ctx.lineTo(12, -22);
      ctx.lineTo(4, 8);
      ctx.fill();
      // shoulder plates
      ctx.fillStyle = palette.clothHi;
      roundRect(-w * 0.42, h * 0.22, 16, 14, 3);
      ctx.fill();
      roundRect(w * 0.26, h * 0.22, 16, 14, 3);
      ctx.fill();
    }

    if (ent.type === "monster") {
      // bulk shoulders
      ctx.fillStyle = palette.clothHi;
      ctx.beginPath();
      ctx.ellipse(-w * 0.3, h * 0.28, 12, 10, 0, 0, Math.PI * 2);
      ctx.ellipse(w * 0.3, h * 0.28, 12, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // enemy HP
    if (!isPlayer && ent.hp < ent.maxHp) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(-22, -14, 44, 6);
      ctx.fillStyle = ent.type === "boss" ? "#e8a84a" : "#c23b3b";
      ctx.fillRect(-22, -14, 44 * Math.max(0, ent.hp / ent.maxHp), 6);
    }

    ctx.restore();
  }

  function draw() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (state === "menu" || state === "shop") {
      zoneName = zoneForLevel(Math.max(1, save.level));
      bossFight = false;
    }
    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawBackground(w, h);

    pickups.forEach((p) => {
      const sx = p.x - cameraX;
      ctx.fillStyle = p.kind === "gold" ? "#e8a84a" : "#3ecf9a";
      ctx.beginPath();
      ctx.arc(sx, p.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#071018";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText(p.kind === "gold" ? "◆" : "+", sx - 4, p.y + 4);
    });

    enemies.forEach((e) => {
      if (e.hp > 0 || e.hitFlash > 0) drawCharacter(e, false);
    });
    if (player) drawCharacter(player, true);

    projectiles.forEach((p) => {
      const sx = p.x - cameraX;
      ctx.save();
      ctx.translate(sx, p.y);
      ctx.rotate(p.spin || 0);
      if (p.friendly) {
        ctx.fillStyle = "#3ecf9a";
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(-6, 5);
        ctx.lineTo(-6, -5);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.stroke();
      } else {
        ctx.fillStyle = "#ff6a4a";
        ctx.beginPath();
        ctx.arc(0, 0, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

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
    vig.addColorStop(1, "rgba(0,0,0,0.42)");
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
        if (act === "jump") {
          if (v && !input.jump) input.jumpPressed = true;
          input.jump = v;
        }
        if (act === "attack") {
          if (v && !input.attack) input.attackPressed = true;
          input.attack = v;
        }
        if (act === "special") {
          if (v && !input.special) input.specialPressed = true;
          input.special = v;
        }
        btn.classList.toggle("active", v);
      };
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        btn.setPointerCapture(e.pointerId);
        set(true);
      });
      btn.addEventListener("pointerup", () => set(false));
      btn.addEventListener("pointercancel", () => set(false));
      btn.addEventListener("lostpointercapture", () => set(false));
    });

    window.addEventListener("keydown", (e) => {
      if (e.repeat) return;
      if (e.code === "ArrowLeft" || e.code === "KeyQ") input.left = true;
      if (e.code === "ArrowRight" || e.code === "KeyD") input.right = true;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyZ") {
        input.jump = true;
        input.jumpPressed = true;
        e.preventDefault();
      }
      if (e.code === "KeyJ" || e.code === "KeyA" || e.code === "KeyK") {
        input.attackPressed = true;
        input.attack = true;
      }
      if (e.code === "KeyL" || e.code === "KeyE" || e.code === "ShiftLeft") {
        input.specialPressed = true;
        input.special = true;
      }
      if (e.code === "Escape" && state === "play") {
        state = "pause";
        showScreen("pause");
      }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyQ") input.left = false;
      if (e.code === "ArrowRight" || e.code === "KeyD") input.right = false;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyZ") input.jump = false;
      if (e.code === "KeyJ" || e.code === "KeyA" || e.code === "KeyK") input.attack = false;
      if (e.code === "KeyL" || e.code === "KeyE" || e.code === "ShiftLeft") input.special = false;
    });
  }

  function bindUi() {
    $("btn-play").addEventListener("click", () => {
      save = defaultSave();
      persist();
      startLevel();
    });
    $("btn-continue").addEventListener("click", () => openShop());
    $("btn-next-level").addEventListener("click", () => startLevel());
    $("btn-menu-from-shop").addEventListener("click", () => {
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    });
    $("btn-pause").addEventListener("click", () => {
      if (state !== "play") return;
      state = "pause";
      showScreen("pause");
    });
    $("btn-resume").addEventListener("click", () => {
      state = "play";
      showScreen(null);
    });
    $("btn-quit").addEventListener("click", () => {
      persist();
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    });
    $("btn-retry").addEventListener("click", () => startLevel());
    $("btn-shop-after").addEventListener("click", () => openShop());
    $("btn-menu-over").addEventListener("click", () => {
      state = "menu";
      showScreen("menu");
      updateContinueBtn();
    });
  }

  resize();
  window.addEventListener("resize", resize);
  bindControls();
  bindUi();
  updateContinueBtn();
  showScreen("menu");
  zoneName = "dojo";
  player = makePlayer();
  player.x = 220;
  seedAmbient();
  requestAnimationFrame(loop);
})();
