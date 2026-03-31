import * as THREE from 'three';

export class WorldMapScene {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.villageMeshes = new Map();
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.onVillageClick = null;
    this.animationId = null;
    this.chunkSize = 20;
    this.loadedChunks = new Set();

    this.setupRenderer();
    this.setupCamera();
    this.setupLights();
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
    this.renderer.shadowMap.enabled = false; // Performans
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  }

  setupCamera() {
    this.camera = new THREE.OrthographicCamera(
      -30, 30, 20, -20, 0.1, 1000
    );
    this.camera.position.set(0, 50, 0);
    this.camera.lookAt(0, 0, 0);
    this.camera.zoom = 1;

    this.cameraTarget = new THREE.Vector3(0, 0, 0);
    this.isDragging = false;
    this.prevMouse = { x: 0, y: 0 };
  }

  setupLights() {
    this.scene.background = new THREE.Color(0x1a3320);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xffeedd, 0.8);
    sun.position.set(30, 50, 20);
    this.scene.add(sun);
  }

  setupEvents() {
    this.canvas.addEventListener('mousedown', (e) => {
      this.isDragging = false;
      this.mouseDown = true;
      this.prevMouse = { x: e.clientX, y: e.clientY };
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (this.mouseDown) {
        const dx = e.clientX - this.prevMouse.x;
        const dy = e.clientY - this.prevMouse.y;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.isDragging = true;

        const factor = 0.15 / this.camera.zoom;
        this.cameraTarget.x -= dx * factor;
        this.cameraTarget.z -= dy * factor;
        this.camera.position.x = this.cameraTarget.x;
        this.camera.position.z = this.cameraTarget.z;
        this.camera.position.y = 50;
        this.camera.lookAt(this.cameraTarget);

        this.prevMouse = { x: e.clientX, y: e.clientY };
      }

      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    this.canvas.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });

    this.canvas.addEventListener('click', (e) => {
      if (this.isDragging) return;
      this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
      this.checkVillageClick();
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.camera.zoom = Math.max(0.3, Math.min(4, this.camera.zoom * zoomFactor));
      this.camera.updateProjectionMatrix();
    }, { passive: false });

    window.addEventListener('resize', () => {
      const aspect = window.innerWidth / window.innerHeight;
      this.camera.left = -30 * aspect;
      this.camera.right = 30 * aspect;
      this.camera.top = 30;
      this.camera.bottom = -30;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  checkVillageClick() {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const meshes = Array.from(this.villageMeshes.values());
    const intersects = this.raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      let obj = intersects[0].object;
      while (obj && !obj.userData.villageId) obj = obj.parent;
      if (obj?.userData.villageId) {
        this.onVillageClick?.(obj.userData);
      }
    }
  }

  // Harita verilerini yükle
  loadVillages(villages) {
    // Mevcut köyleri temizle
    this.villageMeshes.forEach(mesh => this.scene.remove(mesh));
    this.villageMeshes.clear();

    // Zemin oluştur
    if (!this.ground) {
      this.createGround();
    }

    villages.forEach(v => {
      const mesh = this.createVillageMarker(v);
      this.scene.add(mesh);
      this.villageMeshes.set(v._id, mesh);
    });
  }

  createGround() {
    // Ana zemin
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(500, 500, 100, 100),
      new THREE.MeshStandardMaterial({
        color: 0x2a5a1a,
        roughness: 0.95
      })
    );
    ground.rotation.x = -Math.PI / 2;

    // Perlin noise benzeri yükseklik
    const pos = ground.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = Math.sin(x * 0.05) * Math.cos(y * 0.03) * 2 +
                Math.sin(x * 0.12 + y * 0.08) * 0.5;
      pos.setZ(i, h);
    }
    ground.geometry.computeVertexNormals();
    this.scene.add(ground);
    this.ground = ground;

    // Dekoratif ağaç clusterları
    this.addForestClusters();

    // Su alanları
    this.addWater();
  }

  addForestClusters() {
    const treeMat = new THREE.MeshStandardMaterial({ color: 0x1a5a22 });
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520 });

    for (let i = 0; i < 80; i++) {
      const group = new THREE.Group();
      const x = (Math.random() - 0.5) * 400;
      const z = (Math.random() - 0.5) * 400;

      // Küçük ağaç grubu
      const count = 3 + Math.floor(Math.random() * 5);
      for (let j = 0; j < count; j++) {
        const tree = new THREE.Group();
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.1, 0.15, 1.5, 4),
          trunkMat
        );
        trunk.position.y = 0.75;
        tree.add(trunk);

        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(0.6 + Math.random() * 0.4, 2, 5),
          treeMat
        );
        crown.position.y = 2.2;
        tree.add(crown);

        tree.position.set(
          x + (Math.random() - 0.5) * 4,
          0,
          z + (Math.random() - 0.5) * 4
        );
        const s = 0.6 + Math.random() * 0.8;
        tree.scale.set(s, s, s);
        group.add(tree);
      }
      this.scene.add(group);
    }
  }

  addWater() {
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x1a4a8a,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
      metalness: 0.3
    });

    // Birkaç göl/nehir
    [[50, 30, 20, 12], [-80, -40, 15, 25], [100, 80, 10, 10]].forEach(([x, z, w, h]) => {
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        waterMat
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(x, 0.3, z);
      this.scene.add(water);
    });
  }

  createVillageMarker(village) {
    const group = new THREE.Group();
    const isBarbarian = village.isBarbarian;
    const points = village.points || 100;

    // Bina boyutu puanlara göre
    const scale = Math.min(1.5, 0.5 + points / 5000);

    // Ana yapı
    const baseColor = isBarbarian ? 0x666666 :
      (village.owner?._id ? 0xc4a35a : 0x888888);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(1.2 * scale, 0.8 * scale, 1.2 * scale),
      new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.7 })
    );
    base.position.y = 0.4 * scale;
    group.add(base);

    // Çatı
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(0.9 * scale, 0.6 * scale, 4),
      new THREE.MeshStandardMaterial({
        color: isBarbarian ? 0x444444 : 0x8B0000
      })
    );
    roof.position.y = 1 * scale;
    roof.rotation.y = Math.PI / 4;
    group.add(roof);

    // Koordinat -> dünya pozisyonu
    const worldX = (village.x - 250) * 1.5;
    const worldZ = (village.y - 250) * 1.5;
    group.position.set(worldX, 0, worldZ);

    group.userData = {
      villageId: village._id,
      villageName: village.name,
      owner: village.owner?.username || 'Barbar',
      ownerId: village.owner?._id || null,
      x: village.x,
      y: village.y,
      points: village.points,
      isBarbarian: village.isBarbarian
    };

    return group;
  }

  // Haritada bir koordinata git
  centerOn(x, y) {
    const worldX = (x - 250) * 1.5;
    const worldZ = (y - 250) * 1.5;
    this.cameraTarget.set(worldX, 0, worldZ);
    this.camera.position.set(worldX, 50, worldZ);
    this.camera.lookAt(this.cameraTarget);
  }

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
