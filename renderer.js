        const canvas = document.getElementById('playground-canvas');
        const ctx = canvas.getContext('2d');
        const body = document.getElementById('body-container');
        const drawingCanvas = document.createElement('canvas');
        const drawingCtx = drawingCanvas.getContext('2d');

        // Render the same system emoji used by the toolbar into native CSS cursors.
        for (const [name, glyph] of [['paw', '🐾'], ['hand', '✋'], ['fist', '✊']]) {
            const cursorCanvas = document.createElement('canvas');
            if (typeof cursorCanvas.toDataURL !== 'function') continue;
            cursorCanvas.width = cursorCanvas.height = 32;
            const cursorContext = cursorCanvas.getContext('2d');
            cursorContext.font = '26px "Segoe UI Emoji"';
            cursorContext.textAlign = 'center';
            cursorContext.textBaseline = 'middle';
            cursorContext.fillText(glyph, 16, 17);
            canvas.style.setProperty(`--${name}-cursor`,
                `url("${cursorCanvas.toDataURL('image/png')}") 16 16`);
        }

        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;
        drawingCanvas.width = width;
        drawingCanvas.height = height;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
            drawingCanvas.width = width;
            drawingCanvas.height = height;
            redrawDrawing();
        });

        // 고양이 이미지 로딩
        const catImg = new Image();
        catImg.src = 'spritesheet.webp';

        // 까치 이미지 로딩
        const magpieImg = new Image();
        magpieImg.src = 'spritesheet_2.webp';

        const sheetClips = {
            idle: { row: 0, frames: 6, speed: 10 },
            walkRight: { row: 1, frames: 8, speed: 4 },
            walkLeft: { row: 2, frames: 8, speed: 4 },
            fall: { row: 4, frames: 5, speed: 5 },
            drag: { row: 5, frames: 8, speed: 6 }
        };
        const world = { structures: [], drawnShapes: [], drawnColliders: [], nextStructureId: 1,
            nextShapeId: 1, lastBuildAt: 0, lastZone: -1, zoneBuildAt: new Map(),
            lastCleanupAt: 0, now: () => performance.now() };
        const structureLimits = { platform: 7, ladder: 5 };
        const structureZoneCount = 5;
        const structureIdleMs = 90000;
        let structuresEnabled = false;
        function rectangleGap(a, b) {
            return {
                x: Math.max(0, a.x - b.x - b.width, b.x - a.x - a.width),
                y: Math.max(0, a.y - b.y - b.height, b.y - a.y - a.height)
            };
        }
        function touchesDrawing(box) {
            return world.drawnColliders.some(segment => {
                const bounds = { x: Math.min(segment.x1, segment.x2), y: Math.min(segment.y1, segment.y2),
                    width: Math.abs(segment.x2 - segment.x1), height: Math.abs(segment.y2 - segment.y1) };
                const gap = rectangleGap(box, bounds);
                return gap.x < 18 && gap.y < 18;
            });
        }
        function structureSpaceFree(type, box, linkedPlatformId = null) {
            if (touchesDrawing(box)) return false;
            for (const other of world.structures) {
                if (other.id === linkedPlatformId) continue;
                if (type === 'ladder' && other.type === 'platform'
                    && Math.abs(box.y + box.height - other.y) < 3) continue;
                const gap = rectangleGap(box, other);
                if (type === 'platform' && other.type === 'platform' && gap.x < 64 && gap.y < 88) return false;
                if (type === 'ladder' && other.type === 'ladder' && gap.x < 62 && gap.y < 28) {
                    const dividedByPlatform = world.structures.some(platform => platform.type === 'platform'
                        && ((Math.abs(box.y + box.height - platform.y) < 3
                            && Math.abs(other.y - platform.y - platform.height) < 3)
                            || (Math.abs(other.y + other.height - platform.y) < 3
                                && Math.abs(box.y - platform.y - platform.height) < 3)));
                    if (!dividedByPlatform) return false;
                }
                if (type !== other.type && gap.x < 10 && gap.y < 10) return false;
            }
            return true;
        }
        function addStructure(type, geometry, creatorPetId = null) {
            if (!structureLimits[type] || world.structures.filter(item => item.type === type).length >= structureLimits[type]) return null;
            const item = { id: world.nextStructureId++, type, creatorPetId,
                lastUsedAt: world.now(), ...geometry };
            if (!Number.isFinite(item.x) || !Number.isFinite(item.y) || !Number.isFinite(item.width)
                || !Number.isFinite(item.height) || item.width < 8 || item.height < 8
                || item.x < 12 || item.x + item.width > width - 12 || item.y < 50
                || item.y + item.height > height + 1
                || !structureSpaceFree(type, item, item.platformId || null)) return null;
            world.structures.push(item);
            return item;
        }
        function buildRoute(pet, now = world.now()) {
            if (!structuresEnabled || !(['cat', 'dog'].includes(pet.definition.category)
                    || ['kirby', 'kirby_sleepy'].includes(pet.definitionId))
                || now - world.lastBuildAt < 7000 || now - pet.lastBuildAt < 15000
                || world.structures.filter(item => item.type === 'ladder').length >= structureLimits.ladder) return null;
            const baseY = pet.y + pet.size;
            const top = baseY - 145;
            if (top < 55 || width < 260) return null;
            const support = world.structures.find(item => item.type === 'platform'
                && Math.abs(item.y - baseY) < 8 && pet.x >= item.x - 20 && pet.x <= item.x + item.width + 20);
            if (!support && world.structures.filter(item => item.type === 'platform'
                && height - item.y < 190).length >= 3) return null;
            // A reachable upward route is shared; another Pet does not need to build beside it.
            if (world.structures.some(ladder => ladder.type === 'ladder'
                && Math.abs(ladder.y + ladder.height - baseY) < 35
                && Math.abs(ladder.x + ladder.width / 2 - pet.x) < 230
                && world.structures.some(platform => platform.id === ladder.platformId && platform.y < baseY - 75))) return null;
            const centers = new Set();
            for (const offset of [-270, -190, -110, -45, 45, 110, 190, 270]) centers.add(pet.x + offset);
            for (let zone = 0; zone < structureZoneCount; zone++) centers.add((zone + .5) * width / structureZoneCount);
            const candidates = [];
            for (const center of centers) {
                const px = Math.round(Math.max(18, Math.min(width - 178, center - 80)));
                const ladderCenter = Math.max(px + 20, Math.min(px + 140, pet.x));
                if (Math.abs(ladderCenter - pet.x) > 230) continue;
                if (support && (ladderCenter < support.x + 18 || ladderCenter > support.x + support.width - 18)) continue;
                const platformBox = { x: px, y: top, width: 160, height: 12 };
                const ladderBox = { x: Math.round(ladderCenter - 13), y: top + 12, width: 26, height: 133 };
                if (!structureSpaceFree('platform', platformBox)
                    || !structureSpaceFree('ladder', ladderBox, support?.id || null)) continue;
                const zone = Math.min(structureZoneCount - 1, Math.floor((px + 80) / (width / structureZoneCount)));
                const zoneCount = world.structures.filter(item => item.type === 'platform'
                    && Math.floor((item.x + item.width / 2) / (width / structureZoneCount)) === zone).length;
                const recent = now - (world.zoneBuildAt.get(zone) || -Infinity) < 25000 ? 1 : 0;
                const score = zoneCount * 180 + recent * 220 + (zone === world.lastZone ? 180 : 0)
                    + Math.abs(ladderCenter - pet.x) * .6 + Math.abs(px + 80 - pet.x) * .15
                    + Math.random() * 16;
                candidates.push({ platformBox, ladderBox, zone, score });
            }
            candidates.sort((a, b) => a.score - b.score);
            const best = candidates[0];
            if (!best) return null;
            const platform = addStructure('platform', best.platformBox, pet.instanceId);
            if (!platform) return null;
            const ladder = addStructure('ladder', { ...best.ladderBox, platformId: platform.id }, pet.instanceId);
            if (!ladder) { world.structures = world.structures.filter(item => item !== platform); return null; }
            pet.lastBuildAt = world.lastBuildAt = now;
            world.lastZone = best.zone;
            world.zoneBuildAt.set(best.zone, now);
            return { platform, ladder };
        }
        function drawStructures() {
            if (!structuresEnabled) return;
            for (const item of world.structures) {
                if (item.type === 'platform') {
                    ctx.fillStyle = 'rgba(194,215,224,.34)'; ctx.strokeStyle = 'rgba(113,150,165,.42)'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.roundRect(item.x, item.y + 2, item.width, 8, 5); ctx.fill(); ctx.stroke();
                } else {
                    ctx.strokeStyle = 'rgba(151,181,190,.38)'; ctx.lineWidth = 2.5;
                    for (const side of [3, item.width - 3]) {
                        ctx.beginPath(); ctx.moveTo(item.x + side, item.y); ctx.lineTo(item.x + side, item.y + item.height); ctx.stroke();
                    }
                    ctx.lineWidth = 1;
                    for (let y = item.y + 15; y < item.y + item.height; y += 19) {
                        ctx.beginPath(); ctx.moveTo(item.x + 4, y); ctx.lineTo(item.x + item.width - 4, y); ctx.stroke();
                    }
                }
            }
        }
        function trashRect() { return { x: width - 102, y: height - 100, width: 82, height: 76 }; }
        function inTrash(x, y) {
            const b = trashRect(); return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
        }
        function horizontalZone(x) {
            return Math.max(0, Math.min(structureZoneCount - 1,
                Math.floor(x / Math.max(1, width / structureZoneCount))));
        }
        function verticalZone(y) {
            const rise = height - y;
            return rise < 210 ? 'low' : rise < 460 ? 'mid' : 'high';
        }
        function pruneStructureReferences(now = world.now()) {
            const live = new Set(world.structures.map(item => item.id));
            for (const pet of petInstances) {
                const active = new Set([pet.supportId, pet.climbing, pet.targetLadderId]);
                let detached = false;
                for (const key of ['supportId', 'climbing', 'targetLadderId']) {
                    if (typeof pet[key] === 'number' && !live.has(pet[key])) {
                        pet[key] = null; detached = true;
                    }
                }
                if (!pet.climbing) pet.climbingDown = false;
                if (detached) { pet.exploreX = null; pet.navigationUntil = 0; }
                if (!live.has(pet.lastStructureId)) pet.lastStructureId = null;
                for (const [id, visitedAt] of pet.recentStructures) {
                    if (!live.has(id) || (!active.has(id) && now - visitedAt >= 35000)) pet.recentStructures.delete(id);
                }
                pet.targetHistory = pet.targetHistory.filter(id => live.has(id));
            }
        }
        function cleanupStructures(now = world.now()) {
            if (now - world.lastCleanupAt < 5000) return;
            world.lastCleanupAt = now;
            pruneStructureReferences(now);
            if (!structuresEnabled) return;
            const keep = new Set(world.structures.filter(item => now - item.lastUsedAt < structureIdleMs)
                .map(item => item.id));
            for (const pet of petInstances) {
                for (const id of [pet.supportId, pet.climbing, pet.targetLadderId]) {
                    if (typeof id === 'number') keep.add(id);
                }
                if (typeof pet.supportId === 'number') {
                    for (const ladder of world.structures) {
                        if (ladder.type === 'ladder' && ladder.platformId === pet.supportId) keep.add(ladder.id);
                    }
                }
            }
            for (const ladder of world.structures) {
                if (ladder.type === 'ladder' && keep.has(ladder.id)) keep.add(ladder.platformId);
            }
            world.structures = world.structures.filter(item => keep.has(item.id));
            pruneStructureReferences(now);
        }
        function chooseRoamX(pet, now) {
            const current = horizontalZone(pet.x);
            const zones = Array.from({ length: structureZoneCount }, (_, zone) => {
                const x = (zone + .5) * width / structureZoneCount;
                const crowd = petInstances.filter(other => other !== pet && horizontalZone(other.x) === zone).length;
                const recent = now - (pet.zoneVisits.get(zone) ?? -Infinity) < 18000 ? 240 : 0;
                return { x, zone, score: (zone === current ? 350 : 0) + recent + crowd * 35
                    - Math.abs(zone - current) * 32 + Math.random() * 25 };
            });
            zones.sort((a, b) => a.score - b.score);
            pet.exploreX = zones[0].x;
            pet.navigationUntil = now + 14000;
        }
        function chooseNavigation(pet, footY, support, now) {
            const zone = horizontalZone(pet.x);
            if (zone !== pet.currentZone) {
                pet.currentZone = zone; pet.zoneEnteredAt = now;
                pet.zoneVisits.set(zone, now);
                if (!pet.visitedZones.includes(zone)) pet.visitedZones.push(zone);
            }
            if (!structuresEnabled) {
                pet.targetLadderId = null;
                if (pet.exploreX === null || now > pet.navigationUntil) chooseRoamX(pet, now);
                return;
            }
            if (pet.targetLadderId && (now > pet.navigationUntil
                || !world.structures.some(item => item.id === pet.targetLadderId))) {
                pet.recentStructures.set(pet.targetLadderId, now);
                pet.targetLadderId = null;
            }
            if (pet.exploreX !== null && (Math.abs(pet.x - pet.exploreX) < 35
                || now > pet.navigationUntil || now - pet.zoneEnteredAt > 11000)) pet.exploreX = null;
            if (pet.targetLadderId || pet.exploreX !== null || now < pet.ladderCooldownUntil) return;
            const floor = Math.abs(footY - height) < 4;
            const candidates = [];
            for (const ladder of world.structures) {
                if (ladder.type !== 'ladder') continue;
                const platform = world.structures.find(item => item.id === ladder.platformId);
                if (!platform) continue;
                const upward = Math.abs(ladder.y + ladder.height - footY) < 35
                    && platform.y < footY - 60;
                const downward = support?.id === platform.id;
                if (!upward && !downward) continue;
                const center = ladder.x + ladder.width / 2;
                const distance = Math.abs(center - pet.x);
                if (distance > 380) continue;
                const crowd = petInstances.filter(other => other !== pet
                    && (other.supportId === platform.id || other.targetLadderId === ladder.id
                        || other.climbing === ladder.id)).length;
                const zoneCrowd = petInstances.filter(other => other !== pet
                    && horizontalZone(other.x) === horizontalZone(center)).length;
                const recent = now - (pet.recentStructures.get(ladder.id) ?? -Infinity) < 35000;
                const score = 55 + distance * .4 + Math.abs(platform.y - footY) * .18
                    + crowd * 150 + zoneCrowd * 22 + (recent ? 650 : 0)
                    + (pet.lastStructureId === ladder.id ? 900 : 0);
                candidates.push({ ladder, score });
            }
            candidates.sort((a, b) => a.score - b.score);
            const roamScore = floor ? 190 : 140;
            if (candidates.length && candidates[0].score < roamScore) {
                pet.targetLadderId = candidates[0].ladder.id;
                pet.navigationUntil = now + 9000;
                pet.targetHistory.push(pet.targetLadderId);
                if (pet.targetHistory.length > 32) pet.targetHistory.shift();
            } else chooseRoamX(pet, now);
        }
        function drawTrash() {
            if (!draggedPet || currentMode !== 'touch') return;
            const b = trashRect(); const hot = inTrash(draggedPet.x, draggedPet.y);
            ctx.fillStyle = hot ? 'rgba(255,116,130,.91)' : 'rgba(238,245,252,.87)';
            ctx.strokeStyle = hot ? '#bf4357' : '#8aa3b7'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(b.x, b.y, b.width, b.height, 20); ctx.fill(); ctx.stroke();
            ctx.font = '29px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#3b5466';
            ctx.fillText('🗑', b.x + b.width / 2, b.y + 42);
            ctx.font = '11px sans-serif'; ctx.fillText('휴지통', b.x + b.width / 2, b.y + 59);
        }
        let nextPetInstanceId = 1;
        const petDefinitions = new Map([
            ['basic', { id: 'basic', name: '기본', renderKind: 'basic', defaultSize: 34, enabled: true,
                behavior: { turnChance: .03, jumpChance: .014, moveSpeed: 8, jumpSpeed: 9 } }],
            ['blob', { id: 'blob', name: 'Slime', renderKind: 'slime', defaultSize: 35, enabled: true,
                behavior: { turnChance: .03, jumpChance: .017, moveSpeed: 8, jumpSpeed: 9 } }],
            ['cat', { id: 'cat', name: 'Cat', category: 'cat', renderKind: 'sprite', asset: catImg, clips: sheetClips, defaultSize: 40, enabled: true,
                behavior: { turnChance: .022, jumpChance: .01, moveSpeed: 8, jumpSpeed: 8 } }],
            ['magpie', { id: 'magpie', name: 'Magpie', renderKind: 'sprite', asset: magpieImg, clips: sheetClips, defaultSize: 40, enabled: true,
                behavior: { turnChance: .03, jumpChance: .014, moveSpeed: 8, jumpSpeed: 10, airSteer: .015 } }],
            ['robot', { id: 'robot', name: 'Robot', renderKind: 'robot', defaultSize: 35, enabled: true,
                behavior: { turnChance: .007, jumpChance: .006, moveSpeed: 6, jumpSpeed: 8 } }],
            ['bug', { id: 'bug', name: 'Bug', renderKind: 'bug', defaultSize: 26, enabled: true,
                behavior: { turnChance: .06, jumpChance: .013, moveSpeed: 10, jumpSpeed: 8 } }]
        ]);
        for (const [id, name, size] of [['ghost', '유령', 34], ['star', '별', 34], ['cloud', '구름', 38]]) {
            petDefinitions.set(id, { id, name, renderKind: id, defaultSize: size, enabled: true,
                behavior: { turnChance: .03, jumpChance: .012, moveSpeed: 8, jumpSpeed: 9 } });
        }
        let definitionsLoaded = false;

        let auxiliaryEffectsEnabled = true;
        let enabled = false;
        let currentMode = 'pc';
        let controlsPanelOpen = false;
        let controlsPanelKind = null;
        let selectedPetId = null;
        let drawColor = '#30384c';
        let drawSize = 7;
        let drawShape = 'freehand';
        let eraser = false;
        let animationFrame = null;
        let petInstances = [];
        const screenEffects = new PlaygroundScreenEffects.ScreenEffects();
        const particles = screenEffects.groups.particle;
        const rings = screenEffects.groups.ring;
        const impacts = screenEffects.groups.impact;
        const holes = screenEffects.groups.crater;
        const bullets = screenEffects.groups.bullet;
        const grenades = screenEffects.groups.grenade;
        const weaponProfiles = Object.freeze({
            awm: { label: 'AWM', cooldownMs: 4000, speed: 3.1, damage: 120, knockback: 34,
                spread: 0, count: 1, width: 166, height: 62, muzzle: [.99,.32], color: '#e94c70', crackRadius: 124, crackStyle: 'gun-heavy' },
            ak47: { label: 'AK-47', cooldownMs: 120, speed: 2.35, damage: 20, knockback: 12,
                spread: 0, count: 1, width: 137, height: 55, muzzle: [.98,.31], color: '#ff815d', auto: true, crackRadius: 71, crackStyle: 'gun-medium' },
            uzi: { label: 'UZI', cooldownMs: 65, speed: 2.25, damage: 9, knockback: 6,
                spread: 0, count: 1, width: 105, height: 61, muzzle: [.98,.27], color: '#ffd15a', auto: true, crackRadius: 40, crackStyle: 'gun-light' },
            double_barrel: { label: '더블배럴 샷건', cooldownMs: 1200, speed: 2.0, damage: 12,
                knockback: 5, spread: .22, count: 10, width: 141, height: 42,
                muzzle: [.99,.29], color: '#ff9b67', crackRadius: 28, crackStyle: 'gun-pellet' }
        });
        const weaponSprites = Object.fromEntries(Object.keys(weaponProfiles).map(id => {
            const image = new Image(); image.src = `assets/weapons/${id}.png`; return [id, image];
        }));
        const hammerSprite = new Image(); hammerSprite.src = 'assets/tools/hammer.png';
        const grenadeSprite = new Image(); grenadeSprite.src = 'assets/tools/bomb.png';
        let gunWeapon = 'ak47';
        let gunTriggerHeld = false;
        let grenadeDrag = null;
        let lastGunShotAt = -Infinity;
        const combo = { count: 0, lastHitAt: -Infinity };
        const comboDisplayMs = 3000;
        const comboChainMs = comboDisplayMs; // A hit during the visible fade continues the chain.
        const bossSpawnChance = .025;
        const bossHealthById = Object.freeze({
            cat_brown: 520, cat_face: 420, cat_sleepy: 560, 'salary-cat': 550,
            doge: 620, puddle: 470, usagi: 390, kirby: 510,
            kirby_sleepy: 580, blob: 360
        });
        const bossDefaultHealth = 450;
        const bossFadeMs = 1200;
        let lastPetRegionSentAt = -Infinity;
        let lastPetRegionSignature = '';
        let blackHoles = [];
        let strokes = world.drawnShapes;
        let activeStroke = null;
        let pointerDown = false;
        const physicsFrameMs = 1000 / 60;
        const throwSampleMs = 100;
        const maxThrowSpeed = 54; // pixels per reference (60 Hz) physics frame
        const throwPhysics = { gravity: .22, airRetention: .996, groundRetention: .94,
            restitution: .65, wallRestitution: .72, stopImpact: 3, maxMs: 8000, maxStep: .5 };

        // Bomb retains ordinary gravity/air drag; only the protected collision path is shared.
        const bombPhysics = { ...throwPhysics, gravity: .5, airRetention: .98, groundRetention: .98,
            restitution: .6, wallRestitution: 1, maxMs: 5000 };

        // Local profiles are explicit, alpha-audited frame lists; rows have no global meaning.
        // Original assets remain unchanged. Legacy Cat/Magpie keep their old adapter.
        const spriteProfiles = {
            cat: { feet: [.976, .9327, .9375, .976, .976] },
            magpie: { feet: [.976, .976, .976, .976, .976] },
            ...PlaygroundPetProfiles.profiles
        };
        const spriteStates = ['idle', 'walkRight', 'walkLeft', 'fall', 'drag'];

        // Durations are milliseconds of stable autonomous time, never render frame counts.
        const activityProfiles = {
            sleepy: { roam: [1800,3500], idle: [1800,3200], rest: [6500,12000], sleep: [1800000,3600000], sleepChance: .55, look: [900,1800], restChance: .8, lookChance: .15, jump: .05, turn: .35 },
            calm: { roam: [2500,4500], idle: [1500,2500], rest: [4000,7500], sleep: [1200000,2400000], sleepChance: .25, look: [800,1500], restChance: .7, lookChance: .2, jump: .12, turn: .6 },
            normal: { roam: [2500,4500], idle: [1000,2200], rest: [3000,5500], sleep: [600000,1500000], sleepChance: .12, look: [700,1400], restChance: .55, lookChance: .25, jump: .2, turn: .8 },
            lively: { roam: [3500,5500], idle: [800,1600], rest: [2000,4000], sleep: [420000,1080000], sleepChance: .08, look: [600,1100], restChance: .5, lookChance: .3, jump: .25, turn: 1 },
            active: { roam: [4500,6500], idle: [600,1400], rest: [1000,2200], sleep: [300000,900000], sleepChance: .05, look: [500,1000], restChance: .45, lookChance: .35, jump: .3, turn: 1.2 },
            veryActive: { roam: [5000,7500], idle: [400,1000], rest: [800,1600], sleep: [300000,600000], sleepChance: .04, look: [400,900], restChance: .35, lookChance: .45, jump: .4, turn: 1.4 }
        };
        const activityById = { cat_brown: 'calm', cat_face: 'normal', cat_sleepy: 'sleepy',
            'salary-cat': 'calm', doge: 'active', puddle: 'normal', usagi: 'veryActive',
            kirby: 'lively', kirby_sleepy: 'sleepy', blob: 'normal',
            call_duck: 'lively', baby_harp_seal: 'calm' };
        const activityByCategory = { cat: 'calm', dog: 'normal' };
        const autonomousEvent = (chance, multiplier, dt) => Math.random() < 1 - Math.exp(-chance * multiplier * dt);

        class Pet {
            constructor(x, y, definition) {
                this.instanceId = nextPetInstanceId++;
                this.x = x;
                this.y = y;
                this.definitionId = definition.id;
                this.definition = definition;
                this.size = definition.defaultSize;
                this.boss = null;

                this.vx = definition.id === 'robot' ? (Math.random() < .5 ? -2 : 2) : (Math.random() - 0.5) * 4;
                this.vy = 0;
                this.gravity = 0.5;
                this.bounce = -0.6;
                this.friction = 0.98;

                this.isDragging = false;
                this.externalMotion = null;
                this.motionCause = null;
                this.blackHoleOrbit = null;
                this.rescuedFromHoles = new Set();
                this.squish = 1;
                this.facingRight = true;

                this.activity = activityProfiles[activityById[definition.id] || activityByCategory[definition.category] || 'normal'];
                this.autonomy = { state: 'roam', remainingMs: 0, lookTurned: false };
                this.autonomyHoldMs = 0;
                this.isAutonomouslyStill = false;
                this.enterAutonomy('roam');

                this.frame = 0;
                this.animationState = null;
                this.animationMs = 0;
                this.supportId = null;
                this.climbing = null;
                this.climbingDown = false;
                this.targetLadderId = null;
                this.ladderCooldownUntil = 0;
                this.lastBuildAt = -Infinity;
                this.navigationUntil = 0;
                this.exploreX = null;
                this.currentZone = -1;
                this.zoneEnteredAt = world.now();
                this.zoneVisits = new Map();
                this.visitedZones = [];
                this.visitedLevels = new Set();
                this.recentStructures = new Map();
                this.lastStructureId = null;
                this.targetHistory = [];

                // DOM image preserves GIF animation and uses the same center/size as physics.
                if (definition.renderKind === 'image') {
                    this.imgElement = document.createElement('img');
                    this.imgElement.src = definition.assetUrl;
                    this.imgElement.style.position = 'absolute';
                    this.imgElement.style.pointerEvents = 'none';
                    this.imgElement.style.width = `${definition.displayWidth}px`;
                    this.imgElement.style.height = `${definition.displayHeight}px`;
                    this.imgElement.style.zIndex = '15';
                    this.imgElement.onerror = () => {
                        removePetInstance(this.instanceId);
                    };
                    document.body.appendChild(this.imgElement);
                    this.updateImagePosition();
                }
            }

            remove() {
                this.animationPlayer = null;
                this.animationInputPrevious = null;
                this.animationEvent = null;
                this.animationReaction = null;
                if (draggedPet === this) releaseDraggedPet();
                this.blackHoleOrbit = null;
                this.rescuedFromHoles.clear();
                this.externalMotion = null;
                this.motionCause = null;
                this.supportId = null;
                this.climbing = null;
                this.targetLadderId = null;
                this.lastStructureId = null;
                this.recentStructures.clear();
                this.targetHistory = [];
                this.zoneVisits.clear();
                this.visitedZones = [];
                this.visitedLevels.clear();
                this.exploreX = null;
                this.navigationUntil = 0;
                for (const structure of world.structures)
                    if (structure.creatorPetId === this.instanceId) structure.creatorPetId = null;
                if (this.imgElement) this.imgElement.remove();
            }

            becomeBoss() {
                const maxHealth = bossHealthById[this.definitionId] ?? bossDefaultHealth;
                const scale = 1.34 + (maxHealth - 360) / 2600;
                this.boss = { health: maxHealth, maxHealth, scale,
                    barWidth: Math.round(100 + (maxHealth - 360) * .11),
                    defeated: false, fadeRemainingMs: 0, spawnedAt: world.now() };
                this.size *= scale;
            }

            beginBossDeath() {
                if (!this.boss || this.boss.defeated) return;
                this.boss.health = 0;
                this.boss.defeated = true;
                this.boss.fadeRemainingMs = bossFadeMs;
                this.vx = 0; this.vy = 0;
                this.externalMotion = null; this.motionCause = null;
                this.climbing = null; this.climbingDown = false;
                this.targetLadderId = null; this.supportId = null;
                this.animationEvent = null;
                this.animationReaction = null;
                this.enterAutonomy('sleep');
                this.isAutonomouslyStill = true;
            }

            enterAutonomy(state) {
                const [min, max] = this.activity[state];
                this.autonomy = { state, remainingMs: min + Math.random() * (max - min), lookTurned: false };
                this.autonomy.durationMs = this.autonomy.remainingMs;
            }

            interruptAutonomy(holdMs = 0) {
                this.enterAutonomy('roam');
                this.autonomyHoldMs = holdMs;
                this.isAutonomouslyStill = false;
            }

            updateAutonomy(elapsedMs) {
                let remaining = elapsedMs;
                while (remaining + 1e-7 >= this.autonomy.remainingMs) {
                    remaining = Math.max(0, remaining - this.autonomy.remainingMs);
                    if (this.autonomy.state === 'roam') {
                        const choice = Math.random();
                        this.enterAutonomy(choice < this.activity.lookChance ? 'look'
                            : choice < this.activity.lookChance + this.activity.restChance ? 'rest' : 'idle');
                    } else if (this.autonomy.state === 'rest' && Math.random() < this.activity.sleepChance) {
                        this.enterAutonomy('sleep');
                    } else this.enterAutonomy('roam');
                }
                this.autonomy.remainingMs -= remaining;
                if (this.autonomy.state === 'look' && !this.autonomy.lookTurned
                    && this.autonomy.remainingMs <= this.autonomy.durationMs / 2 + 1e-7) {
                    this.facingRight = !this.facingRight;
                    this.autonomy.lookTurned = true;
                }
                return this.autonomy.state === 'roam';
            }

            beginThrow(vx, vy) {
                this.animationPlayer?.reset();
                this.animationEvent = Math.hypot(vx, vy) <= 1.5 ? 'release' : null;
                this.interruptAutonomy();
                const scale = Math.min(1, maxThrowSpeed / (Math.hypot(vx, vy) || 1));
                this.vx = vx * scale;
                this.vy = vy * scale;
                this.climbing = null;
                this.climbingDown = false;
                this.targetLadderId = null;
                this.supportId = null;
                this.exploreX = null;
                this.navigationUntil = 0;
                this.externalMotion = { source: 'throw', elapsedMs: 0, stableMs: 0 };
                this.motionCause = 'throw';
            }

            beginAutonomousJump(vy) {
                if (this.isDragging || this.blackHoleOrbit || this.externalMotion || this.climbing) return;
                this.motionCause = 'autonomous-jump';
                this.vy = vy;
            }

            finishAutonomousJump() {
                if (this.motionCause !== 'autonomous-jump') return;
                this.motionCause = null;
                // Let the landing read as a landing before another autonomous decision.
                this.autonomyHoldMs = Math.max(this.autonomyHoldMs, 200);
            }

            beginImpact(source = 'bomb') {
                this.queueAnimationEvent('hit');
                this.motionCause = source;
                this.externalMotion = { source, elapsedMs: 0, stableMs: 0 };
            }

            update(dt = 1, animationElapsedMs = dt * physicsFrameMs) {
                if (this.boss?.defeated) {
                    this.boss.fadeRemainingMs = Math.max(0, this.boss.fadeRemainingMs - animationElapsedMs);
                    this.advanceAnimation(animationElapsedMs);
                    if (this.imgElement) this.imgElement.style.opacity = String(this.boss.fadeRemainingMs / bossFadeMs);
                    return;
                }
                // Small physics steps keep fast throws consistent across refresh rates.
                // Autonomous movement and ladder timing keep their existing update path.
                const steps = this.externalMotion ? Math.max(1, Math.ceil(dt / throwPhysics.maxStep)) : 1;
                for (let i = 0; i < steps; i++) this.updateStep(dt / steps, animationElapsedMs / steps);
                if (!this.isDragging) this.squish = 1 + (this.squish - 1) * Math.pow(.85, dt);
                this.advanceAnimation(animationElapsedMs);
                this.updateImagePosition();
            }

            updateStep(dt, elapsedMs = dt * physicsFrameMs) {
                this.isAutonomouslyStill = false;
                this.autonomyHoldMs = Math.max(0, this.autonomyHoldMs - dt * physicsFrameMs);
                if (this.isDragging) {
                    this.updateImagePosition();
                    return;
                }
                if (this.blackHoleOrbit) {
                    this.updateImagePosition();
                    return;
                }

                const behavior = this.definition.behavior;
                const now = world.now();
                const externalMotion = this.externalMotion !== null;
                const motionPhysics = this.externalMotion?.source === 'bomb' ? bombPhysics : throwPhysics;
                this.visitedLevels.add(verticalZone(this.y));
                if (!externalMotion && this.climbing && structuresEnabled) {
                    const ladder = world.structures.find(item => item.id === this.climbing && item.type === 'ladder');
                    const platform = ladder && world.structures.find(item => item.id === ladder.platformId);
                    if (ladder && platform) {
                        ladder.lastUsedAt = platform.lastUsedAt = now;
                        this.x += (ladder.x + ladder.width / 2 - this.x) * Math.min(1, .18 * dt);
                        const destination = this.climbingDown ? ladder.y + ladder.height - this.size : platform.y - this.size;
                        this.y = this.climbingDown ? Math.min(destination, this.y + 2.6 * dt)
                            : Math.max(destination, this.y - 2.6 * dt);
                        this.vx = 0; this.vy = 0;
                        if (this.y === destination) {
                            this.climbing = null;
                            this.supportId = this.climbingDown ? null : platform.id;
                            this.lastStructureId = ladder.id;
                            this.recentStructures.set(ladder.id, now);
                            this.targetLadderId = null;
                            this.exploreX = null;
                            this.ladderCooldownUntil = now + 2800;
                            if (this.climbingDown) chooseRoamX(this, now);
                            else this.navigationUntil = 0;
                        }
                        this.updateImagePosition();
                        return;
                    }
                    this.climbing = null;
                }
                const previousFoot = this.y + this.size;
                const supportingPlatform = structuresEnabled && world.structures.find(item => item.type === 'platform'
                    && Math.abs(previousFoot - item.y) < 3 && this.x + this.size * .5 > item.x
                    && this.x - this.size * .5 < item.x + item.width);
                const drawnSupport = drawnSurfaceAt(this.x, previousFoot);
                const grounded = Math.abs(previousFoot - height) < 3 || Boolean(supportingPlatform || drawnSupport);
                if (supportingPlatform) supportingPlatform.lastUsedAt = now;
                const stableAutonomy = grounded && !externalMotion && this.autonomyHoldMs === 0
                    && Math.abs(this.vy) <= 1.5 && Math.abs(this.vx) <= 3 && this.squish <= 1.12;
                const roaming = stableAutonomy && this.updateAutonomy(elapsedMs);
                if (stableAutonomy && !roaming) {
                    this.isAutonomouslyStill = true;
                    this.vx *= Math.pow(.7, dt); // Gradual stop; never brake an external impulse.
                }
                if (roaming) {
                    chooseNavigation(this, previousFoot, supportingPlatform, now);
                    const target = structuresEnabled && world.structures.find(item => item.id === this.targetLadderId && item.type === 'ladder');
                    if (target) {
                        const dx = target.x + target.width / 2 - this.x;
                        if (Math.abs(dx) < 11) {
                            this.climbing = target.id;
                            this.climbingDown = supportingPlatform?.id === target.platformId;
                            this.targetLadderId = null;
                            target.lastUsedAt = now;
                        }
                        else this.vx = Math.sign(dx) * Math.min(2.2, Math.abs(dx) * .06);
                    } else if (this.exploreX !== null) {
                        const dx = this.exploreX - this.x;
                        this.vx += Math.sign(dx) * Math.min(.19 * dt, Math.abs(dx) * .002);
                        this.vx = Math.max(-2.8, Math.min(2.8, this.vx));
                    }
                    if (!drawnSupport && Math.random() < (supportingPlatform ? .006 : .002) * dt) buildRoute(this);
                } else if (!grounded && this.supportId !== null && !this.climbing) {
                    this.targetLadderId = null;
                }
                const speedLimit = externalMotion && this.externalMotion.source !== 'bomb' ? maxThrowSpeed : 18;
                this.vx = Math.max(-speedLimit, Math.min(speedLimit, this.vx));
                this.vy += (externalMotion ? motionPhysics.gravity : this.gravity) * dt;
                if (externalMotion) this.vy = Math.max(-maxThrowSpeed, Math.min(maxThrowSpeed, this.vy));
                if (!externalMotion && behavior.airSteer && Math.abs(this.vy) > 1.5) this.vx += (this.facingRight ? behavior.airSteer : -behavior.airSteer) * dt;
                const previousX = this.x, previousY = this.y;
                this.x += this.vx * dt;
                this.y += this.vy * dt;
                const retention = externalMotion
                    ? (grounded && Math.abs(this.vy) < 1.5 ? motionPhysics.groundRetention : motionPhysics.airRetention)
                    : this.friction;
                const drawnContact = externalMotion ? collideThrownDrawing(this, previousX, previousY, dt, motionPhysics) : null;
                this.vx *= Math.pow(retention, dt);
                if (!externalMotion) collideDrawnWalls(this, previousX, previousY);

                if (this.vx > 0.1) this.facingRight = true;
                else if (this.vx < -0.1) this.facingRight = false;

                // 하강 중 발이 플랫폼 상단을 통과할 때만 착지한다.
                let landed = null;
                if (this.vy >= 0) {
                    for (const platform of structuresEnabled ? world.structures : []) {
                        const crossing = externalMotion && this.y + this.size > previousFoot
                            ? (platform.y - previousFoot) / (this.y + this.size - previousFoot) : 1;
                        const landingX = externalMotion ? previousX + (this.x - previousX) * Math.max(0, Math.min(1, crossing)) : this.x;
                        if (platform.type !== 'platform' || previousFoot > platform.y + 3
                            || this.y + this.size < platform.y || landingX + this.size * .5 <= platform.x
                            || landingX - this.size * .5 >= platform.x + platform.width) continue;
                        if (!landed || platform.y < landed.y) landed = platform;
                    }
                    const drawing = externalMotion ? null : drawnLandingAt(this, previousFoot);
                    if (drawing && (!landed || drawing.y < landed.y)) landed = drawing;
                }
                if (landed) {
                    this.y = landed.y - this.size;
                    this.reactToLanding(this.vy);
                    this.vy = externalMotion ? throwRebound(this.vy, motionPhysics.restitution) : 0;
                    if (!externalMotion) this.finishAutonomousJump();
                    this.supportId = this.vy === 0 ? landed.id : null;
                    if (roaming && !this.targetLadderId && this.exploreX === null && now >= this.ladderCooldownUntil
                        && autonomousEvent(behavior.turnChance, this.activity.turn, dt)) {
                        this.vx = (Math.random() - .5) * behavior.moveSpeed;
                    }
                } else this.supportId = drawnContact;
                if (roaming && !this.autonomyHoldMs && landed && now >= this.ladderCooldownUntil && autonomousEvent(behavior.jumpChance, this.activity.jump, dt)) {
                    this.beginAutonomousJump(-behavior.jumpSpeed - Math.random() * 4);
                }
                // 바닥 충돌
                if (this.y + this.size >= height) {
                    this.y = height - this.size;
                    this.reactToLanding(this.vy);
                    this.vy = externalMotion ? throwRebound(this.vy, motionPhysics.restitution) : 0;
                    if (!externalMotion) this.finishAutonomousJump();

                    // 바닥에서 무작위 이동 (가끔 점프)
                    if (roaming && Math.abs(this.vy) < 1.5) {
                        if (autonomousEvent(behavior.turnChance, this.activity.turn, dt) && !this.targetLadderId && this.exploreX === null) {
                            this.vx = (Math.random() - 0.5) * behavior.moveSpeed;
                            this.squish = 0.8;
                        }
                        if (!this.autonomyHoldMs && autonomousEvent(behavior.jumpChance, this.activity.jump, dt) && !this.targetLadderId) {
                            this.beginAutonomousJump(-behavior.jumpSpeed - Math.random() * 6);
                            this.squish = 0.6;
                        }
                    }
                    this.supportId = null;
                }

                // 양옆 벽 충돌
                if (this.x - this.size <= 0) {
                    if (externalMotion && Math.abs(this.vx) > motionPhysics.stopImpact) this.queueAnimationEvent('bounce');
                    this.x = this.size;
                    this.vx = externalMotion ? throwRebound(this.vx, motionPhysics.wallRestitution) : -this.vx;
                }
                if (this.x + this.size >= width) {
                    if (externalMotion && Math.abs(this.vx) > motionPhysics.stopImpact) this.queueAnimationEvent('bounce');
                    this.x = width - this.size;
                    this.vx = externalMotion ? throwRebound(this.vx, motionPhysics.wallRestitution) : -this.vx;
                }
                // The top edge is open. Only an extreme off-screen excursion loses upward speed.
                if (this.y < -Math.max(2700,height*3) && this.vy < 0) this.vy = 0;

                if (externalMotion) {
                    const motion = this.externalMotion;
                    const elapsedMs = dt * physicsFrameMs;
                    motion.elapsedMs += elapsedMs;
                    const settled = ((landed && this.vy === 0) || drawnContact || this.y + this.size >= height - .5)
                        && Math.abs(this.vx) <= 2.8 && Math.abs(this.vy) <= 1.5;
                    motion.stableMs = settled ? motion.stableMs + elapsedMs : 0;
                    // Stable landing returns control to AI; the deadline also covers airborne/stuck cases.
                    if ((motion.elapsedMs >= 200 && motion.stableMs >= 120) || motion.elapsedMs >= motionPhysics.maxMs) {
                        this.externalMotion = null;
                        this.motionCause = null;
                    }
                }

                this.updateImagePosition();
            }

            reactToLanding(speed) {
                if (speed > 1.5) this.queueAnimationEvent(this.externalMotion && speed > throwPhysics.stopImpact ? 'bounce' : 'land');
                // Ignore resting gravity contact; cap strong landings without touching velocity.
                if (speed >= 6) this.autonomyHoldMs = Math.max(this.autonomyHoldMs, 300);
                const amount = Math.min(.4, Math.max(0, (speed - 2) * .018));
                this.squish = Math.max(this.squish, 1 + amount);
            }

            quietAutonomy() {
                return this.isAutonomouslyStill && !this.isDragging && !this.externalMotion
                    && !this.blackHoleOrbit && !this.climbing && Math.abs(this.vy) <= 1.5;
            }

            queueAnimationEvent(event) {
                if (!Object.hasOwn(PlaygroundPetAnimation.ONCE_MS, event)) return false;
                // Multiple physics substeps produce at most one visual event per update.
                if (this.animationEvent !== 'hit' || event === 'grabStart') this.animationEvent = event;
                return true;
            }

            setAnimationReaction(state = null) {
                // Future tool interface only; visual overrides never own physics/removal.
                if (![null, 'stunned', 'knockout'].includes(state)) return false;
                this.animationReaction = state;
                return true;
            }

            platformClip(profile, elapsedMs) {
                if (!profile.rows || !profile.origin || !profile.clips) return null;
                if (this.animationProfile !== profile || !this.animationPlayer) {
                    try { this.animationPlayer = PlaygroundPetAnimation.createPlayer(profile); }
                    catch { return null; }
                    this.animationProfile = profile;
                    this.animationInputPrevious = null;
                }
                const quiet = this.quietAutonomy();
                const walking = !this.isAutonomouslyStill && Math.abs(this.vx) >
                    (this.animationState?.startsWith('walk') ? .15 : .5);
                const input = {
                    held: this.isDragging, orbit: !!this.blackHoleOrbit,
                    thrown: !!this.externalMotion,
                    stunned: this.animationReaction === 'stunned', knockout: this.animationReaction === 'knockout',
                    climbing: this.climbing ? (this.climbingDown ? 'down' : 'up') : null,
                    airborne: this.motionCause === 'autonomous-jump' || Math.abs(this.vy) > 1.5,
                    vx: walking ? (this.facingRight ? 1 : -1) * Math.max(.51, Math.abs(this.vx)) : 0,
                    vy: this.vy,
                    resting: quiet && ['rest', 'sleep'].includes(this.autonomy.state),
                    sleeping: this.autonomy.state === 'sleep' || profile.sleeping,
                    looking: quiet && this.autonomy.state === 'look'
                };
                const previous = this.animationInputPrevious;
                let event = this.animationEvent;
                if (input.held && !previous?.held) { this.animationPlayer.reset(); event = 'grabStart'; }
                else if (previous?.held && !input.held && !input.orbit && !input.thrown) event = 'release';
                else if (previous?.resting && !input.resting && !input.thrown && !input.airborne && !input.climbing) event ||= 'wake';
                if (event) input.event = event;
                this.animationEvent = null;
                this.animationInputPrevious = input;
                const sample = this.animationPlayer.update(input, elapsedMs);
                this.animationVisualState = sample.state;
                this.animationState = sample.requestedClip;
                this.animationMs = sample.elapsedMs;
                this.frame = sample.frameIndex;
                return { state: sample.requestedClip, clip: sample.clip, platform: true };
            }

            spriteClip(elapsedMs = 0) {
                const profile = this.definition.animation || spriteProfiles[this.definitionId] || {};
                if (this.boss?.defeated) {
                    const clip = profile.clips?.sleep || profile.clips?.rest || profile.clips?.idle
                        || this.definition.clips?.idle;
                    if (clip) return { state: 'bossSleep', clip };
                }
                const platform = this.platformClip(profile, elapsedMs);
                if (platform) return platform;
                const clips = profile.clips || this.definition.clips || {};
                const quiet = this.quietAutonomy();
                const requested = this.isDragging ? 'drag'
                    : this.externalMotion || (this.blackHoleOrbit && profile.clips) ? 'fall'
                    : this.climbing ? 'climb'
                    : this.motionCause === 'autonomous-jump' ? (this.vy <= 0 ? 'jump' : 'fall')
                    : Math.abs(this.vy) > 1.5 ? 'fall'
                    : quiet && this.autonomy.state === 'rest' && profile.sleeping ? 'sleep'
                    : quiet && this.autonomy.state !== 'idle' ? this.autonomy.state
                    : !this.isAutonomouslyStill && Math.abs(this.vx) >
                        (profile.clips && this.animationState?.startsWith('walk') ? .15 : .5)
                        ? (this.facingRight ? 'walkRight' : 'walkLeft') : 'idle';
                const valid = clip => {
                    if (!clip || !Number.isInteger(clip.row) || clip.row < 0 || clip.row >= (this.definition.rows || 11)) return false;
                    const framesValid = Array.isArray(clip.frames)
                        ? clip.frames.length > 0 && clip.frames.every(column => Number.isInteger(column) && column >= 0 && column < 8)
                        : Number.isInteger(clip.frames) && clip.frames > 0 && Number.isInteger(clip.start ?? 0)
                            && (clip.start ?? 0) >= 0 && (clip.start ?? 0) + clip.frames <= 8;
                    if (clip.center !== undefined && (!Number.isFinite(clip.center) || clip.center < 0 || clip.center > 1)) return false;
                    if (clip.foot !== undefined && (!Number.isFinite(clip.foot) || clip.foot < 0 || clip.foot > 1)) return false;
                    if (profile.origin === 'center' && (!Number.isFinite(clip.centerY) || clip.centerY < 0 || clip.centerY > 1)) return false;
                    if (clip.scale !== undefined && (!Number.isFinite(clip.scale) || clip.scale <= 0 || clip.scale > 4)) return false;
                    if (clip.loop !== undefined && typeof clip.loop !== 'boolean') return false;
                    if (clip.tilt !== undefined && (!Number.isFinite(clip.tilt) || Math.abs(clip.tilt) > .25)) return false;
                    if (clip.bob !== undefined && (!Number.isFinite(clip.bob) || clip.bob < 0 || clip.bob > .1
                        || !Number.isFinite(clip.bobMs) || clip.bobMs <= 0)) return false;
                    if (clip.frameAdjustments !== undefined) {
                        if (!clip.frameAdjustments || typeof clip.frameAdjustments !== 'object' || Array.isArray(clip.frameAdjustments)) return false;
                        for (const [column, adjustment] of Object.entries(clip.frameAdjustments)) {
                            if (!/^[0-7]$/.test(column) || !adjustment || typeof adjustment !== 'object') return false;
                            for (const key of ['center','foot','centerY']) if (adjustment[key] !== undefined
                                && (!Number.isFinite(adjustment[key]) || adjustment[key] < 0 || adjustment[key] > 1)) return false;
                            if (adjustment.scale !== undefined && (!Number.isFinite(adjustment.scale) || adjustment.scale <= 0 || adjustment.scale > 4)) return false;
                            for (const key of ['offsetX','offsetY']) if (adjustment[key] !== undefined
                                && (!Number.isFinite(adjustment[key]) || Math.abs(adjustment[key]) > .5)) return false;
                        }
                    }
                    return framesValid && (Number.isFinite(clip.frameMs) ? clip.frameMs > 0
                        : Number.isFinite(clip.speed) && clip.speed >= 0);
                };
                let state = requested, clip;
                // Bounded fallback traversal also makes cyclic/malformed future profiles safe.
                for (let i = 0; i < 10; i++) {
                    clip = clips[state];
                    if (valid(clip)) break;
                    state = profile.fallback?.[state] || (state === 'idle' ? null : 'idle');
                    if (!state) return null;
                }
                if (!valid(clip)) return null;
                return { state: profile.clips ? requested : state, clip };
            }

            advanceAnimation(elapsedMs) {
                if (this.definition.renderKind !== 'sprite') return;
                const selected = this.spriteClip(elapsedMs);
                if (!selected) return;
                if (selected.platform) return;
                const { clip } = selected;
                const frameCount = Array.isArray(clip.frames) ? clip.frames.length : clip.frames;
                const clipKey = `${selected.state}:${clip.row}:${clip.start || 0}:${clip.frameMs ?? clip.speed}:${frameCount}`;
                if (this.animationClipKey !== clipKey) {
                    this.animationClipKey = clipKey;
                    this.animationState = selected.state;
                    this.animationMs = 0;
                    this.frame = 0;
                }
                this.animationMs += elapsedMs;
                const frameMs = clip.frameMs ?? (clip.speed + 1) * physicsFrameMs;
                const frame = Math.floor((this.animationMs + 1e-7) / frameMs);
                this.frame = clip.loop === false ? Math.min(frame, frameCount - 1) : frame % frameCount;
            }

            updateImagePosition() {
                // DOM 이미지(GIF) 위치 동기화 (커스텀 펫용)
                if (this.imgElement) {
                    this.imgElement.style.left = (this.x - this.definition.displayWidth / 2) + 'px';
                    this.imgElement.style.top = (this.y - this.definition.displayHeight / 2) + 'px';
                    const flip = this.facingRight ? 1 : -1;
                    const bossScale = this.boss?.scale ?? 1;
                    this.imgElement.style.transform = `scale(${flip * bossScale * this.squish}, ${bossScale / this.squish})`;
                }
            }

            spriteGeometry(selected = this.spriteClip()) {
                if (!selected) return null;
                const { state, clip } = selected;
                const profile = this.definition.animation || spriteProfiles[this.definitionId] || {};
                const column = Array.isArray(clip.frames) ? clip.frames[this.frame] : this.frame + (clip.start || 0);
                const adjustment = clip.frameAdjustments?.[column];
                const index = spriteStates.indexOf(clip.anchor || state);
                const foot = adjustment?.foot ?? clip.foot ?? profile.feet?.[index] ?? .976;
                const center = adjustment?.center ?? clip.center ?? profile.centers?.[index] ?? .5;
                const scale = (clip.scale ?? 1) * (adjustment?.scale ?? 1);
                return { column, center, foot, scale,
                    anchorY: profile.origin === 'center' ? (adjustment?.centerY ?? clip.centerY) : foot,
                    offsetX: (adjustment?.offsetX ?? 0) * this.size * 2.5,
                    offsetY: (adjustment?.offsetY ?? 0) * this.size * 2.5,
                    tilt: clip.tilt ?? 0,
                    bob: clip.bob ? -Math.abs(Math.sin(this.animationMs * Math.PI * 2 / clip.bobMs)) * clip.bob * this.size : 0 };
            }

            draw(ctx) {
                ctx.save();
                if (this.boss?.defeated) ctx.globalAlpha *= this.boss.fadeRemainingMs / bossFadeMs;
                ctx.translate(this.x, this.y);
                const quiet = this.quietAutonomy();
                const looking = quiet && this.autonomy.state === 'look';
                const resting = this.boss?.defeated || quiet && ['rest', 'sleep'].includes(this.autonomy.state);
                const profile = this.definition.animation || spriteProfiles[this.definitionId] || {};
                const sleeping = resting && (this.autonomy.state === 'sleep' || profile.sleeping);
                const restPhase = (this.autonomy.durationMs - this.autonomy.remainingMs) / 1000;
                const breath = resting ? 1 + Math.sin(restPhase * Math.PI * .8) * (sleeping ? .012 : .006) : 1;

                if (this.definition.renderKind === 'sprite') {
                    const image = this.definition.asset;
                    if (image.complete && image.naturalWidth > 0) {
                        this.advanceAnimation(0); // Input can change state between update and draw.
                        const selected = this.spriteClip();
                        if (!selected) { ctx.restore(); return; }
                        const { clip } = selected;
                        const geometry = this.spriteGeometry(selected);
                        const fw = image.naturalWidth / 8;
                        const fh = image.naturalHeight / (this.definition.rows || 11);
                        const renderSize = this.size * 2.5 * geometry.scale;
                        const squash = 1 + (this.squish - 1) * (profile.elasticity ?? .55);
                        // Only verified overrides mirror a source row; pivot at visible feet.
                        ctx.translate(geometry.offsetX, (profile.origin === 'center' ? 0 : this.size) + geometry.offsetY + geometry.bob);
                        ctx.scale(squash / breath, breath / squash);
                        if (clip.flip) ctx.scale(-1, 1);
                        if (geometry.tilt) ctx.rotate(geometry.tilt);
                        if (looking) ctx.rotate(this.facingRight ? .035 : -.035);
                        ctx.drawImage(image, geometry.column * fw, clip.row * fh, fw, fh,
                            -renderSize * geometry.center, -renderSize * geometry.anchorY, renderSize, renderSize);
                    }
                } else if (['basic', 'ghost', 'star', 'cloud'].includes(this.definition.renderKind)) {
                    ctx.translate(0, this.size * (1 - 1 / this.squish));
                    const kind = this.definition.renderKind;
                    ctx.scale(this.facingRight ? 1 : -1, 1);
                    ctx.scale(this.squish, 1 / this.squish);
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#75879c';
                    ctx.fillStyle = { basic: '#ffdfbd', ghost: '#eee9ff', star: '#ffe49a', cloud: '#e4f3ff' }[kind];
                    ctx.beginPath();
                    if (kind === 'basic') ctx.arc(0, 0, 29, 0, Math.PI * 2);
                    else if (kind === 'ghost') {
                        ctx.moveTo(-26, 17); ctx.lineTo(-26, -3);
                        ctx.arc(0, -3, 26, Math.PI, 0);
                        ctx.lineTo(26, 17); ctx.lineTo(16, 12); ctx.lineTo(8, 20);
                        ctx.lineTo(0, 12); ctx.lineTo(-9, 20); ctx.lineTo(-17, 12);
                        ctx.closePath();
                    } else if (kind === 'star') {
                        for (let i = 0; i < 10; i++) {
                            const angle = -Math.PI / 2 + i * Math.PI / 5;
                            const radius = i % 2 ? 14 : 29;
                            const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
                            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
                        }
                        ctx.closePath();
                    } else {
                        ctx.moveTo(-28, 17); ctx.arc(-17, 4, 15, Math.PI * .7, Math.PI * 1.65);
                        ctx.arc(0, -7, 18, Math.PI * 1.1, Math.PI * 1.95);
                        ctx.arc(19, 5, 13, Math.PI * 1.25, Math.PI * .25);
                        ctx.lineTo(23, 18); ctx.closePath();
                    }
                    ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#405269';
                    ctx.beginPath(); ctx.arc(-8, 1, 2.5, 0, Math.PI * 2);
                    ctx.arc(8, 1, 2.5, 0, Math.PI * 2); ctx.fill();
                    ctx.beginPath(); ctx.arc(0, 7, 4, 0, Math.PI); ctx.stroke();
                } else if (this.definition.renderKind === 'robot') {
                    ctx.translate(0, this.size * (1 - 1 / this.squish));
                    ctx.scale(this.facingRight ? 1 : -1, 1);
                    ctx.scale(this.squish, 1 / this.squish);
                    ctx.fillStyle = '#7bd8da';
                    ctx.strokeStyle = '#31546d';
                    ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.roundRect(-27, -27, 54, 48, 11); ctx.fill(); ctx.stroke();
                    ctx.fillStyle = '#effcff';
                    ctx.beginPath(); ctx.roundRect(-20, -18, 40, 22, 7); ctx.fill();
                    ctx.fillStyle = '#305b88';
                    ctx.beginPath(); ctx.arc(-9, -7, 4, 0, Math.PI * 2); ctx.arc(9, -7, 4, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#31546d';
                    ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0, -36); ctx.stroke();
                    ctx.fillStyle = '#ffb75e';
                    ctx.beginPath(); ctx.arc(0, -39, 4, 0, Math.PI * 2); ctx.fill();
                    ctx.fillStyle = '#44617c';
                    ctx.fillRect(-19, 21, 12, 7); ctx.fillRect(7, 21, 12, 7);
                } else if (this.definition.renderKind === 'bug') {
                    ctx.translate(0, this.size * (1 - 1 / this.squish));
                    ctx.scale(this.facingRight ? 1 : -1, 1);
                    ctx.scale(this.squish, 1 / this.squish);
                    ctx.strokeStyle = '#375c52';
                    ctx.lineWidth = 2.5;
                    for (const side of [-1, 1]) {
                        for (const y of [-5, 5, 15]) {
                            ctx.beginPath(); ctx.moveTo(side * 15, y); ctx.lineTo(side * 25, y + 7); ctx.stroke();
                        }
                    }
                    ctx.fillStyle = '#82d6a8';
                    ctx.beginPath(); ctx.ellipse(0, 4, 20, 22, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                    ctx.strokeStyle = '#4b987c';
                    ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, 25); ctx.stroke();
                    ctx.fillStyle = '#253b43';
                    ctx.beginPath(); ctx.arc(-8, -4, 3, 0, Math.PI * 2); ctx.arc(8, -4, 3, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#253b43';
                    ctx.beginPath(); ctx.arc(0, 4, 5, 0, Math.PI); ctx.stroke();
                } else if (this.definition.renderKind === 'slime') {
                    ctx.translate(0, this.size * (1 - 1 / this.squish));
                    ctx.translate(0, this.size);
                    ctx.scale(1 / breath, breath);
                    ctx.translate(0, -this.size);
                    ctx.scale(this.squish, 1 / this.squish);

                    // 귀
                    ctx.fillStyle = '#ffffff';
                    ctx.lineWidth = 3;
                    ctx.strokeStyle = '#4a5568';
                    ctx.beginPath(); ctx.arc(-this.size/2, -this.size/1.5, this.size/2.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                    ctx.beginPath(); ctx.arc(this.size/2, -this.size/1.5, this.size/2.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();

                    // 몸통
                    ctx.beginPath(); ctx.arc(0, 0, this.size, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

                    // 발그레한 볼터치
                    ctx.fillStyle = '#ffb3ba';
                    ctx.beginPath(); ctx.arc(-this.size/1.8, this.size/6, this.size/3.5, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(this.size/1.8, this.size/6, this.size/3.5, 0, Math.PI*2); ctx.fill();

                    // 까만 콩 눈
                    ctx.fillStyle = '#2D3748';
                    const ex = looking ? (this.facingRight ? 2 : -2) : Math.max(-2, Math.min(2, this.vx * 1.5));
                    const ey = Math.max(-2, Math.min(2, this.vy * 0.5));
                    if (resting) {
                        ctx.lineWidth = 2.5; ctx.strokeStyle = '#2D3748';
                        ctx.beginPath();ctx.moveTo(-this.size/3-4,-this.size/6);ctx.lineTo(-this.size/3+4,-this.size/6);
                        ctx.moveTo(this.size/3-4,-this.size/6);ctx.lineTo(this.size/3+4,-this.size/6);ctx.stroke();
                    } else {
                        ctx.beginPath(); ctx.arc(-this.size/3 + ex, -this.size/6 + ey, this.size/7, 0, Math.PI*2); ctx.fill();
                        ctx.beginPath(); ctx.arc(this.size/3 + ex, -this.size/6 + ey, this.size/7, 0, Math.PI*2); ctx.fill();
                    }

                    // 입 모양
                    ctx.strokeStyle = '#2D3748';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    if (this.isDragging || this.externalMotion) {
                        // 잡히거나 던져졌을 때 기존 당황 표정
                        ctx.beginPath(); ctx.arc(0, this.size/4, this.size/6, 0, Math.PI, true); ctx.stroke();
                        // 땀방울
                        if (auxiliaryEffectsEnabled) {
                            ctx.fillStyle = '#63B3ED';
                            ctx.beginPath(); ctx.arc(this.size/2, -this.size/1.2, 5, 0, Math.PI*2); ctx.fill();
                        }
                    } else {
                        // 고양이/먼작귀 입 (w 모양)
                        ctx.beginPath();
                        ctx.arc(-this.size/8, this.size/6, this.size/8, 0, Math.PI);
                        ctx.arc(this.size/8, this.size/6, this.size/8, 0, Math.PI);
                        ctx.stroke();
                    }
                }
                ctx.restore();

            }
        }

        function addParticles(x, y, color, count, speed = 3, shape = 'spark') {
            // Cap generation as well as retained objects, even for oversized bursts.
            const budget = Number.isFinite(count) ? Math.min(160, Math.max(0, Math.floor(count))) : 0;
            for (let i = 0; i < budget; i++) {
                const angle = Math.random() * Math.PI * 2;
                const velocity = (0.5 + Math.random()) * speed;
                screenEffects.add('particle', {
                    x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
                    color, size: 1.5 + Math.random() * 2.5, shape, angle
                }, (18 + Math.random() * 14) * physicsFrameMs);
            }
        }

        function addRing(x, y, color, radius, life = 18) {
            screenEffects.add('ring', { x, y, color, radius }, life * physicsFrameMs);
        }

        function addImpact(x, y, color, life = 10) {
            screenEffects.add('impact', { x, y, color }, life * physicsFrameMs);
        }

        function registerComboHit(source) {
            if (source !== 'gun' && source !== 'hammer' && source !== 'bomb') return;
            const now = world.now();
            combo.count = now - combo.lastHitAt < comboChainMs
                ? Math.min(999, combo.count + 1) : 1;
            combo.lastHitAt = now;
        }

        // Shared nonlethal toy hit path; future tools can supply their own impulse and number.
        function applyNonlethalHit(pet, { source, vx, vy, cap, squish, holdMs, damage,
            hitX = pet.x, hitY = pet.y, numberOffset = 0, numberLift = 0, weapon = null }) {
            if (pet.isDragging || pet.blackHoleOrbit || pet.boss?.defeated) return false;
            pet.vx = Math.max(-cap, Math.min(cap, pet.vx + vx));
            pet.vy = Math.max(-cap, Math.min(cap, pet.vy + vy));
            pet.squish = squish;
            pet.interruptAutonomy(holdMs);
            pet.beginImpact(source);
            pet.climbing = null; pet.climbingDown = false;
            pet.targetLadderId = null; pet.supportId = null;
            const amount = Math.max(1, Math.round(damage));
            screenEffects.add('damage', { x: hitX + numberOffset,
                y: Math.max(32, hitY - (source === 'gun' ? 24 + numberLift : pet.size * 1.9)),
                amount, source, weapon,
                drift: ((pet.instanceId * 17 + numberOffset * 3) % 11 - 5) * 1.2 }, 850);
            if (pet.boss) {
                pet.boss.health = Math.max(0, pet.boss.health - amount);
                if (pet.boss.health === 0) pet.beginBossDeath();
            }
            registerComboHit(source);
            return true;
        }

        const hitMaskCache = new WeakMap();
        function spriteHitArea(pet, x, y) {
            if (pet.boss?.defeated) return null;
            if (pet.definition.renderKind !== 'sprite') {
                if (Math.hypot(x - pet.x, y - pet.y) > pet.size) return null;
                return y < pet.y - pet.size * .3 ? 'head' : 'body';
            }
            const image = pet.definition.asset;
            const selected = pet.spriteClip();
            if (!selected || !image?.complete || !image.naturalWidth) return null;
            const { clip } = selected, geometry = pet.spriteGeometry(selected);
            const fw = image.naturalWidth / 8, fh = image.naturalHeight / (pet.definition.rows || 11);
            const renderSize = pet.size * 2.5 * geometry.scale;
            const profile = pet.definition.animation || spriteProfiles[pet.definitionId] || {};
            const quiet = pet.quietAutonomy();
            const resting = quiet && ['rest', 'sleep'].includes(pet.autonomy.state);
            const sleeping = resting && (pet.autonomy.state === 'sleep' || profile.sleeping);
            const restPhase = (pet.autonomy.durationMs - pet.autonomy.remainingMs) / 1000;
            const breath = resting ? 1 + Math.sin(restPhase * Math.PI * .8) * (sleeping ? .012 : .006) : 1;
            const squash = 1 + (pet.squish - 1) * (profile.elasticity ?? .55);
            let lx = (x - pet.x - geometry.offsetX) / (squash / breath);
            let ly = (y - pet.y - (profile.origin === 'center' ? 0 : pet.size)
                - geometry.offsetY - geometry.bob) / (breath / squash);
            if (clip.flip) lx = -lx;
            const angle = (geometry.tilt || 0) + (quiet && pet.autonomy.state === 'look'
                ? pet.facingRight ? .035 : -.035 : 0);
            const rx = lx * Math.cos(angle) + ly * Math.sin(angle);
            const ry = -lx * Math.sin(angle) + ly * Math.cos(angle);
            const sx = Math.floor((rx / renderSize + geometry.center) * fw);
            const sy = Math.floor((ry / renderSize + geometry.anchorY) * fh);
            if (sx < 0 || sy < 0 || sx >= fw || sy >= fh) return null;
            let frames = hitMaskCache.get(image);
            if (!frames) { frames = new Map(); hitMaskCache.set(image, frames); }
            const key = `${clip.row}:${geometry.column}`;
            let mask = frames.get(key);
            if (!mask) {
                try {
                    const cell = document.createElement('canvas'); cell.width = fw; cell.height = fh;
                    const cellCtx = cell.getContext('2d', { willReadFrequently: true });
                    cellCtx.drawImage(image, geometry.column * fw, clip.row * fh, fw, fh, 0, 0, fw, fh);
                    const pixels = cellCtx.getImageData(0, 0, fw, fh).data;
                    let top = fh, bottom = 0;
                    for (let py = 0; py < fh; py++) for (let px = 0; px < fw; px++) {
                        if (pixels[(py * fw + px) * 4 + 3] > 32) {
                            top = Math.min(top, py); bottom = Math.max(bottom, py);
                        }
                    }
                    mask = { pixels, top, bottom };
                } catch { mask = { fallback: true, top: 0, bottom: fh }; }
                frames.set(key, mask);
            }
            if (!mask.fallback && mask.pixels[(sy * fw + sx) * 4 + 3] <= 32) return null;
            return sy <= mask.top + (mask.bottom - mask.top) * .42 ? 'head' : 'body';
        }

        function gunPose(x, y, profile = weaponProfiles[gunWeapon]) {
            const offsets = [[78,78],[-78,78],[78,-78],[-78,-78]];
            const cornersAt = (muzzleX, muzzleY, angle) => {
                const cos = Math.cos(angle), sin = Math.sin(angle);
                const flipY = cos < 0 ? -1 : 1;
                return [[0,0],[profile.width,0],[0,profile.height],[profile.width,profile.height]]
                    .map(([cx,cy]) => ({ x: muzzleX + (cx-profile.width*profile.muzzle[0])*cos
                        - (cy-profile.height*profile.muzzle[1])*flipY*sin,
                    y: muzzleY + (cx-profile.width*profile.muzzle[0])*sin
                        + (cy-profile.height*profile.muzzle[1])*flipY*cos }));
            };
            for (const [ox,oy] of offsets) {
                const muzzleX=x+ox,muzzleY=y+oy,angle=Math.atan2(-oy,-ox);
                if (cornersAt(muzzleX,muzzleY,angle).every(point => point.x>=14 && point.y>=14
                    && point.x<=width-14 && point.y<=height-14)) return { muzzleX,muzzleY,angle,flipY:Math.cos(angle)<0?-1:1 };
            }
            let muzzleX=x+78,muzzleY=y+78,angle=0;
            for (let attempt=0;attempt<5;attempt++) {
                angle=Math.atan2(y-muzzleY,x-muzzleX);
                const corners=cornersAt(muzzleX,muzzleY,angle);
                const minX = Math.min(...corners.map(p=>p.x)), maxX = Math.max(...corners.map(p=>p.x));
                const minY = Math.min(...corners.map(p=>p.y)), maxY = Math.max(...corners.map(p=>p.y));
                muzzleX += Math.max(14-minX, Math.min(0,width-14-maxX));
                muzzleY += Math.max(14-minY, Math.min(0,height-14-maxY));
            }
            angle = Math.atan2(y - muzzleY, x - muzzleX);
            return { muzzleX, muzzleY, angle, flipY:Math.cos(angle)<0?-1:1 };
        }

        function shootGun(x, y) {
            const now = world.now(), profile = weaponProfiles[gunWeapon];
            if (!Number.isFinite(x) || !Number.isFinite(y)
                || now - lastGunShotAt < profile.cooldownMs) return false;
            lastGunShotAt = now;
            const pose = gunPose(x, y, profile);
            for (let pellet = 0; pellet < profile.count; pellet++) {
                const distance = Math.hypot(x-pose.muzzleX,y-pose.muzzleY);
                const spread = profile.count === 1 ? 0
                    : ((pellet - (profile.count-1)/2)/(profile.count-1) + (Math.random()-.5)*.16) * profile.spread * 2;
                const angle = pose.angle + spread, aimX = pose.muzzleX + Math.cos(angle)*distance;
                const aimY = pose.muzzleY + Math.sin(angle)*distance;
                const vx = Math.cos(angle) * profile.speed, vy = Math.sin(angle) * profile.speed;
                screenEffects.add('bullet', { x: pose.muzzleX, y: pose.muzzleY,
                    originX: pose.muzzleX, originY: pose.muzzleY,
                    previousX: pose.muzzleX, previousY: pose.muzzleY, vx, vy, aimX, aimY,
                    weapon: gunWeapon,
                    volleyTime: now, pellet }, 2000);
            }
            addImpact(pose.muzzleX, pose.muzzleY, 'rgba(255,234,159,.96)', 5);
            addParticles(pose.muzzleX, pose.muzzleY, '#ffdb82', gunWeapon === 'double_barrel' ? 10 : 5, 4);
            return true;
        }

        function updateBullets(elapsedMs) {
            if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
            for (let i = bullets.length - 1; i >= 0; i--) {
                const bullet = bullets[i];
                const step = Math.min(elapsedMs, bullet.remainingMs);
                const fromX = bullet.x, fromY = bullet.y;
                const remaining = Math.hypot(bullet.aimX-fromX,bullet.aimY-fromY);
                const arrived = bullet.vx*bullet.vx*step*step + bullet.vy*bullet.vy*step*step >= remaining*remaining;
                const toX=arrived ? bullet.aimX : fromX+bullet.vx*step;
                const toY=arrived ? bullet.aimY : fromY+bullet.vy*step;
                const dx=toX-fromX,dy=toY-fromY,length2=dx*dx+dy*dy;
                let target=null,area=null,firstT=Infinity;
                if (length2>0) for(let p=petInstances.length-1;p>=0;p--) {
                    const pet=petInstances[p];
                    if(pet.isDragging||pet.blackHoleOrbit||pet.boss?.defeated)continue;
                    const radius=pet.size*1.7,px=fromX-pet.x,py=fromY-pet.y;
                    const projection=px*dx+py*dy;
                    const discriminant=projection*projection-length2*(px*px+py*py-radius*radius);
                    if(discriminant<0)continue;
                    const start=Math.max(0,(-projection-Math.sqrt(discriminant))/length2);
                    const end=Math.min(firstT,1,(-projection+Math.sqrt(discriminant))/length2);
                    if(end<start)continue;
                    const samples=Math.max(1,Math.ceil((end-start)*Math.sqrt(length2)/2));
                    for(let sample=0;sample<=samples;sample++) {
                        const t=start+(end-start)*sample/samples;
                        const hit=spriteHitArea(pet,fromX+dx*t,fromY+dy*t);
                        if(hit){target=pet;area=hit;firstT=t;break;}
                    }
                }
                bullet.previousX = fromX; bullet.previousY = fromY;
                bullet.x=target?fromX+dx*firstT:toX;
                bullet.y=target?fromY+dy*firstT:toY;
                if (target) {
                    const profile = weaponProfiles[bullet.weapon];
                    const head = area === 'head', force = profile.knockback * (head ? 1.35 : 1);
                    applyNonlethalHit(target, { source: 'gun',
                        vx: bullet.vx / profile.speed * force,
                        vy: Math.min(-force * .72, bullet.vy / profile.speed * force - 5),
                        cap: bullet.weapon === 'awm' ? 48 : bullet.weapon === 'double_barrel' ? 30 : 24,
                        squish: head ? 1.32 : 1.2, holdMs: head ? 550 : 400,
                        damage: profile.damage * (head ? 1.5 : 1),
                        hitX: bullet.x, hitY: bullet.y,
                        numberOffset: profile.count > 1 ? (bullet.pellet % 5 - 2) * 22 : 0,
                        numberLift: profile.count > 1 ? Math.floor(bullet.pellet / 5) * 25 : 0,
                        weapon: bullet.weapon });
                    screenEffects.add('shot', { x: bullet.x, y: bullet.y,
                        originX: bullet.originX, originY: bullet.originY, weapon: bullet.weapon }, 140);
                    addImpact(bullet.x, bullet.y, 'rgba(171,241,255,.95)', 6);
                    addParticles(bullet.x, bullet.y, '#79d9ee', 9, 5);
                    bullets.splice(i, 1);
                } else if(arrived) {
                    // A miss reaches only the transparent overlay, never the desktop below.
                    const profile = weaponProfiles[bullet.weapon];
                    screenEffects.addCrack(bullet.x, bullet.y, profile.crackRadius, profile.crackStyle);
                    addImpact(bullet.x, bullet.y, 'rgba(221,241,255,.9)', bullet.weapon === 'awm' ? 7 : 4);
                    addParticles(bullet.x, bullet.y, '#b7d8e7', bullet.weapon === 'awm' ? 12
                        : bullet.weapon === 'double_barrel' ? 2 : 4, 3, 'glass');
                    bullets.splice(i,1);
                } else if (bullet.x < -32 || bullet.y < -32 || bullet.x > width + 32 || bullet.y > height + 32) {
                    bullets.splice(i, 1);
                }
            }
        }

        function fireBomb(x, y) {
            const radius = 78 + Math.random() * 12;
            screenEffects.add('crater', { x, y, radius,
                edge: Array.from({ length: 32 }, (_, i) => .72 + (i % 4 === 0 ? .27 : i % 3 === 0 ? .11 : 0)
                    + Math.random() * .36),
                burst: Array.from({ length: 16 }, (_, i) => 1.38 + (i % 3 === 0 ? .42 : 0)
                    + Math.random() * .35) }, 5000);
            addRing(x, y, 'rgba(255,105,42,.96)', 320, 42);
            addRing(x, y, 'rgba(255,196,72,.88)', 160, 16);
            addImpact(x, y, 'rgba(255,239,181,.98)', 10);
            addParticles(x, y, '#f28a53', 34, 11);
            addParticles(x, y, '#ffd06a', 22, 12);
            addParticles(x, y, '#813a31', 12, 9);
            body.classList.remove('shake-bomb');
            void body.offsetWidth;
            if (auxiliaryEffectsEnabled) body.classList.add('shake-bomb');
            for (const pet of petInstances) {
                if (pet.isDragging || pet.blackHoleOrbit || pet.boss?.defeated) continue;
                const dx = pet.x - x, dy = pet.y - y;
                const distance = Math.hypot(dx, dy);
                if (distance >= 360) continue;
                const force = 17 * Math.pow(1 - distance / 360, 1.25);
                const angle = distance > 1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
                const probeY = Math.max(pet.y-pet.size*.8,Math.min(y,pet.y+pet.size*.8));
                const head = spriteHitArea(pet,pet.x,probeY) === 'head';
                applyNonlethalHit(pet, { source: 'bomb', vx: Math.cos(angle) * force * (head ? 1.15 : 1),
                    vy: -(4 + force * (head ? .82 : .65)), cap: 19, squish: 1.3,
                    holdMs: 700, damage: (12 + force * 2.5) * (head ? 1.4 : 1) });
            }
        }

        function throwGrenade(startX, startY, endX = startX, endY = startY) {
            const dx = endX - startX, dy = endY - startY;
            const dragged = Math.hypot(dx,dy) >= 8;
            const vx = dragged ? Math.max(-18,Math.min(18,dx*.12)) : [-7,7,0][Math.floor(Math.random()*3)];
            const vy = dragged ? Math.max(-19,Math.min(12,dy*.12-5)) : -12;
            return screenEffects.add('grenade', { x: startX, y: startY,
                vx, vy, rotation: 0 }, 3000);
        }

        function moveGrenadeThroughDrawing(grenade, dt) {
            let x = grenade.x, y = grenade.y, remaining = dt;
            for (let pass = 0; pass < 4 && remaining > 1e-6; pass++) {
                const dx = grenade.vx * remaining, dy = grenade.vy * remaining;
                let first = null;
                for (const segment of world.drawnColliders) {
                    const radius = 13 + segment.thickness / 2;
                    if (Math.max(x, x + dx) + radius < Math.min(segment.x1, segment.x2)
                        || Math.min(x, x + dx) - radius > Math.max(segment.x1, segment.x2)
                        || Math.max(y, y + dy) + radius < Math.min(segment.y1, segment.y2)
                        || Math.min(y, y + dy) - radius > Math.max(segment.y1, segment.y2)) continue;
                    const hit = sweptStrokeHit(x, y, dx, dy, radius, segment);
                    if (hit && (!first || hit.time < first.time)) first = hit;
                }
                if (!first) { x += dx; y += dy; break; }
                x += dx * first.time + first.nx * (first.depth + .05);
                y += dy * first.time + first.ny * (first.depth + .05);
                const normalSpeed = grenade.vx * first.nx + grenade.vy * first.ny;
                const bounce = Math.abs(normalSpeed) > 1 ? .55 : 0;
                grenade.vx = (grenade.vx - (1 + bounce) * normalSpeed * first.nx) * .96;
                grenade.vy = (grenade.vy - (1 + bounce) * normalSpeed * first.ny) * .96;
                remaining *= 1 - first.time;
            }
            grenade.x = x; grenade.y = y;
        }

        function updateGrenades(elapsedMs) {
            if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return;
            for (let i = grenades.length - 1; i >= 0; i--) {
                const grenade = grenades[i];
                const travelMs = Math.min(elapsedMs, grenade.remainingMs);
                const steps = Math.max(1,Math.ceil(travelMs / physicsFrameMs));
                const dt = travelMs / steps / physicsFrameMs;
                for (let step = 0; step < steps; step++) {
                    grenade.vy += .3 * dt;
                    moveGrenadeThroughDrawing(grenade, dt);
                    grenade.rotation += grenade.vx * dt * .015;
                    if (grenade.x < 16) { grenade.x = 16; grenade.vx = Math.abs(grenade.vx) * .58; }
                    if (grenade.x > width-16) { grenade.x = width-16; grenade.vx = -Math.abs(grenade.vx) * .58; }
                    if (grenade.y > height-16) {
                        grenade.y = height-16;
                        grenade.vy = Math.abs(grenade.vy) > 1 ? -Math.abs(grenade.vy) * .48 : 0;
                        grenade.vx *= .88;
                    }
                }
                if (grenade.remainingMs <= elapsedMs) {
                    grenades.splice(i,1);
                    fireBomb(grenade.x, grenade.y);
                } else grenade.remainingMs -= elapsedMs;
            }
        }

        function strikeHammer(x, y) {
            // The head's bottom-center, glass fracture and Pet hit all share x/y.
            const hammer = screenEffects.add('hammer', { x, y, visualFired: false }, 430);
            showHammerContact(hammer);
            // A narrow, single-target hit; Grab and orbit keep their existing priority.
            for (let i = petInstances.length - 1; i >= 0; i--) {
                const pet = petInstances[i];
                if (pet.isDragging || pet.blackHoleOrbit || pet.boss?.defeated) continue;
                const dx = pet.x - x, dy = pet.y - y;
                const distance = Math.hypot(dx, dy);
                if (distance > pet.size + 18) continue;
                const area = spriteHitArea(pet,x,y);
                if (!area) continue;
                const horizontal = distance > 1 ? dx / distance : (pet.facingRight ? 1 : -1);
                const vertical = distance > 1 ? dy / distance : -.35;
                const head = area === 'head';
                applyNonlethalHit(pet, { source: 'hammer', vx: horizontal * (head ? 17 : 13),
                    vy: vertical * 11 - (head ? 12 : 8), cap: 24, squish: 1.28,
                    holdMs: 500, damage: (22 + 16 * (1 - distance / (pet.size + 18))) * (head ? 1.5 : 1) });
                break;
            }
        }

        function showHammerContact(hammer) {
            if (!hammer || hammer.visualFired) return;
            hammer.visualFired = true;
            const nearby = screenEffects.groups.crack.filter(crack =>
                Math.hypot(crack.x-hammer.x,crack.y-hammer.y) < 65).length;
            screenEffects.addCrack(hammer.x, hammer.y, Math.min(200,170 + nearby*10), 'hammer');
            addRing(hammer.x, hammer.y, 'rgba(197,231,248,.9)', 170, 11);
            addImpact(hammer.x, hammer.y, 'rgba(241,251,255,.98)', 9);
            addParticles(hammer.x, hammer.y, '#8fbdd0', 34, 9, 'glass');
        }

        const blackHoleConsumeRadius = 22;
        const maxBlackHoles = 10;
        let nextBlackHoleId = 1;
        function pruneBlackHoleReferences() {
            const live = new Set(blackHoles.filter(hole => hole.life > 0).map(hole => hole.id));
            for (const pet of petInstances) {
                if (pet.blackHoleOrbit && !live.has(pet.blackHoleOrbit.holeId)) pet.blackHoleOrbit = null;
                for (const id of pet.rescuedFromHoles) if (!live.has(id)) pet.rescuedFromHoles.delete(id);
            }
        }
        function addBlackHole(x, y) {
            blackHoles.push({ id: nextBlackHoleId++, x, y, radius: 190, life: 540, angle: 0 });
            if (blackHoles.length > maxBlackHoles) {
                blackHoles.shift();
                pruneBlackHoleReferences();
            }
        }

        function updateBlackHoles(dt = 1) {
            for (const hole of blackHoles) {
                hole.life -= dt;
                if (hole.life <= 0) continue;
                hole.angle += .07 * dt;
                const glow = ctx.createRadialGradient(hole.x, hole.y, 8, hole.x, hole.y, hole.radius);
                glow.addColorStop(0, 'rgba(10,8,23,.98)');
                glow.addColorStop(.22, 'rgba(57,38,95,.86)');
                glow.addColorStop(1, 'rgba(62,43,113,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(hole.x, hole.y, hole.radius, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = 'rgba(177,151,242,.67)'; ctx.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    ctx.beginPath();
                    for (let j = 0; j < 28; j++) {
                        const a = hole.angle + i * 2 + j * .17;
                        const r = 18 + i * 13 + j * 2.8;
                        const px = hole.x + Math.cos(a) * r, py = hole.y + Math.sin(a) * r;
                        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.stroke();
                }
                for (let i = 0; i < 12; i++) {
                    const a = hole.angle * (i % 2 ? -1 : 1) + i * 2.4;
                    const r = 25 + (i * 31 + hole.angle * 20) % 145;
                    ctx.fillStyle = 'rgba(194,167,245,.65)';
                    ctx.beginPath(); ctx.arc(hole.x + Math.cos(a) * r, hole.y + Math.sin(a) * r, 1.4, 0, Math.PI * 2); ctx.fill();
                }
                const radiusSquared = hole.radius * hole.radius;
                for (const pet of petInstances) {
                    if (pet.isDragging || pet.absorbed || pet.boss?.defeated) continue;
                    if (pet.blackHoleOrbit && pet.blackHoleOrbit.holeId !== hole.id) continue;
                    const dx = pet.x - hole.x, dy = pet.y - hole.y;
                    const distanceSquared = dx * dx + dy * dy;
                    // Grab owns position. A rescued Pet must leave this hole before fresh capture.
                    if (pet.rescuedFromHoles.has(hole.id)) {
                        if (distanceSquared < radiusSquared) continue;
                        pet.rescuedFromHoles.delete(hole.id);
                    }
                    if (!pet.blackHoleOrbit && distanceSquared >= radiusSquared) continue;
                    if (!pet.blackHoleOrbit) {
                        pet.blackHoleOrbit = { holeId: hole.id, angle: Math.atan2(dy, dx),
                            startRadius: Math.max(34, Math.sqrt(distanceSquared)), turns: 0 };
                        // Orbit supersedes Throw/AI; release never resumes a stale throw timer.
                        pet.externalMotion = null;
                        pet.motionCause = null;
                        pet.interruptAutonomy();
                        pet.climbingDown = false;
                        pet.climbing = null; pet.targetLadderId = null; pet.supportId = null;
                    }
                    const orbit = pet.blackHoleOrbit;
                    if (!orbit || orbit.holeId !== hole.id) continue;
                    const step = .072 * dt;
                    orbit.angle += step;
                    orbit.turns += step / (Math.PI * 2);
                    const progress = Math.min(1, orbit.turns / 3.5);
                    const radius = blackHoleConsumeRadius
                        + (orbit.startRadius - blackHoleConsumeRadius) * Math.pow(1 - progress, 1.1);
                    pet.x = hole.x + Math.cos(orbit.angle) * radius;
                    pet.y = hole.y + Math.sin(orbit.angle) * radius;
                    pet.vx = -Math.sin(orbit.angle) * radius * step - Math.cos(orbit.angle) * .4;
                    pet.vy = Math.cos(orbit.angle) * radius * step - Math.sin(orbit.angle) * .4;
                    pet.updateImagePosition();
                    if (orbit.turns >= 3.5 && radius <= blackHoleConsumeRadius + 1) { pet.remove(); pet.absorbed = true; }
                }
            }
            const previousPetCount = petInstances.length;
            petInstances = petInstances.filter(pet => !pet.absorbed);
            if (petInstances.length !== previousPetCount) publishPetInstances();
            const previousHoleCount = blackHoles.length;
            blackHoles = blackHoles.filter(hole => hole.life > 0);
            if (blackHoles.length !== previousHoleCount) pruneBlackHoleReferences();
        }

        function shapeSegments(shape) {
            const start = shape.points[0];
            const end = shape.points.at(-1) || start;
            let points = shape.points;
            if (shape.kind === 'line') points = [start, end];
            else if (shape.kind === 'rect') points = [start, { x: end.x, y: start.y }, end,
                { x: start.x, y: end.y }, start];
            else if (shape.kind === 'ellipse') {
                const cx = (start.x + end.x) / 2, cy = (start.y + end.y) / 2;
                const rx = Math.abs(end.x - start.x) / 2, ry = Math.abs(end.y - start.y) / 2;
                points = Array.from({ length: 33 }, (_, i) => ({
                    x: cx + Math.cos(i * Math.PI / 16) * rx,
                    y: cy + Math.sin(i * Math.PI / 16) * ry
                }));
            }
            const result = [];
            for (let i = 1; i < points.length; i++) {
                const a = points[i - 1], b = points[i];
                if (Math.hypot(b.x - a.x, b.y - a.y) >= .5) result.push({
                    x1: a.x, y1: a.y, x2: b.x, y2: b.y,
                    shapeId: shape.id, thickness: shape.size,
                    closed: shape.kind === 'rect' || shape.kind === 'ellipse'
                });
            }
            return result;
        }

        function rebuildDrawnColliders() {
            while (strokes.length > 80) strokes.shift();
            let segments = strokes.flatMap(shapeSegments);
            while (segments.length > 600 && strokes.length > 1) {
                strokes.shift();
                segments = strokes.flatMap(shapeSegments);
            }
            if (segments.length > 600) segments = segments.slice(-600);
            world.drawnColliders = segments;
        }

        function redrawDrawing() {
            drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            drawingCtx.lineCap = 'round'; drawingCtx.lineJoin = 'round';
            for (const shape of strokes) {
                const segments = shapeSegments(shape);
                drawingCtx.strokeStyle = shape.color; drawingCtx.fillStyle = shape.color;
                drawingCtx.lineWidth = shape.size;
                if (!segments.length) {
                    drawingCtx.beginPath(); drawingCtx.arc(shape.points[0].x, shape.points[0].y,
                        shape.size / 2, 0, Math.PI * 2); drawingCtx.fill();
                    continue;
                }
                drawingCtx.beginPath(); drawingCtx.moveTo(segments[0].x1, segments[0].y1);
                for (const segment of segments) drawingCtx.lineTo(segment.x2, segment.y2);
                drawingCtx.stroke();
            }
        }

        function distanceToSegment(x, y, segment) {
            const dx = segment.x2 - segment.x1, dy = segment.y2 - segment.y1;
            const t = Math.max(0, Math.min(1,
                ((x - segment.x1) * dx + (y - segment.y1) * dy) / (dx * dx + dy * dy || 1)));
            return Math.hypot(x - (segment.x1 + dx * t), y - (segment.y1 + dy * t));
        }

        function eraseDrawing(x, y) {
            const radius = Math.max(12, drawSize * 2);
            const kept = strokes.filter(shape => {
                const segments = shapeSegments(shape);
                // Match redrawDrawing's dot fallback, including its visible painted radius.
                if (!segments.length) return Math.hypot(x - shape.points[0].x, y - shape.points[0].y) > radius + shape.size / 2;
                return !segments.some(segment => distanceToSegment(x, y, segment) <= radius);
            });
            if (kept.length === strokes.length) return;
            strokes = world.drawnShapes = kept;
            rebuildDrawnColliders(); redrawDrawing();
        }

        function beginDrawing(x, y) {
            if (eraser) { eraseDrawing(x, y); return; }
            const shape = { id: world.nextShapeId++, kind: drawShape, color: drawColor,
                size: drawSize, points: [{ x, y }] };
            if (drawShape !== 'freehand') shape.points.push({ x, y });
            strokes.push(shape);
            if (strokes.length > 80) strokes.shift();
            activeStroke = shape;
            rebuildDrawnColliders(); redrawDrawing();
        }

        function extendDrawing(x, y) {
            if (eraser) { eraseDrawing(x, y); return; }
            if (!activeStroke) return;
            if (activeStroke.kind === 'freehand') {
                const previous = activeStroke.points.at(-1);
                if (Math.hypot(x - previous.x, y - previous.y) < 7) return;
                const before = activeStroke.points.at(-2);
                const straight = before && distanceToSegment(previous.x, previous.y,
                    { x1: before.x, y1: before.y, x2: x, y2: y }) < 2.5;
                if (straight || activeStroke.points.length >= 100) activeStroke.points[activeStroke.points.length - 1] = { x, y };
                else activeStroke.points.push({ x, y });
            } else activeStroke.points[1] = { x, y };
            rebuildDrawnColliders(); redrawDrawing();
        }

        function drawnSurfaceAt(x, footY, tolerance = 3) {
            for (const segment of world.drawnColliders) {
                const dx = segment.x2 - segment.x1, dy = segment.y2 - segment.y1;
                if (Math.abs(dx) < .5) continue;
                const t = (x - segment.x1) / dx;
                if (t < -.02 || t > 1.02) continue;
                const y = segment.y1 + dy * t - segment.thickness / 2;
                if (Math.abs(footY - y) <= tolerance) return { y, id: `draw:${segment.shapeId}` };
            }
            return null;
        }

        function drawnLandingAt(pet, previousFoot) {
            let landing = null;
            for (const segment of world.drawnColliders) {
                const dx = segment.x2 - segment.x1, dy = segment.y2 - segment.y1;
                if (Math.abs(dx) < .5) continue;
                const t = (pet.x - segment.x1) / dx;
                if (t < -.02 || t > 1.02) continue;
                const y = segment.y1 + dy * t - segment.thickness / 2;
                if (previousFoot <= y + 3 && pet.y + pet.size >= y
                    && (!landing || y < landing.y)) landing = { y, id: `draw:${segment.shapeId}` };
            }
            return landing;
        }

        function throwRebound(velocity, restitution = throwPhysics.restitution) {
            return Math.abs(velocity) <= throwPhysics.stopImpact ? 0 : -velocity * restitution;
        }

        // Sweep the thrown Pet's circular body against each stroke capsule (line + endpoints).
        // Closed shapes block both sides; open horizontal strokes remain one-way surfaces.
        function sweptStrokeHit(x, y, dx, dy, radius, segment) {
            const sx = segment.x2 - segment.x1, sy = segment.y2 - segment.y1;
            const length = Math.hypot(sx, sy);
            if (length < .001) return null;
            const tx = sx / length, ty = sy / length;
            const nx = -ty, ny = tx;
            let best = null;
            const accept = (time, normalX, normalY, depth = 0) => {
                if (time < -1e-8 || time > 1 || dx * normalX + dy * normalY >= -1e-8) return;
                if (!segment.closed && normalY >= -.25 && Math.abs(normalX) <= .75) return;
                if (!best || time < best.time) best = { time: Math.max(0, time), nx: normalX, ny: normalY, depth };
            };
            const projection = Math.max(0, Math.min(length, (x - segment.x1) * tx + (y - segment.y1) * ty));
            const ox = x - segment.x1 - projection * tx, oy = y - segment.y1 - projection * ty;
            const distance = Math.hypot(ox, oy);
            if (distance > .001 && distance < radius) accept(0, ox / distance, oy / distance, radius - distance);
            const signed = (x - segment.x1) * nx + (y - segment.y1) * ny;
            const travel = dx * nx + dy * ny;
            if (Math.abs(travel) > 1e-8) {
                for (const sign of [-1, 1]) {
                    const time = (sign * radius - signed) / travel;
                    const along = (x + dx * time - segment.x1) * tx + (y + dy * time - segment.y1) * ty;
                    if (along >= 0 && along <= length) accept(time, nx * sign, ny * sign);
                }
            }
            const a = dx * dx + dy * dy;
            if (a > 1e-8) for (const [ex, ey] of [[segment.x1, segment.y1], [segment.x2, segment.y2]]) {
                const px = x - ex, py = y - ey;
                const b = 2 * (px * dx + py * dy), c = px * px + py * py - radius * radius;
                const discriminant = b * b - 4 * a * c;
                if (discriminant < 0) continue;
                const time = (-b - Math.sqrt(discriminant)) / (2 * a);
                const hx = px + dx * time, hy = py + dy * time;
                const norm = Math.hypot(hx, hy);
                if (norm > .001) accept(time, hx / norm, hy / norm);
            }
            return best;
        }

        function collideThrownDrawing(pet, previousX, previousY, dt, physics = throwPhysics) {
            let x = previousX, y = previousY, remaining = dt, support = null;
            for (let pass = 0; pass < 4 && remaining > 1e-6; pass++) {
                const dx = pet.vx * remaining, dy = pet.vy * remaining;
                let first = null;
                for (const segment of world.drawnColliders) {
                    const radius = pet.size + segment.thickness / 2;
                    if (Math.max(x, x + dx) + radius < Math.min(segment.x1, segment.x2)
                        || Math.min(x, x + dx) - radius > Math.max(segment.x1, segment.x2)
                        || Math.max(y, y + dy) + radius < Math.min(segment.y1, segment.y2)
                        || Math.min(y, y + dy) - radius > Math.max(segment.y1, segment.y2)) continue;
                    const hit = sweptStrokeHit(x, y, dx, dy, radius, segment);
                    if (hit && (!first || hit.time < first.time)) first = { ...hit, segment };
                }
                if (!first) { x += dx; y += dy; break; }
                x += dx * first.time + first.nx * (first.depth + .01);
                y += dy * first.time + first.ny * (first.depth + .01);
                const normalSpeed = pet.vx * first.nx + pet.vy * first.ny;
                if (first.ny < -.5) pet.reactToLanding(-normalSpeed);
                const bounce = Math.abs(normalSpeed) > physics.stopImpact ? physics.restitution : 0;
                if (bounce) pet.queueAnimationEvent('bounce');
                pet.vx -= (1 + bounce) * normalSpeed * first.nx;
                pet.vy -= (1 + bounce) * normalSpeed * first.ny;
                if (first.ny < -.5 && bounce === 0) support = `draw:${first.segment.shapeId}`;
                remaining *= 1 - first.time;
            }
            pet.x = x; pet.y = y;
            return support;
        }

        function collideDrawnWalls(pet, previousX, previousY) {
            for (const segment of world.drawnColliders) {
                const dx = segment.x2 - segment.x1, dy = segment.y2 - segment.y1;
                if (Math.abs(dy) > .5 && Math.abs(dy) >= Math.abs(dx) * .5) {
                    const t = (pet.y - segment.y1) / dy;
                    if (t >= -.05 && t <= 1.05) {
                        const x = segment.x1 + dx * t;
                        const left = x - segment.thickness / 2, right = x + segment.thickness / 2;
                        if (pet.vx > 0 && previousX + pet.size <= left + 2 && pet.x + pet.size >= left) {
                            pet.x = left - pet.size; pet.vx = 0;
                        } else if (pet.vx < 0 && previousX - pet.size >= right - 2 && pet.x - pet.size <= right) {
                            pet.x = right + pet.size; pet.vx = 0;
                        }
                    }
                }
                if (segment.closed && pet.vy < 0 && Math.abs(dx) >= .5) {
                    const t = (pet.x - segment.x1) / dx;
                    if (t < 0 || t > 1) continue;
                    const y = segment.y1 + dy * t + segment.thickness / 2;
                    if (previousY - pet.size >= y - 3 && pet.y - pet.size <= y) {
                        pet.y = y + pet.size; pet.vy = 0;
                    }
                }
            }
        }

        function drawEffects(elapsedMs = physicsFrameMs) {
            for (const grenade of grenades) {
                ctx.save(); ctx.translate(grenade.x,grenade.y); ctx.rotate(grenade.rotation);
                if (grenadeSprite.complete && grenadeSprite.naturalWidth)
                    ctx.drawImage(grenadeSprite,-19,-19,38,38);
                else { ctx.fillStyle='#536c38';ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill(); }
                ctx.restore();
            }
            for (const hole of holes) {
                const alpha = Math.min(1, hole.remainingMs / (35 * physicsFrameMs));
                const burstAge = hole.durationMs - hole.remainingMs;
                if (burstAge < 250) {
                    ctx.save(); ctx.globalAlpha = (1 - burstAge / 250) * alpha;
                    ctx.fillStyle = '#ff9b36'; ctx.beginPath();
                    for (let i = 0; i < hole.burst.length * 2; i++) {
                        const angle = i * Math.PI / hole.burst.length;
                        const reach = hole.radius * (i % 2 ? hole.burst[(i - 1) / 2] : .82);
                        const px = hole.x + Math.cos(angle) * reach;
                        const py = hole.y + Math.sin(angle) * reach;
                        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                    }
                    ctx.closePath(); ctx.fill(); ctx.restore();
                }
                const glow = ctx.createRadialGradient(hole.x, hole.y, hole.radius * .35,
                    hole.x, hole.y, hole.radius * 1.48);
                glow.addColorStop(0, `rgba(255,192,65,${alpha * .36})`);
                glow.addColorStop(.65, `rgba(255,92,35,${alpha * .35})`);
                glow.addColorStop(1, 'rgba(255,100,40,0)');
                ctx.fillStyle = glow;
                ctx.beginPath(); ctx.arc(hole.x, hole.y, hole.radius * 1.48, 0, Math.PI * 2); ctx.fill();
                const center = ctx.createRadialGradient(hole.x, hole.y, 2,
                    hole.x, hole.y, hole.radius * 1.15);
                center.addColorStop(0, `rgba(13,11,16,${alpha})`);
                center.addColorStop(.58, `rgba(28,13,16,${alpha * .97})`);
                center.addColorStop(.84, `rgba(164,47,27,${alpha * .92})`);
                center.addColorStop(1, `rgba(255,135,43,${alpha * .9})`);
                ctx.fillStyle = center;
                ctx.beginPath();
                for (let i = 0; i < hole.edge.length; i++) {
                    const angle = i * Math.PI * 2 / hole.edge.length;
                    const radius = hole.radius * hole.edge[i];
                    const px = hole.x + Math.cos(angle) * radius, py = hole.y + Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fill();
                ctx.strokeStyle = `rgba(255,112,39,${alpha * .94})`; ctx.lineWidth = 4;
                ctx.stroke();
            }
            for (const ring of rings) {
                if (auxiliaryEffectsEnabled) {
                    const progress = 1 - ring.remainingMs / ring.durationMs;
                    ctx.strokeStyle = ring.color;
                    ctx.globalAlpha = Math.max(0, ring.remainingMs / ring.durationMs);
                    ctx.lineWidth = 3 + (1 - progress) * 4;
                    ctx.beginPath(); ctx.arc(ring.x, ring.y, Math.max(1, ring.radius * progress), 0, Math.PI * 2); ctx.stroke();
                    ctx.globalAlpha = 1;
                }
            }
            for (const impact of impacts) {
                if (auxiliaryEffectsEnabled) {
                    ctx.fillStyle = impact.color;
                    ctx.globalAlpha = impact.remainingMs / impact.durationMs;
                    ctx.beginPath(); ctx.arc(impact.x, impact.y, 5 + (impact.durationMs - impact.remainingMs) / physicsFrameMs * 2, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }
            for (const bullet of bullets) {
                const age = bullet.durationMs - bullet.remainingMs;
                if (auxiliaryEffectsEnabled && age < 75) {
                    const angle = Math.atan2(bullet.vy, bullet.vx);
                    ctx.save(); ctx.translate(bullet.originX, bullet.originY); ctx.rotate(angle);
                    ctx.globalAlpha = 1 - age / 75;
                    ctx.fillStyle = '#fff1b5';
                    ctx.beginPath(); ctx.moveTo(24, 0); ctx.lineTo(-9, -10);
                    ctx.lineTo(-3, 0); ctx.lineTo(-9, 10); ctx.closePath(); ctx.fill();
                    ctx.restore();
                }
                ctx.save();
                ctx.strokeStyle = auxiliaryEffectsEnabled ? 'rgba(255,199,104,.36)' : 'rgba(213,178,118,.8)';
                ctx.lineWidth = auxiliaryEffectsEnabled ? 5 : 2;
                ctx.lineCap = 'round'; ctx.beginPath();
                ctx.moveTo(bullet.previousX, bullet.previousY);
                ctx.lineTo(bullet.x, bullet.y); ctx.stroke();
                if (auxiliaryEffectsEnabled) {
                    ctx.strokeStyle = '#fff4bf'; ctx.lineWidth = 1.5; ctx.stroke();
                }
                ctx.fillStyle = '#fff7d9'; ctx.beginPath();
                ctx.arc(bullet.x, bullet.y, bullet.weapon === 'awm' ? 3.5 : 2.3, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            if (auxiliaryEffectsEnabled) for (const shot of screenEffects.groups.shot) {
                const progress = 1 - shot.remainingMs / shot.durationMs;
                ctx.save(); ctx.globalAlpha = 1 - progress;
                ctx.lineCap = 'round';
                ctx.strokeStyle = 'rgba(255,199,104,.38)'; ctx.lineWidth = 5;
                ctx.beginPath(); ctx.moveTo(shot.originX, shot.originY); ctx.lineTo(shot.x, shot.y); ctx.stroke();
                ctx.strokeStyle = '#fff5c6'; ctx.lineWidth = 1.5; ctx.stroke();
                ctx.translate(shot.x, shot.y);
                ctx.strokeStyle = '#ffd179'; ctx.lineWidth = 2.5;
                ctx.beginPath(); ctx.arc(0, 0, 13 + progress * 15, 0, Math.PI * 2); ctx.stroke();
                for (let ray = 0; ray < 8; ray++) {
                    const angle = ray * Math.PI / 4;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(angle) * 8, Math.sin(angle) * 8);
                    ctx.lineTo(Math.cos(angle) * (22 + progress * 10),
                        Math.sin(angle) * (22 + progress * 10)); ctx.stroke();
                }
                ctx.fillStyle = '#fff9db'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            if (auxiliaryEffectsEnabled) for (const hammer of screenEffects.groups.hammer) {
                const age = hammer.durationMs - hammer.remainingMs + elapsedMs;
                ctx.save();
                ctx.translate(hammer.x, hammer.y);
                ctx.globalAlpha = Math.min(1, hammer.remainingMs / 110);
                const swing = age < 105 ? -.55 * (1-age/105)
                    : age < 155 ? .12 * ((age-105)/50)
                        : .12-.4*Math.min(1,(age-155)/275);
                ctx.rotate(swing);
                // Brief offset echoes suggest a local jolt without moving the desktop or hit point.
                ctx.strokeStyle = 'rgba(207,237,249,.68)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(-2, 1, 23 + age * .4, .25, 2.55); ctx.stroke();
                ctx.beginPath(); ctx.arc(2, -1, 23 + age * .4, 3.4, 5.7); ctx.stroke();
                if (hammerSprite.complete && hammerSprite.naturalWidth)
                    ctx.drawImage(hammerSprite,-17,-34,96,96);
                else {
                    ctx.strokeStyle = '#55453d'; ctx.lineWidth = 8; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(-3, -21); ctx.lineTo(-28, -70); ctx.stroke();
                    ctx.fillStyle = '#718899'; ctx.fillRect(-26, -24, 52, 24);
                }
                // The metal striking face is anchored at the stored click / impact coordinate.
                ctx.restore();
            }
            for (const particle of particles) {
                if (auxiliaryEffectsEnabled) {
                    ctx.globalAlpha = Math.min(1, particle.remainingMs / (15 * physicsFrameMs));
                    ctx.fillStyle = particle.color;
                    if (particle.shape === 'glass') {
                        const a = particle.angle + (1 - particle.remainingMs / particle.durationMs) * 2;
                        const tip = particle.size * 1.8;
                        ctx.beginPath();
                        ctx.moveTo(particle.x + Math.cos(a) * tip, particle.y + Math.sin(a) * tip);
                        ctx.lineTo(particle.x + Math.cos(a + 2.4) * particle.size,
                            particle.y + Math.sin(a + 2.4) * particle.size);
                        ctx.lineTo(particle.x + Math.cos(a - 2.4) * particle.size,
                            particle.y + Math.sin(a - 2.4) * particle.size);
                        ctx.closePath(); ctx.fill();
                        ctx.strokeStyle = 'rgba(65,105,126,.68)'; ctx.lineWidth = .8; ctx.stroke();
                    } else {
                        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
                    }
                    ctx.globalAlpha = 1;
                }
            }
            // Cracks are auxiliary visuals, never Draw geometry or Pet colliders.
            if (auxiliaryEffectsEnabled) for (const crack of screenEffects.groups.crack) {
                ctx.save();
                ctx.translate(crack.x, crack.y);
                ctx.globalAlpha = screenEffects.crackMode === 'accumulate' ? 1 : Math.min(1, crack.remainingMs / 500);
                const strong = crack.style === 'hammer';
                const heavy = crack.style === 'gun-heavy';
                const pellet = crack.style === 'gun-pellet';
                const spread = Math.min(1,Math.max(strong ? .2 : .08,
                    (crack.durationMs - crack.remainingMs + elapsedMs)/(strong ? 180 : 260)));
                ctx.scale(spread,spread);
                ctx.fillStyle = heavy ? 'rgba(17,24,34,.94)' : strong ? 'rgba(34,52,68,.78)'
                    : 'rgba(44,68,82,.65)';
                ctx.beginPath();
                crack.core.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
                ctx.closePath(); ctx.fill();
                ctx.fillStyle = strong || heavy ? 'rgba(191,227,241,.62)' : 'rgba(191,227,241,.4)';
                for (const shard of crack.shards) {
                    ctx.beginPath(); ctx.moveTo(shard[0].x, shard[0].y);
                    ctx.lineTo(shard[1].x, shard[1].y); ctx.lineTo(shard[2].x, shard[2].y);
                    ctx.closePath(); ctx.fill();
                }
                ctx.strokeStyle = strong ? 'rgba(33,54,75,.98)' : heavy
                    ? 'rgba(39,60,77,.94)' : 'rgba(64,92,110,.78)';
                ctx.lineWidth = strong ? 4.4 : heavy ? 3.2 : pellet ? 1.7 : 2.4;
                ctx.beginPath();
                for (const path of crack.paths) {
                    ctx.moveTo(path[0].x, path[0].y);
                    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
                }
                ctx.stroke();
                ctx.translate(.7, -.8); ctx.strokeStyle = 'rgba(244,253,255,.82)';
                ctx.lineWidth = strong ? 1.6 : heavy ? 1.1 : pellet ? .55 : .85;
                ctx.stroke();
                ctx.restore();
            }
            drawDamageNumbers();
            screenEffects.update(elapsedMs, { width, height });
        }

        function drawDamageNumbers() {
            if (auxiliaryEffectsEnabled) for (const number of screenEffects.groups.damage) {
                const progress = 1 - number.remainingMs / number.durationMs;
                const bounce = 1 + .26 * Math.sin(Math.min(1, progress * 3) * Math.PI);
                const fade = Math.min(1, number.remainingMs / 280);
                ctx.save();
                ctx.translate(number.x + number.drift * progress + Math.sin(progress * 28) * (1 - progress) * 2,
                    number.y - 38 * (1 - Math.pow(1 - progress, 2)));
                ctx.scale(bounce, bounce); ctx.globalAlpha = fade;
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                const gunProfile = number.source === 'gun' ? weaponProfiles[number.weapon] : null;
                ctx.font = `900 ${gunProfile ? number.weapon === 'awm' ? 43
                    : number.weapon === 'uzi' ? 21 : number.weapon === 'double_barrel' ? 23 : 29 : 27}px sans-serif`;
                ctx.lineJoin = 'round';
                ctx.strokeStyle = 'rgba(39,34,58,.94)'; ctx.lineWidth = 6;
                ctx.strokeText(String(number.amount), 0, 0);
                ctx.strokeStyle = number.source === 'bomb' ? '#e75c32'
                    : gunProfile ? gunProfile.color : '#448fb6'; ctx.lineWidth = gunProfile ? 3 : 2;
                ctx.strokeText(String(number.amount), 0, 0);
                ctx.fillStyle = number.source === 'bomb' ? '#ffe387'
                    : gunProfile ? '#fff7dd' : '#eefaff';
                ctx.fillText(String(number.amount), 0, 0);
                ctx.restore();
            }
        }

        function drawCombo() {
            const age = world.now() - combo.lastHitAt;
            if (combo.count && age >= comboDisplayMs) {
                combo.count = 0;
                combo.lastHitAt = -Infinity;
            }
            if (!auxiliaryEffectsEnabled || !combo.count || age < 0) return;
            const opacity = Math.min(1, (comboDisplayMs - age) / 600);
            const milestone = combo.count >= 50 ? 3 : combo.count >= 25 ? 2
                : combo.count >= 10 ? 1 : combo.count >= 5 ? .5 : 0;
            const scale = 1 + milestone * .035 + (age < 180 ? (.16 + milestone * .025) * (1 - age / 180) : 0);
            ctx.save();
            ctx.globalAlpha = opacity;
            ctx.translate(width - 108, 112);
            ctx.scale(scale, scale);
            ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
            ctx.lineJoin = 'round';
            ctx.font = '900 23px sans-serif';
            ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(29,38,54,.94)';
            ctx.strokeText('COMBO', 0, -14);
            ctx.fillStyle = '#fff0b3'; ctx.fillText('COMBO', 0, -14);
            ctx.font = '900 49px sans-serif';
            const digits = String(combo.count).padStart(3, '0');
            ctx.lineWidth = 9; ctx.strokeText(digits, 0, 24);
            ctx.fillStyle = milestone >= 2 ? '#ffe07c' : '#ffb852'; ctx.fillText(digits, 0, 24);
            ctx.restore();
        }

        function drawSleepEffect(pet) {
            if (!auxiliaryEffectsEnabled || pet.boss?.defeated || pet.autonomy.state !== 'sleep'
                || !pet.quietAutonomy()) return;
            ctx.save();
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.font = '600 13px sans-serif';
            for (let i = 0; i < 2; i++) {
                const phase = ((world.now() / 2300 + i * .5 + pet.instanceId * .13) % 1 + 1) % 1;
                ctx.globalAlpha = .5 * Math.sin(Math.PI * phase);
                ctx.fillStyle = '#7189a5';
                ctx.fillText('z', pet.x + pet.size * .78 + i * 8,
                    pet.y - pet.size * 1.25 - phase * 22);
            }
            ctx.restore();
        }

        function drawBossHealth(pet) {
            if (!pet.boss) return;
            const opacity = pet.boss.defeated ? pet.boss.fadeRemainingMs / bossFadeMs : 1;
            const barWidth = pet.boss.barWidth;
            const left = pet.x - barWidth / 2, top = pet.y - pet.size * 1.9 - 20;
            ctx.save();
            if (auxiliaryEffectsEnabled) {
                const spawnAge = world.now() - pet.boss.spawnedAt;
                const entrance = !pet.boss.defeated && spawnAge >= 0 && spawnAge < 500;
                const defeat = pet.boss.defeated && pet.boss.fadeRemainingMs > 0;
                if (entrance || defeat) {
                    const progress = entrance ? spawnAge / 500 : 1 - pet.boss.fadeRemainingMs / bossFadeMs;
                    ctx.globalAlpha = (1 - progress) * (entrance ? .28 : .38);
                    ctx.strokeStyle = entrance ? '#ffd9a0' : '#f5a4b1';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(pet.x, pet.y - pet.size * .3, pet.size * (1 + progress * .45), 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            ctx.globalAlpha = Math.max(0, opacity);
            ctx.fillStyle = 'rgba(32,38,52,.8)'; ctx.fillRect(left - 2, top, barWidth + 4, 12);
            ctx.fillStyle = '#f3d3bb'; ctx.fillRect(left, top + 2, barWidth, 8);
            ctx.fillStyle = pet.boss.health / pet.boss.maxHealth <= .2 ? '#ff9568' : '#ed6473';
            ctx.fillRect(left, top + 2, barWidth * pet.boss.health / pet.boss.maxHealth, 8);
            ctx.restore();
        }

        function publishTaskbarPetRegions() {
            if (currentMode !== 'pc' || !window.playground?.publishTaskbarPetRegions) return;
            const now = performance.now();
            if (now - lastPetRegionSentAt < 150) return;
            lastPetRegionSentAt = now;
            const regions = petInstances.map(pet => {
                // Generous visual bounds include Sprite pose/anchor variation;
                // the main process clips these to the taskbar strip.
                const reach = Math.ceil(pet.size * 1.8 + 8);
                const x = Math.floor((pet.x - reach) / 8) * 8;
                const y = Math.floor((pet.y - reach) / 8) * 8;
                return { x, y, width: reach * 2 + 8, height: reach * 2 + 8 };
            });
            const signature = JSON.stringify(regions);
            if (signature !== lastPetRegionSignature) {
                lastPetRegionSignature = signature;
                window.playground.publishTaskbarPetRegions(regions);
            }
        }

        let draggedPet = null;
        let mouseX = 0, mouseY = 0;
        let dragOffsetX = 0, dragOffsetY = 0;
        let dragSamples = [];

        function recordDragSample(event) {
            const timestamp = Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
            const time = Math.max(timestamp, dragSamples.at(-1)?.time ?? timestamp);
            const sample = { x: mouseX, y: mouseY, time };
            if (dragSamples.at(-1)?.time === time) dragSamples[dragSamples.length - 1] = sample;
            else dragSamples.push(sample);
            // Keep one sample before the window for interpolation, including a stationary mouseup.
            while (dragSamples.length > 2 && dragSamples[1].time <= time - throwSampleMs) dragSamples.shift();
        }

        function dragThrowVelocity() {
            if (dragSamples.length < 2) return { vx: 0, vy: 0 };
            const end = dragSamples.at(-1);
            const estimate = windowMs => {
                let start = dragSamples[0];
                const cutoff = end.time - windowMs;
                for (let i = 1; i < dragSamples.length; i++) {
                    const next = dragSamples[i];
                    if (next.time <= cutoff) { start = next; continue; }
                    if (start.time < cutoff) {
                        const fraction = (cutoff - start.time) / (next.time - start.time);
                        start = { time: cutoff, x: start.x + (next.x - start.x) * fraction,
                            y: start.y + (next.y - start.y) * fraction };
                    }
                    break;
                }
                const elapsedMs = end.time - start.time;
                return elapsedMs < 1 ? { vx: 0, vy: 0 } : {
                    vx: (end.x - start.x) / elapsedMs * physicsFrameMs,
                    vy: (end.y - start.y) / elapsedMs * physicsFrameMs };
            };
            // Keep 100ms of history, but let a short final flick outweigh a preceding hold.
            const recent = estimate(40), full = estimate(throwSampleMs);
            if (Math.hypot(recent.vx, recent.vy) < .01) return { vx: 0, vy: 0 };
            const vx = recent.vx * .75 + full.vx * .25;
            const vy = recent.vy * .75 + full.vy * .25;
            const speed = Math.hypot(vx, vy);
            // Slow gestures retain their scale; faster gestures gain a little extra reach.
            const gain = 1 + .35 * Math.max(0, Math.min(1, (speed - 6) / 24));
            const scale = Math.min(gain, maxThrowSpeed / (speed || 1));
            return { vx: vx * scale, vy: vy * scale };
        }

        function spawnPet(id, x, y, { allowBoss = false } = {}) {
            const definition = petDefinitions.get(id);
            if (!definition || !definition.enabled) return null;
            const pet = new Pet(x, y, definition);
            if (allowBoss && Math.random() < bossSpawnChance) pet.becomeBoss();
            petInstances.push(pet);
            publishPetInstances();
            return pet;
        }

        function publishPetInstances() {
            window.playground.publishPetInstances(petInstances.map(pet => ({
                instanceId: pet.instanceId, definitionId: pet.definitionId
            })));
        }

        function removePetInstance(instanceId) {
            const index = petInstances.findIndex(pet => pet.instanceId === instanceId);
            if (index < 0) return false;
            const [pet] = petInstances.splice(index, 1);
            pet.remove();
            publishPetInstances();
            return true;
        }

        function removePetKind(definitionId) {
            if (typeof definitionId !== 'string') return 0;
            let removed = 0;
            petInstances = petInstances.filter(pet => {
                if (pet.definitionId !== definitionId) return true;
                pet.remove();
                removed++;
                return false;
            });
            if (removed) publishPetInstances();
            return removed;
        }

        function applyPetDefinitions(snapshot) {
            if (!snapshot || !snapshot.defaultPets || !Array.isArray(snapshot.customPets)) return;
            for (const id of ['basic', 'blob', 'cat', 'magpie', 'robot', 'bug', 'ghost', 'star', 'cloud']) {
                petDefinitions.get(id).enabled = true;
            }
            for (const entry of snapshot.localPets || []) {
                if (![9, 11].includes(entry.rows)) continue;
                const image = new Image(); image.src = entry.asset;
                petDefinitions.set(entry.id, {
                    id: entry.id, name: entry.name, category: entry.category, renderKind: 'sprite', asset: image,
                    clips: sheetClips, animation: spriteProfiles[entry.id], rows: entry.rows, defaultSize: entry.id.startsWith('kirby') ? 34 : 39,
                    enabled: true,
                    behavior: { turnChance: .025, jumpChance: .012, moveSpeed: 8, jumpSpeed: 9 }
                });
            }
            for (const [id] of petDefinitions) {
                if (!['basic', 'blob', 'cat', 'magpie', 'robot', 'bug', 'ghost', 'star', 'cloud'].includes(id)
                    && !(snapshot.localPets || []).some(item => item.id === id)) petDefinitions.delete(id);
            }
            for (const entry of snapshot.customPets) {
                const longest = Math.max(entry.width, entry.height);
                const scale = 88 / longest;
                petDefinitions.set(entry.id, {
                    id: entry.id, name: entry.name, renderKind: 'image', assetUrl: entry.assetUrl,
                    displayWidth: Math.max(1, Math.round(entry.width * scale)),
                    displayHeight: Math.max(1, Math.round(entry.height * scale)),
                    defaultSize: 44, enabled: entry.enabled,
                    behavior: { turnChance: .03, jumpChance: .01, moveSpeed: 8, jumpSpeed: 8 }
                });
            }
            if (draggedPet && !petDefinitions.get(draggedPet.definitionId)?.enabled) releaseDraggedPet();
            const previousPetCount = petInstances.length;
            petInstances = petInstances.filter(pet => {
                if (petDefinitions.get(pet.definitionId)?.enabled) return true;
                pet.remove();
                return false;
            });
            if (petInstances.length !== previousPetCount) publishPetInstances();
            definitionsLoaded = true;
        }

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2 && enabled && currentMode !== 'pc') {
                e.preventDefault();
                cancelInput();
                window.playground.setMode('pc');
                return;
            }
            if (!enabled || e.button !== 0) return;
            if (controlsPanelOpen) {
                if (currentMode === 'draw' && controlsPanelKind === 'draw') {
                    // Dismiss Draw options and use this same press to start the stroke.
                    controlsPanelOpen = false;
                    window.playground.setControlsPanelOpen(false);
                } else {
                    // Other tools retain the outside-click safety behavior.
                    window.playground.setMode('pc');
                    return;
                }
            }
            if (currentMode === 'pc') return;
            pointerDown = true;
            mouseX = e.clientX; mouseY = e.clientY;

            if (currentMode === 'spawn') {
                spawnPet(selectedPetId, mouseX, mouseY, { allowBoss: true });
            } else if (currentMode === 'bomb') {
                grenadeDrag = { x: mouseX, y: mouseY };
            } else if (currentMode === 'hammer') {
                strikeHammer(mouseX, mouseY);
            } else if (currentMode === 'gun') {
                gunTriggerHeld = true;
                shootGun(mouseX, mouseY);
            } else if (currentMode === 'blackhole') {
                addBlackHole(mouseX, mouseY);
            } else if (currentMode === 'draw') {
                beginDrawing(mouseX, mouseY);
            } else if (currentMode === 'touch') {
                for (let i = petInstances.length - 1; i >= 0; i--) {
                    const p = petInstances[i];
                    if (p.boss?.defeated) continue;
                    if (Math.hypot(p.x - mouseX, p.y - mouseY) < p.size + 25) {
                        draggedPet = p;
                        dragOffsetX = p.x - mouseX; dragOffsetY = p.y - mouseY;
                        dragSamples = [];
                        recordDragSample(e);
                        if (p.blackHoleOrbit) p.rescuedFromHoles.add(p.blackHoleOrbit.holeId);
                        p.blackHoleOrbit = null;
                        p.interruptAutonomy();
                        p.externalMotion = null;
                        p.motionCause = null;
                        p.climbing = null; p.targetLadderId = null; p.supportId = null;
                        p.climbingDown = false;
                        p.isDragging = true;
                        canvas.classList.add('is-grabbing');
                        p.squish = 1.4; // 잡힐 때 길어짐
                        p.vy = 0; p.vx = 0;
                        break;
                    }
                }
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            mouseX = e.clientX; mouseY = e.clientY;

            if (draggedPet) {
                recordDragSample(e);
                draggedPet.x = mouseX + dragOffsetX;
                draggedPet.y = mouseY + dragOffsetY;
                draggedPet.updateImagePosition();
            }
            if (pointerDown && currentMode === 'draw' && (activeStroke || eraser)) extendDrawing(mouseX, mouseY);
        });
        canvas.addEventListener('mouseleave', () => { mouseX = -1; mouseY = -1; cancelInput(); });

        window.addEventListener('mouseup', (e) => {
            const wasDown = pointerDown;
            pointerDown = false;
            gunTriggerHeld = false;
            activeStroke = null;
            if (wasDown && currentMode === 'bomb' && grenadeDrag) {
                throwGrenade(grenadeDrag.x, grenadeDrag.y, e.clientX, e.clientY);
                grenadeDrag = null;
            }
            if (draggedPet) {
                mouseX = e.clientX; mouseY = e.clientY;
                recordDragSample(e);
                draggedPet.x = mouseX + dragOffsetX;
                draggedPet.y = mouseY + dragOffsetY;
                if (inTrash(draggedPet.x, draggedPet.y)) {
                    removePetInstance(draggedPet.instanceId);
                } else {
                    const { vx, vy } = dragThrowVelocity();
                    draggedPet.beginThrow(vx, vy);
                    draggedPet.isDragging = false;
                    draggedPet.squish = 1;
                    draggedPet.updateImagePosition();
                }
                draggedPet = null;
                canvas.classList.remove('is-grabbing');
                dragSamples = [];
            }
        });
        window.addEventListener('contextmenu', event => {
            event.preventDefault();
            if (currentMode === 'pc') return;
            cancelInput();
            window.playground.setMode('pc');
        }, true);

        function drawGunOverlay() {
            if (currentMode !== 'gun' || !enabled || controlsPanelOpen
                || mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) return;
            const profile = weaponProfiles[gunWeapon], pose = gunPose(mouseX, mouseY, profile);
            const recoil = Math.max(0, 1 - (world.now() - lastGunShotAt) / 105) *
                (gunWeapon === 'awm' || gunWeapon === 'double_barrel' ? 9 : 4);
            const image = weaponSprites[gunWeapon];
            ctx.save();
            // Recoil pivots around the muzzle so the flash and projectile never detach.
            ctx.translate(pose.muzzleX,pose.muzzleY);
            ctx.rotate(pose.angle+recoil*.012);
            ctx.scale(1,pose.flipY);
            if (image.complete && image.naturalWidth > 0) {
                ctx.drawImage(image, -profile.width * profile.muzzle[0],
                    -profile.height * profile.muzzle[1], profile.width, profile.height);
            }
            ctx.restore();
            // The OS/CSS red dot has its hotspot at this same aim coordinate.
        }

        function animate(dt = 1, effectElapsedMs = dt * physicsFrameMs) {
            if (gunTriggerHeld && currentMode === 'gun' && weaponProfiles[gunWeapon].auto)
                shootGun(mouseX, mouseY);
            cleanupStructures();
            ctx.clearRect(0, 0, width, height);
            drawStructures();

            updateGrenades(effectElapsedMs);
            updateBullets(effectElapsedMs);
            drawEffects(effectElapsedMs);
            ctx.drawImage(drawingCanvas, 0, 0);
            updateBlackHoles(dt);

            // 펫 업데이트 및 렌더링
            petInstances.forEach(pet => {
                pet.update(dt, effectElapsedMs);
                if (pet.boss?.defeated && pet.boss.fadeRemainingMs <= 0) return;
                pet.draw(ctx);
                drawBossHealth(pet);
                drawSleepEffect(pet);
            });
            let removedBoss = false;
            petInstances = petInstances.filter(pet => {
                if (!pet.boss?.defeated || pet.boss.fadeRemainingMs > 0) return true;
                pet.remove();
                removedBoss = true;
                return false;
            });
            if (removedBoss) publishPetInstances();
            publishTaskbarPetRegions();
            // Keep arcade numbers legible in front of the Pet that was hit.
            drawDamageNumbers();
            drawTrash();
            drawGunOverlay();
            drawCombo();


        }

        function startAnimation() {
            if (!enabled || animationFrame !== null) return;
            let previousTime = null;
            const frame = (now) => {
                animationFrame = null;
                if (!enabled) return;
                const elapsedMs = previousTime === null ? physicsFrameMs : Math.max(0, now - previousTime);
                const dt = previousTime === null ? 1 : Math.max(.25, Math.min(3, (now - previousTime) / 16.667));
                previousTime = now;
                animate(dt, elapsedMs);
                animationFrame = requestAnimationFrame(frame);
            };
            animationFrame = requestAnimationFrame(frame);
        }

        function stopAnimation() {
            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
        }

        function releaseDraggedPet() {
            dragSamples = [];
            if (!draggedPet) return;
            draggedPet.isDragging = false;
            draggedPet.squish = 1;
            draggedPet.updateImagePosition();
            draggedPet = null;
        }

        function clearPlayground(kind) {
            if (kind === 'crack') screenEffects.clear('crack');
            if (kind === 'drawing' || kind === 'all') {
                strokes = world.drawnShapes = [];
                world.drawnColliders = [];
                activeStroke = null;
                drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            }
            if (kind === 'effects' || kind === 'all') {
                screenEffects.clear();
                combo.count = 0;
                combo.lastHitAt = -Infinity;
                blackHoles = [];
                pruneBlackHoleReferences();
            }
            if (kind === 'structures' || kind === 'all') {
                world.structures = [];
                world.lastZone = null;
                world.zoneBuildAt = new Map();
                world.lastBuildAt = 0;
                world.lastCleanupAt = 0;
                for (const pet of petInstances) {
                    pet.supportId = null; pet.climbing = null; pet.targetLadderId = null;
                    pet.vy = Math.max(.5, pet.vy);
                }
                pruneStructureReferences();
            }
            if (kind === 'pets' || kind === 'all') {
                releaseDraggedPet();
                for (const pet of petInstances) pet.remove();
                petInstances = [];
                publishPetInstances();
            }
        }

        function applyAppState(nextState) {
            if (!nextState || typeof nextState.enabled !== 'boolean') return;
            const changedMode = currentMode !== nextState.mode;
            const changedWeapon = weaponProfiles[nextState.gunWeapon]
                && gunWeapon !== nextState.gunWeapon;
            enabled = nextState.enabled;
            auxiliaryEffectsEnabled = nextState.auxiliaryEffectsEnabled !== false;
            screenEffects.setCrackMode(nextState.crackMode === 'accumulate' ? 'accumulate' : 'auto');
            if (!auxiliaryEffectsEnabled) body.classList.remove('shake-bomb');
            const wasStructuresEnabled = structuresEnabled;
            structuresEnabled = nextState.structuresEnabled === true;
            if (wasStructuresEnabled && !structuresEnabled) {
                for (const pet of petInstances) {
                    pet.supportId = null;
                    pet.climbing = null;
                    pet.targetLadderId = null;
                    pet.climbingDown = false;
                    pet.vy = Math.max(.5, pet.vy);
                }
            }
            if (!wasStructuresEnabled && structuresEnabled) {
                const now = world.now();
                for (const structure of world.structures) structure.lastUsedAt = now;
            }
            currentMode = nextState.mode || 'pc';
            if (changedMode && currentMode === 'pc') {
                lastPetRegionSentAt = -Infinity;
                lastPetRegionSignature = '';
            }
            controlsPanelOpen = nextState.controlsPanelOpen === true;
            controlsPanelKind = nextState.controlsPanelKind || null;
            if (weaponProfiles[nextState.gunWeapon]) gunWeapon = nextState.gunWeapon;
            selectedPetId = nextState.petId || null;
            drawShape = nextState.drawShape || drawShape;
            drawColor = nextState.drawColor || drawColor;
            drawSize = nextState.drawSize || drawSize;
            eraser = Boolean(nextState.eraser);
            if (!enabled || changedMode || changedWeapon) cancelInput();
            canvas.className = currentMode === 'pc' ? 'cursor-pointer'
                : currentMode === 'touch' ? 'cursor-touch'
                : currentMode === 'hammer' ? 'cursor-hammer'
                : currentMode === 'gun' ? 'cursor-gun'
                : currentMode === 'spawn' ? 'cursor-spawn'
                : currentMode === 'draw' ? eraser ? 'cursor-eraser' : 'cursor-draw'
                : currentMode === 'bomb' ? 'cursor-bomb'
                : currentMode === 'blackhole' ? 'cursor-blackhole' : 'cursor-pointer';
            if (enabled) startAnimation();
            else stopAnimation();
        }

        function cancelInput() {
            pointerDown = false;
            gunTriggerHeld = false;
            grenadeDrag = null;
            activeStroke = null;
            releaseDraggedPet();
            canvas.classList.remove('is-grabbing');
        }

        window.playground.onState(applyAppState);
        window.playground.onClear(clearPlayground);
        window.playground.onRemovePetInstance(removePetInstance);
        window.playground.onRemovePetKind(removePetKind);
        window.playground.onPetDefinitions(applyPetDefinitions);
        publishPetInstances();
        window.playground.getState().then(applyAppState);
        window.playground.getPetDefinitions().then(applyPetDefinitions);
        window.addEventListener('blur', cancelInput);
        window.addEventListener('mouseleave', cancelInput);
        window.addEventListener('keydown', event => {
            if (event.key === 'Escape' && currentMode !== 'pc') window.playground.setMode('pc');
        });

        // 숨겨진 상태로 시작한 경우에도 대표 Pet을 동일 세션에 한 번만 생성한다.
        let starterPetsCreated = false;
        setTimeout(() => {
            const addStarters = () => {
                if (starterPetsCreated || !definitionsLoaded) return;
                starterPetsCreated = true;
                for (const [id, x, y] of [
                    ['kirby', width / 2 + 170, -130],
                    ['cat_brown', width / 2 - 90, -100],
                    ['doge', width / 2 - 170, -90]
                ]) {
                    const pet = spawnPet(id, x, y);
                    if (pet) pet.startingPet = true;
                }
            };
            if (definitionsLoaded) addStarters();
            else window.playground.getPetDefinitions().then(snapshot => {
                applyPetDefinitions(snapshot);
                addStarters();
            });
        }, 500);
