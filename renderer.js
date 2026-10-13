        const canvas = document.getElementById('playground-canvas');
        const ctx = canvas.getContext('2d');
        const body = document.getElementById('body-container');
        const drawingCanvas = document.createElement('canvas');
        const drawingCtx = drawingCanvas.getContext('2d');

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
            "cat_brown": {
                rows: 11,
                origin: "feet",
                elasticity: 0.55,
                sleeping: false,
                clips: {
                    idle: {"row": 0, "frames": [0, 1, 2, 3, 4, 5, 6], "frameMs": 183.3333333333, "center": 0.5, "foot": 0.976},
                    walkRight: {"row": 1, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.8462},
                    walkLeft: {"mirrorOf": "walkRight"},
                    jump: {"row": 4, "frames": [1, 2, 3], "frameMs": 100, "loop": false, "center": 0.5, "foot": 0.976},
                    fall: {"row": 4, "frames": [1, 2, 3], "frameMs": 125, "loop": false, "center": 0.5, "foot": 0.976},
                    drag: {"row": 5, "frames": [0, 1, 2, 6, 7], "frameMs": 116.6666666667, "center": 0.4974, "foot": 0.976},
                    rest: {"row": 7, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 350, "center": 0.4974, "foot": 0.976},
                    sleep: {"row": 5, "frames": [3, 4], "frameMs": 500, "center": 0.5, "foot": 0.8606},
                    look: {"row": 9, "frames": [1, 2, 3, 4, 5, 6, 5, 4, 3, 2], "frameMs": 160, "center": 0.4948, "foot": 0.976},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
            "cat_face": {
                rows: 11,
                origin: "center",
                elasticity: 0.25,
                sleeping: false,
                clips: {
                    walkLeft: {"mirrorOf": "walkRight"},
                    walkRight: {"row": 9, "frames": [1, 2, 3, 4, 5, 6, 5, 4, 3, 2], "frameMs": 110, "center": 0.5026, "foot": 0.8894, "scale": 1.035, "tilt": 0.035, "bob": 0.025, "bobMs": 360, "centerY": 0.5},
                    idle: {"row": 0, "frames": [0, 1, 2, 3, 4, 5, 6], "frameMs": 183.3333333333, "center": 0.5, "foot": 0.8894, "centerY": 0.4976},
                    jump: {"row": 6, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 100, "loop": false, "center": 0.5, "foot": 0.9038, "centerY": 0.5},
                    fall: {"row": 6, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 125, "loop": false, "center": 0.5, "foot": 0.9038, "centerY": 0.5},
                    drag: {"row": 5, "frames": [0, 1, 6, 7], "frameMs": 116.6666666667, "center": 0.5, "foot": 0.9038, "centerY": 0.4976},
                    rest: {"row": 8, "frames": [0, 1, 5], "frameMs": 400, "center": 0.5, "foot": 0.9231, "centerY": 0.5},
                    sleep: {"row": 8, "frames": [1, 5], "frameMs": 500, "center": 0.5, "foot": 0.9231, "centerY": 0.5},
                    look: {"row": 8, "frames": [0, 1, 4, 5], "frameMs": 216.6666666667, "center": 0.5, "foot": 0.9231, "centerY": 0.5},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
            "cat_sleepy": {
                rows: 9,
                origin: "feet",
                elasticity: 0.4,
                sleeping: true,
                clips: {
                    idle: {"row": 0, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 183.3333333333, "center": 0.5, "foot": 0.7933},
                    walkRight: {"row": 1, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.851},
                    walkLeft: {"row": 2, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.851},
                    jump: {"row": 4, "frames": [1, 2, 3], "frameMs": 100, "loop": false, "center": 0.5, "foot": 0.9279},
                    fall: {"row": 4, "frames": [1, 2, 3], "frameMs": 125, "loop": false, "center": 0.5, "foot": 0.9279},
                    drag: {"row": 5, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 116.6666666667, "center": 0.5, "foot": 0.7981},
                    rest: {"row": 6, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 400, "center": 0.5, "foot": 0.7837},
                    sleep: {"row": 0, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 483.3333333333, "center": 0.5, "foot": 0.7933},
                    look: {"row": 8, "frames": [0, 1, 3, 4, 5], "frameMs": 200, "center": 0.5, "foot": 0.8173},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
            "doge": {
                rows: 9,
                origin: "feet",
                elasticity: 0.55,
                sleeping: false,
                clips: {
                    idle: {"row": 0, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 183.3333333333, "center": 0.4974, "foot": 0.976},
                    walkRight: {"row": 1, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.976},
                    walkLeft: {"row": 2, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.976},
                    jump: {"row": 4, "frames": [1, 2, 3], "frameMs": 100, "loop": false, "center": 0.5, "foot": 0.976},
                    fall: {"row": 4, "frames": [1, 2, 3], "frameMs": 125, "loop": false, "center": 0.5, "foot": 0.976},
                    drag: {"row": 5, "frames": [0, 1, 5, 7], "frameMs": 116.6666666667, "center": 0.4974, "foot": 0.976},
                    rest: {"row": 6, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 350, "center": 0.4974, "foot": 0.976},
                    sleep: {"row": 5, "frames": [3, 4], "frameMs": 500, "center": 0.5, "foot": 0.9519},
                    look: {"row": 8, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 200, "center": 0.5, "foot": 0.976},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
            "puddle": {
                rows: 11,
                origin: "feet",
                elasticity: 0.55,
                sleeping: false,
                clips: {
                    walkLeft: {"row": 2, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.8125, "scale": 1.1},
                    walkRight: {"row": 1, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.8125, "scale": 1.1},
                    idle: {"row": 0, "frames": [0, 1, 2, 3, 4, 5, 6], "frameMs": 183.3333333333, "center": 0.5, "foot": 0.976},
                    jump: {"row": 4, "frames": [1, 2, 3], "frameMs": 100, "loop": false, "center": 0.5, "foot": 0.976},
                    fall: {"row": 4, "frames": [1, 2, 3], "frameMs": 125, "loop": false, "center": 0.5, "foot": 0.976},
                    drag: {"row": 5, "frames": [0, 1, 2, 6, 7], "frameMs": 116.6666666667, "center": 0.5, "foot": 0.976},
                    rest: {"row": 7, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 383.3333333333, "center": 0.5, "foot": 0.976},
                    sleep: {"row": 5, "frames": [4, 5], "frameMs": 500, "center": 0.5, "foot": 0.8173},
                    look: {"row": 9, "frames": [1, 2, 3, 4, 5, 6, 5, 4, 3, 2], "frameMs": 180, "center": 0.5391, "foot": 0.976},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
            "salary-cat": {
                rows: 9,
                origin: "feet",
                elasticity: 0.4,
                sleeping: false,
                clips: {
                    fall: {"row": 4, "frames": [2], "frameMs": 125, "center": 0.5, "foot": 0.875, "loop": false},
                    jump: {"row": 4, "frames": [2], "frameMs": 100, "center": 0.5, "foot": 0.875, "loop": false},
                    walkLeft: {"mirrorOf": "walkRight"},
                    walkRight: {"row": 4, "frames": [2], "frameMs": 180, "center": 0.5, "foot": 0.875, "tilt": 0.025, "bob": 0.018, "bobMs": 420},
                    idle: {"row": 8, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 183.3333333333, "center": 0.5, "foot": 0.9327},
                    drag: {"row": 5, "frames": [0, 1, 4, 5], "frameMs": 116.6666666667, "scale": 0.9, "center": 0.5, "foot": 0.9327},
                    rest: {"row": 6, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 350, "center": 0.5, "foot": 0.8413},
                    look: {"row": 8, "frames": [0, 1, 4, 5], "frameMs": 216.6666666667, "center": 0.5, "foot": 0.9327},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
            "kirby": {
                rows: 9,
                origin: "feet",
                elasticity: 0.7,
                sleeping: false,
                clips: {
                    idle: {"row": 0, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 183.3333333333, "center": 0.5, "foot": 0.899},
                    walkRight: {"row": 1, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.9567},
                    walkLeft: {"row": 2, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.5, "foot": 0.9567},
                    jump: {"row": 4, "frames": [1, 2, 3], "frameMs": 100, "loop": false, "center": 0.5, "foot": 0.899},
                    fall: {"row": 4, "frames": [1, 2, 3], "frameMs": 125, "loop": false, "center": 0.5, "foot": 0.899},
                    drag: {"row": 5, "frames": [0, 1, 5, 6, 7], "frameMs": 116.6666666667, "center": 0.5, "foot": 0.9087},
                    rest: {"row": 6, "frames": [2, 3, 4], "frameMs": 400, "center": 0.5, "foot": 0.8894},
                    sleep: {"row": 6, "frames": [3], "frameMs": 500, "center": 0.5, "foot": 0.8606},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
            "kirby_sleepy": {
                rows: 9,
                origin: "feet",
                elasticity: 0.4,
                sleeping: true,
                clips: {
                    idle: {"row": 0, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 183.3333333333, "center": 0.3854, "foot": 0.9423},
                    walkRight: {"row": 1, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.4167, "foot": 0.9471},
                    walkLeft: {"row": 2, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.4818, "foot": 0.9471},
                    jump: {"row": 4, "frames": [1, 2, 3], "frameMs": 100, "loop": false, "center": 0.4297, "foot": 0.9038},
                    fall: {"row": 4, "frames": [1, 2, 3], "frameMs": 125, "loop": false, "center": 0.4297, "foot": 0.9038},
                    drag: {"row": 5, "frames": [0, 1, 5, 6, 7], "frameMs": 116.6666666667, "center": 0.388, "foot": 0.9375},
                    rest: {"row": 5, "frames": [1, 2, 3, 4, 5], "frameMs": 400, "center": 0.388, "foot": 0.9375},
                    sleep: {"row": 5, "frames": [2, 3, 4], "frameMs": 516.6666666667, "center": 0.3906, "foot": 0.9375},
                    look: {"row": 6, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 200, "center": 0.4036, "foot": 0.9375},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
            "usagi": {
                rows: 9,
                origin: "feet",
                elasticity: 0.55,
                sleeping: false,
                clips: {
                    fall: {"row": 4, "frames": [1, 2, 3], "frameMs": 125, "center": 0.4974, "foot": 0.9327, "loop": false, "scale": 1.25, "frameAdjustments": {"1": {"foot": 0.8894}, "2": {"foot": 0.7356}, "3": {"foot": 0.9327}}},
                    jump: {"row": 4, "frames": [1, 2, 3], "frameMs": 100, "center": 0.4974, "foot": 0.9327, "loop": false, "scale": 1.25, "frameAdjustments": {"1": {"foot": 0.8894}, "2": {"foot": 0.7356}, "3": {"foot": 0.9327}}},
                    idle: {"row": 0, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 183.3333333333, "center": 0.4974, "foot": 0.9712},
                    walkRight: {"row": 1, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.4974, "foot": 0.9663},
                    walkLeft: {"row": 2, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 83.3333333333, "center": 0.4974, "foot": 0.9663},
                    drag: {"row": 5, "frames": [0, 1, 2, 4, 5, 6, 7], "frameMs": 116.6666666667, "center": 0.4974, "foot": 0.9663},
                    rest: {"row": 0, "frames": [1, 3], "frameMs": 350, "center": 0.4974, "foot": 0.9712},
                    look: {"row": 7, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 200, "center": 0.5, "foot": 0.9712},
                },
                fallback: {"sleep": "rest", "look": "idle", "rest": "idle", "jump": "fall", "fall": "idle", "walkRight": "idle", "walkLeft": "idle", "climb": "idle", "drag": "idle"}
            },
        };
        // Resolve mirror declarations once, never rebuild frame arrays during rendering.
        for (const profile of Object.values(spriteProfiles)) for (const [name, clip] of Object.entries(profile.clips || {})) {
            if (clip.mirrorOf) {
                const source = profile.clips[clip.mirrorOf];
                if (!source || source.mirrorOf) { delete profile.clips[name]; continue; }
                profile.clips[name] = { ...source, flip: !source.flip, mirrorOf: clip.mirrorOf };
            }
        }
        const spriteStates = ['idle', 'walkRight', 'walkLeft', 'fall', 'drag'];

        // Durations are milliseconds of stable autonomous time, never render frame counts.
        const activityProfiles = {
            sleepy: { roam: [1800,3500], idle: [1800,3200], rest: [6500,12000], look: [900,1800], restChance: .8, lookChance: .15, jump: .05, turn: .35 },
            calm: { roam: [2500,4500], idle: [1500,2500], rest: [4000,7500], look: [800,1500], restChance: .7, lookChance: .2, jump: .12, turn: .6 },
            normal: { roam: [2500,4500], idle: [1000,2200], rest: [3000,5500], look: [700,1400], restChance: .55, lookChance: .25, jump: .2, turn: .8 },
            lively: { roam: [3500,5500], idle: [800,1600], rest: [2000,4000], look: [600,1100], restChance: .5, lookChance: .3, jump: .25, turn: 1 },
            active: { roam: [4500,6500], idle: [600,1400], rest: [1000,2200], look: [500,1000], restChance: .45, lookChance: .35, jump: .3, turn: 1.2 },
            veryActive: { roam: [5000,7500], idle: [400,1000], rest: [800,1600], look: [400,900], restChance: .35, lookChance: .45, jump: .4, turn: 1.4 }
        };
        const activityById = { cat_brown: 'calm', cat_face: 'normal', cat_sleepy: 'sleepy',
            'salary-cat': 'calm', doge: 'active', puddle: 'normal', usagi: 'veryActive',
            kirby: 'lively', kirby_sleepy: 'sleepy', blob: 'normal' };
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
                        this.remove();
                        petInstances = petInstances.filter(pet => pet !== this);
                    };
                    document.body.appendChild(this.imgElement);
                    this.updateImagePosition();
                }
            }

            remove() {
                if (draggedPet === this) releaseDraggedPet();
                this.blackHoleOrbit = null;
                this.rescuedFromHoles.clear();
                this.externalMotion = null;
                this.motionCause = null;
                if (this.imgElement) this.imgElement.remove();
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

            beginImpact() {
                this.motionCause = 'bomb';
                this.externalMotion = { source: 'bomb', elapsedMs: 0, stableMs: 0 };
            }

            update(dt = 1) {
                // Small physics steps keep fast throws consistent across refresh rates.
                // Autonomous movement and ladder timing keep their existing update path.
                const steps = this.externalMotion ? Math.max(1, Math.ceil(dt / throwPhysics.maxStep)) : 1;
                for (let i = 0; i < steps; i++) this.updateStep(dt / steps);
                if (!this.isDragging) this.squish = 1 + (this.squish - 1) * Math.pow(.85, dt);
                this.advanceAnimation(dt * physicsFrameMs);
                this.updateImagePosition();
            }

            updateStep(dt) {
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
                const roaming = stableAutonomy && this.updateAutonomy(dt * physicsFrameMs);
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
                    this.x = this.size;
                    this.vx = externalMotion ? throwRebound(this.vx, motionPhysics.wallRestitution) : -this.vx;
                }
                if (this.x + this.size >= width) {
                    this.x = width - this.size;
                    this.vx = externalMotion ? throwRebound(this.vx, motionPhysics.wallRestitution) : -this.vx;
                }
                if (externalMotion && this.y < this.size && this.vy < 0) {
                    this.y = this.size;
                    this.vy = throwRebound(this.vy, motionPhysics.wallRestitution);
                }

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
                // Ignore resting gravity contact; cap strong landings without touching velocity.
                if (speed >= 6) this.autonomyHoldMs = Math.max(this.autonomyHoldMs, 300);
                const amount = Math.min(.4, Math.max(0, (speed - 2) * .018));
                this.squish = Math.max(this.squish, 1 + amount);
            }

            quietAutonomy() {
                return this.isAutonomouslyStill && !this.isDragging && !this.externalMotion
                    && !this.blackHoleOrbit && !this.climbing && Math.abs(this.vy) <= 1.5;
            }

            spriteClip() {
                const profile = this.definition.animation || spriteProfiles[this.definitionId] || {};
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
                const selected = this.spriteClip();
                if (!selected) return;
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
                    this.imgElement.style.transform = `scale(${flip * this.squish}, ${1 / this.squish})`;
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
                ctx.translate(this.x, this.y);
                const quiet = this.quietAutonomy();
                const looking = quiet && this.autonomy.state === 'look';
                const resting = quiet && this.autonomy.state === 'rest';
                const profile = this.definition.animation || spriteProfiles[this.definitionId] || {};
                const sleeping = resting && profile.sleeping;
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

        function addParticles(x, y, color, count, speed = 3) {
            // Cap generation as well as retained objects, even for oversized bursts.
            const budget = Number.isFinite(count) ? Math.min(160, Math.max(0, Math.floor(count))) : 0;
            for (let i = 0; i < budget; i++) {
                const angle = Math.random() * Math.PI * 2;
                const velocity = (0.5 + Math.random()) * speed;
                screenEffects.add('particle', {
                    x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
                    color, size: 1.5 + Math.random() * 2.5
                }, (18 + Math.random() * 14) * physicsFrameMs);
            }
        }

        function addRing(x, y, color, radius, life = 18) {
            screenEffects.add('ring', { x, y, color, radius }, life * physicsFrameMs);
        }

        function addImpact(x, y, color, life = 10) {
            screenEffects.add('impact', { x, y, color }, life * physicsFrameMs);
        }

        function fireBomb(x, y) {
            const radius = 61 + Math.random() * 10;
            screenEffects.add('crater', { x, y, radius,
                edge: Array.from({ length: 24 }, () => .78 + Math.random() * .42) }, 5000);
            addRing(x, y, 'rgba(255,105,42,.96)', 240, 38);
            addImpact(x, y, 'rgba(255,239,181,.98)', 25);
            addParticles(x, y, '#f28a53', 50, 8);
            body.classList.remove('shake-bomb');
            void body.offsetWidth;
            if (auxiliaryEffectsEnabled) body.classList.add('shake-bomb');
            for (const pet of petInstances) {
                if (pet.isDragging || pet.blackHoleOrbit) continue;
                const dx = pet.x - x, dy = pet.y - y;
                const distance = Math.hypot(dx, dy);
                if (distance >= 360) continue;
                const force = 17 * Math.pow(1 - distance / 360, 1.25);
                const angle = distance > 1 ? Math.atan2(dy, dx) : Math.random() * Math.PI * 2;
                pet.vx = Math.max(-19, Math.min(19, pet.vx + Math.cos(angle) * force));
                pet.vy = Math.max(-19, Math.min(19, pet.vy + Math.sin(angle) * force));
                pet.squish = 1.3;
                pet.interruptAutonomy(700);
                pet.beginImpact();
                pet.climbing = null; pet.climbingDown = false; pet.targetLadderId = null; pet.supportId = null;
            }
        }

        const blackHoleConsumeRadius = 22;
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
            if (blackHoles.length > 2) {
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
                for (const pet of petInstances) {
                    if (pet.isDragging || pet.absorbed) continue;
                    if (pet.blackHoleOrbit && pet.blackHoleOrbit.holeId !== hole.id) continue;
                    const dx = pet.x - hole.x, dy = pet.y - hole.y;
                    const distance = Math.hypot(dx, dy);
                    // Grab owns position. A rescued Pet must leave this hole before fresh capture.
                    if (pet.rescuedFromHoles.has(hole.id)) {
                        if (distance < hole.radius) continue;
                        pet.rescuedFromHoles.delete(hole.id);
                    }
                    if (!pet.blackHoleOrbit && distance < hole.radius) {
                        pet.blackHoleOrbit = { holeId: hole.id, angle: Math.atan2(dy, dx),
                            startRadius: Math.max(34, distance), turns: 0 };
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
            petInstances = petInstances.filter(pet => !pet.absorbed);
            blackHoles = blackHoles.filter(hole => hole.life > 0);
            pruneBlackHoleReferences();
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
            for (const hole of holes) {
                const alpha = Math.min(1, hole.remainingMs / (35 * physicsFrameMs));
                const gradient = ctx.createRadialGradient(hole.x, hole.y, 4, hole.x, hole.y, hole.radius * 1.45);
                gradient.addColorStop(0, `rgba(13,11,16,${alpha})`);
                gradient.addColorStop(.57, `rgba(34,16,17,${alpha * .94})`);
                gradient.addColorStop(.79, `rgba(239,77,31,${alpha * .8})`);
                gradient.addColorStop(1, 'rgba(255,138,48,0)');
                ctx.fillStyle = gradient;
                ctx.beginPath(); ctx.arc(hole.x, hole.y, hole.radius * 1.45, 0, Math.PI * 2); ctx.fill();
                ctx.strokeStyle = `rgba(255,103,45,${alpha * .88})`; ctx.lineWidth = 5;
                ctx.beginPath();
                for (let i = 0; i <= hole.edge.length; i++) {
                    const angle = i * Math.PI * 2 / hole.edge.length;
                    const radius = hole.radius * hole.edge[i % hole.edge.length];
                    const px = hole.x + Math.cos(angle) * radius, py = hole.y + Math.sin(angle) * radius;
                    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
                }
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
            for (const particle of particles) {
                if (auxiliaryEffectsEnabled) {
                    ctx.fillStyle = particle.color;
                    ctx.globalAlpha = Math.min(1, particle.remainingMs / (15 * physicsFrameMs));
                    ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
                    ctx.globalAlpha = 1;
                }
            }
            // Cracks are auxiliary visuals, never Draw geometry or Pet colliders.
            if (auxiliaryEffectsEnabled) for (const crack of screenEffects.groups.crack) {
                ctx.strokeStyle = 'rgba(90,75,105,.8)'; ctx.lineWidth = 1.5;
                ctx.globalAlpha = screenEffects.crackMode === 'accumulate' ? 1 : Math.min(1, crack.remainingMs / 500);
                for (const path of crack.paths) {
                    ctx.beginPath(); ctx.moveTo(crack.x + path[0].x, crack.y + path[0].y);
                    for (let i = 1; i < path.length; i++) ctx.lineTo(crack.x + path[i].x, crack.y + path[i].y);
                    ctx.stroke();
                }
                ctx.globalAlpha = 1;
            }
            screenEffects.update(elapsedMs, { width, height });
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

        function spawnPet(id, x, y) {
            const definition = petDefinitions.get(id);
            if (!definition || !definition.enabled) return null;
            const pet = new Pet(x, y, definition);
            petInstances.push(pet);
            return pet;
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
            petInstances = petInstances.filter(pet => {
                if (petDefinitions.get(pet.definitionId)?.enabled) return true;
                pet.remove();
                return false;
            });
            definitionsLoaded = true;
        }

        canvas.addEventListener('mousedown', (e) => {
            if (e.button === 2 && enabled && currentMode !== 'pc') {
                e.preventDefault();
                cancelInput();
                window.playground.setMode('pc');
                return;
            }
            if (!enabled || currentMode === 'pc' || e.button !== 0) return;
            pointerDown = true;
            mouseX = e.clientX; mouseY = e.clientY;

            if (currentMode === 'spawn') {
                spawnPet(selectedPetId, mouseX, mouseY);
            } else if (currentMode === 'bomb') {
                fireBomb(mouseX, mouseY);
            } else if (currentMode === 'blackhole') {
                addBlackHole(mouseX, mouseY);
            } else if (currentMode === 'draw') {
                beginDrawing(mouseX, mouseY);
            } else if (currentMode === 'touch') {
                for (let i = petInstances.length - 1; i >= 0; i--) {
                    const p = petInstances[i];
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

        window.addEventListener('mouseup', (e) => {
            pointerDown = false;
            activeStroke = null;
            if (draggedPet) {
                mouseX = e.clientX; mouseY = e.clientY;
                recordDragSample(e);
                draggedPet.x = mouseX + dragOffsetX;
                draggedPet.y = mouseY + dragOffsetY;
                if (inTrash(draggedPet.x, draggedPet.y)) {
                    const removedPet = draggedPet;
                    removedPet.remove();
                    petInstances = petInstances.filter(pet => pet !== removedPet);
                } else {
                    const { vx, vy } = dragThrowVelocity();
                    draggedPet.beginThrow(vx, vy);
                    draggedPet.isDragging = false;
                    draggedPet.squish = 1;
                    draggedPet.updateImagePosition();
                }
                draggedPet = null;
                dragSamples = [];
            }
        });
        window.addEventListener('contextmenu', event => {
            event.preventDefault();
            if (currentMode === 'pc') return;
            cancelInput();
            window.playground.setMode('pc');
        }, true);

        function animate(dt = 1, effectElapsedMs = dt * physicsFrameMs) {
            cleanupStructures();
            ctx.clearRect(0, 0, width, height);
            drawStructures();

            drawEffects(effectElapsedMs);
            ctx.drawImage(drawingCanvas, 0, 0);
            updateBlackHoles(dt);

            // 펫 업데이트 및 렌더링
            petInstances.forEach(pet => {
                pet.update(dt);
                pet.draw(ctx);
            });
            drawTrash();


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
            if (kind === 'drawing' || kind === 'all') {
                strokes = world.drawnShapes = [];
                world.drawnColliders = [];
                activeStroke = null;
                drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
            }
            if (kind === 'effects' || kind === 'all') {
                screenEffects.clear();
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
            }
        }

        function applyAppState(nextState) {
            if (!nextState || typeof nextState.enabled !== 'boolean') return;
            const changedMode = currentMode !== nextState.mode;
            enabled = nextState.enabled;
            auxiliaryEffectsEnabled = nextState.auxiliaryEffectsEnabled !== false;
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
            selectedPetId = nextState.petId || null;
            drawShape = nextState.drawShape || drawShape;
            drawColor = nextState.drawColor || drawColor;
            drawSize = nextState.drawSize || drawSize;
            eraser = Boolean(nextState.eraser);
            if (!enabled || changedMode) cancelInput();
            canvas.className = currentMode === 'pc' || currentMode === 'touch' ? 'cursor-pointer' : 'cursor-tool';
            if (enabled) startAnimation();
            else stopAnimation();
        }

        function cancelInput() {
            pointerDown = false;
            activeStroke = null;
            releaseDraggedPet();
        }

        window.playground.onState(applyAppState);
        window.playground.onClear(clearPlayground);
        window.playground.onPetDefinitions(applyPetDefinitions);
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
                    ['blob', width / 2, -100],
                    ['cat_brown', width / 2 - 90, -100],
                    ['doge', width / 2 - 170, -90],
                    ['kirby', width / 2 + 170, -130]
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
