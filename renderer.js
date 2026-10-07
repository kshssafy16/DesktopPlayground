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
        function cleanupStructures(now = world.now()) {
            if (!structuresEnabled) return;
            if (now - world.lastCleanupAt < 5000) return;
            world.lastCleanupAt = now;
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

        let enabled = false;
        let currentMode = 'pc';
        let selectedPetId = null;
        let drawColor = '#30384c';
        let drawSize = 7;
        let drawShape = 'freehand';
        let eraser = false;
        let animationFrame = null;
        let petInstances = [];
        let particles = [];
        let rings = [];
        let impacts = [];
        let holes = [];
        let blackHoles = [];
        let strokes = world.drawnShapes;
        let activeStroke = null;
        let pointerDown = false;

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
                this.squish = 1;
                this.facingRight = true;

                this.frame = 0;
                this.tick = 0;
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
                if (this.imgElement) this.imgElement.remove();
            }

            update(dt = 1) {
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
                this.visitedLevels.add(verticalZone(this.y));
                if (this.climbing && structuresEnabled) {
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
                if (grounded) {
                    if (supportingPlatform) supportingPlatform.lastUsedAt = now;
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
                } else if (this.supportId !== null && !this.climbing) {
                    this.targetLadderId = null;
                }
                for (const other of petInstances) {
                    if (other === this || other.isDragging) continue;
                    const dx = this.x - other.x, dy = this.y - other.y;
                    const distance = Math.hypot(dx, dy);
                    const desired = (this.size + other.size) * .76;
                    if (distance >= desired) continue;
                    const direction = distance > .01 ? dx / distance : (this.instanceId < other.instanceId ? -1 : 1);
                    this.vx += direction * .32 * (1 - distance / desired) * dt;
                }
                this.vx = Math.max(-18, Math.min(18, this.vx));
                this.vy += this.gravity * dt;
                if (behavior.airSteer && Math.abs(this.vy) > 1.5) this.vx += (this.facingRight ? behavior.airSteer : -behavior.airSteer) * dt;
                const previousX = this.x, previousY = this.y;
                this.x += this.vx * dt;
                this.y += this.vy * dt;
                this.vx *= Math.pow(this.friction, dt);
                collideDrawnWalls(this, previousX, previousY);

                if (this.vx > 0.1) this.facingRight = true;
                else if (this.vx < -0.1) this.facingRight = false;

                // 하강 중 발이 플랫폼 상단을 통과할 때만 착지한다.
                let landed = null;
                if (this.vy >= 0) {
                    for (const platform of structuresEnabled ? world.structures : []) {
                        if (platform.type !== 'platform' || previousFoot > platform.y + 3
                            || this.y + this.size < platform.y || this.x + this.size * .5 <= platform.x
                            || this.x - this.size * .5 >= platform.x + platform.width) continue;
                        if (!landed || platform.y < landed.y) landed = platform;
                    }
                    const drawing = drawnLandingAt(this, previousFoot);
                    if (drawing && (!landed || drawing.y < landed.y)) landed = drawing;
                }
                if (landed) {
                    this.y = landed.y - this.size;
                    this.vy = 0;
                    this.supportId = landed.id;
                    if (!this.targetLadderId && this.exploreX === null && now >= this.ladderCooldownUntil
                        && Math.random() < behavior.turnChance * dt) {
                        this.vx = (Math.random() - .5) * behavior.moveSpeed;
                    }
                } else this.supportId = null;
                if (landed && now >= this.ladderCooldownUntil && Math.random() < behavior.jumpChance * dt) {
                    this.vy = -behavior.jumpSpeed - Math.random() * 4;
                }
                // 바닥 충돌
                if (this.y + this.size >= height) {
                    this.y = height - this.size;
                    this.vy *= this.bounce;

                    // 강하게 부딪히면 찌그러짐
                    if (Math.abs(this.vy) > 2) this.squish = 1.4;

                    // 바닥에서 무작위 이동 (가끔 점프)
                    if (Math.abs(this.vy) < 1.5) {
                        if (Math.random() < behavior.turnChance * dt && !this.targetLadderId && this.exploreX === null) {
                            this.vx = (Math.random() - 0.5) * behavior.moveSpeed;
                            this.squish = 0.8;
                        }
                        if (Math.random() < behavior.jumpChance * dt && !this.targetLadderId) {
                            this.vy = -behavior.jumpSpeed - Math.random() * 6;
                            this.squish = 0.6;
                        }
                    }
                    this.supportId = null;
                }

                // 양옆 벽 충돌
                if (this.x - this.size <= 0) {
                    this.x = this.size;
                    this.vx *= -1;
                }
                if (this.x + this.size >= width) {
                    this.x = width - this.size;
                    this.vx *= -1;
                }

                // 모양 원래대로 복구
                this.squish += (1 - this.squish) * 0.15;

                this.updateImagePosition();
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

            draw(ctx) {
                ctx.save();
                ctx.translate(this.x, this.y);

                if (this.definition.renderKind === 'sprite') {
                    const image = this.definition.asset;
                    if (image.complete && image.naturalWidth > 0) {
                        const clips = this.definition.clips;
                        const clip = this.isDragging ? clips.drag
                            : Math.abs(this.vy) > 1.5 ? clips.fall
                            : Math.abs(this.vx) > .5 ? (this.facingRight ? clips.walkRight : clips.walkLeft) : clips.idle;
                        // Rows 1 and 2 are already right/left facing on both sheets.
                        this.frame %= clip.frames;
                        this.tick++;
                        if (this.tick > clip.speed) { this.tick = 0; this.frame = (this.frame + 1) % clip.frames; }
                        const fw = image.naturalWidth / 8;
                        const fh = image.naturalHeight / (this.definition.rows || 11);
                        const renderSize = this.size * 2.5;
                        const offsetY = this.definitionId === 'magpie' ? 15 : 10;
                        ctx.drawImage(image, this.frame * fw, clip.row * fh, fw, fh,
                            -renderSize / 2, -renderSize / 2 - offsetY, renderSize, renderSize);
                    }
                } else if (['basic', 'ghost', 'star', 'cloud'].includes(this.definition.renderKind)) {
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
                    const ex = Math.max(-2, Math.min(2, this.vx * 1.5));
                    const ey = Math.max(-2, Math.min(2, this.vy * 0.5));
                    ctx.beginPath(); ctx.arc(-this.size/3 + ex, -this.size/6 + ey, this.size/7, 0, Math.PI*2); ctx.fill();
                    ctx.beginPath(); ctx.arc(this.size/3 + ex, -this.size/6 + ey, this.size/7, 0, Math.PI*2); ctx.fill();

                    // 입 모양
                    ctx.strokeStyle = '#2D3748';
                    ctx.lineWidth = 2.5;
                    ctx.lineCap = 'round';
                    if(this.isDragging) {
                        // 잡혔을 때 벌린 입
                        ctx.beginPath(); ctx.arc(0, this.size/4, this.size/6, 0, Math.PI, true); ctx.stroke();
                        // 땀방울
                        ctx.fillStyle = '#63B3ED';
                        ctx.beginPath(); ctx.arc(this.size/2, -this.size/1.2, 5, 0, Math.PI*2); ctx.fill();
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
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const velocity = (0.5 + Math.random()) * speed;
                particles.push({
                    x, y, vx: Math.cos(angle) * velocity, vy: Math.sin(angle) * velocity,
                    color, size: 1.5 + Math.random() * 2.5, life: 18 + Math.random() * 14
                });
            }
            if (particles.length > 160) particles.splice(0, particles.length - 160);
        }

        function addRing(x, y, color, radius, life = 18) {
            rings.push({ x, y, color, radius, life, maxLife: life });
            if (rings.length > 24) rings.shift();
        }

        function addImpact(x, y, color, life = 10) {
            impacts.push({ x, y, color, life, maxLife: life });
            if (impacts.length > 24) impacts.shift();
        }

        function fireBomb(x, y) {
            const radius = 61 + Math.random() * 10;
            holes.push({ x, y, radius, life: 300, maxLife: 300,
                edge: Array.from({ length: 24 }, () => .78 + Math.random() * .42) });
            if (holes.length > 8) holes.shift();
            addRing(x, y, 'rgba(255,105,42,.96)', 240, 38);
            addImpact(x, y, 'rgba(255,239,181,.98)', 25);
            addParticles(x, y, '#f28a53', 50, 8);
            body.classList.remove('shake-bomb');
            void body.offsetWidth;
            body.classList.add('shake-bomb');
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
            }
        }

        const blackHoleConsumeRadius = 22;
        let nextBlackHoleId = 1;
        function addBlackHole(x, y) {
            blackHoles.push({ id: nextBlackHoleId++, x, y, radius: 190, life: 540, angle: 0 });
            if (blackHoles.length > 2) {
                const removed = blackHoles.shift();
                for (const pet of petInstances) if (pet.blackHoleOrbit?.holeId === removed.id) pet.blackHoleOrbit = null;
            }
        }

        function updateBlackHoles(dt = 1) {
            for (const hole of blackHoles) {
                hole.life -= dt;
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
                    if (pet.isDragging) continue;
                    if (pet.blackHoleOrbit && pet.blackHoleOrbit.holeId !== hole.id) continue;
                    const dx = pet.x - hole.x, dy = pet.y - hole.y;
                    const distance = Math.hypot(dx, dy);
                    if (!pet.blackHoleOrbit && distance < hole.radius) {
                        pet.blackHoleOrbit = { holeId: hole.id, angle: Math.atan2(dy, dx),
                            startRadius: Math.max(34, distance), turns: 0 };
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
            for (const pet of petInstances) {
                if (pet.blackHoleOrbit && !blackHoles.some(hole => hole.id === pet.blackHoleOrbit.holeId && hole.life > 0)) pet.blackHoleOrbit = null;
            }
            blackHoles = blackHoles.filter(hole => hole.life > 0);
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
            const kept = strokes.filter(shape => !shapeSegments(shape).some(segment =>
                distanceToSegment(x, y, segment) <= radius));
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

        function drawEffects() {
            for (const hole of holes) {
                const alpha = Math.min(1, hole.life / 35);
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
                hole.life--;
            }
            holes = holes.filter(hole => hole.life > 0);
            for (const ring of rings) {
                const progress = 1 - ring.life / ring.maxLife;
                ctx.strokeStyle = ring.color;
                ctx.globalAlpha = Math.max(0, ring.life / ring.maxLife);
                ctx.lineWidth = 3 + (1 - progress) * 4;
                ctx.beginPath(); ctx.arc(ring.x, ring.y, Math.max(1, ring.radius * progress), 0, Math.PI * 2); ctx.stroke();
                ctx.globalAlpha = 1;
                ring.life--;
            }
            rings = rings.filter(ring => ring.life > 0);
            for (const impact of impacts) {
                ctx.fillStyle = impact.color;
                ctx.globalAlpha = impact.life / impact.maxLife;
                ctx.beginPath(); ctx.arc(impact.x, impact.y, 5 + (impact.maxLife - impact.life) * 2, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                impact.life--;
            }
            impacts = impacts.filter(impact => impact.life > 0);
            for (const particle of particles) {
                ctx.fillStyle = particle.color;
                ctx.globalAlpha = Math.min(1, particle.life / 15);
                ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
                ctx.globalAlpha = 1;
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.vy += .09;
                particle.life--;
            }
            particles = particles.filter(particle => particle.life > 0);
        }

        let draggedPet = null;
        let mouseX = 0, mouseY = 0, lastMouseX = 0, lastMouseY = 0;

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
                    clips: sheetClips, rows: entry.rows, defaultSize: entry.id.startsWith('kirby') ? 34 : 39,
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
            lastMouseX = mouseX; lastMouseY = mouseY;

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
                        p.climbing = null; p.targetLadderId = null; p.supportId = null;
                        p.isDragging = true;
                        p.squish = 1.4; // 잡힐 때 길어짐
                        p.vy = 0; p.vx = 0;
                        break;
                    }
                }
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            lastMouseX = mouseX; lastMouseY = mouseY;
            mouseX = e.clientX; mouseY = e.clientY;

            if (draggedPet) {
                draggedPet.x = mouseX;
                draggedPet.y = mouseY;
                draggedPet.updateImagePosition();
            }
            if (pointerDown && currentMode === 'draw' && (activeStroke || eraser)) extendDrawing(mouseX, mouseY);
        });

        window.addEventListener('mouseup', () => {
            pointerDown = false;
            activeStroke = null;
            if (draggedPet) {
                if (inTrash(draggedPet.x, draggedPet.y)) {
                    draggedPet.remove();
                    petInstances = petInstances.filter(pet => pet !== draggedPet);
                } else {
                    // 마우스 던지는 속도 반영
                    draggedPet.vx = (mouseX - lastMouseX) * 0.9;
                    draggedPet.vy = (mouseY - lastMouseY) * 0.9;
                    draggedPet.isDragging = false;
                    draggedPet.squish = 1;
                }
                draggedPet = null;
            }
        });
        window.addEventListener('contextmenu', event => {
            event.preventDefault();
            if (currentMode === 'pc') return;
            cancelInput();
            window.playground.setMode('pc');
        }, true);

        function animate(dt = 1) {
            cleanupStructures();
            ctx.clearRect(0, 0, width, height);
            drawStructures();

            drawEffects();
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
                const dt = previousTime === null ? 1 : Math.max(.25, Math.min(3, (now - previousTime) / 16.667));
                previousTime = now;
                animate(dt);
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
                holes = [];
                blackHoles = [];
                particles = [];
                rings = [];
                impacts = [];
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
