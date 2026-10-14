'use strict';
(function (root) {

// Standalone visual timeline. It never changes position, velocity, collider or assets.
const STATES = Object.freeze({
  idle: ['idle', 'loop'], look: ['look', 'loop'], walkRight: ['walkRight', 'loop'],
  walkLeft: ['walkLeft', 'loop'], rest: ['rest', 'loop'], sleep: ['sleep', 'hold'],
  wake: ['idle', 'once'], jumpPrepare: ['idle', 'once'], jumpRise: ['jump', 'once'],
  jumpApex: ['jump', 'hold'], fall: ['fall', 'hold'], land: ['idle', 'once'],
  grabStart: ['drag', 'once'], held: ['drag', 'loop'], release: ['idle', 'once'],
  thrown: ['fall', 'hold'], bounce: ['fall', 'once'], hit: ['drag', 'once'],
  stunned: ['drag', 'hold'], knockout: ['drag', 'hold'], climbUp: ['walkRight', 'loop'],
  climbDown: ['walkLeft', 'loop'], blackHoleOrbit: ['fall', 'loop']
});
const ONCE_MS = Object.freeze({wake: 180, jumpPrepare: 100, jumpRise: 260,
  land: 130, grabStart: 120, release: 120, bounce: 140, hit: 180});
const PRIORITY = Object.freeze({idle: 0, look: 0, walkRight: 0, walkLeft: 0,
  rest: 0, sleep: 0, wake: 1, jumpPrepare: 1, jumpRise: 2, jumpApex: 2,
  fall: 2, climbUp: 3, climbDown: 3, stunned: 4, thrown: 5,
  land: 6, bounce: 6, hit: 6, release: 6, knockout: 7, grabStart: 9, held: 9, blackHoleOrbit: 8});
const EVENTS = new Set(Object.keys(ONCE_MS));

function assertProfile(profile) {
  if (!profile || !Number.isInteger(profile.rows) || profile.rows < 1 ||
      !['feet', 'center'].includes(profile.origin) || !profile.clips || !profile.clips.idle) {
    throw new Error('Invalid animation profile header');
  }
  for (const [name, clip] of Object.entries(profile.clips)) {
    if (clip.mirrorOf) {
      const source = profile.clips[clip.mirrorOf];
      if (!source || source.mirrorOf || clip.flip !== true) throw new Error(`Invalid mirror: ${name}`);
      continue;
    }
    if (!Number.isInteger(clip.row) || clip.row < 0 || clip.row >= profile.rows ||
        !Array.isArray(clip.frames) || !clip.frames.length ||
        !clip.frames.every(n => Number.isInteger(n) && n >= 0 && n < 8) ||
        !Number.isFinite(clip.frameMs) || clip.frameMs <= 0) {
      throw new Error(`Invalid clip: ${name}`);
    }
    for (const key of ['center', 'foot', 'centerY']) {
      if (clip[key] !== undefined && (!Number.isFinite(clip[key]) || clip[key] < 0 || clip[key] > 1))
        throw new Error(`Invalid ${key}: ${name}`);
    }
    if (profile.origin === 'center' && !Number.isFinite(clip.centerY))
      throw new Error(`Missing centerY: ${name}`);
    if (clip.scale !== undefined && (!Number.isFinite(clip.scale) || clip.scale <= 0 || clip.scale > 4))
      throw new Error(`Invalid scale: ${name}`);
    if (clip.frameAdjustments) for (const [column, value] of Object.entries(clip.frameAdjustments)) {
      if (!/^[0-7]$/.test(column) || !value || typeof value !== 'object' ||
          Object.entries(value).some(([key, n]) => !['center','foot','centerY','scale','offsetX','offsetY'].includes(key) ||
            !Number.isFinite(n) || (key === 'scale' ? n <= 0 || n > 4 :
              key.startsWith('offset') ? Math.abs(n) > 0.5 : n < 0 || n > 1)))
        throw new Error(`Invalid frame adjustment: ${name}/${column}`);
    }
  }
  return profile;
}

function resolveClip(profile, state) {
  const shared = STATES[state]?.[0];
  if (!shared) throw new Error(`Unknown state: ${state}`);
  const desired = profile.clips[state] ? state : shared;
  const seen = new Set();
  let name = desired;
  while (name && !seen.has(name)) {
    seen.add(name);
    const raw = profile.clips[name];
    if (raw) {
      const source = raw.mirrorOf ? profile.clips[raw.mirrorOf] : raw;
      return {name, sourceName: raw.mirrorOf || name,
        clip: raw.mirrorOf ? {...source, ...raw, frames: source.frames, row: source.row,
          frameMs: source.frameMs, flip: !source.flip} : raw,
        fallback: name !== desired};
    }
    name = profile.fallback?.[name] || (name === 'idle' ? null : 'idle');
  }
  throw new Error(`No visual clip for ${state}`);
}

function baseState(input = {}) {
  if (input.held) return 'held';
  if (input.orbit) return 'blackHoleOrbit';
  if (input.knockout) return 'knockout';
  if (input.thrown) return 'thrown';
  if (input.stunned) return 'stunned';
  if (input.climbing) return input.climbing === 'down' ? 'climbDown' : 'climbUp';
  if (input.airborne) return input.vy < 0 ? 'jumpRise' :
    input.vy > 0 ? 'fall' : 'jumpApex';
  if (input.resting) return input.sleeping ? 'sleep' : 'rest';
  if (input.looking) return 'look';
  if (Math.abs(input.vx || 0) > 0.5) return input.vx < 0 ? 'walkLeft' : 'walkRight';
  return 'idle';
}

function createPlayer(profile) {
  assertProfile(profile);
  let state = 'idle', elapsedMs = 0;
  return {
    update(input = {}, deltaMs = 0) {
      if (!Number.isFinite(deltaMs) || deltaMs < 0) throw new Error('Invalid elapsed time');
      const base = baseState(input);
      const event = input.event;
      if (event !== undefined && !EVENTS.has(event)) throw new Error(`Unknown event: ${event}`);
      const pendingOnce = STATES[state][1] === 'once' && elapsedMs < (ONCE_MS[state] || 260);
      const candidate = event && PRIORITY[event] >= PRIORITY[base] ? event : base;
      const physicalTransition = (state === 'jumpRise' && base !== 'jumpRise')
        || (state === 'grabStart' && !input.held);
      if ((candidate !== state && (!pendingOnce || physicalTransition || PRIORITY[candidate] > PRIORITY[state]))
          || (event && candidate === event && candidate === state)) {
        state = candidate;
        elapsedMs = 0;
      }
      elapsedMs += deltaMs;
      if (STATES[state][1] === 'once' && elapsedMs >= (ONCE_MS[state] || 260) &&
          state !== base && PRIORITY[base] <= PRIORITY[state]) {
        elapsedMs -= ONCE_MS[state] || 260;
        state = base;
      }
      const selected = resolveClip(profile, state);
      // Preserve the audited rise/fall sequence instead of snapping from apex
      // back to the first fall cell. Held repeats authored expressions, sleep holds.
      const mode = state === 'held' && selected.clip.frames.length === 1 ? 'hold'
        : ['fall', 'thrown'].includes(state) && selected.clip.loop === false ? 'once' : STATES[state][1];
      const frames = selected.clip.frames;
      const index = mode === 'hold' ? (state === 'jumpApex' ? frames.length - 1 : 0) :
        mode === 'once' ? Math.min(Math.floor((elapsedMs + 1e-7) / selected.clip.frameMs), frames.length - 1) :
        Math.floor((elapsedMs + 1e-7) / selected.clip.frameMs) % frames.length;
      return {state, mode, requestedClip: STATES[state][0], clipName: selected.name,
        fallback: selected.fallback, row: selected.clip.row, column: frames[index],
        frameIndex: index, flip: !!selected.clip.flip, elapsedMs,
        clip: selected.clip};
    },
    reset() { state = 'idle'; elapsedMs = 0; },
    get state() { return state; }
  };
}

const api = {STATES, ONCE_MS, assertProfile, resolveClip, baseState, createPlayer};
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.PlaygroundPetAnimation = Object.freeze(api);
})(globalThis);
