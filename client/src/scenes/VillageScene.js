import * as THREE from 'three';

export class VillageScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.buildings = new Map();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.selectedBuilding = null;
    this.onBuildingClick = null;
    this.animationId = null;

    this.setupRenderer();
    this.setupCamera();
    this.setupLights();
    this.setupGround();
    this.setupEvents();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
  }

  setupCamera() {
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(25, 30, 25);
    this.camera.lookAt(0, 0, 0);

    // Simple orbit kontrolü
    this.isDragging = false;
    this.prevMouse = { x: 0, y: 0 };
    this.cameraAngle = Math.PI / 4;
    this.cameraHeight = 30;
    this.cameraDistance = 35;
  }

  setupLights() {
    // Ambient
    const ambient = new THREE.AmbientLight(0x6688cc, 0.4);
    this.scene.add(ambient);

    // Ana güneş ışığı
    this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.2);
    this.sunLight.position.set(20, 30, 10);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 80;
    this.sunLight.shadow.camera.left = -30;
    this.sunLight.shadow.camera.right = 30;
    this.sunLight.shadow.camera.top = 30;
    this.sunLight.shadow.camera.bottom = -30;
    this.scene.add(this.sunLight);

    // Fill light
    const fill = new THREE.DirectionalLight(0x88aaff, 0.3);
    fill.position.set(-10, 15, -10);
    this.scene.add(fill);

    // Hemisphere
    const hemi = new THREE.HemisphereLight(0x88bbff, 0x445522, 0.3);
    this.scene.add(hemi);

    // Gökyüzü
    this.scene.background = new THREE.Color(0x1a2a3a);
    this.scene.fog = new THREE.FogExp2(0x1a2a3a, 0.008);
  }

  setupGround() {
    // Ana zemin
    const groundGeom = new THREE.PlaneGeometry(80, 80, 40, 40);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a1e,
      roughness: 0.9,
      metalness: 0.0
    });

    // Zemine hafif yükseklik değişimi ver
    const positions = groundGeom.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      positions.setZ(i, Math.sin(x * 0.3) * Math.cos(y * 0.3) * 0.3);
    }
    groundGeom.computeVertexNormals();

    this.ground = new THREE.Mesh(groundGeom, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);

    // Dekoratif ağaçlar
    this.addTrees();

    // Grid overlay (subtle)
    const gridHelper = new THREE.GridHelper(80, 40, 0x335533, 0x223322);
    gridHelper.position.y = 0.01;
    gridHelper.material.opacity = 0.15;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  addTrees() {
    const treePositions = [
      [-25, -25], [-28, -15], [-30, 5], [-25, 20], [-15, 28],
      [25, -28], [28, -10], [30, 8], [25, 25], [15, 30],
      [-20, 30], [20, -30], [-32, -5], [32, 15], [-10, -32]
    ];

    treePositions.forEach(([x, z]) => {
      const tree = this.createTree();
      tree.position.set(x, 0, z);
      tree.rotation.y = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 0.6;
      tree.scale.set(s, s, s);
      this.scene.add(tree);
    });
  }

  createTree() {
    const group = new THREE.Group();

    // Gövde
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.25, 2, 6),
      new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 })
    );
    trunk.position.y = 1;
    trunk.castShadow = true;
    group.add(trunk);

    // Yapraklar (3 küre)
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x1a6b2a, roughness: 0.8 });
    [[0, 2.5, 0, 1.2], [0.5, 3, 0.3, 0.9], [-0.4, 3.2, -0.2, 0.8]].forEach(([x, y, z, r]) => {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(r, 7, 5), leafMat);
      leaf.position.set(x, y, z);
      leaf.castShadow = true;
      group.add(leaf);
    });

    return group;
  }

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.prevMouse = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;
        this.cameraAngle += dx * 0.005;
        this.cameraHeight = Math.max(10, Math.min(60, this.cameraHeight - dy * 0.1));
        this.prevMouse = { x: e.clientX, y: e.clientY };
        this.updateCamera();
      }

      // Hover
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    this.canvas.addEventListener('mouseup', () => { this.isDragging = false; });

    this.canvas.addEventListener('wheel', (e) => {
      this.cameraDistance = Math.max(15, Math.min(60, this.cameraDistance + e.deltaY * 0.03));
      this.updateCamera();
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.isDragging) return;
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.checkBuildingClick();
    });

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  updateCamera() {
    this.camera.position.x = Math.cos(this.cameraAngle) * this.cameraDistance;
    this.camera.position.z = Math.sin(this.cameraAngle) * this.cameraDistance;
    this.camera.position.y = this.cameraHeight;
    this.camera.lookAt(0, 0, 0);
  }

  checkBuildingClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = [];
    this.buildings.forEach(b => meshes.push(...b.children));
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj.parent && !obj.userData.buildingType) {
        obj = obj.parent;
      }
      if (obj.userData.buildingType) {
        this.selectBuilding(obj.userData.buildingType);
        this.onBuildingClick?.(obj.userData.buildingType);
      }
    }
  }

  selectBuilding(type) {
    // Eski seçimi kaldır
    if (this.selectedBuilding) {
      const old = this.buildings.get(this.selectedBuilding);
      if (old) old.traverse(c => { if (c.isMesh) c.material.emissive?.setHex(0x000000); });
    }
    this.selectedBuilding = type;
    const building = this.buildings.get(type);
    if (building) {
      building.traverse(c => {
        if (c.isMesh && c.material.emissive) c.material.emissive.setHex(0x332200);
      });
    }
  }

  // Köy binalarını oluştur/güncelle
  updateBuildings(villageBuildings) {
    const positions = this.getBuildingPositions();

    for (const [type, data] of Object.entries(villageBuildings)) {
      const pos = positions[type];
      if (!pos) continue;

      // Eski modeli kaldır
      if (this.buildings.has(type)) {
        this.scene.remove(this.buildings.get(type));
      }

      if (data.level <= 0) {
        // Boş arsa
        const placeholder = this.createPlaceholder(type);
        placeholder.position.set(pos.x, 0, pos.z);
        placeholder.userData.buildingType = type;
        this.scene.add(placeholder);
        this.buildings.set(type, placeholder);
      } else {
        const model = this.createBuildingModel(type, data.level);
        model.position.set(pos.x, 0, pos.z);
        model.userData.buildingType = type;
        this.scene.add(model);
        this.buildings.set(type, model);
      }
    }
  }

  getBuildingPositions() {
    return {
      townHall:    { x: 0, z: 0 },
      barracks:    { x: -6, z: -3 },
      stable:      { x: -6, z: 3 },
      workshop:    { x: -3, z: -6 },
      academy:     { x: 3, z: -6 },
      smithy:      { x: 6, z: -3 },
      rallyPoint:  { x: 6, z: 3 },
      market:      { x: 3, z: 6 },
      timberCamp:  { x: -10, z: -8 },
      clayPit:     { x: -10, z: 0 },
      ironMine:    { x: -10, z: 8 },
      farm:        { x: 10, z: -8 },
      warehouse:   { x: 10, z: 0 },
      wall:        { x: 0, z: 10 }
    };
  }

  createPlaceholder(type) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.1, 2.5),
      new THREE.MeshStandardMaterial({
        color: 0x333333, transparent: true, opacity: 0.4
      })
    );
    base.position.y = 0.05;

    // + İşareti
    const plus = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.3, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    plus.position.y = 0.25;
    const plus2 = plus.clone();
    plus2.rotation.y = Math.PI / 2;

    group.add(base, plus, plus2);
    group.userData.buildingType = type;
    return group;
  }

  createBuildingModel(type, level) {
    const builders = {
      townHall: this.buildTownHall,
      barracks: this.buildBarracks,
      stable: this.buildStable,
      workshop: this.buildWorkshop,
      academy: this.buildAcademy,
      smithy: this.buildSmithy,
      rallyPoint: this.buildRallyPoint,
      market: this.buildMarket,
      timberCamp: this.buildTimberCamp,
      clayPit: this.buildClayPit,
      ironMine: this.buildIronMine,
      farm: this.buildFarm,
      warehouse: this.buildWarehouse,
      wall: this.buildWall
    };

    const builder = builders[type];
    if (builder) return builder.call(this, level);
    return this.buildGeneric(level, 0x888888);
  }

  // ======== Bina Modelleri ========

  buildTownHall(level) {
    const group = new THREE.Group();
    const scale = 0.8 + level * 0.08;
    const height = 2 + level * 0.3;

    // Ana bina
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3 * scale, height, 2.5 * scale),
      new THREE.MeshStandardMaterial({ color: 0xc4a35a, roughness: 0.7 })
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Çatı
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.2 * scale, 1.5 + level * 0.1, 4),
      new THREE.MeshStandardMaterial({ color: 0x8B0000, roughness: 0.6 })
    );
    roof.position.y = height + 0.7;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Kapı
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 1.2, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x4a3520 })
    );
    door.position.set(0, 0.6, 1.26 * scale);
    group.add(door);

    // Bayrak (yüksek seviye)
    if (level >= 5) {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 2),
        new THREE.MeshStandardMaterial({ color: 0x666666 })
      );
      pole.position.set(1.2 * scale, height + 1.5, 0);
      group.add(pole);

      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 0.5),
        new THREE.MeshStandardMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
      );
      flag.position.set(1.6 * scale, height + 2, 0);
      group.add(flag);
    }

    group.userData.buildingType = 'townHall';
    return group;
  }

  buildBarracks(level) {
    const group = new THREE.Group();
    const s = 0.8 + level * 0.06;
    const h = 1.8 + level * 0.2;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3 * s, h, 2 * s),
      new THREE.MeshStandardMaterial({ color: 0x7a5c3a, roughness: 0.8 })
    );
    body.position.y = h / 2; body.castShadow = true;
    group.add(body);

    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(3.2 * s, 0.3, 2.4 * s),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
    );
    roof.position.y = h + 0.15;
    group.add(roof);

    // Silah rafı
    if (level >= 3) {
      const rack = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 1, 1.5 * s),
        new THREE.MeshStandardMaterial({ color: 0x555555 })
      );
      rack.position.set(1.51 * s, 0.8, 0);
      group.add(rack);
    }

    group.userData.buildingType = 'barracks';
    return group;
  }

  buildStable(level) {
    const group = new THREE.Group();
    const s = 0.8 + level * 0.06;
    const h = 1.5 + level * 0.15;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.5 * s, h, 2.5 * s),
      new THREE.MeshStandardMaterial({ color: 0x8B6914, roughness: 0.8 })
    );
    body.position.y = h / 2; body.castShadow = true;
    group.add(body);

    // Saman çatı
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(2.5 * s, 1.2, 4),
      new THREE.MeshStandardMaterial({ color: 0xBDA55D, roughness: 0.9 })
    );
    roof.position.y = h + 0.5; roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Çit
    for (let i = -1; i <= 1; i++) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.2),
        new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
      );
      post.position.set(i * 0.8, 0.6, 1.3 * s);
      group.add(post);
    }

    group.userData.buildingType = 'stable';
    return group;
  }

  buildWorkshop(level) {
    const group = new THREE.Group();
    const s = 0.8 + level * 0.07;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.5 * s, 2, 2.5 * s),
      new THREE.MeshStandardMaterial({ color: 0x5c5c5c, roughness: 0.7 })
    );
    body.position.y = 1; body.castShadow = true;
    group.add(body);

    // Baca
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.25, 1.5),
      new THREE.MeshStandardMaterial({ color: 0x444444 })
    );
    chimney.position.set(0.8 * s, 2.5, -0.5 * s);
    group.add(chimney);

    // Çatı
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(1.8 * s, 1, 4),
      new THREE.MeshStandardMaterial({ color: 0x4a4a4a })
    );
    roof.position.y = 2.5; roof.rotation.y = Math.PI / 4;
    group.add(roof);

    group.userData.buildingType = 'workshop';
    return group;
  }

  buildAcademy(level) {
    const group = new THREE.Group();
    const s = 0.9 + level * 0.2;

    // Büyük yapı
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3 * s, 3, 2.5 * s),
      new THREE.MeshStandardMaterial({ color: 0xd4c5a0, roughness: 0.6 })
    );
    body.position.y = 1.5; body.castShadow = true;
    group.add(body);

    // Sütunlar
    for (let i = -1; i <= 1; i++) {
      const col = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.15, 2.8),
        new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 })
      );
      col.position.set(i * 0.8, 1.4, 1.3 * s);
      group.add(col);
    }

    // Üçgen alınlık
    const pediment = new THREE.Mesh(
      new THREE.ConeGeometry(1.8 * s, 1, 3),
      new THREE.MeshStandardMaterial({ color: 0xe0d5b0 })
    );
    pediment.position.y = 3.5; pediment.rotation.y = Math.PI / 6;
    group.add(pediment);

    group.userData.buildingType = 'academy';
    return group;
  }

  buildSmithy(level) {
    const group = new THREE.Group();
    const s = 0.8 + level * 0.05;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.5 * s, 1.8, 2 * s),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8 })
    );
    body.position.y = 0.9; body.castShadow = true;
    group.add(body);

    // Örs
    const anvil = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.3, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
    );
    anvil.position.set(0, 0.15, 1.1 * s);
    group.add(anvil);

    // Baca
    const chimney = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.35, 2),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    chimney.position.set(-0.8 * s, 2.5, 0);
    group.add(chimney);

    group.userData.buildingType = 'smithy';
    return group;
  }

  buildRallyPoint(level) {
    const group = new THREE.Group();

    // Platform
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.8, 0.3, 8),
      new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.6 })
    );
    base.position.y = 0.15;
    group.add(base);

    // Bayrak direği
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 3.5),
      new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
    );
    pole.position.y = 1.75;
    group.add(pole);

    // Bayrak
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 0.7),
      new THREE.MeshStandardMaterial({ color: 0xcc2222, side: THREE.DoubleSide })
    );
    flag.position.set(0.5, 3.2, 0);
    group.add(flag);

    group.userData.buildingType = 'rallyPoint';
    return group;
  }

  buildMarket(level) {
    const group = new THREE.Group();
    const s = 0.8 + level * 0.04;

    // Tezgah
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3 * s, 0.4, 2 * s),
      new THREE.MeshStandardMaterial({ color: 0x8B6914 })
    );
    body.position.y = 1.0;
    group.add(body);

    // Bacaklar
    [[-1, -0.7], [1, -0.7], [-1, 0.7], [1, 0.7]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 1),
        new THREE.MeshStandardMaterial({ color: 0x5a3a1a })
      );
      leg.position.set(x * s, 0.5, z * s);
      group.add(leg);
    });

    // Tente
    const tent = new THREE.Mesh(
      new THREE.ConeGeometry(2 * s, 1.5, 4),
      new THREE.MeshStandardMaterial({ color: 0xcc8844, roughness: 0.7 })
    );
    tent.position.y = 2.5; tent.rotation.y = Math.PI / 4;
    group.add(tent);

    group.userData.buildingType = 'market';
    return group;
  }

  buildTimberCamp(level) {
    const group = new THREE.Group();
    const s = 0.7 + level * 0.04;

    // Kulübe
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2 * s, 1.2, 1.5 * s),
      new THREE.MeshStandardMaterial({ color: 0x6a4a2a })
    );
    body.position.y = 0.6; body.castShadow = true;
    group.add(body);

    // Kütükler
    for (let i = 0; i < Math.min(level, 5); i++) {
      const log = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x8B6914 })
      );
      log.rotation.z = Math.PI / 2;
      log.position.set(1.2 * s, 0.15 + i * 0.26, (Math.random() - 0.5) * 0.5);
      group.add(log);
    }

    group.userData.buildingType = 'timberCamp';
    return group;
  }

  buildClayPit(level) {
    const group = new THREE.Group();
    const s = 0.7 + level * 0.04;

    // Çukur
    const pit = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5 * s, 1.2 * s, 0.4, 8),
      new THREE.MeshStandardMaterial({ color: 0xC2703E, roughness: 0.95 })
    );
    pit.position.y = 0.2;
    group.add(pit);

    // Kulübe
    const hut = new THREE.Mesh(
      new THREE.BoxGeometry(1.2 * s, 1, 1 * s),
      new THREE.MeshStandardMaterial({ color: 0x7a5c3a })
    );
    hut.position.set(1.8 * s, 0.5, 0); hut.castShadow = true;
    group.add(hut);

    group.userData.buildingType = 'clayPit';
    return group;
  }

  buildIronMine(level) {
    const group = new THREE.Group();
    const s = 0.7 + level * 0.04;

    // Maden girişi
    const entrance = new THREE.Mesh(
      new THREE.BoxGeometry(1.5 * s, 1.5, 0.5 * s),
      new THREE.MeshStandardMaterial({ color: 0x555555 })
    );
    entrance.position.y = 0.75;
    group.add(entrance);

    // Karanlık giriş
    const hole = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 1, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x111111 })
    );
    hole.position.set(0, 0.5, 0.26 * s);
    group.add(hole);

    // Kayalar
    for (let i = 0; i < 3; i++) {
      const rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.4 + Math.random() * 0.3),
        new THREE.MeshStandardMaterial({ color: 0x71797E, roughness: 0.8 })
      );
      rock.position.set(
        -1 + Math.random() * 2, 0.2,
        0.8 + Math.random() * 0.5
      );
      group.add(rock);
    }

    group.userData.buildingType = 'ironMine';
    return group;
  }

  buildFarm(level) {
    const group = new THREE.Group();
    const s = 0.8 + level * 0.04;

    // Çiftlik binası
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2 * s, 1.2, 1.5 * s),
      new THREE.MeshStandardMaterial({ color: 0xa0522d })
    );
    body.position.y = 0.6; body.castShadow = true;
    group.add(body);

    // Tarlalar
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(3 * s, 2 * s),
      new THREE.MeshStandardMaterial({ color: 0x7cad3a, roughness: 0.95 })
    );
    field.rotation.x = -Math.PI / 2;
    field.position.set(0, 0.02, 2 * s);
    group.add(field);

    // Çit
    const fence = new THREE.Mesh(
      new THREE.BoxGeometry(3.2 * s, 0.5, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x8B6914 })
    );
    fence.position.set(0, 0.25, 3.1 * s);
    group.add(fence);

    group.userData.buildingType = 'farm';
    return group;
  }

  buildWarehouse(level) {
    const group = new THREE.Group();
    const s = 0.8 + level * 0.05;
    const h = 1.5 + level * 0.15;

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.5 * s, h, 2 * s),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5a, roughness: 0.7 })
    );
    body.position.y = h / 2; body.castShadow = true;
    group.add(body);

    // Büyük kapı
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, h * 0.7, 0.1),
      new THREE.MeshStandardMaterial({ color: 0x4a3520 })
    );
    door.position.set(0, h * 0.35, 1.01 * s);
    group.add(door);

    // Çatı
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(2.7 * s, 0.2, 2.3 * s),
      new THREE.MeshStandardMaterial({ color: 0x5a4a3a })
    );
    roof.position.y = h + 0.1;
    group.add(roof);

    group.userData.buildingType = 'warehouse';
    return group;
  }

  buildWall(level) {
    const group = new THREE.Group();
    const h = 1 + level * 0.15;

    // Sur duvarı (kavisli)
    for (let i = -5; i <= 5; i++) {
      const segment = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, h, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x8a8a7a, roughness: 0.8 })
      );
      segment.position.set(i * 1.7, h / 2, 0);
      segment.castShadow = true;
      group.add(segment);
    }

    // Kule (seviye 5+)
    if (level >= 5) {
      [[-5, 0], [5, 0]].forEach(([x, z]) => {
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.6, 0.7, h + 1, 8),
          new THREE.MeshStandardMaterial({ color: 0x7a7a6a })
        );
        tower.position.set(x * 1.7, (h + 1) / 2, z);
        tower.castShadow = true;
        group.add(tower);
      });
    }

    group.userData.buildingType = 'wall';
    return group;
  }

  buildGeneric(level, color) {
    const group = new THREE.Group();
    const s = 0.7 + level * 0.05;
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2 * s, 1.5, 2 * s),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7 })
    );
    body.position.y = 0.75;
    body.castShadow = true;
    group.add(body);
    return group;
  }

  // Animasyon döngüsü
  start() {
    const animate = () => {
      this.animationId = requestAnimationFrame(animate);
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  stop() {
    if (this.animationId) cancelAnimationFrame(this.animationId);
  }

  dispose() {
    this.stop();
    this.scene.clear();
    this.renderer.dispose();
  }
}
