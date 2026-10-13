// Screen-only effects: no Pet, input, physics, DOM or animation dependencies.
(function (root) {
    'use strict';
    const frameMs = 1000 / 60;
    const limits = Object.freeze({ particle: 160, ring: 24, impact: 24, crater: 8, crack: 64 });
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
            const effect = { ...data, durationMs, remainingMs: durationMs };
            if (group.length >= limits[kind]) group.splice(0, group.length - limits[kind] + 1);
            group.push(effect);
            return effect;
        }
        addCrack(x, y, radius = 45) {
            if (!Number.isFinite(radius) || radius <= 0) return null;
            radius = Math.min(radius, 200);
            // Geometry is generated once, bounded at 18 segments per crack.
            const paths = Array.from({ length: 6 }, (_, i) => {
                const angle = i * Math.PI / 3 + (Math.random() - .5) * .3;
                return Array.from({ length: 4 }, (_, j) => {
                    const a = angle + (j ? (Math.random() - .5) * .35 : 0);
                    return { x: Math.cos(a) * radius * j / 3, y: Math.sin(a) * radius * j / 3 };
                });
            });
            return this.add('crack', { x, y, paths }, 5000);
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
                let write = 0;
                for (const effect of group) {
                    if (kind !== 'crack' || this.crackMode !== 'accumulate') effect.remainingMs -= elapsedMs;
                    if (effect.remainingMs <= 1e-7) continue;
                    if (kind === 'particle') {
                        // Closed-form extension of the original 60Hz explicit Euler step.
                        effect.x += effect.vx * dt;
                        effect.y += effect.vy * dt + .09 * dt * (dt - 1) / 2;
                        effect.vy += .09 * dt;
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
