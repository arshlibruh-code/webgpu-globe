import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

class WebGPUGlobe {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.terrain = null; // Will be replaced by this.crust
        this.pointCloud = null;
        
        // Editing state
        this.isEditing = false;
        this.isDragging = false;
        this.isWireframe = false;
        this.brushSize = 20;
        this.mode = 'extrude';
        this.intensity = 2;
        
        // Polygon drawing state
        this.isDrawingPolygon = false;
        this.polygonPoints = [];
        this.polygonMode = 'extrude'; // or 'compress'
        
        // WebGPU compute shader for smooth editing
        this.computePipeline = null;
        this.vertexBuffer = null;
        this.uniformBuffer = null;
        
        // Vertex highlighting
        this.highlightedVertices = [];
        this.vertexHighlightGeometry = null;
        this.vertexHighlightMaterial = null;
        
            // Globe segments tracking - will be set from inputs on load
            this.currentSegments = { width: 256, height: 128 };
        this.mouse = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
            
            // Earth layers
            this.crust = null;
            this.mantle = null;
            this.core = null;
            
            // Clipping system
            this.clippingPolygon = null;
            this.originalGeometries = {};
            this.clippingDirection = 'inside'; // 'outside' or 'inside'
            this.realtimeClipping = false;
            
            // Material clipping system
            this.clippingPlanes = [];
            this.materialClipping = true;
            
            // Polygon movement
            this.polygonAxis = 'z';
            this.polygonPosition = 0;
            this.originalPolygonPoints = null;
            
            // Polygon rotation
            this.polygonRotationAxis = 'x';
            this.polygonRotation = 0;
            
            // Polygon size
            this.polygonWidth = 50;
            this.polygonHeight = 50;
        
        this.init();
    }
    
    async init() {
        try {
            await this.setupWebGPU();
            await this.setupScene();
            this.setupControls();
            this.setupEventListeners();
            this.animate();
            
            console.log('WebGPU Globe initialized!');
        } catch (error) {
            console.error('Failed to initialize:', error);
            this.showError('WebGPU not supported. Please use a modern browser.');
        }
    }
    
    async setupWebGPU() {
        // Check WebGPU support
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported');
        }
        
        // Get adapter and device
        const adapter = await navigator.gpu.requestAdapter();
        const device = await adapter.requestDevice();
        
        console.log('WebGPU device ready');
    }
    
    async setupScene() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            window.innerWidth / window.innerHeight, 
            0.1, 
            1000
        );
        this.camera.position.set(0, 0, 150);
        
        // Renderer with WebGPU
        this.renderer = new WebGPURenderer({ 
            canvas: this.canvas,
            antialias: true 
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Initialize WebGPU renderer
        await this.renderer.init();
        
        // Controls
        this.controls = new OrbitControls(this.camera, this.canvas);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 60;
        this.controls.maxDistance = 300;
        
        // Set mouse buttons: left = none, middle = rotate, right = pan
        this.controls.mouseButtons = {
            LEFT: null,      // Disable left mouse
            MIDDLE: THREE.MOUSE.ROTATE,  // Middle mouse rotates
            RIGHT: THREE.MOUSE.PAN       // Right mouse pans
        };
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
        directionalLight.position.set(100, 100, 100);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
        
        // Add a second light for better illumination
        const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.5);
        directionalLight2.position.set(-50, 50, -50);
        this.scene.add(directionalLight2);
        
        // Set background color
        this.scene.background = new THREE.Color(0x1a1a1a); // Dark background
        
        // Read initial values from inputs
        this.readInitialSegments();
        
        // Create initial terrain
        this.createTerrain();
            
            // Create Earth layers
            this.createEarthLayers();
    }
    
    createTerrain() {
            // The terrain is now handled by the Earth crust layer
            // This function is kept for compatibility but terrain is created in createEarthLayers()
            console.log('Terrain creation handled by Earth layers');
            
            // Update console display
            this.updateConsoleDisplay();
        }
    
    createEarthLayers() {
        // Create SOLID Earth layers (filled, not hollow)
        
        // Create Core (innermost SOLID layer)
        const coreGeometry = new THREE.SphereGeometry(20, this.currentSegments.width, this.currentSegments.height);
        const coreMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xffff00, // Bright yellow core
            wireframe: false,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
            this.core = new THREE.Mesh(coreGeometry, coreMaterial);
            this.core.visible = true; // Visible by default
            this.scene.add(this.core);
        
        // Create Mantle (middle SOLID layer) - from core to mantle outer radius
        const mantleGeometry = new THREE.SphereGeometry(40, this.currentSegments.width, this.currentSegments.height);
        const mantleMaterial = new THREE.MeshLambertMaterial({ 
            color: 0xff6600, // Orange/red mantle color
            wireframe: false,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.8
        });
            this.mantle = new THREE.Mesh(mantleGeometry, mantleMaterial);
            this.mantle.visible = true; // Visible by default
            this.scene.add(this.mantle);
            
            // Create Crust (outermost SOLID layer) - from mantle to crust outer radius
            const crustGeometry = new THREE.SphereGeometry(50, this.currentSegments.width, this.currentSegments.height);
            const crustMaterial = new THREE.MeshLambertMaterial({ 
                color: 0x404040, // Dark grey (current terrain color)
                wireframe: false,
                side: THREE.DoubleSide,
                transparent: true,
                opacity: 1.0
            });
            this.crust = new THREE.Mesh(crustGeometry, crustMaterial);
            this.crust.receiveShadow = true;
            this.crust.castShadow = true;
            this.scene.add(this.crust);
        
        // Set terrain reference to crust for compatibility
        this.terrain = this.crust;
        
        // Create 4 cylinders on sphere surface and polygon fill
        this.createSpherePolygon();
        
        console.log('Earth layers created: Crust, Mantle, Core');
    }
    
        createSpherePolygon() {
            // Create 4 cylinders on sphere surface
            const sphereRadius = 80;
            const cylinderHeight = 3;
            const cylinderRadius = 0.5;
            
            // Define 4 points on sphere surface (rectangle pattern) - size relative to sphere radius
            const widthRatio = this.polygonWidth / 50; // Convert 1-50 to 0.02-1.0 ratio
            const heightRatio = this.polygonHeight / 50; // Convert 1-50 to 0.02-1.0 ratio
            
            const halfWidth = (sphereRadius * widthRatio) / 2;
            const halfHeight = (sphereRadius * heightRatio) / 2;
            
            const points = [
                new THREE.Vector3(halfWidth, halfHeight, 4),   // Point 1
                new THREE.Vector3(-halfWidth, halfHeight, 4),  // Point 2  
                new THREE.Vector3(-halfWidth, -halfHeight, 4), // Point 3
                new THREE.Vector3(halfWidth, -halfHeight, 4)   // Point 4
            ];
            
            // Normalize points to sphere surface
            points.forEach(point => {
                point.normalize().multiplyScalar(sphereRadius);
            });
            
            // Store polygon points for clipping
            this.clippingPolygon = points;
            this.originalPolygonPoints = points.map(p => p.clone()); // Store original positions
            
            // Create cylinders at each point
            this.sphereCylinders = [];
            points.forEach((point, index) => {
                const cylinderGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 8);
                const cylinderMaterial = new THREE.MeshPhysicalMaterial({ 
                    color: 0x00aaff, // Bright neon blue
                    transparent: true,
                    opacity: 0.8,
                    roughness: 0.1,
                    metalness: 0.0,
                    clearcoat: 1.0,
                    clearcoatRoughness: 0.1,
                    transmission: 0.3,
                    thickness: 0.2,
                    ior: 1.5,
                    emissive: 0x002244,
                    emissiveIntensity: 0.3
                });
                
                const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
                cylinder.position.copy(point);
                
                // Orient cylinder to point outward from sphere center
                const direction = point.clone().normalize();
                cylinder.lookAt(direction);
                cylinder.rotateX(Math.PI / 2);
                
                this.scene.add(cylinder);
                this.sphereCylinders.push(cylinder);
            });
            
            // Create polygon fill using the 4 points
            const polygonGeometry = new THREE.BufferGeometry();
            const positions = [];
            
            // Add all 4 points
            points.forEach(point => {
                positions.push(point.x, point.y, point.z);
            });
            
            polygonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            
            // Create triangle fan (connect all points to first point)
            const indices = [0, 1, 2, 0, 2, 3]; // Two triangles to make a square
            polygonGeometry.setIndex(indices);
            
            const polygonMaterial = new THREE.MeshPhysicalMaterial({
                color: 0x00aaff, // Bright neon blue
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide,
                roughness: 0.1,
                metalness: 0.0,
                clearcoat: 1.0,
                clearcoatRoughness: 0.1,
                transmission: 0.8, // Glass-like transmission
                thickness: 0.5,
                ior: 1.5, // Glass index of refraction
                emissive: 0x002244, // Subtle blue glow
                emissiveIntensity: 0.2
            });
        
            this.spherePolygon = new THREE.Mesh(polygonGeometry, polygonMaterial);
            this.scene.add(this.spherePolygon);
            
            console.log('4 cylinders and polygon fill created on sphere surface');
            console.log('Clipping polygon points stored:', this.clippingPolygon);
    }
    
    setupControls() {
        // Load terrain button
        document.getElementById('loadTerrain').addEventListener('click', () => {
            this.loadHeightmap();
        });
        
        // Edit mode button
        document.getElementById('editMode').addEventListener('click', () => {
            this.toggleEditMode();
        });
        
        // Wireframe mode button
        document.getElementById('wireframeMode').addEventListener('click', () => {
            this.toggleWireframeMode();
        });
        
        // Smooth globe button
        document.getElementById('smoothGlobe').addEventListener('click', () => {
            this.smoothGlobe();
        });
        
        // Load point cloud button
        document.getElementById('loadPointCloud').addEventListener('click', () => {
            this.loadPointCloud();
        });
            
            // Polygon drawing button
            document.getElementById('polygonMode').addEventListener('click', () => {
                this.togglePolygonMode();
            });
            
            // Earth layer controls
            document.getElementById('crustToggle').addEventListener('change', (e) => {
                console.log('Crust toggle:', e.target.checked);
                this.crust.visible = e.target.checked;
            });
            
            document.getElementById('crustOpacity').addEventListener('input', (e) => {
                const opacity = parseFloat(e.target.value);
                console.log('Crust opacity:', opacity);
                this.crust.material.opacity = opacity;
                document.getElementById('crustOpacityValue').textContent = opacity;
            });
            
            document.getElementById('mantleToggle').addEventListener('change', (e) => {
                console.log('Mantle toggle:', e.target.checked);
                this.mantle.visible = e.target.checked;
            });
            
            document.getElementById('mantleOpacity').addEventListener('input', (e) => {
                const opacity = parseFloat(e.target.value);
                console.log('Mantle opacity:', opacity);
                this.mantle.material.opacity = opacity;
                document.getElementById('mantleOpacityValue').textContent = opacity;
            });
            
            document.getElementById('coreToggle').addEventListener('change', (e) => {
                console.log('Core toggle:', e.target.checked);
                this.core.visible = e.target.checked;
            });
            
            document.getElementById('coreOpacity').addEventListener('input', (e) => {
                const opacity = parseFloat(e.target.value);
                console.log('Core opacity:', opacity);
                this.core.material.opacity = opacity;
                document.getElementById('coreOpacityValue').textContent = opacity;
            });
            
            // Real-time clipping toggle
            document.getElementById('realtimeClippingToggle').addEventListener('change', (e) => {
                this.realtimeClipping = e.target.checked;
                console.log('Real-time clipping:', this.realtimeClipping ? 'ON' : 'OFF');
                
                if (this.realtimeClipping) {
                    // When turning ON, check all layers and apply clipping
                    this.checkAllLayersForClipping();
                    this.applyClippingToSelectedLayers();
                } else {
                    // When turning OFF, restore all layers
                    this.restoreAllLayers();
                }
            });
            
            // Layer checkbox changes - real-time updates
            document.getElementById('clipCrust').addEventListener('change', () => {
                this.handleLayerSelectionChange('crust');
            });
            
            document.getElementById('clipMantle').addEventListener('change', () => {
                this.handleLayerSelectionChange('mantle');
            });
            
            document.getElementById('clipCore').addEventListener('change', () => {
                this.handleLayerSelectionChange('core');
            });
            
            
            document.getElementById('restoreAll').addEventListener('click', () => {
                this.restoreAllLayers();
                console.log('All layers restored');
            });
            
            // Clipping direction
            document.getElementById('clippingDirection').addEventListener('change', (e) => {
                this.clippingDirection = e.target.value;
                console.log('Clipping direction:', this.clippingDirection);
                
                // Always re-apply clipping when direction changes
                this.reapplyClippingToAllLayers();
            });
            
            
            // Polygon axis selection
            document.getElementById('polygonAxis').addEventListener('change', (e) => {
                this.polygonAxis = e.target.value;
                console.log('Polygon axis:', this.polygonAxis);
                this.updatePolygonPosition();
            });
            
            // Polygon position slider
            document.getElementById('polygonPosition').addEventListener('input', (e) => {
                this.polygonPosition = parseFloat(e.target.value);
                document.getElementById('polygonPositionValue').textContent = this.polygonPosition;
                this.updatePolygonPosition();
            });
            
            // Polygon rotation axis
            document.getElementById('polygonRotationAxis').addEventListener('change', (e) => {
                this.polygonRotationAxis = e.target.value;
                console.log('Polygon rotation axis:', this.polygonRotationAxis);
                this.updatePolygonTransform();
            });
            
            // Polygon rotation slider
            document.getElementById('polygonRotation').addEventListener('input', (e) => {
                this.polygonRotation = parseFloat(e.target.value);
                document.getElementById('polygonRotationValue').textContent = this.polygonRotation + '°';
                this.updatePolygonTransform();
            });
            
            // Polygon width slider
            document.getElementById('polygonWidth').addEventListener('input', (e) => {
                this.polygonWidth = parseFloat(e.target.value);
                document.getElementById('polygonWidthValue').textContent = this.polygonWidth;
                this.updatePolygonSize();
            });
            
            // Polygon height slider
            document.getElementById('polygonHeight').addEventListener('input', (e) => {
                this.polygonHeight = parseFloat(e.target.value);
                document.getElementById('polygonHeightValue').textContent = this.polygonHeight;
                this.updatePolygonSize();
        });
        
        // Brush size
        document.getElementById('brushSize').addEventListener('input', (e) => {
            this.brushSize = parseFloat(e.target.value);
            document.getElementById('brushSizeValue').textContent = this.brushSize;
            // Update brush preview size
            if (this.brushPreview) {
                this.brushPreview.scale.setScalar(this.brushSize / 20);
            }
        });
        
        // Mode buttons
        document.getElementById('extrudeBtn').addEventListener('click', () => {
            this.setMode('extrude');
        });
        
        document.getElementById('compressBtn').addEventListener('click', () => {
            this.setMode('compress');
        });
        
        // Intensity slider
        document.getElementById('intensity').addEventListener('input', (e) => {
            this.intensity = parseFloat(e.target.value);
            document.getElementById('intensityValue').textContent = this.intensity;
        });
        
        
        // Console controls - auto-update on change
        document.getElementById('customWidth').addEventListener('input', () => {
            this.updateSegmentsIfValid();
        });
        
        document.getElementById('customHeight').addEventListener('input', () => {
            this.updateSegmentsIfValid();
        });
        
        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const width = parseInt(btn.dataset.width);
                const height = parseInt(btn.dataset.height);
                
                // Update input fields
                document.getElementById('customWidth').value = width;
                document.getElementById('customHeight').value = height;
                
                // Apply the preset
                this.currentSegments.width = width;
                this.currentSegments.height = height;
                
                // Remove old terrain
                if (this.terrain) {
                    this.scene.remove(this.terrain);
                }
                
                // Create new terrain
                this.createTerrain();
                
                // Restore wireframe mode if enabled
                if (this.isWireframe) {
                    this.terrain.material.wireframe = true;
                }
                
                // Update console display
                this.updateConsoleDisplay();
                
                console.log(`Applied preset: ${width}×${height}`);
            });
        });
    }
    
    setupEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousemove', (e) => {
            this.updateMousePosition(e);
            if (this.isEditing) {
                this.showBrushPreview();
                // Continue editing while dragging
                if (this.isDragging) {
                this.editTerrain();
                }
            }
        });
        
        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                if (this.isDrawingPolygon) {
                    this.addPolygonPoint(e);
                } else if (this.isEditing) {
                    this.isDragging = true;
                this.editTerrain();
                }
            }
        });
        
        this.canvas.addEventListener('mouseup', (e) => {
            if (e.button === 0) { // Left click release
                this.isDragging = false;
            }
        });
        
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // Prevent right-click menu
            if (this.isDrawingPolygon && this.polygonPoints.length >= 3) {
                this.applyPolygonEdit();
            }
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    updateMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    
    showBrushPreview() {
        if (!this.terrain) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.terrain);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // Create or update brush preview (invisible)
            if (!this.brushPreview) {
                this.brushPreview = new THREE.Mesh(
                    new THREE.CircleGeometry(this.brushSize, 32),
                    new THREE.MeshBasicMaterial({ 
                        color: 0x0088ff, 
                        transparent: true, 
                        opacity: 0, // Make invisible
                        side: THREE.DoubleSide
                    })
                );
                this.brushPreview.rotation.x = -Math.PI / 2;
                this.scene.add(this.brushPreview);
            }
            
            // Update brush position and size
            this.brushPreview.position.copy(point);
            this.brushPreview.scale.setScalar(this.brushSize / 20); // Scale based on brush size
            
            // Highlight vertices that would be affected
            this.highlightVerticesInBrush(point);
        } else {
            // Remove highlights if no intersection
            this.clearVertexHighlights();
        }
    }
    
    setMode(mode) {
        this.mode = mode;
        
        // Update button states
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        if (mode === 'extrude') {
            document.getElementById('extrudeBtn').classList.add('active');
        } else if (mode === 'compress') {
            document.getElementById('compressBtn').classList.add('active');
        }
    }
    
    editTerrain() {
        if (!this.terrain) return;
        
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObject(this.terrain);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            const vertices = this.terrain.geometry.attributes.position.array;
            
            // Transform intersection point to terrain's local space
            const localPoint = point.clone();
            this.terrain.worldToLocal(localPoint);
            
            let edited = false;
            let verticesInRange = 0;
            const changedVertexIndices = new Set(); // Track which vertices actually changed
            
            // Smooth editing with falloff
            for (let i = 0; i < vertices.length; i += 3) {
                const vertex = new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
                const distance = vertex.distanceTo(localPoint);
                
                if (distance < this.brushSize) {
                    verticesInRange++;
                    
                    // Debug: Show which vertices are being affected
                    if (verticesInRange <= 5) { // Only show first 5 for clarity
                        console.log(`Vertex ${i/3}: pos(${vertex.x.toFixed(2)}, ${vertex.y.toFixed(2)}, ${vertex.z.toFixed(2)}) distance: ${distance.toFixed(2)}`);
                    }
                    
                    // Smooth falloff using smoothstep function
                    const normalizedDistance = distance / this.brushSize;
                    const influence = 1 - (3 * normalizedDistance * normalizedDistance - 2 * normalizedDistance * normalizedDistance * normalizedDistance);
                    
                    // For sphere, we need to move vertices along their normal direction
                    const normal = vertex.clone().normalize();
                    
                    // Change amount based on mode and intensity
                    let change = 0;
                    if (this.mode === 'extrude') {
                        change = this.intensity * influence; // Push outward
                        vertex.add(normal.multiplyScalar(change));
                    } else if (this.mode === 'compress') {
                        change = this.intensity * influence; // Use positive intensity
                        vertex.add(normal.multiplyScalar(-change)); // But move inward (negative direction)
                    }
                    
                    // Only update if vertex actually changed (smart optimization)
                    const oldX = vertices[i];
                    const oldY = vertices[i + 1];
                    const oldZ = vertices[i + 2];
                    
                    if (Math.abs(vertex.x - oldX) > 0.001 || 
                        Math.abs(vertex.y - oldY) > 0.001 || 
                        Math.abs(vertex.z - oldZ) > 0.001) {
                        
                        // Update vertex positions
                        vertices[i] = vertex.x;
                        vertices[i + 1] = vertex.y;
                        vertices[i + 2] = vertex.z;
                        
                        // Mark this vertex as changed
                        changedVertexIndices.add(i);
                        changedVertexIndices.add(i + 1);
                        changedVertexIndices.add(i + 2);
                        edited = true;
                    }
                }
            }
            
            if (edited) {
            this.terrain.geometry.attributes.position.needsUpdate = true;
            this.terrain.geometry.computeVertexNormals();
                console.log(`Terrain edited: ${verticesInRange} vertices, ${changedVertexIndices.size/3} actually changed, intensity: ${this.intensity}`);
            } else {
                console.log(`No vertices in range. Brush size: ${this.brushSize}, try increasing brush size`);
            }
        } else {
            console.log('No intersection with terrain');
        }
    }
    
    toggleEditMode() {
        this.isEditing = !this.isEditing;
        const button = document.getElementById('editMode');
        button.textContent = this.isEditing ? 'Exit Edit' : 'Edit Mode';
        button.style.background = this.isEditing ? '#ff4444' : '#00ff88';
        
        this.canvas.style.cursor = this.isEditing ? 'crosshair' : 'grab';
        
        // Remove brush preview and highlights when exiting edit mode
        if (!this.isEditing && this.brushPreview) {
            this.scene.remove(this.brushPreview);
            this.brushPreview = null;
        }
        
        if (!this.isEditing) {
            this.clearVertexHighlights();
        }
    }
    
    toggleWireframeMode() {
        this.isWireframe = !this.isWireframe;
        const button = document.getElementById('wireframeMode');
        button.textContent = this.isWireframe ? 'Solid' : 'Wireframe';
        button.style.background = this.isWireframe ? '#ff4444' : '#00ff88';
        
        if (this.terrain) {
            this.terrain.material.wireframe = this.isWireframe;
        }
    }
    
    smoothGlobe() {
        if (!this.terrain) return;
        
        console.log('Smoothing entire globe...');
        const vertices = this.terrain.geometry.attributes.position.array;
        const baseRadius = 50;
        
        // Smooth all vertices towards base sphere
        for (let i = 0; i < vertices.length; i += 3) {
            const vertex = new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
            const currentRadius = vertex.length();
            const smoothedRadius = currentRadius * 0.8 + baseRadius * 0.2;
            vertex.normalize().multiplyScalar(smoothedRadius);
            
            vertices[i] = vertex.x;
            vertices[i + 1] = vertex.y;
            vertices[i + 2] = vertex.z;
        }
        
        this.terrain.geometry.attributes.position.needsUpdate = true;
        this.terrain.geometry.computeVertexNormals();
        console.log('Globe smoothed!');
    }
    
    readInitialSegments() {
        // Read values from input fields on load
        const widthInput = document.getElementById('customWidth');
        const heightInput = document.getElementById('customHeight');
        
            if (widthInput && heightInput) {
                const width = parseInt(widthInput.value) || 256;
                const height = parseInt(heightInput.value) || 128;
            
            this.currentSegments.width = Math.max(8, Math.min(1024, width));
            this.currentSegments.height = Math.max(8, Math.min(1024, height));
            
            console.log(`Initial segments from inputs: ${this.currentSegments.width}x${this.currentSegments.height}`);
        }
    }
    
    updateConsoleDisplay() {
        const vertexCount = (this.currentSegments.width + 1) * (this.currentSegments.height + 1);
        const triangleCount = this.currentSegments.width * this.currentSegments.height * 2;
        
        document.getElementById('segmentCount').textContent = `${this.currentSegments.width}x${this.currentSegments.height}`;
        document.getElementById('vertexCount').textContent = vertexCount.toLocaleString();
        document.getElementById('triangleCount').textContent = triangleCount.toLocaleString();
    }
    
    updateSegmentsIfValid() {
        const customWidth = parseInt(document.getElementById('customWidth').value);
        const customHeight = parseInt(document.getElementById('customHeight').value);
        
        // Only update if both values are valid
        if (customWidth && customHeight && customWidth >= 8 && customWidth <= 1024 && customHeight >= 8 && customHeight <= 1024) {
            // Only update if values actually changed
            if (customWidth !== this.currentSegments.width || customHeight !== this.currentSegments.height) {
                console.log(`Auto-updating segments: ${customWidth}x${customHeight}`);
                
                // Update segments
                this.currentSegments.width = customWidth;
                this.currentSegments.height = customHeight;
                
                // Remove old terrain
                if (this.terrain) {
                    this.scene.remove(this.terrain);
                }
                
                // Create new terrain with custom segments
                this.createTerrain();
                
                // Restore wireframe mode if it was enabled
                if (this.isWireframe) {
                    this.terrain.material.wireframe = true;
                }
                
                // Update console display
                this.updateConsoleDisplay();
            }
        }
    }
    
    async loadHeightmap() {
        // Simulate loading a heightmap
        console.log('Loading heightmap...');
        this.showLoading('Loading heightmap...');
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create new terrain with heightmap data
        this.createTerrain();
        this.hideLoading();
        console.log('Heightmap loaded!');
    }
    
    async loadPointCloud() {
        // Simulate loading a point cloud
        console.log('Loading point cloud...');
        this.showLoading('Loading point cloud...');
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create point cloud
        this.createPointCloud();
        this.hideLoading();
        console.log('Point cloud loaded!');
    }
    
    createPointCloud() {
        // Remove existing point cloud
        if (this.pointCloud) {
            this.scene.remove(this.pointCloud);
        }
        
        // Create random point cloud
        const geometry = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        
        for (let i = 0; i < 1000; i++) {
            positions.push(
                (Math.random() - 0.5) * 100,
                Math.random() * 20,
                (Math.random() - 0.5) * 100
            );
            colors.push(Math.random(), Math.random(), Math.random());
        }
        
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({ 
            size: 0.5, 
            vertexColors: true 
        });
        
        this.pointCloud = new THREE.Points(geometry, material);
        this.scene.add(this.pointCloud);
    }
    
    showLoading(message) {
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.innerHTML = `
            <div class="spinner"></div>
            <div>${message}</div>
        `;
        loading.id = 'loading';
        document.body.appendChild(loading``);
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.remove();
        }
    }
    
    highlightVerticesInBrush(brushPoint) {
        if (!this.terrain) return;
        
        // Clear previous highlights
        this.clearVertexHighlights();
        
        const vertices = this.terrain.geometry.attributes.position.array;
        const localPoint = brushPoint.clone();
        this.terrain.worldToLocal(localPoint);
        
        const highlightPositions = [];
        const highlightColors = [];
        
        // Find vertices in brush radius using CURRENT vertex positions (after editing)
        for (let i = 0; i < vertices.length; i += 3) {
            // Get the CURRENT vertex position (after any editing) in LOCAL space
            const vertex = new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
            
            // Calculate distance in LOCAL space (same as editTerrain)
            const distance = vertex.distanceTo(localPoint);
            
            if (distance < this.brushSize) {
                // Transform vertex to world space for highlighting display
                const worldVertex = vertex.clone();
                this.terrain.localToWorld(worldVertex);
                
                // Add vertex position in world space for highlighting
                highlightPositions.push(worldVertex.x, worldVertex.y, worldVertex.z);
                
                // Color based on distance (closer = brighter)
                const normalizedDistance = distance / this.brushSize;
                const intensity = 1 - normalizedDistance;
                highlightColors.push(intensity, 0, 1 - intensity); // Red to blue gradient
            }
        }
        
        if (highlightPositions.length > 0) {
            // Create geometry for highlighted vertices
            this.vertexHighlightGeometry = new THREE.BufferGeometry();
            this.vertexHighlightGeometry.setAttribute('position', new THREE.Float32BufferAttribute(highlightPositions, 3));
            this.vertexHighlightGeometry.setAttribute('color', new THREE.Float32BufferAttribute(highlightColors, 3));
            
            // Create material
            this.vertexHighlightMaterial = new THREE.PointsMaterial({
                size: 6.0,
                vertexColors: true,
                opacity: 1
            });
            
            // Create points mesh
            const highlightMesh = new THREE.Points(this.vertexHighlightGeometry, this.vertexHighlightMaterial);
            this.scene.add(highlightMesh);
            this.highlightedVertices.push(highlightMesh);
        }
    }
    
    clearVertexHighlights() {
        // Remove all highlighted vertices
        this.highlightedVertices.forEach(mesh => {
            this.scene.remove(mesh);
        });
        this.highlightedVertices = [];
        
        // Clean up geometry and material
        if (this.vertexHighlightGeometry) {
            this.vertexHighlightGeometry.dispose();
            this.vertexHighlightGeometry = null;
        }
        if (this.vertexHighlightMaterial) {
            this.vertexHighlightMaterial.dispose();
            this.vertexHighlightMaterial = null;
        }
    }
    
    showError(message) {
        const error = document.createElement('div');
        error.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            z-index: 1000;
        `;
        error.textContent = message;
        document.body.appendChild(error);
    }
    
    // Polygon drawing methods
        togglePolygonMode() {
            this.isDrawingPolygon = !this.isDrawingPolygon;
            this.isEditing = false; // Exit edit mode
            
            const button = document.getElementById('polygonMode');
            button.textContent = this.isDrawingPolygon ? 'Exit Polygon' : 'Polygon Mode';
            button.style.background = this.isDrawingPolygon ? '#ff4444' : '#00ff88';
            
            if (this.isDrawingPolygon) {
                this.polygonPoints = [];
                this.canvas.style.cursor = 'crosshair';
                console.log('🎯 POLYGON MODE ENABLED: Click points to draw polygon, right-click to finish');
                console.log('Current polygon points:', this.polygonPoints.length);
            } else {
                this.clearPolygon();
                this.canvas.style.cursor = 'grab';
                console.log('Polygon mode disabled');
            }
        }
    
        addPolygonPoint(event) {
            if (!this.terrain) {
                console.log('❌ No terrain found');
                return;
            }
            
            console.log('🎯 Adding polygon point...');
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObject(this.terrain);
            
            console.log(`Raycaster intersects: ${intersects.length}`);
            
            if (intersects.length > 0) {
                const point = intersects[0].point;
                this.polygonPoints.push(point);
                
                console.log(`✅ Polygon point ${this.polygonPoints.length}: (${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})`);
                console.log(`Total polygon points: ${this.polygonPoints.length}`);
                
                // Draw polygon preview
                this.drawPolygonPreview();
            } else {
                console.log('❌ No intersection with terrain');
            }
        }
    
         drawPolygonPreview() {
            // Remove existing polygon preview
            this.clearPolygon();
            
            if (this.polygonPoints.length === 0) return;
            
            console.log(`Drawing polygon with ${this.polygonPoints.length} points`);
            
            // STEP 1: CREATE VERTICES (BLUE SPHERES)
            this.createPolygonVertices();
            
            // STEP 2: CREATE LINES (if 2+ points)
            if (this.polygonPoints.length >= 2) {
                this.createPolygonLines();
            }
            
            // STEP 3: CREATE POLYGON AREA (if 3+ points)
            if (this.polygonPoints.length >= 3) {
                this.createPolygonArea();
            }
        }
        
        createPolygonVertices() {
            // VERTEX DEFINITION: Blue cylinders (straws) at each point
            const vertexGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2.0, 8); // Thin blue cylinders like straws
            const vertexMaterial = new THREE.MeshBasicMaterial({ 
                color: 0x0088ff, // Bright blue
                transparent: false
            });
            
            // Create a cylinder for each vertex
            this.polygonVertices = [];
            this.polygonPoints.forEach((point, index) => {
                const vertex = new THREE.Mesh(vertexGeometry, vertexMaterial);
                vertex.position.copy(point);
                
                // Orient cylinder to point outward from sphere center
                const direction = point.clone().normalize();
                vertex.lookAt(direction);
                vertex.rotateX(Math.PI / 2); // Rotate to align with sphere normal
                
                this.scene.add(vertex);
                this.polygonVertices.push(vertex);
            });
            
            console.log(`Created ${this.polygonVertices.length} vertex cylinders (straws)`);
        }
        
        createPolygonLines() {
            // LINE DEFINITION: Blue lines connecting consecutive points (elevated)
            const lineGeometry = new THREE.BufferGeometry();
            const linePositions = [];
            
            // Connect each point to the next one (elevated above terrain)
            for (let i = 0; i < this.polygonPoints.length; i++) {
                const currentPoint = this.polygonPoints[i];
                const nextPoint = this.polygonPoints[(i + 1) % this.polygonPoints.length];
                
                // Elevate lines above terrain surface (same as polygon fill)
                const currentNormal = currentPoint.clone().normalize();
                const nextNormal = nextPoint.clone().normalize();
                
                const elevatedCurrent = currentPoint.clone().add(currentNormal.multiplyScalar(2));
                const elevatedNext = nextPoint.clone().add(nextNormal.multiplyScalar(2));
                
                // Add elevated line segment
                linePositions.push(elevatedCurrent.x, elevatedCurrent.y, elevatedCurrent.z);
                linePositions.push(elevatedNext.x, elevatedNext.y, elevatedNext.z);
            }
            
            lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
            
            const lineMaterial = new THREE.LineBasicMaterial({ 
                color: 0x0088ff, // Blue lines (same as spheres)
                linewidth: 3
            });
            
            this.polygonLines = new THREE.Line(lineGeometry, lineMaterial);
            this.scene.add(this.polygonLines);
            
            console.log(`Created elevated lines connecting ${this.polygonPoints.length} points`);
        }
        
        createPolygonArea() {
            // POLYGON AREA DEFINITION: Blue semi-transparent area using Three.js Shape
            if (this.polygonPoints.length < 3) return;
            
            // Convert 3D points to 2D shape for proper triangulation
            const shape = new THREE.Shape();
            const numPoints = this.polygonPoints.length;
            
            // Project 3D points to 2D plane (using sphere's UV coordinates)
            const points2D = [];
            this.polygonPoints.forEach(point => {
                // Convert 3D point to spherical coordinates
                const phi = Math.acos(point.y / 50); // latitude
                const theta = Math.atan2(point.z, point.x); // longitude
                
                // Convert to UV coordinates (0-1 range)
                const u = (theta + Math.PI) / (2 * Math.PI);
                const v = phi / Math.PI;
                
                points2D.push(new THREE.Vector2(u, v));
            });
            
            // Create shape from 2D points
            shape.moveTo(points2D[0].x, points2D[0].y);
            for (let i = 1; i < points2D.length; i++) {
                shape.lineTo(points2D[i].x, points2D[i].y);
            }
            shape.closePath(); // Close the polygon
            
            // Create geometry from shape
            const shapeGeometry = new THREE.ShapeGeometry(shape);
            
            // Convert back to 3D by mapping UV coordinates to sphere surface
            const positions = shapeGeometry.attributes.position.array;
            const newPositions = [];
            
            for (let i = 0; i < positions.length; i += 3) {
                const u = positions[i];
                const v = positions[i + 1];
                
                // Convert UV back to 3D sphere coordinates
                const theta = u * 2 * Math.PI - Math.PI;
                const phi = v * Math.PI;
                
                // Calculate base sphere position
                const x = 50 * Math.sin(phi) * Math.cos(theta);
                const y = 50 * Math.cos(phi);
                const z = 50 * Math.sin(phi) * Math.sin(theta);
                
                // Elevate polygon fill above terrain surface (2 units outward)
                const normal = new THREE.Vector3(x, y, z).normalize();
                const elevatedX = x + normal.x * 1;
                const elevatedY = y + normal.y * 1;
                const elevatedZ = z + normal.z * 1;
                
                newPositions.push(elevatedX, elevatedY, elevatedZ);
            }
            
            // Create final geometry
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
            geometry.setIndex(shapeGeometry.index);
            
            const material = new THREE.MeshBasicMaterial({
                color: 0x0088ff, // Blue (same as spheres and lines)
                transparent: true,
                opacity: 0.4, // 40% opacity
                side: THREE.DoubleSide
            });
            
            this.polygonArea = new THREE.Mesh(geometry, material);
            this.scene.add(this.polygonArea);
            
            console.log(`Created polygon area with ${this.polygonPoints.length} vertices using Three.js Shape triangulation`);
        }
    
        createPolygonAreaHighlight() {
            // Create a semi-transparent plane to show the polygon area
            if (this.polygonPoints.length >= 3) {
                const geometry = new THREE.BufferGeometry();
                const positions = [];
                
                // Add all polygon points
                this.polygonPoints.forEach(point => {
                    positions.push(point.x, point.y, point.z);
                });
                
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
                
                // Create a simple triangle fan for the polygon area
                const indices = [];
                for (let i = 1; i < this.polygonPoints.length - 1; i++) {
                    indices.push(0, i, i + 1);
                }
                geometry.setIndex(indices);
                
                const material = new THREE.MeshBasicMaterial({
                    color: 0x00ff00, // Green
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide
                });
                
                this.polygonArea = new THREE.Mesh(geometry, material);
                this.scene.add(this.polygonArea);
                console.log('Added polygon area highlight');
            }
        }
        
        clearPolygon() {
            // Clear vertex spheres
            if (this.polygonVertices && Array.isArray(this.polygonVertices)) {
                this.polygonVertices.forEach(vertex => {
                    this.scene.remove(vertex);
                    vertex.geometry.dispose();
                    vertex.material.dispose();
                });
                this.polygonVertices = [];
            }
            
            // Clear lines
            if (this.polygonLines) {
                this.scene.remove(this.polygonLines);
                this.polygonLines.geometry.dispose();
                this.polygonLines.material.dispose();
                this.polygonLines = null;
            }
            
            // Clear polygon area
            if (this.polygonArea) {
                this.scene.remove(this.polygonArea);
                this.polygonArea.geometry.dispose();
                this.polygonArea.material.dispose();
                this.polygonArea = null;
            }
            
            // Clear any old preview
            if (this.polygonPreview) {
                this.scene.remove(this.polygonPreview);
                this.polygonPreview = null;
            }
        }
    
    applyPolygonEdit() {
        if (this.polygonPoints.length < 3) {
            console.log('Need at least 3 points for polygon');
            return;
        }
        
        console.log(`Applying ${this.polygonMode} to polygon with ${this.polygonPoints.length} points`);
        
        // Get all vertices
        const vertices = this.terrain.geometry.attributes.position.array;
        let edited = false;
        let verticesInPolygon = 0;
        
        // Check each vertex if it's inside the polygon
        for (let i = 0; i < vertices.length; i += 3) {
            const vertex = new THREE.Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
            
            if (this.isPointInPolygon(vertex, this.polygonPoints)) {
                verticesInPolygon++;
                
                // Apply transformation
                const normal = vertex.clone().normalize();
                const change = this.intensity;
                
                if (this.polygonMode === 'extrude') {
                    vertex.add(normal.multiplyScalar(change));
                } else if (this.polygonMode === 'compress') {
                    vertex.add(normal.multiplyScalar(-change));
                }
                
                // Update vertex
                vertices[i] = vertex.x;
                vertices[i + 1] = vertex.y;
                vertices[i + 2] = vertex.z;
                edited = true;
            }
        }
        
        if (edited) {
            this.terrain.geometry.attributes.position.needsUpdate = true;
            this.terrain.geometry.computeVertexNormals();
            console.log(`Polygon edit applied: ${verticesInPolygon} vertices affected`);
        }
        
        // Clear polygon
        this.clearPolygon();
        this.polygonPoints = [];
    }
    
    isPointInPolygon(point, polygon) {
        // Simple point-in-polygon test using ray casting
        // This is a simplified version - for production, use proper 3D point-in-polygon
        const x = point.x, y = point.y, z = point.z;
        let inside = false;
        
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y, zi = polygon[i].z;
            const xj = polygon[j].x, yj = polygon[j].y, zj = polygon[j].z;
            
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }
        
        return inside;
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.controls.update();
            this.renderer.renderAsync(this.scene, this.camera);
        }
        
        // CLIPPING SYSTEM METHODS
        
        clipSphereWithPolygon(targetLayer) {
            if (!this.clippingPolygon || this.clippingPolygon.length < 3) {
                console.log('No clipping polygon available');
                return;
            }
            
            console.log(`Applying material clipping to ${targetLayer}...`);
            
            // Get the target layer
            let targetMesh = null;
            switch(targetLayer) {
                case 'crust': targetMesh = this.crust; break;
                case 'mantle': targetMesh = this.mantle; break;
                case 'core': targetMesh = this.core; break;
                default: console.log('Invalid layer'); return;
            }
            
            if (!targetMesh) {
                console.log(`${targetLayer} layer not found`);
                return;
            }
            
            // Create clipping plane from polygon
            const clippingPlane = this.calculateClippingPlane();
            if (!clippingPlane) {
                console.log('Failed to calculate clipping plane');
                return;
            }
            
            // Apply material clipping
            this.applyMaterialClipping(targetMesh, clippingPlane);
            
            console.log(`${targetLayer} material clipping applied successfully`);
        }
        
        calculateClippingPlane() {
            if (this.clippingPolygon.length < 3) return null;
            
            // Calculate normal vector from first 3 points
            const p0 = this.clippingPolygon[0];
            const p1 = this.clippingPolygon[1];
            const p2 = this.clippingPolygon[2];
            
            // Two vectors in the plane
            const v1 = p1.clone().sub(p0);
            const v2 = p2.clone().sub(p0);
            
            // Normal vector (cross product)
            const normal = v1.clone().cross(v2).normalize();
            
            // Plane equation: ax + by + cz + d = 0
            // where (a,b,c) is normal and d = -normal.dot(point)
            const d = -normal.dot(p0);
            
            return { normal, d };
        }
        
        applyMaterialClipping(mesh, clippingPlane) {
            // Check if WebGPU supports clipping planes
            if (this.renderer.isWebGPURenderer) {
                console.log('WebGPU detected - using custom clipping approach');
                this.applyWebGPUClipping(mesh, clippingPlane);
                return;
            }
            
            // Create Three.js clipping plane
            const plane = new THREE.Plane(
                clippingPlane.normal.clone(),
                clippingPlane.d
            );
            
            // Store clipping plane for this mesh
            if (!this.clippingPlanes[mesh.uuid]) {
                this.clippingPlanes[mesh.uuid] = [];
            }
            
            // Add clipping plane to material
            if (mesh.material.clippingPlanes) {
                mesh.material.clippingPlanes.push(plane);
            } else {
                mesh.material.clippingPlanes = [plane];
            }
            
            // Enable clipping on material
            mesh.material.clipIntersection = this.clippingDirection === 'inside';
            mesh.material.needsUpdate = true;
            
            console.log(`Material clipping applied to ${mesh.uuid}`);
        }
        
        applyWebGPUClipping(mesh, clippingPlane) {
            // For WebGPU, we'll use a different approach
            // Store the clipping plane data for custom shader or geometry manipulation
            if (!this.clippingPlanes[mesh.uuid]) {
                this.clippingPlanes[mesh.uuid] = [];
            }
            
            // Store clipping plane data
            this.clippingPlanes[mesh.uuid].push({
                normal: clippingPlane.normal.clone(),
                d: clippingPlane.d,
                direction: this.clippingDirection
            });
            
            // For now, let's use the original destructive approach as fallback
            console.log('WebGPU fallback: Using geometry clipping');
            this.applyGeometryClipping(mesh, clippingPlane);
        }
        
        applyGeometryClipping(mesh, clippingPlane) {
            // Store original geometry if not already stored
            const meshId = mesh.uuid;
            if (!this.originalGeometries[meshId]) {
                this.originalGeometries[meshId] = mesh.geometry.clone();
                console.log(`Stored original geometry for ${meshId}`);
            }
            
            const originalGeometry = this.originalGeometries[meshId];
            const positions = originalGeometry.attributes.position.array;
            const indices = originalGeometry.index ? originalGeometry.index.array : null;
            
            // Create visibility array to track which vertices are visible
            const vertexVisibility = new Array(positions.length / 3).fill(false);
            
            // Test each vertex against clipping plane
            for (let i = 0; i < positions.length; i += 3) {
                const vertex = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
                const distance = clippingPlane.normal.dot(vertex) + clippingPlane.d;
                
                // Mark vertices as visible based on clipping direction
                const shouldShow = this.clippingDirection === 'outside' ? distance > 0 : distance < 0;
                vertexVisibility[i / 3] = shouldShow;
            }
            
            // Create new positions array with only visible vertices
            const newPositions = [];
            const vertexMap = new Map();
            let newVertexIndex = 0;
            
            for (let i = 0; i < positions.length; i += 3) {
                if (vertexVisibility[i / 3]) {
                    newPositions.push(positions[i], positions[i + 1], positions[i + 2]);
                    vertexMap.set(i / 3, newVertexIndex);
                    newVertexIndex++;
                }
            }
            
            // Create new indices array with only visible triangles
            const newIndices = [];
            if (indices) {
                for (let i = 0; i < indices.length; i += 3) {
                    const a = indices[i];
                    const b = indices[i + 1];
                    const c = indices[i + 2];
                    
                    // Only keep triangles where all 3 vertices are visible
                    if (vertexVisibility[a] && vertexVisibility[b] && vertexVisibility[c]) {
                        newIndices.push(vertexMap.get(a), vertexMap.get(b), vertexMap.get(c));
                    }
                }
            }
            
            // Create new geometry with only visible vertices
            const newGeometry = new THREE.BufferGeometry();
            newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
            
            if (newIndices.length > 0) {
                newGeometry.setIndex(newIndices);
            }
            
            newGeometry.computeVertexNormals();
            
            // Replace geometry
            mesh.geometry.dispose();
            mesh.geometry = newGeometry;
            
            console.log(`Soft clipping: ${positions.length/3} total -> ${newPositions.length/3} visible vertices`);
        }
        
        restoreOriginalGeometry(targetLayer) {
            let targetMesh = null;
            switch(targetLayer) {
                case 'crust': targetMesh = this.crust; break;
                case 'mantle': targetMesh = this.mantle; break;
                case 'core': targetMesh = this.core; break;
                default: console.log('Invalid layer'); return;
            }
            
            if (targetMesh) {
                if (this.renderer.isWebGPURenderer) {
                    // For WebGPU, restore original geometry using mesh UUID
                    const meshId = targetMesh.uuid;
                    if (this.originalGeometries[meshId]) {
                        targetMesh.geometry.dispose();
                        targetMesh.geometry = this.originalGeometries[meshId].clone();
                        console.log(`Restored original geometry for ${targetLayer} (${meshId})`);
                    } else {
                        console.log(`No original geometry found for ${targetLayer} (${meshId})`);
                    }
                } else {
                    // Clear material clipping
                    if (targetMesh.material.clippingPlanes) {
                        targetMesh.material.clippingPlanes = [];
                        targetMesh.material.needsUpdate = true;
                    }
                }
                
                // Clear stored clipping planes
                if (this.clippingPlanes[targetMesh.uuid]) {
                    delete this.clippingPlanes[targetMesh.uuid];
                }
                
                console.log(`Restored clipping for ${targetLayer}`);
            }
        }
        
        applyRealtimeClipping() {
            console.log('Applying real-time clipping...');
            
            // For WebGPU, we need to re-apply geometry clipping
            if (this.renderer.isWebGPURenderer) {
                // Check which layers are selected for clipping
                const crustSelected = document.getElementById('clipCrust').checked;
                const mantleSelected = document.getElementById('clipMantle').checked;
                const coreSelected = document.getElementById('clipCore').checked;
                
                // Re-apply clipping to selected layers
                if (crustSelected && this.crust && this.crust.visible) {
                    this.clipSphereWithPolygon('crust');
                }
                if (mantleSelected && this.mantle && this.mantle.visible) {
                    this.clipSphereWithPolygon('mantle');
                }
                if (coreSelected && this.core && this.core.visible) {
                    this.clipSphereWithPolygon('core');
                }
            } else {
                // For WebGL, use material clipping updates
                if (this.crust && this.crust.visible) {
                    this.updateMaterialClipping('crust');
                }
                if (this.mantle && this.mantle.visible) {
                    this.updateMaterialClipping('mantle');
                }
                if (this.core && this.core.visible) {
                    this.updateMaterialClipping('core');
                }
            }
        }
        
        reapplyClippingToAllLayers() {
            console.log('Re-applying clipping with new direction...');
            
            // First restore all layers to original state
            this.restoreOriginalGeometry('crust');
            this.restoreOriginalGeometry('mantle');
            this.restoreOriginalGeometry('core');
            
            // Then re-apply clipping with new direction
            if (this.crust && this.crust.visible) {
                this.clipSphereWithPolygon('crust');
            }
            if (this.mantle && this.mantle.visible) {
                this.clipSphereWithPolygon('mantle');
            }
            if (this.core && this.core.visible) {
                this.clipSphereWithPolygon('core');
            }
            
            console.log('Clipping re-applied with new direction');
        }
        
        updateMaterialClipping(targetLayer) {
            if (!this.clippingPolygon || this.clippingPolygon.length < 3) {
                console.log('No clipping polygon available');
                return;
            }
            
            // Get the target layer
            let targetMesh = null;
            switch(targetLayer) {
                case 'crust': targetMesh = this.crust; break;
                case 'mantle': targetMesh = this.mantle; break;
                case 'core': targetMesh = this.core; break;
                default: console.log('Invalid layer'); return;
            }
            
            if (!targetMesh) {
                console.log(`${targetLayer} layer not found`);
                return;
            }
            
            // Create new clipping plane from current polygon position
            const clippingPlane = this.calculateClippingPlane();
            if (!clippingPlane) {
                console.log('Failed to calculate clipping plane');
                return;
            }
            
            // Update existing clipping plane or create new one
            if (targetMesh.material.clippingPlanes && targetMesh.material.clippingPlanes.length > 0) {
                // Update existing plane
                const plane = targetMesh.material.clippingPlanes[0];
                plane.normal.copy(clippingPlane.normal);
                plane.constant = clippingPlane.d;
            } else {
                // Create new plane
                const plane = new THREE.Plane(
                    clippingPlane.normal.clone(),
                    clippingPlane.d
                );
                targetMesh.material.clippingPlanes = [plane];
                targetMesh.material.clipIntersection = this.clippingDirection === 'inside';
            }
            
            targetMesh.material.needsUpdate = true;
        }
        
        updatePolygonPosition() {
            if (!this.originalPolygonPoints || !this.clippingPolygon) {
                console.log('No polygon points available');
                return;
            }
            
            console.log(`Moving polygon along ${this.polygonAxis} axis by ${this.polygonPosition}`);
            
            // Update polygon points based on axis and position
            this.clippingPolygon.forEach((point, index) => {
                const originalPoint = this.originalPolygonPoints[index];
                
                // Reset to original position
                point.copy(originalPoint);
                
                // Apply rotation first (if any)
                if (this.polygonRotation !== 0) {
                    const rotationMatrix = new THREE.Matrix4();
                    const rotationRadians = (this.polygonRotation * Math.PI) / 180;
                    
                    if (this.polygonRotationAxis === 'x') {
                        rotationMatrix.makeRotationX(rotationRadians);
                    } else if (this.polygonRotationAxis === 'y') {
                        rotationMatrix.makeRotationY(rotationRadians);
                    } else if (this.polygonRotationAxis === 'z') {
                        rotationMatrix.makeRotationZ(rotationRadians);
                    }
                    
                    point.applyMatrix4(rotationMatrix);
                }
                
                // Then apply movement along selected axis
                if (this.polygonAxis === 'x') {
                    point.x += this.polygonPosition;
                } else if (this.polygonAxis === 'y') {
                    point.y += this.polygonPosition;
                } else if (this.polygonAxis === 'z') {
                    point.z += this.polygonPosition;
                }
            });
            
            // Update visual polygon (cylinders and fill)
            this.updatePolygonVisuals();
            
            // Apply real-time clipping if enabled
            if (this.realtimeClipping) {
                this.applyRealtimeClipping();
            } else {
                // Even without real-time, update clipping when polygon moves
                this.updateClippingOnPolygonMove();
            }
        }
        
        updatePolygonVisuals() {
            if (!this.clippingPolygon || !this.sphereCylinders || !this.spherePolygon) return;
            
            // Update cylinder positions
            this.clippingPolygon.forEach((point, index) => {
                if (this.sphereCylinders[index]) {
                    this.sphereCylinders[index].position.copy(point);
                }
            });
            
            // Update polygon fill geometry
            const positions = [];
            this.clippingPolygon.forEach(point => {
                positions.push(point.x, point.y, point.z);
            });
            
            this.spherePolygon.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            this.spherePolygon.geometry.attributes.position.needsUpdate = true;
            
            console.log('Polygon visuals updated');
        }
        
        updatePolygonTransform() {
            if (!this.originalPolygonPoints || !this.clippingPolygon) {
                console.log('No polygon points available for transform');
                return;
            }
            
            console.log(`Rotating polygon around ${this.polygonRotationAxis} axis by ${this.polygonRotation}°`);
            
            // Create rotation matrix
            const rotationMatrix = new THREE.Matrix4();
            const rotationRadians = (this.polygonRotation * Math.PI) / 180;
            
            if (this.polygonRotationAxis === 'x') {
                rotationMatrix.makeRotationX(rotationRadians);
            } else if (this.polygonRotationAxis === 'y') {
                rotationMatrix.makeRotationY(rotationRadians);
            } else if (this.polygonRotationAxis === 'z') {
                rotationMatrix.makeRotationZ(rotationRadians);
            }
            
            // Apply rotation to each point
            this.clippingPolygon.forEach((point, index) => {
                const originalPoint = this.originalPolygonPoints[index];
                point.copy(originalPoint);
                point.applyMatrix4(rotationMatrix);
                
                // Apply position offset after rotation
                if (this.polygonPosition !== 0) {
                    if (this.polygonAxis === 'x') {
                        point.x += this.polygonPosition;
                    } else if (this.polygonAxis === 'y') {
                        point.y += this.polygonPosition;
                    } else if (this.polygonAxis === 'z') {
                        point.z += this.polygonPosition;
                    }
                }
            });
            
            // Update visuals
            this.updatePolygonVisuals();
            
            // Apply real-time clipping if enabled
            if (this.realtimeClipping) {
                this.applyRealtimeClipping();
            } else {
                // Even without real-time, update clipping when polygon moves
                this.updateClippingOnPolygonMove();
            }
        }
        
        checkAllLayersForClipping() {
            // Check all layer checkboxes when real-time is turned on
            document.getElementById('clipCrust').checked = true;
            document.getElementById('clipMantle').checked = true;
            document.getElementById('clipCore').checked = true;
            console.log('All layers checked for clipping');
        }
        
        restoreAllLayers() {
            // Restore all layers to original geometry
            this.restoreOriginalGeometry('crust');
            this.restoreOriginalGeometry('mantle');
            this.restoreOriginalGeometry('core');
            console.log('All layers restored to original state');
        }
        
        handleLayerSelectionChange(layerName) {
            if (!this.realtimeClipping) return; // Only handle if real-time is on
            
            const isSelected = document.getElementById(`clip${layerName.charAt(0).toUpperCase() + layerName.slice(1)}`).checked;
            console.log(`${layerName} selection changed: ${isSelected}`);
            
            if (isSelected) {
                // Apply clipping to this layer
                this.clipSphereWithPolygon(layerName);
            } else {
                // Restore this layer to original geometry
                this.restoreOriginalGeometry(layerName);
            }
        }
        
        
        applyClippingToSelectedLayers() {
            console.log('Applying clipping to selected layers...');
            
            // Check which layers are selected for clipping
            const crustSelected = document.getElementById('clipCrust').checked;
            const mantleSelected = document.getElementById('clipMantle').checked;
            const coreSelected = document.getElementById('clipCore').checked;
            
            console.log(`Selected layers - Crust: ${crustSelected}, Mantle: ${mantleSelected}, Core: ${coreSelected}`);
            
            // Apply clipping only to selected layers
            if (crustSelected && this.crust && this.crust.visible) {
                this.clipSphereWithPolygon('crust');
            }
            if (mantleSelected && this.mantle && this.mantle.visible) {
                this.clipSphereWithPolygon('mantle');
            }
            if (coreSelected && this.core && this.core.visible) {
                this.clipSphereWithPolygon('core');
            }
        }
        
        updateClippingOnPolygonMove() {
            if (!this.realtimeClipping) return; // Only update if real-time is enabled
            
            console.log('Updating clipping due to polygon movement...');
            
            // Only update clipping for layers that are selected for clipping
            const crustSelected = document.getElementById('clipCrust').checked;
            const mantleSelected = document.getElementById('clipMantle').checked;
            const coreSelected = document.getElementById('clipCore').checked;
            
            // For WebGPU, we need to re-apply geometry clipping
            if (this.renderer.isWebGPURenderer) {
                // Update clipping for selected layers only
                if (crustSelected && this.crust && this.crust.visible) {
                    this.clipSphereWithPolygon('crust');
                }
                if (mantleSelected && this.mantle && this.mantle.visible) {
                    this.clipSphereWithPolygon('mantle');
                }
                if (coreSelected && this.core && this.core.visible) {
                    this.clipSphereWithPolygon('core');
                }
            } else {
                // For WebGL, use material clipping updates
                if (crustSelected && this.crust && this.crust.visible) {
                    this.updateMaterialClipping('crust');
                }
                if (mantleSelected && this.mantle && this.mantle.visible) {
                    this.updateMaterialClipping('mantle');
                }
                if (coreSelected && this.core && this.core.visible) {
                    this.updateMaterialClipping('core');
                }
            }
        }
        
        updatePolygonSize() {
            console.log(`Updating polygon size: ${this.polygonWidth} x ${this.polygonHeight}`);
            
            // Recreate polygon with new size
            this.recreatePolygon();
            
            // Apply real-time clipping if enabled
            if (this.realtimeClipping) {
                this.applyRealtimeClipping();
            }
        }
        
        recreatePolygon() {
            if (!this.originalPolygonPoints) return;
            
            // Clear existing polygon
            this.clearPolygon();
            
            // Create new polygon with current size - relative to sphere radius
            const sphereRadius = 80;
            const widthRatio = this.polygonWidth / 50; // Convert 1-50 to 0.02-1.0 ratio
            const heightRatio = this.polygonHeight / 50; // Convert 1-50 to 0.02-1.0 ratio
            
            const halfWidth = (sphereRadius * widthRatio) / 2;
            const halfHeight = (sphereRadius * heightRatio) / 2;
            
            const points = [
                new THREE.Vector3(halfWidth, halfHeight, 4),
                new THREE.Vector3(-halfWidth, halfHeight, 4),
                new THREE.Vector3(-halfWidth, -halfHeight, 4),
                new THREE.Vector3(halfWidth, -halfHeight, 4)
            ];
            
            // Normalize points to sphere surface
            points.forEach(point => {
                point.normalize().multiplyScalar(sphereRadius);
            });
            
            // Update clipping polygon
            this.clippingPolygon = points;
            this.originalPolygonPoints = points.map(p => p.clone());
            
            // Create visual elements
            this.createPolygonVisuals();
            
            console.log('Polygon recreated with new size');
        }
        
        createPolygonVisuals() {
            if (!this.clippingPolygon) return;
            
            const cylinderHeight = 3;
            const cylinderRadius = 0.5;
            
            // Create cylinders
            this.sphereCylinders = [];
            this.clippingPolygon.forEach((point, index) => {
                const cylinderGeometry = new THREE.CylinderGeometry(cylinderRadius, cylinderRadius, cylinderHeight, 8);
                const cylinderMaterial = new THREE.MeshBasicMaterial({ 
                    color: 0x0088ff,
                    transparent: false
                });
                
                const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
                cylinder.position.copy(point);
                
                const direction = point.clone().normalize();
                cylinder.lookAt(direction);
                cylinder.rotateX(Math.PI / 2);
                
                this.scene.add(cylinder);
                this.sphereCylinders.push(cylinder);
            });
            
            // Create polygon fill
            const polygonGeometry = new THREE.BufferGeometry();
            const positions = [];
            
            this.clippingPolygon.forEach(point => {
                positions.push(point.x, point.y, point.z);
            });
            
            polygonGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
            const indices = [0, 1, 2, 0, 2, 3];
            polygonGeometry.setIndex(indices);
            
            const polygonMaterial = new THREE.MeshBasicMaterial({
                color: 0x0088ff,
                transparent: true,
                opacity: 0.4,
                side: THREE.DoubleSide
            });
            
            this.spherePolygon = new THREE.Mesh(polygonGeometry, polygonMaterial);
            this.scene.add(this.spherePolygon);
        }
        
        clearPolygon() {
            // Clear cylinders
            if (this.sphereCylinders) {
                this.sphereCylinders.forEach(cylinder => {
                    this.scene.remove(cylinder);
                    cylinder.geometry.dispose();
                    cylinder.material.dispose();
                });
                this.sphereCylinders = [];
            }
            
            // Clear polygon fill
            if (this.spherePolygon) {
                this.scene.remove(this.spherePolygon);
                this.spherePolygon.geometry.dispose();
                this.spherePolygon.material.dispose();
                this.spherePolygon = null;
            }
    }
}

// Start the app
new WebGPUGlobe();
