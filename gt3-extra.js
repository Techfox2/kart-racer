/* Additional hand-authored GT3 meshes. Loads after gt3.js and extends window.KartGT3
   (cars, prices, valid, make) without editing gt3.js. No downloaded geometry, no brand logos;
   the shapes are stylised approximations, not official manufacturer assets. */
(() => {
 'use strict';
 const base = window.KartGT3;
 if (!base || base.extraLoaded) return;

 // Per-car parameters. Wheel positions, body length and driver position match gt3.js so physics,
 // cameras and first-person view behave the same for every GT3.
 const SPECS = {
  bmw: {
   name: 'BMW M4 GT3', price: 1800, caliper: 0x2f7fe8,
   w: .97, flare: .06, top: .81, fh: .14, hood: .05, rear: .02, roof: 1.37, cabinZ: -.20,
   nose: 'kidney', lights: 'split', tail: 'wrap', wing: { type: 'ped', y: 1.36, z: -1.81, chord: .56 },
   side: 'fender', hoodDetail: 'louver'
  },
  aston: {
   name: 'Aston Martin Vantage GT3', price: 2400, caliper: 0xe8c23a,
   w: .98, flare: .06, top: .80, fh: .15, hood: .12, rear: .00, roof: 1.33, cabinZ: -.42,
   nose: 'gape', lights: 'slit', tail: 'bar', wing: { type: 'ped', y: 1.31, z: -1.83, chord: .62 },
   side: 'strake', hoodDetail: 'vent'
  },
  audi: {
   name: 'Audi R8 LMS GT3', price: 2800, caliper: 0xe83e31,
   w: .975, flare: .055, top: .78, fh: .17, hood: .12, rear: .05, roof: 1.30, cabinZ: .02,
   nose: 'frame', lights: 'led', tail: 'bar', wing: { type: 'ped', y: 1.34, z: -1.80, chord: .56 },
   side: 'blade', hoodDetail: 'none'
  },
  lambo: {
   name: 'Lamborghini Hurac\u00e1n GT3 Evo2', price: 3400, caliper: 0xefe037,
   w: 1.0, flare: .06, top: .75, fh: .20, hood: .13, rear: .08, roof: 1.25, cabinZ: .14,
   nose: 'wedge', lights: 'wye', tail: 'hex', wing: { type: 'swan', y: 1.44, z: -1.84, chord: .60 },
   side: 'scoop', hoodDetail: 'vent'
  },
  mclaren: {
   name: 'McLaren 720S GT3', price: 3800, caliper: 0xff7a1a,
   w: .99, flare: .065, top: .76, fh: .19, hood: .15, rear: .07, roof: 1.27, cabinZ: .10,
   nose: 'dihedral', lights: 'eye', tail: 'strip', wing: { type: 'swan', y: 1.46, z: -1.86, chord: .62 },
   side: 'scoop', hoodDetail: 'scoop', roofScoop: true
  }
 };
 const IDS = Object.keys(SPECS);

 const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

 function build(color, wstyle, scene, id) {
  const s = SPECS[id], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
  const low = typeof PREF !== 'undefined' && PREF.quality === 'low', segments = low ? 16 : 28;
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .38, roughness: .25, clearcoat: low ? 0 : 1, clearcoatRoughness: .18 }),
   carbon = new THREE.MeshStandardMaterial({ color: 0x141b23, roughness: .62, metalness: .15 }),
   glass = new THREE.MeshPhysicalMaterial({ color: 0x153449, metalness: .35, roughness: .12, clearcoat: 1 }),
   rubber = new THREE.MeshStandardMaterial({ color: 0x111419, roughness: .96 }),
   rim = new THREE.MeshStandardMaterial({ color: 0xb7c1cd, metalness: .8, roughness: .24 }),
   rimDark = new THREE.MeshStandardMaterial({ color: 0x37424e, metalness: .7, roughness: .3 }),
   lights = new THREE.MeshStandardMaterial({ color: 0xe6f8ff, emissive: 0x9cdfff, emissiveIntensity: .7 }),
   tl = new THREE.MeshStandardMaterial({ color: 0xd52132, emissive: 0 }),
   caliper = new THREE.MeshStandardMaterial({ color: s.caliper, roughness: .4 });
  for(const m of [paint,carbon,glass,rubber,rim,rimDark,lights,tl,caliper]){m.color.convertSRGBToLinear();m.userData.authoredScenery=true}paint.userData.baseColor=color;paint.userData.livery='original';
  const parts = [];
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = false; parent.add(m); if (parent === body) parts.push(m); return m; };
  const box = (w, h, d, mat, x, y, z, parent) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, parent);
  const oval = (x, y, z, sx, sy, sz, mat) => { const m = add(new THREE.SphereGeometry(1, segments, 10), mat, x, y, z); m.scale.set(sx, sy, sz); return m; };
  const patch = (points, mat, parent = body) => { const positions = [], indices = []; points.forEach(p => positions.push(...p)); for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1); const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setIndex(indices); geo.computeVertexNormals(); const m = add(geo, mat, 0, 0, 0, parent); m.material.side = THREE.DoubleSide; return m; };
  const beam = (from, to, r, mat, parent = body) => { const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), m = add(new THREE.CylinderGeometry(r, r, a.distanceTo(b), 6), mat, ...a.clone().add(b).multiplyScalar(.5).toArray(), parent); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return m; };
  function loft(rings,mat){return add(KartVehicleGeometry.loft(THREE,rings),mat)}

  // Sculpted shoulder line. The wheel arches need body above them, so `top + fh` stays above the arch crown.
  const rings = [];
  for (let i = 0; i <= 64; i++) {
   const z = -2.08 + i * 4.16 / 64, ends = Math.pow(Math.abs(z) / 2.1, 7), arch = Math.min(Math.abs(z - 1.25), Math.abs(z + 1.27)), fender = Math.exp(-Math.pow(arch / .45, 2));
   const bottom = arch < .46 ? .37 + Math.sqrt(.46 * .46 - arch * arch) : .34;
   const width = s.w - ends * .17 + fender * s.flare;
   const top = Math.max(bottom + .06, s.top + fender * s.fh - ends * .14 + s.rear * smooth(-z, 0, 1.3) - s.hood * smooth(z, 1.3, 2.0));
   const cockpitFloor=z>s.cabinZ-.85&&z<s.cabinZ+.58?.46:top+.035;
   rings.push([[-width, bottom, z], [-width, Math.max(bottom + .025, top - .1), z], [-width * .86, top, z], [-width * .4, cockpitFloor, z], [width * .4, cockpitFloor, z], [width * .86, top, z], [width, Math.max(bottom + .025, top - .1), z], [width, bottom, z]]);
  }
  loft(rings, paint);
  box(1.52, .12, 3.65, carbon, 0, .32, 0); box(2.04, .055, .36, carbon, 0, .29, 1.98); box(1.95, .06, .31, carbon, 0, .3, -1.98);

  // Glasshouse and roof.
  const belt = s.top + .08, roof = s.roof, c0 = s.cabinZ;
  const back = c0 - 1.02, rz = c0 - .58, fz = c0 + .34, front = c0 + .90;
  const cabin = loft([
   [[-.79, belt, back], [-.62, belt + .09, back], [.62, belt + .09, back], [.79, belt, back]],
   [[-.76, belt, rz], [-.60, roof - .025, rz], [.60, roof - .025, rz], [.76, belt, rz]],
   [[-.75, belt, fz], [-.60, roof, fz], [.60, roof, fz], [.75, belt, fz]],
   [[-.78, belt - .02, front], [-.73, belt + .03, front], [.73, belt + .03, front], [.78, belt - .02, front]]], glass);
  const roofMesh = loft([
   [[-.61, roof - .035, rz - .09], [-.46, roof + .025, rz - .09], [.46, roof + .025, rz - .09], [.61, roof - .035, rz - .09]],
   [[-.61, roof - .005, fz + .035], [-.46, roof + .05, fz + .035], [.46, roof + .05, fz + .035], [.61, roof - .005, fz + .035]]], paint);
  if (s.roofScoop) { box(.34, .08, .62, carbon, 0, roof + .1, rz - .22); box(.26, .05, .3, rimDark, 0, roof + .145, rz - .08); }

  const mid = s.cabinZ > -.1, wg = s.wing; // cab-forward, mid-engine proportions
  for (const side of [-1, 1]) {
   // Pillars, window frames, mirrors and door shut lines.
   beam([side * .78, belt + .01, front], [side * .61, roof, fz], .035, paint); beam([side * .78, belt + .01, back], [side * .61, roof - .025, rz], .045, paint);
   beam([side * .76, belt + .02, c0 - .30], [side * .61, roof, c0 - .30], .022, carbon); beam([side * .77, belt, back], [side * .78, belt, front], .02, carbon);
   beam([side * .83, belt + .02, c0 + .65], [side * 1.06, belt + .15, c0 + .59], .025, carbon); oval(side * 1.10, belt + .155, c0 + .58, .13, .065, .19, paint);
   box(.075, .13, 1.54, carbon, side * 1.005, .34, 0); box(.012, .022, .24, rimDark, side * .981, s.top, c0 - .43);
   beam([side * .985, .41, c0 - .55], [side * .99, s.top, c0 - .55], .009, carbon); beam([side * .99, s.top, c0 - .55], [side * .99, s.top, c0 + .55], .009, carbon);
   for (const z of [1.25, -1.27]) { const curve = new THREE.CatmullRomCurve3(Array.from({ length: 19 }, (_, i) => { const angle = i * Math.PI / 18; return new THREE.Vector3(side * 1.022, .38 + Math.sin(angle) * .447, z + Math.cos(angle) * .447); })); add(new THREE.TubeGeometry(curve, 18, .018, 5, false), carbon); }

   // Front lamp signature (side-specific).
   const lz = 1.90, lx = side * .63, ly = s.top - Math.pow(lz / 2.1,7)*.14 - s.hood*smooth(lz,1.3,2.0) + .005;
   if (s.lights === 'split') { for (const dx of [.46, .78]) { oval(side * dx, ly + .02, lz + .02, .12, .03, .10, carbon); beam([side * (dx - .09), ly + .03, lz + .075], [side * (dx + .09), ly + .03, lz + .075], .017, lights); } }
   else if (s.lights === 'slit') { patch([[lx - side * .30, ly + .02, lz - .02], [lx + side * .26, ly + .04, lz - .08], [lx + side * .26, ly - .03, lz - .04], [lx - side * .28, ly - .06, lz + .02]], carbon); beam([lx - side * .26, ly, lz + .01], [lx + side * .22, ly + .015, lz - .05], .015, lights); }
   else if (s.lights === 'led') { patch([[lx - side * .26, ly + .02, lz - .03], [lx + side * .26, ly + .05, lz - .09], [lx + side * .22, ly - .05, lz - .02], [lx - side * .24, ly - .06, lz + .04]], carbon); for (let k = 0; k < 4; k++) beam([lx - side * (.22 - k * .12), ly + .02 - k * .003, lz + .02 - k * .02], [lx - side * (.10 - k * .12), ly + .025 - k * .003, lz - .01 - k * .02], .014, lights); }
   else if (s.lights === 'wye') { const y0 = ly + .015; patch([[lx - side * .30, y0 + .03, lz - .06], [lx + side * .30, y0 + .02, lz - .1], [lx + side * .26, y0 - .06, lz - .02], [lx - side * .26, y0 - .07, lz + .04]], carbon); beam([lx - side * .26, y0, lz + .01], [lx, y0 + .01, lz - .03], .02, lights); beam([lx, y0 + .01, lz - .03], [lx + side * .22, y0 + .035, lz - .07], .02, lights); beam([lx, y0 + .01, lz - .03], [lx + side * .1, y0 - .045, lz + .0], .02, lights); }
   else if (s.lights === 'eye') { oval(lx, ly + .01, lz - .02, .24, .045, .13, carbon).rotation.z = -side * .22; beam([lx - side * .2, ly - .02, lz + .06], [lx + side * .2, ly + .045, lz - .02], .02, lights); oval(lx - side * .1, ly - .005, lz + .03, .045, .028, .045, lights); }
   // Front corner intake.
   box(.35, .16, .075, carbon, side * .62, .49, 2.015); for (let j = 0; j < 3; j++) box(.30, .013, .025, rimDark, side * .62, .44 + j * .045, 2.058);

   // Brake lights.
   if (s.tail === 'bar') box(.78, .05, .04, tl, side * .46, s.top + .02, -2.065);
   else if (s.tail === 'wrap') { box(.62, .05, .04, tl, side * .56, s.top + .02, -2.07); box(.04, .06, .22, tl, side * .93, s.top + .02, -1.97); }
   else if (s.tail === 'hex') { for (const x of [.48, .76]) { const m = add(new THREE.CylinderGeometry(.075, .075, .04, 6), tl, side * x, s.top, -2.08); m.rotation.x = Math.PI / 2; } }
   else { box(.62, .028, .04, tl, side * .52, s.top + .03, -2.07); box(.50, .028, .04, tl, side * .56, s.top - .03, -2.07); }

   // Side details and air intakes.
   if (s.side === 'scoop') { patch([[side * 1.024, .43, c0 - .95], [side * 1.05, .78, c0 - 1.0], [side * 1.02, .72, c0 - .35], [side * 1.02, .47, c0 - .45]], carbon); beam([side * 1.03, .43, c0 - .95], [side * 1.02, .72, c0 - .35], .024, paint); }
   else if (s.side === 'blade') { box(.04, .30, .98, carbon, side * 1.045, .58, c0 - .62); box(.03, .05, .98, paint, side * 1.065, .72, c0 - .62); }
   else if (s.side === 'strake') { for (let k = 0; k < 3; k++) box(.03, .012, .30, carbon, side * 1.03, .52 + k * .05, 1.0 - k * .04); }
   else if (s.side === 'fender') { for (let k = 0; k < 4; k++) box(.03, .012, .20, carbon, side * 1.032, .62 + k * .045, 1.50 - k * .05); }

   // Rear wing supports and endplates.
   if (wg.type === 'swan') { beam([side * .65, s.top + .02, wg.z + .36], [side * .65, wg.y + .08, wg.z + .22], .035, carbon); beam([side * .65, wg.y + .08, wg.z + .22], [side * .65, wg.y + .08, wg.z - .06], .035, carbon); }
   else beam([side * .66, s.top + .03, wg.z + .32], [side * .66, wg.y + .07, wg.z - .0], .04, carbon);
   box(.035, .23, wg.chord + .04, carbon, side * 1.095, wg.y - .02, wg.z);
  }
  const wing = box(2.20, .065, wg.chord, carbon, 0, wg.y, wg.z); wing.rotation.x = -.10;

  // Nose, grille and splitter.
  if (s.nose === 'kidney') { for (const side of [-1, 1]) { box(.24, .27, .05, carbon, side * .16, s.top - .22, 2.07); for (let k = 0; k < 4; k++) box(.015, .24, .02, rimDark, side * (.08 + k * .055), s.top - .22, 2.10); } box(.04, .30, .06, carbon, 0, s.top - .22, 2.075); }
  else if (s.nose === 'gape') { box(1.05, .24, .06, carbon, 0, .52, 2.07); for (let x = -.46; x <= .47; x += .08) box(.012, .21, .02, rimDark, x, .52, 2.11); }
  else if (s.nose === 'frame') { patch([[-.34, .66, 2.05], [.34, .66, 2.05], [.27, .38, 2.07], [-.27, .38, 2.07]], carbon); for (let k = 0; k < 4; k++) box(.52 - k * .03, .012, .02, rimDark, 0, .44 + k * .05, 2.10); box(.64, .045, .03, rimDark, 0, .68, 2.08); }
  else if (s.nose === 'wedge') { patch([[-.5, .50, 2.06], [.5, .50, 2.06], [.30, .33, 2.09], [-.30, .33, 2.09]], carbon); for (let k = 0; k < 3; k++) box(.62 - k * .08, .012, .02, rimDark, 0, .39 + k * .045, 2.11); }
  else { box(.84, .20, .06, carbon, 0, .50, 2.075); box(.30, .04, .03, rimDark, -.28, .50, 2.12); box(.30, .04, .03, rimDark, .28, .50, 2.12); box(.04, .20, .03, rimDark, 0, .50, 2.12); }
  for (let x = -.7; x <= .7; x += .23) box(.025, .14, .36, carbon, x, .31, -2.02);

  // Bonnet detail and rear deck louvres.
  if (s.hoodDetail === 'louver') for (let k = 0; k < 4; k++) box(.42, .012, .035, carbon, 0, s.top + .02 - s.hood * smooth(1.3 + k * .15, 1.3, 2.0) + .0, 1.05 + k * .13);
  else if (s.hoodDetail === 'vent') for (const side of [-1, 1]) for (let k = 0; k < 3; k++) box(.20, .012, .03, carbon, side * .38, s.top - .01, 1.15 + k * .1);
  else if (s.hoodDetail === 'scoop') { box(.30, .05, .38, carbon, 0, s.top - .03, 1.15); box(.20, .02, .22, rimDark, 0, s.top - .005, 1.15); }
  if (mid) for (let k = 0; k < 5; k++) box(.78, .012, .04, carbon, 0, s.top + s.rear * smooth(1.2 + k * .11, 0, 1.3) + .045, -1.0 - k * .14);
  for (const side of [-1, 1]) { const x = side * (s.nose === 'kidney' ? .60 : .62); const pipe = add(new THREE.CylinderGeometry(.07, .07, .16, 14), rim, x, .42, -2.10); pipe.rotation.x = Math.PI / 2; const hole = add(new THREE.CylinderGeometry(.048, .048, .17, 12), carbon, x, .42, -2.11); hole.rotation.x = Math.PI / 2; }

  // Merge static details by material to keep seven-car grids inexpensive.
  const hide = [cabin, roofMesh], batches = new Map();
  for (const m of parts) { if (hide.includes(m)) continue; m.updateMatrix(); const geo = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); geo.applyMatrix4(m.matrix); const list = batches.get(m.material) || []; list.push(geo); batches.set(m.material, list); body.remove(m); m.geometry.dispose(); }
  for (const [mat, geos] of batches) { const p = [], n = []; for (const geo of geos) { p.push(...geo.attributes.position.array); n.push(...geo.attributes.normal.array); geo.dispose(); } const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = false; body.add(m); }

  // Wheels: identical placement and construction to gt3.js.
  const wheels = [], pivots = [];
  for (const [x, z, frontWheel] of [[-1.015, 1.25, 1], [1.015, 1.25, 1], [-1.025, -1.27, 0], [1.025, -1.27, 0]]) {
   const pivot = new THREE.Group(); pivot.position.set(x, .38, z); g.add(pivot); const wheel = new THREE.Group(); pivot.add(wheel); wheels.push(wheel); if (frontWheel) pivots.push(pivot); const sign = Math.sign(x);
   const tire = add(new THREE.CylinderGeometry(.375, .375, .27, segments), rubber, 0, 0, 0, wheel); tire.rotation.z = Math.PI / 2;
   const disc = add(new THREE.CylinderGeometry(.248, .248, .026, segments), rimDark, sign * .145, 0, 0, wheel); disc.rotation.z = Math.PI / 2;
   const lip = add(new THREE.TorusGeometry(.262, .018, 6, segments), rim, sign * .161, 0, 0, wheel); lip.rotation.y = Math.PI / 2;
   const spokeGeo = new THREE.BufferGeometry(), positions = [], normals = [];
   for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5, geo = new THREE.BoxGeometry(.027, .026, .23); geo.rotateX(a); geo.translate(sign * .166, -Math.sin(a) * .145, Math.cos(a) * .145); const flat = geo.toNonIndexed(); positions.push(...flat.attributes.position.array); normals.push(...flat.attributes.normal.array); geo.dispose(); flat.dispose(); }
   spokeGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); spokeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3)); add(spokeGeo, rim, 0, 0, 0, wheel);
   const cap = add(new THREE.CylinderGeometry(.067, .067, .035, 12), carbon, sign * .18, 0, 0, wheel); cap.rotation.z = Math.PI / 2; box(.035, .13, .06, caliper, sign * .135, .06, -.15, pivot);
  }
  const steerG = new THREE.Group(); steerG.position.set(-.34, 1.0, .25); steerG.add(makeWheel(wstyle)); steerG.scale.setScalar(.65); body.add(steerG);
  const driver = KartModels.driver(color); driver.scale.setScalar(.60); driver.position.set(-.34, .08, -.25); body.add(driver);
  g.rotation.order = 'YXZ'; g.userData = { vehicle: 'gt3', car: id, body, wheels, pivots, tl, steerG, fpHide: [driver, ...hide], modelRevision: 3 };
  scene.add(g); return g;
 }

 // Register: names, prices, validation and construction.
 const originalValid = base.valid.bind(base), originalMake = base.make;
 for (const id of IDS) { if (!base.cars.some(c => c[0] === id)) base.cars.push([id, SPECS[id].name]); base.prices[id] = SPECS[id].price; }
 base.extraIds = IDS.slice();
 base.valid = id => IDS.includes(id) ? id : originalValid(id);
 base.make = function (color, wstyle, scene, id) { return IDS.includes(id) ? build(color, wstyle, scene, id) : originalMake.call(this, color, wstyle, scene, id); };
 base.extraLoaded = true;
})();
