const fs = require('node:fs');
const path = require('node:path');

// Folder names are stable app IDs; pet.json IDs belong to the source packages.
const LOCAL_PETS = [
  { id: 'cat_brown', sourceId: 'sanqian', category: 'cat', label: 'Brown' },
  { id: 'cat_face', sourceId: 'hami--tat', category: 'cat', label: 'Face' },
  { id: 'cat_sleepy', sourceId: 'diandian--lllucasxu', category: 'cat', label: 'Sleepy' },
  { id: 'salary-cat', sourceId: 'monthly-salary-cat', category: 'cat', label: 'Salary' },
  { id: 'doge', sourceId: 'doge', category: 'dog', label: '시바' },
  { id: 'puddle', sourceId: 'tudou', category: 'dog', label: '푸들' },
  { id: 'kirby', sourceId: 'kirby', category: 'character', label: '커비' },
  { id: 'kirby_sleepy', sourceId: 'haaap', category: 'character', label: '커비(잠)' },
  { id: 'usagi', sourceId: 'usachi--jack', category: 'character', label: '우사기' }
];
const LOCAL_PET_IDS = LOCAL_PETS.map(pet => pet.id);

function webpSize(file) {
  const header = Buffer.alloc(30);
  const fd = fs.openSync(file, 'r');
  try { fs.readSync(fd, header, 0, header.length, 0); }
  finally { fs.closeSync(fd); }
  if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WEBP'
    || header.readUInt32LE(4) + 8 !== fs.statSync(file).size) return { width: 0, height: 0 };
  const format = header.toString('ascii', 12, 16);
  if (format === 'VP8L' && header[20] === 0x2f) {
    const bits = header.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (format === 'VP8X') return {
    width: 1 + header.readUIntLE(24, 3), height: 1 + header.readUIntLE(27, 3)
  };
  return { width: 0, height: 0 };
}

function loadLocalPets(root, readImageSize = webpSize) {
  const pets = [];
  for (const pet of LOCAL_PETS) {
    const { id } = pet;
    try {
      const directory = path.join(root, id);
      const data = JSON.parse(fs.readFileSync(path.join(directory, 'pet.json'), 'utf8'));
      if (data.id !== pet.sourceId || data.spritesheetPath !== 'spritesheet.webp'
        || typeof data.displayName !== 'string' || !data.displayName.trim()) continue;
      const sheet = path.join(directory, data.spritesheetPath);
      const stat = fs.statSync(sheet);
      if (!stat.isFile() || stat.size < 100 || stat.size > 10 * 1024 * 1024) continue;
      const size = readImageSize(sheet);
      if (size.width !== 1536 || ![1872, 2288].includes(size.height)) continue;
      pets.push({ id, name: data.displayName.trim().slice(0, 32),
        category: pet.category, label: pet.label,
        asset: `assets/pets/${id}/spritesheet.webp`, columns: 8,
        rows: size.height === 1872 ? 9 : 11 });
    } catch (error) {
      console.warn(`Skipping invalid local Pet package ${id}:`, error.message);
    }
  }
  return pets;
}

module.exports = { LOCAL_PET_IDS, LOCAL_PETS, loadLocalPets, webpSize };
