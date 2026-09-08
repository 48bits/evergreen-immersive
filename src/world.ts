import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { stops, motion } from "./journey";
import type { Vec3 } from "./journey";

export interface World {
  setProgress: (from: number, to: number, progress: number) => void;
  setActive: (active: boolean) => void;
  resize: () => void;
  projectedDrift: (index: number) => { x: number; y: number };
  snapshot: (index: number) => string;
  metrics: () => {
    fps: number;
    calls: number;
    triangles: number;
    pixelRatio: number;
    mobile: boolean;
    renderedFrames: number;
    renderer: string;
  };
  dispose: () => void;
}

export async function createWorld(
  container: HTMLElement,
  onLoss: () => void,
): Promise<World> {
  let mobile = innerWidth <= 760;
  let compact = mobile || matchMedia("(pointer: coarse)").matches;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setClearColor("#F4F2EC");
  renderer.setPixelRatio(
    Math.min(
      devicePixelRatio,
      compact ? motion.mobile.pixelRatio : motion.desktop.pixelRatio,
    ),
  );
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  renderer.shadowMap.enabled = !compact;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.addEventListener("webglcontextlost", (event) => {
    event.preventDefault();
    onLoss();
  });
  container.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#F4F2EC");
  scene.fog = new THREE.Fog("#F4F2EC", 42, 100);
  const camera = new THREE.PerspectiveCamera(
    motion.fov,
    innerWidth / innerHeight,
    0.1,
    230,
  );
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.025);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.6;
  room.dispose();
  pmrem.dispose();
  scene.add(new THREE.HemisphereLight("#ffffff", "#a5aa91", 2.8));
  const sun = new THREE.DirectionalLight("#fffdf5", 4);
  sun.position.set(-18, 32, 16);
  sun.castShadow = !compact;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -60,
    right: 60,
    top: 45,
    bottom: -45,
    near: 0.5,
    far: 110,
  });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  const fill = new THREE.DirectionalLight("#dce7e5", 1.6);
  fill.position.set(10, 8, -10);
  scene.add(fill);

  const material = {
    ivory: new THREE.MeshStandardMaterial({
      color: "#e4e4d9",
      roughness: 0.64,
      metalness: 0.15,
    }),
    paper: new THREE.MeshStandardMaterial({ color: "#f4f2ec", roughness: 1 }),
    silver: new THREE.MeshStandardMaterial({
      color: "#bbc5bd",
      roughness: 0.24,
      metalness: 0.85,
    }),
    edge: new THREE.MeshStandardMaterial({
      color: "#83907e",
      roughness: 0.35,
      metalness: 0.75,
    }),
    green: new THREE.MeshStandardMaterial({
      color: "#45634c",
      roughness: 0.37,
      metalness: 0.55,
    }),
    dark: new THREE.MeshStandardMaterial({
      color: "#243b31",
      roughness: 0.3,
      metalness: 0.72,
    }),
    pale: new THREE.MeshStandardMaterial({
      color: "#c8d3b8",
      roughness: 0.52,
      metalness: 0.25,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: "#a6c5ad",
      metalness: 0.1,
      roughness: 0.18,
      transparent: true,
      opacity: compact ? 0.26 : 0.36,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    trace: new THREE.LineBasicMaterial({
      color: "#6d806b",
      transparent: true,
      opacity: 0.48,
    }),
    thin: new THREE.LineBasicMaterial({
      color: "#8b9881",
      transparent: true,
      opacity: 0.3,
    }),
  };
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, compact ? 24 : 48);
  const sphereGeo = new THREE.SphereGeometry(
    1,
    compact ? 12 : 20,
    compact ? 8 : 14,
  );
  const scratch = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  const groups: THREE.Group[] = [];
  const animated: { object: THREE.Object3D; y: number; phase: number }[] = [];
  const arms: THREE.Group[] = [];

  function box(
    parent: THREE.Object3D,
    size: Vec3,
    pos: Vec3,
    mat: THREE.Material = material.ivory,
  ) {
    const mesh = new THREE.Mesh(boxGeo, mat);
    mesh.scale.set(...size);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function cylinder(
    parent: THREE.Object3D,
    r: number,
    height: number,
    pos: Vec3,
    mat: THREE.Material = material.silver,
  ) {
    const mesh = new THREE.Mesh(cylinderGeo, mat);
    mesh.scale.set(r, height, r);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function sphere(
    parent: THREE.Object3D,
    r: number,
    pos: Vec3,
    mat: THREE.Material = material.green,
  ) {
    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.scale.setScalar(r);
    mesh.position.set(...pos);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function line(
    parent: THREE.Object3D,
    points: Vec3[],
    mat: THREE.Material = material.trace,
  ) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => new THREE.Vector3(...p)),
    );
    const mesh = new THREE.Line(geometry, mat);
    parent.add(mesh);
    return mesh;
  }
  function rod(
    parent: THREE.Object3D,
    a: Vec3,
    b: Vec3,
    r: number,
    mat: THREE.Material = material.silver,
  ) {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      delta = end.clone().sub(start);
    const mesh = cylinder(parent, r, delta.length(), [0, 0, 0], mat);
    mesh.position.copy(start).add(end).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(up, delta.normalize());
    return mesh;
  }
  function instances(
    parent: THREE.Object3D,
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    transforms: { p: Vec3; s: Vec3; r?: Vec3 }[],
  ) {
    const mesh = new THREE.InstancedMesh(geo, mat, transforms.length);
    transforms.forEach((t, i) => {
      scratch.position.set(...t.p);
      scratch.scale.set(...t.s);
      scratch.rotation.set(...(t.r || [0, 0, 0]));
      scratch.updateMatrix();
      mesh.setMatrixAt(i, scratch.matrix);
    });
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function ring(
    parent: THREE.Object3D,
    radius: number,
    y: number,
    mat = material.thin,
  ) {
    line(
      parent,
      Array.from(
        { length: 129 },
        (_, i) =>
          [
            Math.cos((i / 128) * Math.PI * 2) * radius,
            y,
            Math.sin((i / 128) * Math.PI * 2) * radius,
          ] as Vec3,
      ),
      mat,
    );
  }

  // Procedural contact shadows retain depth on devices where realtime shadows are disabled.
  const shadowCanvas = document.createElement("canvas");
  shadowCanvas.width = shadowCanvas.height = 128;
  const ctx = shadowCanvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 5, 64, 64, 64);
  gradient.addColorStop(0, "rgba(45,57,38,0.27)");
  gradient.addColorStop(0.5, "rgba(45,57,38,0.12)");
  gradient.addColorStop(1, "rgba(45,57,38,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 260),
    material.paper,
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);

  function platform(index: number, radius = 6) {
    const g = new THREE.Group();
    g.position.set(...stops[index].origin);
    scene.add(g);
    groups.push(g);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(19, 19),
      shadowMaterial,
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(1, -0.48, 1);
    g.add(shadow);
    cylinder(g, radius, 0.25, [0, -0.22, 0], material.ivory);
    cylinder(g, radius - 0.08, 0.035, [0, -0.08, 0], material.paper);
    ring(g, radius - 0.35, -0.052);
    ring(g, radius - 0.5, -0.051);
    for (let i = 0; i < 4; i++) {
      const theta = (i * Math.PI) / 2;
      const x = Math.cos(theta) * (radius - 0.8),
        z = Math.sin(theta) * (radius - 0.8);
      line(g, [
        [x - 0.12, 0, z],
        [x + 0.12, 0, z],
      ]);
      line(g, [
        [x, 0, z - 0.12],
        [x, 0, z + 0.12],
      ]);
    }
    return g;
  }

  function silicon(parent: THREE.Group, scale = 1) {
    const g = new THREE.Group();
    g.scale.setScalar(scale);
    parent.add(g);
    box(g, [6.2, 0.32, 6.2], [0, 0.2, 0], material.silver);
    box(g, [5.7, 0.14, 5.7], [0, 0.46, 0], material.dark);
    const pads: { p: Vec3; s: Vec3 }[] = [];
    for (let x = -11; x <= 11; x++)
      for (let z = -11; z <= 11; z++) {
        if (Math.abs(x) > 8 || Math.abs(z) > 8)
          pads.push({ p: [x * 0.23, 0.57, z * 0.23], s: [0.11, 0.08, 0.11] });
      }
    instances(g, boxGeo, material.silver, pads);
    const layers = [
      { y: 1.15, w: 4.8, m: material.green },
      { y: 2.0, w: 4.3, m: material.silver },
      { y: 2.85, w: 3.75, m: material.glass },
      { y: 3.65, w: 3.15, m: material.dark },
    ];
    layers.forEach((layer, n) => {
      const plate = new THREE.Group();
      plate.position.y = layer.y;
      g.add(plate);
      animated.push({ object: plate, y: layer.y, phase: n * 0.7 });
      box(plate, [layer.w, 0.17, layer.w], [0, 0, 0], layer.m);
      const detail: { p: Vec3; s: Vec3 }[] = [];
      for (let j = -8; j <= 8; j++) {
        const step = layer.w / 20;
        detail.push({
          p: [j * step, 0.12, layer.w / 2 + 0.06],
          s: [0.065, 0.1, 0.17],
        });
        detail.push({
          p: [j * step, 0.12, -layer.w / 2 - 0.06],
          s: [0.065, 0.1, 0.17],
        });
        detail.push({
          p: [layer.w / 2 + 0.06, 0.12, j * step],
          s: [0.17, 0.1, 0.065],
        });
        detail.push({
          p: [-layer.w / 2 - 0.06, 0.12, j * step],
          s: [0.17, 0.1, 0.065],
        });
      }
      instances(plate, boxGeo, material.edge, detail);
      for (let k = -3; k <= 3; k++) {
        const v = k * 0.33;
        line(
          plate,
          [
            [v, 0.1, -layer.w / 2 + 0.15],
            [v, 0.1, -0.6],
            [v + 0.15, 0.1, -0.35],
          ],
          material.thin,
        );
        line(
          plate,
          [
            [-layer.w / 2 + 0.15, 0.1, v],
            [-0.6, 0.1, v],
            [-0.35, 0.1, v + 0.15],
          ],
          material.thin,
        );
      }
      if (n === 3) {
        box(plate, [1.85, 0.09, 1.85], [0, 0.13, 0], material.green);
        const dies: { p: Vec3; s: Vec3 }[] = [];
        for (let x = -3; x <= 3; x++)
          for (let z = -3; z <= 3; z++)
            dies.push({ p: [x * 0.23, 0.2, z * 0.23], s: [0.2, 0.03, 0.2] });
        instances(plate, boxGeo, material.silver, dies);
      }
    });
    for (const x of [-2.5, 2.5])
      for (const z of [-2.5, 2.5]) {
        rod(g, [x, 0.6, z], [x, 3.5, z], 0.018, material.edge);
        cylinder(g, 0.07, 0.08, [x, 0.7, z], material.silver);
      }
    ring(g, 4.55, 0.05);
    ring(g, 4.6, 0.05);
    const ticks: Vec3[] = [];
    for (let i = 0; i < 100; i++) {
      const t = (i / 100) * Math.PI * 2;
      const r = i % 5 === 0 ? 4.8 : 4.69;
      ticks.push(
        [Math.cos(t) * 4.6, 0.06, Math.sin(t) * 4.6],
        [Math.cos(t) * r, 0.06, Math.sin(t) * r],
      );
    }
    g.add(
      new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(
          ticks.map((p) => new THREE.Vector3(...p)),
        ),
        material.thin,
      ),
    );
    return g;
  }
  silicon(platform(0));

  // Connected intelligence: an open lattice surrounding a suspended computation core.
  const network = platform(1);
  const positions: Vec3[] = [];
  for (let level = 0; level < 3; level++)
    for (let j = 0; j < 7; j++) {
      const theta = (j / 7) * Math.PI * 2 + level * 0.3;
      positions.push([
        Math.cos(theta) * (level === 1 ? 3.6 : 2.7),
        1 + level * 1.65,
        Math.sin(theta) * (level === 1 ? 3.6 : 2.7),
      ]);
    }
  instances(
    network,
    sphereGeo,
    material.silver,
    positions.map((p, i) => ({
      p,
      s: [
        i % 4 === 0 ? 0.22 : 0.12,
        i % 4 === 0 ? 0.22 : 0.12,
        i % 4 === 0 ? 0.22 : 0.12,
      ],
    })),
  );
  positions.forEach((p, i) => {
    line(network, [p, positions[Math.floor(i / 7) * 7 + ((i + 1) % 7)]]);
    if (i < 14) {
      line(network, [p, positions[i + 7]]);
      line(network, [p, positions[7 + ((i + 2) % 14)]], material.thin);
    }
  });
  const core = box(network, [1.5, 1.5, 1.5], [0, 2.75, 0], material.green);
  core.rotation.y = Math.PI / 4;
  animated.push({ object: core, y: 2.75, phase: 1 });
  const outer = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(2.2, 2.2, 2.2)),
    material.trace,
  );
  outer.position.y = 2.75;
  outer.rotation.y = Math.PI / 4;
  network.add(outer);
  cylinder(network, 1.5, 0.12, [0, 0.12, 0], material.silver);
  ring(network, 4.7, 0.02);

  // An articulated arm sits inside a sequence of open precision frames.
  const robotics = platform(2);
  const frames: { p: Vec3; s: Vec3 }[] = [];
  for (let z = -3; z <= 3; z += 1.5) {
    frames.push(
      { p: [-3.2, 2.7, z], s: [0.13, 5.4, 0.13] },
      { p: [3.2, 2.7, z], s: [0.13, 5.4, 0.13] },
      { p: [0, 5.4, z], s: [6.5, 0.13, 0.13] },
    );
  }
  instances(robotics, boxGeo, material.silver, frames);
  box(robotics, [6.4, 0.08, 5.8], [0, 5.5, 0], material.glass);
  box(robotics, [4.6, 0.24, 4.6], [0, 0.12, 0], material.silver);
  cylinder(robotics, 0.9, 0.35, [0, 0.42, 0], material.dark);
  cylinder(robotics, 0.63, 0.8, [0, 1, 0], material.silver);
  const arm = new THREE.Group();
  arm.position.y = 1.2;
  robotics.add(arm);
  arms.push(arm);
  const joints: Vec3[] = [
    [0, 0, 0],
    [-1.1, 1.75, 0],
    [1.05, 2.7, 0],
    [1.9, 1.9, 0],
  ];
  joints.forEach((p, i) => {
    sphere(
      arm,
      i === 0 ? 0.42 : 0.3,
      p,
      i % 2 === 0 ? material.green : material.silver,
    );
    if (i > 0) {
      rod(arm, joints[i - 1], p, i === 1 ? 0.3 : 0.23, material.ivory);
      rod(
        arm,
        [joints[i - 1][0], joints[i - 1][1], 0.29],
        [p[0], p[1], 0.29],
        0.075,
        material.silver,
      );
    }
  });
  rod(arm, [1.9, 1.9, 0], [1.9, 1.55, 0], 0.16, material.dark);
  for (const z of [-0.17, 0.17]) {
    rod(arm, [1.9, 1.55, 0], [2.05, 1.3, z], 0.055);
    rod(arm, [2.05, 1.3, z], [1.9, 1.1, z], 0.045);
  }
  box(robotics, [0.8, 0.55, 0.8], [1.9, 0.65, 0], material.green);

  const fund = platform(3);
  const towers: { p: Vec3; s: Vec3 }[] = [];
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) {
      const h = 1.2 + (Math.sin(x * 1.5 + z * 0.7) + 1) * 1.4;
      towers.push({ p: [x * 1.12, h / 2, z * 1.12], s: [0.76, h, 0.76] });
      box(
        fund,
        [0.85, 0.09, 0.85],
        [x * 1.12, h + 0.07, z * 1.12],
        material.green,
      );
    }
  instances(fund, boxGeo, material.silver, towers);
  box(fund, [6.8, 0.1, 6.8], [0, 4.8, 0], material.glass);
  for (const x of [-3.2, 3.2])
    for (const z of [-3.2, 3.2]) rod(fund, [x, 0, z], [x, 4.8, z], 0.035);
  ring(fund, 4.9, 0.04);

  // A reconstructed world: terrain sampled into a mesh and an instanced city.
  function terrain(parent: THREE.Group, size: number, count: number) {
    const geo = new THREE.PlaneGeometry(size, size, count, count);
    geo.rotateX(-Math.PI / 2);
    const vertices = geo.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i),
        z = vertices.getZ(i);
      vertices.setY(
        i,
        0.2 + Math.max(0, Math.sin(x * 0.7) * Math.cos(z * 0.65) * 0.8),
      );
    }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, material.pale);
    mesh.receiveShadow = true;
    parent.add(mesh);
    const wire = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: "#607b56",
        wireframe: true,
        transparent: true,
        opacity: 0.15,
      }),
    );
    wire.position.y = 0.012;
    parent.add(wire);
  }
  const city = platform(4);
  terrain(city, 8, compact ? 16 : 28);
  const buildings: { p: Vec3; s: Vec3 }[] = [];
  for (let x = -3; x <= 3; x++)
    for (let z = -3; z <= 3; z++) {
      if ((x + z) % 3 === 0) continue;
      const h = 0.35 + (Math.sin(x * 7 + z * 3) + 1) * 0.95;
      buildings.push({
        p: [x * 0.95, 0.7 + h / 2, z * 0.95],
        s: [0.4, h, 0.5],
      });
    }
  instances(city, boxGeo, material.silver, buildings);
  const scan = box(city, [8, 0.025, 8], [0, 3.45, 0], material.glass);
  animated.push({ object: scan, y: 3.45, phase: 2 });
  for (let i = 0; i < 5; i++)
    line(
      city,
      [
        [-4, 3.47, i * 1.6 - 3.2],
        [4, 3.47, i * 1.6 - 3.2],
      ],
      material.thin,
    );
  for (const x of [-4, 4])
    for (const z of [-4, 4])
      line(
        city,
        [
          [x, 0.2, z],
          [x, 4.2, z],
        ],
        material.thin,
      );

  // Repeated energy structures are a metaphor for continuity, not an investment claim.
  const energy = platform(5);
  const cells: { p: Vec3; s: Vec3 }[] = [];
  for (let x = -2; x <= 2; x++)
    for (let z = -1; z <= 1; z++) {
      const h = 1.8 + (x + 2) * 0.38;
      cells.push({ p: [x * 1.25, h / 2 + 0.2, z * 1.5], s: [0.38, h, 0.38] });
      cylinder(
        energy,
        0.4,
        0.07,
        [x * 1.25, h + 0.22, z * 1.5],
        material.green,
      );
    }
  instances(energy, cylinderGeo, material.silver, cells);
  box(energy, [6.6, 0.2, 4.8], [0, 0.1, 0], material.dark);
  box(energy, [6.4, 3.9, 0.06], [0, 2, -2.2], material.glass);
  for (let i = 0; i < 3; i++) {
    const panel = box(
      energy,
      [1.6, 0.1, 2],
      [i * 1.8 - 1.8, 0.6, 3.1],
      material.green,
    );
    panel.rotation.x = -0.4;
  }

  const pavilion = platform(6, 6.5);
  terrain(pavilion, 9, compact ? 14 : 22);
  cylinder(pavilion, 3.5, 0.2, [0, 0.85, 0], material.silver);
  cylinder(pavilion, 3.25, 0.1, [0, 0.98, 0], material.paper);
  const columns: { p: Vec3; s: Vec3 }[] = [];
  for (let i = 0; i < 18; i++) {
    const theta = (i / 18) * Math.PI * 2;
    columns.push({
      p: [Math.cos(theta) * 3, 2.4, Math.sin(theta) * 3],
      s: [0.06, 2.8, 0.06],
    });
  }
  instances(pavilion, cylinderGeo, material.silver, columns);
  cylinder(pavilion, 3.65, 0.12, [0, 3.9, 0], material.silver);
  cylinder(pavilion, 3.4, 0.04, [0, 3.99, 0], material.glass);
  cylinder(pavilion, 1.4, 0.14, [0, 1.9, 0], material.green);
  cylinder(pavilion, 0.55, 0.8, [0, 1.4, 0], material.silver);
  ring(pavilion, 4.9, 1.0);

  // Architectural paths physically connect every chapter in one landscape.
  const routeMarkers: { p: Vec3; s: Vec3 }[] = [];
  for (let i = 0; i < 6; i++) {
    const a = new THREE.Vector3(...stops[i].origin),
      b = new THREE.Vector3(...stops[i + 1].origin);
    const direction = b.clone().sub(a).normalize();
    a.addScaledVector(direction, 5.8);
    b.addScaledVector(direction, -5.8);
    const midpoint = a.clone().add(b).multiplyScalar(0.5),
      length = a.distanceTo(b);
    const bridge = box(
      scene,
      [length, 0.07, 0.85],
      [midpoint.x, -0.16, midpoint.z],
      material.ivory,
    );
    bridge.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    line(
      scene,
      [
        [a.x, -0.1, a.z],
        [b.x, -0.1, b.z],
      ],
      material.thin,
    );
    const side = new THREE.Vector3(-direction.z, 0, direction.x);
    for (const sign of [-1, 1]) {
      const edgeA = a.clone().addScaledVector(side, sign * 0.7);
      const edgeB = b.clone().addScaledVector(side, sign * 0.7);
      line(
        scene,
        [
          [edgeA.x, -0.1, edgeA.z],
          [edgeB.x, -0.1, edgeB.z],
        ],
        material.thin,
      );
      for (let step = 0; step < length; step += 1.2) {
        const point = edgeA.clone().addScaledVector(direction, step);
        routeMarkers.push({
          p: [point.x, 0.03, point.z],
          s: [0.09, 0.24, 0.09],
        });
      }
    }
  }
  instances(scene, boxGeo, material.edge, routeMarkers);

  let from = 0,
    to = 0,
    progress = 0,
    active = false,
    disposed = false;
  let pointerX = 0,
    pointerY = 0,
    lastFrame = 0,
    renderedFrames = 0;
  let measuredFrames = 0,
    fps = 0,
    sampleStart = performance.now();
  const posA = new THREE.Vector3(),
    posB = new THREE.Vector3(),
    targetA = new THREE.Vector3(),
    targetB = new THREE.Vector3();
  const target = new THREE.Vector3(),
    projected = new THREE.Vector3();
  const debug = renderer.getContext().getExtension("WEBGL_debug_renderer_info");
  const rendererName = debug
    ? String(renderer.getContext().getParameter(debug.UNMASKED_RENDERER_WEBGL))
    : "WebGL 2";

  function pose(
    index: number,
    position: THREE.Vector3,
    look: THREE.Vector3,
    illustration = false,
  ) {
    const stop = stops[index];
    if (illustration) {
      position.set(
        ...(index === 7 ? ([58, 52, 72] as Vec3) : ([12, 11, 18] as Vec3)),
      );
      look.set(
        ...(index === 7 ? ([12, 0, -13] as Vec3) : ([0, 1.8, 0] as Vec3)),
      );
    } else if (mobile) {
      position.set(...(stop.mobileCamera || [20, 20, 33]));
      look.set(...(stop.mobileTarget || [0, -6.5, 0]));
    } else {
      position.set(...stop.camera);
      look.set(...stop.target);
    }
    position.add(new THREE.Vector3(...stop.origin));
    look.add(new THREE.Vector3(...stop.origin));
  }
  function applyCamera() {
    pose(from, posA, targetA);
    pose(to, posB, targetB);
    camera.position.lerpVectors(posA, posB, progress);
    target.lerpVectors(targetA, targetB, progress);
    // Rise and turn through the connected world, then settle at the next reading stop.
    // The entire path is reversible and is determined only by native scroll position.
    if (from !== to) {
      const arc = stops[from].departureArc || [0, 4, 5];
      const strength =
        Math.sin(progress * Math.PI) * (mobile ? motion.mobileTravelScale : 1);
      camera.position.x += arc[0] * strength;
      camera.position.y += arc[1] * strength;
      camera.position.z += arc[2] * strength;
    }
    if (!compact && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      camera.position.x += pointerX * motion.pointerAmount;
      camera.position.y += pointerY * motion.pointerAmount;
    }
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const overview = from === 7 || to === 7;
    const overviewProgress = from === 7 ? 1 : to === 7 ? progress : 0;
    (scene.fog as THREE.Fog).near = THREE.MathUtils.lerp(
      42,
      85,
      overviewProgress,
    );
    (scene.fog as THREE.Fog).far = THREE.MathUtils.lerp(
      100,
      180,
      overviewProgress,
    );
    groups.forEach((g, i) => {
      g.visible =
        overview ||
        i === from ||
        i === to ||
        (!mobile && g.position.distanceTo(target) < 29);
    });
  }
  function render(time: number) {
    if (!active || document.hidden || disposed) return;
    const frameDuration =
      1000 / (compact ? motion.mobile.fps : motion.desktop.fps);
    if (time - lastFrame < frameDuration - 1) return;
    lastFrame = time;
    applyCamera();
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      animated.forEach(({ object, y, phase }) => {
        object.position.y = y + Math.sin(time * 0.00055 + phase) * 0.045;
      });
      arms.forEach((arm) => {
        arm.rotation.y = Math.sin(time * 0.00018) * 0.06;
      });
    }
    renderer.render(scene, camera);
    renderedFrames++;
    measuredFrames++;
    if (time - sampleStart > 2000) {
      fps = (measuredFrames * 1000) / (time - sampleStart);
      sampleStart = time;
      measuredFrames = 0;
    }
  }
  const pointerHandler = (event: PointerEvent) => {
    pointerX = event.clientX / innerWidth - 0.5;
    pointerY = event.clientY / innerHeight - 0.5;
  };
  window.addEventListener("pointermove", pointerHandler, { passive: true });
  const visibilityHandler = () => {
    lastFrame = 0;
    sampleStart = performance.now();
    measuredFrames = 0;
    renderer.setAnimationLoop(document.hidden || !active ? null : render);
  };
  document.addEventListener("visibilitychange", visibilityHandler);
  applyCamera();
  await renderer.compileAsync(scene, camera);
  renderer.shadowMap.needsUpdate = true;
  renderer.render(scene, camera);

  return {
    setProgress(a, b, t) {
      from = a;
      to = b;
      progress = t;
    },
    setActive(value) {
      active = value;
      visibilityHandler();
    },
    resize() {
      mobile = innerWidth <= 760;
      compact = mobile || matchMedia("(pointer: coarse)").matches;
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(
        Math.min(
          devicePixelRatio,
          compact ? motion.mobile.pixelRatio : motion.desktop.pixelRatio,
        ),
      );
      renderer.setSize(innerWidth, innerHeight);
      applyCamera();
    },
    projectedDrift(index) {
      pose(index, posA, targetA);
      projected.copy(targetA).project(camera);
      return {
        x: THREE.MathUtils.clamp(projected.x * innerWidth * 0.025, -30, 30),
        y: THREE.MathUtils.clamp(-projected.y * innerHeight * 0.02, -20, 20),
      };
    },
    snapshot(index) {
      const size = renderer.getSize(new THREE.Vector2()),
        ratio = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(1200, 1000);
      camera.aspect = 1.2;
      camera.updateProjectionMatrix();
      pose(index, posA, targetA, true);
      camera.position.copy(posA);
      camera.lookAt(targetA);
      groups.forEach((g, i) => {
        g.visible = index === 7 || i === index;
      });
      (scene.fog as THREE.Fog).near = index === 7 ? 95 : 42;
      (scene.fog as THREE.Fog).far = index === 7 ? 190 : 100;
      renderer.render(scene, camera);
      const result = renderer.domElement.toDataURL("image/webp", 0.88);
      renderer.setPixelRatio(ratio);
      renderer.setSize(size.x, size.y);
      camera.aspect = size.x / size.y;
      camera.updateProjectionMatrix();
      applyCamera();
      return result;
    },
    metrics: () => ({
      fps: Math.round(fps * 10) / 10,
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      pixelRatio: renderer.getPixelRatio(),
      mobile: compact,
      renderedFrames,
      renderer: rendererName,
    }),
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      window.removeEventListener("pointermove", pointerHandler);
      document.removeEventListener("visibilitychange", visibilityHandler);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          geometries.add(object.geometry);
          (Array.isArray(object.material)
            ? object.material
            : [object.material]
          ).forEach((m) => materials.add(m));
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      shadowTexture.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
