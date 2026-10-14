// Screen-only effects: no Pet, input, physics, DOM or animation dependencies.
(function (root) {
    'use strict';
    const frameMs = 1000 / 60;
    const limits = Object.freeze({ particle: 160, ring: 24, impact: 24, crater: 8, crack: 64, hammer: 12, damage: 40, bullet: 24, shot: 24, grenade: 24 });
    class ScreenEffects {
        constructor() {
            this.groups = Object.fromEntries(Object.keys(limits).map(kind => [kind, []]));
            this.crackMode = 'auto';
        }
        add(kind, data, durationMs) {
            const group = Object.hasOwn(this.groups, kind) ? this.groups[kind] : null;
            if (!group || !data || !Number.isFinite(data.x) || !Number.isFinite(data.y)
                || !Number.isFinite(durationMs) || durationMs <= 0) return null;
            if (kind === 'particle' && (!Number.isFinite(data.vx) || !Number.isFinite(data.vy))) return null;
            if ((kind === 'bullet' || kind === 'grenade') && (!Number.isFinite(data.vx) || !Number.isFinite(data.vy))) return null;
            // A live grenade must reach its fuse; unlike visual effects it cannot be evicted.
            if (kind === 'grenade' && group.length >= limits.grenade) return null;
            const effect = { ...data, durationMs, remainingMs: durationMs };
            if (group.length >= limits[kind]) group.splice(0, group.length - limits[kind] + 1);
            group.push(effect);
            return effect;
        }
        addCrack(x, y, radius = 45) {
            if (!Number.isFinite(radius) || radius <= 0) return null;
            radius = Math.min(radius, 200);
            // A small broken center, a chipped inner ring and short kinked glass fractures.
            const point = (angle, distance) => ({ x: Math.cos(angle) * distance, y: Math.sin(angle) * distance });
            const core = Array.from({ length: 9 }, (_, i) => point(i * Math.PI * 2 / 9,
                radius * (.075 + Math.random() * .05)));
            const inner = Array.from({ length: 9 }, (_, i) => point(i * Math.PI * 2 / 9,
                radius * (.19 + Math.random() * .1)));
            const paths = [[...inner, inner[0]]];
            for (let i = 0; i < 8; i++) {
                const angle = i * Math.PI / 4 + (Math.random() - .5) * .28;
                const length = radius * (.58 + Math.random() * .38);
                const spoke = [inner[i], point(angle + (Math.random() - .5) * .25, length * .53),
                    point(angle + (Math.random() - .5) * .3, length * .78), point(angle, length)];
                paths.push(spoke);
                if (i % 2 === 0) {
                    const forkAngle = angle + (i % 4 === 0 ? .75 : -.75);
                    paths.push([spoke[2], point(forkAngle, length * .81), point(forkAngle, length * .94)]);
                }
            }
            const shards = Array.from({ length: 5 }, (_, i) => [core[i], inner[i], inner[i + 1]]);
            // 9 inner edges + 8*3 spokes + 4*2 forks = 41 bounded segments.
            return this.add('crack', { x, y, paths, core, shards }, 5000);
        }
        setCrackMode(mode) {
            if (!['auto', 'accumulate'].includes(mode)) return false;
            if (mode === this.crackMode) return true;
            this.crackMode = mode;
            // Returning to auto gives retained cracks one full recovery interval.
            if (mode === 'auto') for (const crack of this.groups.crack) crack.remainingMs = crack.durationMs;
            return true;
        }
        clear(kind) {
            if (kind === undefined) {
                for (const group of Object.values(this.groups)) group.length = 0;
            } else if (Object.hasOwn(this.groups, kind)) this.groups[kind].length = 0;
        }
        update(elapsedMs, viewport) {
            if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;
            const dt = elapsedMs / frameMs;
            for (const [kind, group] of Object.entries(this.groups)) {
                // Projectile fuse/removal belongs to updateGrenades, which detonates first.
                if (kind === 'grenade') continue;
                let write = 0;
                for (const effect of group) {
                    if (kind !== 'crack' || this.crackMode !== 'accumulate') effect.remainingMs -= elapsedMs;
                    if (effect.remainingMs <= 1e-7) continue;
                    if (kind === 'particle') {
                        // Closed-form extension of the original 60Hz explicit Euler step.
                        const gravity = effect.shape === 'glass' ? .22 : .09;
                        effect.x += effect.vx * dt;
                        effect.y += effect.vy * dt + gravity * dt * (dt - 1) / 2;
                        effect.vy += gravity * dt;
                        if (!Number.isFinite(effect.x) || !Number.isFinite(effect.y)
                            || (viewport && (effect.x < -32 || effect.y < -32
                                || effect.x > viewport.width + 32 || effect.y > viewport.height + 32))) continue;
                    }
                    group[write++] = effect;
                }
                group.length = write;
            }
        }
    }
    root.PlaygroundScreenEffects = Object.freeze({ ScreenEffects, limits, frameMs });
    if (typeof module !== 'undefined' && module.exports) module.exports = root.PlaygroundScreenEffects;
})(globalThis);
