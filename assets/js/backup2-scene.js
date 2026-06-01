(function() {
        let scene, camera, renderer, particles, positions, targetPositions;
        let windowHalfX = window.innerWidth / 2;
        let windowHalfY = window.innerHeight / 2;
        
        // Kích thước canvas (giống universe/main.js)
        let w = window.innerWidth;
        let h = window.innerHeight;
        
        // Thời gian bắt đầu animation
        let startTime = Date.now();
        // Thời gian để các hạt xoay/chuyển động tự do (ms)
        const chaosDuration = 4000;
        // Thời gian để các hạt di chuyển từ vũ trụ thành trái tim (ms)
        const duration = 8000;
        
        // Thêm mảng để lưu trữ thông tin animation cho từng hạt (giống universe/main.js)
        let particleAnimations = [];
        
        // Hàm tính maxOrbit giống universe/main.js
        function maxOrbit(x, y) {
            var max = Math.max(x, y);
            var diameter = Math.round(Math.sqrt(max * max + max * max));
            return diameter / 2;
        }
        
        // Hàm random giống universe/main.js
        function randomRange(min, max) {
            if (arguments.length < 2) {
                max = min;
                min = 0;
            }
            if (min > max) {
                var hold = max;
                max = min;
                min = hold;
            }
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }
        
        // ========== CHỈNH GÓC BẮT ĐẦU CỦA TRÁI TIM ==========
        // Góc xoay ban đầu của trái tim (theo radian)
        // 0 = thẳng đứng, Math.PI/2 = 90 độ, Math.PI = 180 độ, -Math.PI/2 = -90 độ
        // Ví dụ: Math.PI/4 = 45 độ, -Math.PI/6 = -30 độ
        const heartInitialRotationY = Math.PI / 2; // Xoay quanh trục Y (trái/phải)
        const heartInitialRotationX = 0; // Xoay quanh trục X (lên/xuống) - 90 độ để cạnh hướng ra màn hình
        const heartInitialRotationZ = 0; // Xoay quanh trục Z (nghiêng)
        // ====================================================

        // ========== CONFIG từ APP_CONFIG (config.js) ==========
        const HEART_MESSAGE_CONFIG = (typeof window !== 'undefined' && window.APP_CONFIG && window.APP_CONFIG.heart) || { mode: 'days', loveStartDate: '2024-01-15', loveNameLeft: 'Trí Toán', loveNameRight: 'Yên Hà' };

        function updateHeartSideNames() {
            const leftEl = document.getElementById('heart-side-name-left');
            const rightEl = document.getElementById('heart-side-name-right');
            if (leftEl) leftEl.textContent = HEART_MESSAGE_CONFIG.loveNameLeft || '';
            if (rightEl) rightEl.textContent = HEART_MESSAGE_CONFIG.loveNameRight || '';
        }

        function updateHeartMessage() {
            const el = document.getElementById('message');
            if (!el) return;
            if (HEART_MESSAGE_CONFIG.mode === 'valentine') {
                const l1 = (HEART_MESSAGE_CONFIG.valentineMessageLine1 || "Happy Valentine's Day!").replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const l2 = (HEART_MESSAGE_CONFIG.valentineMessageLine2 || "You are my universe.").replace(/</g, '&lt;').replace(/>/g, '&gt;');
                el.innerHTML = l1 + "<br><span style=\"font-size: 0.6em\">" + l2 + "</span>";
            } else {
                const daysLabel = (HEART_MESSAGE_CONFIG.loveDaysLabel || 'Đang Yêu').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                const startStr = (HEART_MESSAGE_CONFIG.loveStartDate || '').trim();
                if (!startStr) {
                    el.innerHTML = "<span class=\"heart-line1\">" + daysLabel + "</span>";
                } else {
                    const start = new Date(startStr);
                    const today = new Date();
                    start.setHours(0, 0, 0, 0);
                    today.setHours(0, 0, 0, 0);
                    const diffMs = today - start;
                    const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
                    el.innerHTML = "<span class=\"heart-days-number\">" + diffDays + " ngày</span>";
                }
            }
        }
        
        // Trạng thái animation: chaos -> heart -> flyout (trái tim vỡ, hạt bay ra) -> sphere
        let animationState = 'chaos';
        let heartRotationCount = 0;
        let originalParticleCount = 15000; // Số hạt ban đầu (trái tim)
        let expandedParticleCount = 0;
        
        // Hạt bay ra từ chính trái tim đó khi xoay đủ 1 vòng (chỉ một trái tim, không tạo trái tim khác)
        let flyOutParticles = null;      // THREE.Points — hạt từ trái tim bay ra
        let flyOutPositions = null;      // Float32Array
        let flyOutStartPositions = null; // Xuất phát: vị trí trên trái tim
        let flyOutTargetPositions = null;// Đích: phân bố không gian
        let flyOutStartTime = 0;         // Thời điểm bắt đầu tan ra (để lerp trong 5s)
        let flyOutVelocities = [];       // [{x,y,z}, ...] - drift nhẹ
        let flyOutFloatPhase = [];       // phase cho dao động lơ lửng
        let flyOutFloatAmplitude = [];   // biên độ lơ lửng
        const cfg3d = (typeof window !== 'undefined' && window.APP_CONFIG) || {};
        const FLYOUT_SPREAD_DURATION_MS = cfg3d.flyOutSpreadDurationMs || 5000;
        const HEART_DELAY_BEFORE_FLYOUT_MS = cfg3d.heartDelayBeforeFlyoutMs || 5000;
        let heartDelayEndTime = 0; // Thời điểm kết thúc delay (0 = chưa set)
        let heartLetterButtonShown = false; // Đã hiện nút thư ở chế độ chỉ có trái tim 

        // ========== PHASE QUẢ CẦU (sau khi canvas ảnh biến mất 2s) ==========
        let controls = null; // OrbitControls - tạo khi vào phase sphere
        const sphereOriginalImages = (cfg3d.sphereImages && cfg3d.sphereImages.length > 0) ? cfg3d.sphereImages : [];
        let sphereGroup = null, sphereMeshes = [], capMeshes = [];
        let sphereLoadedTextures = [], sphereTexturesForSphere = [], sphereLoadedCount = 0;
        let sphereTextureLoader = null;
        const sphereRadius = 6;
        const sphereRows = 6;
        const spherePolarMargin = 0.15;
        let spherePhiStart = 0, spherePhiEnd = 0, spherePhiRange = 0;
        let sphereIntroComplete = false, sphereIntroStartTime = 0, sphereIntroCompleteTime = 0;
        const SPHERE_INTRO_DURATION_MS = 2800;   // Thời gian bay từ ngoài vào ghép quả cầu
        const SPHERE_INTRO_STAGGER_MS = 900;      // Stagger khi bay vào
        let sphereHintClickShown = false, sphereHintFlyShown = false;
        const SPHERE_HINT_DELAY_MS = 5000;        // 5s sau mới hiện gợi ý
        const SPHERE_HINT_DURATION_MS = 3000;     // Hiện gợi ý 3s
        const SPHERE_INTRO_RADIUS = 16;          // Phân bố toàn không gian (như imageheart) rồi bay vào tạo quả cầu
        let sphereIsExploded = false, sphereHasZoomedIn = false, sphereNeedZoomIn = false, sphereZoomInTime = 0;
        const sphereZoomInTargetPosition = new THREE.Vector3();
        let sphereFloatingImages = [], sphereExplosionProgress = 0, sphereExplosionStartTime = 0;
        let sphereFadeProgress = 0;
        let sphereIsFinalFlyUp = false, sphereFinalFlyUpStartTime = 0;
        let sphereNeedSmoothCameraReset = false;
        const sphereSmoothCameraTarget = new THREE.Vector3(0, 0, 0);
        let sphereSmoothCameraPosition = null;
        const sphereValentineText = (cfg3d.letter && cfg3d.letter.text) || "Từ lâu lắm rồi, trong một thế giới không xa, có hai trái tim tìm thấy nhau...\n\nMỗi khoảnh khắc bên em đều là món quà. Mỗi nụ cười của em là ánh sáng của anh. Cảm ơn em đã chọn anh.\n\nDù thời gian trôi, dù đường đời có gập ghềnh, anh vẫn muốn đi cùng em đến cuối con đường.\n\nHappy Valentine, tình yêu của anh.... 💕";
        let sphereTextCrawlMesh = null, sphereTextCrawlStarted = false;
        const SPHERE_TEXT_CRAWL_SPEED = 0.025;
        let sphereTextStopY = 0;
        let sphereTypingStarted = false;
        const SPHERE_TYPING_SPEED_MS = 50;
        let         sphereLetterShown = false;
        const sphereTextDisplayMode = 'typing';
        
        // ========== CONFIG CÁC LOẠI THƯ (Letter Types) ==========
        const LETTER_TYPES = { TYPING: 'typing', CRAWL: 'crawl', CUPID: 'cupid' };
        const letterTypeCfg = (cfg3d.letter && cfg3d.letter.type) || 'typing';
        let sphereLetterType = LETTER_TYPES[letterTypeCfg.toUpperCase()] || LETTER_TYPES.TYPING;
        const LETTER_SIGNATURE_TEXT = (cfg3d.letter && typeof cfg3d.letter.signatureText === 'string')
            ? cfg3d.letter.signatureText
            : '';
        
        // Biến trạng thái cho kiểu thư Cupid
        let cupidLetterState = 'hidden'; // hidden | flying | letterImage | showingLetter
        let cupidFlyStartTime = 0;
        const CUPID_FLY_DURATION_MS = 2000;  // 2s bay từ góc trái lên giữa
        const CUPID_VALENTINE_TEXT = sphereValentineText;
        let sphereRaycaster = null, sphereMouse = null, sphereClickSphere = null;
        let sphereParticlesMesh = null;
        let sphereRainUpParticles = null;   // Hạt mưa bay lên từ dưới (random, kiểu mưa ngược)
        let sphereRainUpPositions = null;
        let sphereFloatingGroup = null;
        let sphereDriftTiltAngle = 0, sphereDriftTiltDirection = 1;
        const SPHERE_DRIFT_TILT_MAX = 0.25;
        const SPHERE_DRIFT_TILT_SPEED = 0.0003;
        const SPHERE_CLICK_DRAG_THRESHOLD = 6;
        let sphereMouseDownX = 0, sphereMouseDownY = 0, sphereIsPointerDown = false, sphereWasDrag = false;
        let sphereTime = 0;
        // Cùng một camera cho cả trái tim/ảnh và quả cầu (không đổi z → không giật)
        const UNIFIED_CAMERA_Z = 10;
        const UNIFIED_CAMERA_Z_MOBILE = 11;   // Mobile: camera gần hơn (tránh dot tròn nhỏ, trái tim nhỏ)
        const HEART_PHASE_SCALE = 0.026;        // scale trái tim desktop
        const HEART_PHASE_SCALE_MOBILE = 0.020; // scale trái tim mobile (khác desktop)
        const CHAOS_ORBIT_SCALE_MOBILE = 0.028; // mobile: vùng dot đoạn đầu rộng hơn (chỉ cho orbit ban đầu)
        let effectiveHeartScale = HEART_PHASE_SCALE; // scale orbit chaos (set trong init)
        const FLYOUT_BOUND = 10; // hạt bay lơ lửng giữ trong khung cam và ngoài một chút (-10..10)
        const SPHERE_PARTICLE_ORBIT_SPEED = 0.003; // Hạt trong không gian: chỉ xoay theo trục cam (Y)
        const SPHERE_RAIN_UP_SPEED = 0.025;        // Hạt mưa bay lên từ dưới (random từ dưới → lên)
        const SPHERE_RAIN_UP_COUNT = 450;          // Số hạt mưa bay lên
        const SPHERE_RAIN_TOP_MAX = 6;             // Trần Y: reset trước khi chạm viền trên (tránh hạt dính viền)
        let renderFrameCount = 0; // throttle cập nhật hạt mỗi 2 frame để giảm lag (transitioning + image+Canvas2D)
        let particleFadeOutStartTime = 0;          // Khi mở thư: bắt đầu fade hạt từ từ (giảm lag)
        const PARTICLE_FADEOUT_DURATION_MS = 2500; // 2.5s fade out hạt

        // Service Worker: bỏ qua (file sw.js không tồn tại trong bản local)

        function init() {
            updateHeartMessage();
            updateHeartSideNames();
            if (HEART_MESSAGE_CONFIG.mode === 'days') {
                const root = document.getElementById('scene3d-root');
                if (root) root.classList.add('heart-mode-days');
            }

            // 1. Tạo Scene (Khung cảnh) và Camera
            scene = new THREE.Scene();
            // Thêm sương mù nhẹ để tạo chiều sâu
            scene.fog = new THREE.FogExp2(0x000000, 0.0008);

            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            const isMobileInit = window.innerWidth < 768;
            camera.position.z = isMobileInit ? UNIFIED_CAMERA_Z_MOBILE : UNIFIED_CAMERA_Z;
            const heartScale = isMobileInit ? HEART_PHASE_SCALE_MOBILE : HEART_PHASE_SCALE; // kích thước trái tim
            const chaosOrbitScale = isMobileInit ? CHAOS_ORBIT_SCALE_MOBILE : HEART_PHASE_SCALE; // vùng dot đầu
            effectiveHeartScale = chaosOrbitScale;

            // 2. Tạo Renderer
            // Tắt antialias và giới hạn pixel ratio để tăng performance
            renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Giới hạn tối đa 2x
            renderer.setSize(window.innerWidth, window.innerHeight);
            renderer.domElement.id = 'threejs-canvas';
            (window.SCENE3D_CONTAINER || document.body).appendChild(renderer.domElement);

            const isLetterOnlyMode = HEART_MESSAGE_CONFIG.mode === 'none' && sphereOriginalImages.length === 0 && cfg3d.enableLetter === true;
            
            // 3. Tạo Hạt (Particles) — bỏ qua khi chỉ có thư (không heart, không quả cầu)
            if (!isLetterOnlyMode) {
            const particleCount = 8000; // Số lượng hạt ban đầu (trái tim)
            originalParticleCount = particleCount;
            const geometry = new THREE.BufferGeometry();
            positions = new Float32Array(particleCount * 3); // Vị trí hiện tại
            targetPositions = new Float32Array(particleCount * 3); // Vị trí mục tiêu (hình trái tim)
            const initialPositions = new Float32Array(particleCount * 3); // Vị trí ban đầu (vũ trụ)
            const colors = new Float32Array(particleCount * 3);

            const colorBase = new THREE.Color(0xff4d6d); // Màu hồng cơ bản

            for (let i = 0; i < particleCount; i++) {
                let i3 = i * 3;

                // --- TẠO HÌNH DẠNG TRÁI TIM (Target Positions) ---
                // Trái tim: heartScale (mobile khác desktop)
                const t = Math.random() * Math.PI * 2;
                const scale = 12 * heartScale;
                let x_heart = 16 * Math.pow(Math.sin(t), 3);
                let y_heart = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
                let z_heart = (Math.random() - 0.5) * scale * 8; 
                targetPositions[i3] = x_heart * scale + (Math.random()-0.5)*3 * heartScale;
                targetPositions[i3 + 1] = y_heart * scale + (Math.random()-0.5)*3 * heartScale;
                targetPositions[i3 + 2] = z_heart + (Math.random()-0.5)*3 * heartScale;

                // --- TẠO VŨ TRỤ BAN ĐẦU - PHÂN BỐ ĐỀU TRÊN HÌNH CẦU 3D (mobile: rộng hơn) ---
                const maxOrbitRadius = maxOrbit(w, h);
                const orbitRadius = randomRange(50, maxOrbitRadius); // Bán kính quỹ đạo (tối thiểu 50 để không quá gần tâm)
                const speed = (randomRange(50, 150) / 100000); // Tốc độ xoay chậm và đều
                const alpha = randomRange(2, 10) / 10; // Độ trong suốt
                
                // PHÂN BỐ ĐỀU TRÊN BỀ MẶT CẦU (Uniform Spherical Distribution)
                // theta: góc trong mặt phẳng XY (0 đến 2π)
                // phi: góc từ cực (sử dụng acos để phân bố đều)
                const theta = Math.random() * Math.PI * 2; // 0 đến 360 độ
                const phi = Math.acos(2 * Math.random() - 1); // Phân bố đều từ 0 đến π
                
                const scaleForThreeJS = 0.5 * chaosOrbitScale; // mobile: chaosOrbitScale lớn hơn → vùng dot rộng hơn
                const r = orbitRadius * scaleForThreeJS;
                
                // Công thức tọa độ cầu -> Descartes
                const initX = r * Math.sin(phi) * Math.cos(theta);
                const initY = r * Math.sin(phi) * Math.sin(theta);
                const initZ = r * Math.cos(phi);
                
                // Lưu thông tin animation cho từng hạt
                // Mỗi hạt sẽ xoay quanh trục riêng (trục vuông góc với vị trí ban đầu)
                particleAnimations.push({
                    orbitRadius: orbitRadius,
                    theta: theta,        // Góc theta ban đầu
                    phi: phi,            // Góc phi (cố định - xác định mặt phẳng quỹ đạo)
                    timePassed: theta,   // Bắt đầu từ vị trí theta
                    speed: speed,
                    alpha: alpha
                });
                
                initialPositions[i3] = initX;
                initialPositions[i3+1] = initY;
                initialPositions[i3+2] = initZ;

                // Gán vị trí ban đầu cho mảng vị trí hiện tại
                positions[i3] = initialPositions[i3];
                positions[i3+1] = initialPositions[i3+1];
                positions[i3+2] = initialPositions[i3+2];

                // --- MÀU SẮC ---
                // Tạo biến thể màu sắc từ hồng sang hơi trắng/vàng
                let randomTint = Math.random() * 0.3;
                colors[i3] = colorBase.r + randomTint;     // R
                colors[i3 + 1] = colorBase.g + randomTint*0.5; // G
                colors[i3 + 2] = colorBase.b + randomTint;     // B
            }

            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('targetPosition', new THREE.BufferAttribute(targetPositions, 3));
            geometry.setAttribute('initialPosition', new THREE.BufferAttribute(initialPositions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            // --- TẠO VẬT LIỆU CHO HẠT ---
            // Tạo texture hình tròn với edge mềm mại, giống như particle-image.js vẽ trực tiếp
            // Texture trắng để vertexColors hoạt động đúng
            let canvasTexture = document.createElement('canvas');
            canvasTexture.width = 64; canvasTexture.height = 64;
            let ctx = canvasTexture.getContext('2d');
            // Vẽ hình tròn với gradient mềm mại để edge không cứng
            const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(0.7, 'rgba(255, 255, 255, 1)');
            gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(32, 32, 30, 0, Math.PI * 2);
            ctx.fill();
            let texture = new THREE.CanvasTexture(canvasTexture);

            const material = new THREE.PointsMaterial({
                size: 2.4 * heartScale, // Trái tim: mobile khác desktop
                map: texture,
                vertexColors: true, // Sử dụng màu riêng cho từng hạt
                blending: THREE.AdditiveBlending, // Chế độ hòa trộn cho trái tim
                depthTest: false, // Tắt depth test để các hạt không che nhau và màu sáng hơn
                transparent: true,
                opacity: 1.0, // Opacity đầy đủ để màu sắc rõ nét
                sizeAttenuation: true // Cho phép size thay đổi theo khoảng cách
            });

            particles = new THREE.Points(geometry, material);
            scene.add(particles);

            // Mobile + mode days: dịch trái tim (dot) lên trên
            var heartOffsetY = (HEART_MESSAGE_CONFIG && HEART_MESSAGE_CONFIG.mobileHeartOffsetY) || 0.7;
            if (isMobileInit && HEART_MESSAGE_CONFIG.mode === 'days' && heartOffsetY) {
                particles.position.y = heartOffsetY;
            }
            }

            const ambientLight = new THREE.AmbientLight(0xffffff, 1);
            scene.add(ambientLight);

            // Event listeners
            window.addEventListener('resize', onWindowResize);

            // Gắn click thư để dùng cho cả chế độ chỉ trái tim và chế độ có quả cầu
            document.getElementById('letter-envelope-img')?.addEventListener('click', handleLetterEnvelopeClick);

            // Chế độ none: không trái tim
            if (HEART_MESSAGE_CONFIG.mode === 'none') {
                if (sphereOriginalImages.length > 0) {
                    // Có ảnh quả cầu → vào thẳng phase quả cầu
                    animationState = 'sphere';
                    startSpherePhase();
                } else if (cfg3d.enableLetter === true) {
                    // Không heart, không quả cầu, chỉ có thư → chạy thẳng UI thư
                    animationState = 'letterOnly';
                    setTimeout(function() { sphereShowLetter(); }, 150);
                } else {
                    animationState = 'sphere';
                    startSpherePhase();
                }
            }
        }

        // Hàm Easing để chuyển động mượt mà hơn (Cubic In-Out)
        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }
        
        // Hàm Easing để tốc độ giảm dần (Ease Out Cubic)
        function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
        }

        function animate() {
            requestAnimationFrame(animate);
            render();
        }

        function render() {
            renderFrameCount++;
            const time = Date.now();

            // ========== CHỈ CÓ THƯ (không heart, không quả cầu): cập nhật cupid fly + render ==========
            if (animationState === 'letterOnly') {
                if (cupidLetterState === 'flying') updateCupidFly();
                renderer.render(scene, camera);
                return;
            }

            // ========== PHASE QUẢ CẦU: cập nhật và render ==========
            if (animationState === 'sphere') {
                updateSpherePhase(time);
                renderer.render(scene, camera);
                return;
            }

            const positionsArray = particles.geometry.attributes.position.array;
            const initialPositionsArray = particles.geometry.attributes.initialPosition.array;
            const targetPositionsArray = particles.geometry.attributes.targetPosition.array;

            // Xử lý animation state
            if (animationState === 'chaos') {
                // Giai đoạn xoay tròn 3D - PHÂN BỐ ĐỀU TRÊN HÌNH CẦU
                const chaosProgress = Math.min((time - startTime) / chaosDuration, 1);
                // Áp dụng easing để tốc độ xoay giảm dần từ nhanh đến chậm
                const speedFactor = 1 - easeOutCubic(chaosProgress); // Từ 1 (nhanh) xuống 0 (chậm)
                
                const scaleForThreeJS = 0.5 * effectiveHeartScale;
                
                // Xoay từng hạt theo quỹ đạo trên bề mặt cầu
                for (let i = 0; i < positionsArray.length / 3; i++) {
                    const i3 = i * 3;
                    const anim = particleAnimations[i];
                    
                    if (anim) {
                        // Tính vị trí mới trên bề mặt cầu
                        // Mỗi hạt xoay theo vòng tròn tại phi cố định (như vĩ độ trên quả địa cầu)
                        const r = anim.orbitRadius * scaleForThreeJS;
                        const phi = anim.phi; // Góc phi cố định (vĩ độ)
                        const currentTheta = anim.timePassed; // Góc theta thay đổi (kinh độ)
                        
                        // Công thức tọa độ cầu -> Descartes
                        const x = r * Math.sin(phi) * Math.cos(currentTheta);
                        const y = r * Math.sin(phi) * Math.sin(currentTheta);
                        const z = r * Math.cos(phi);
                        
                        positionsArray[i3] = x;
                        positionsArray[i3 + 1] = y;
                        positionsArray[i3 + 2] = z;
                        
                        // Cập nhật timePassed (theta) - tốc độ ổn định, chậm và mượt
                        const speedMultiplier = 1 + 0.5 * speedFactor; // Từ 1.5 xuống 1
                        anim.timePassed += anim.speed * speedMultiplier;
                    }
                }
                
                particles.geometry.attributes.position.needsUpdate = true;
                
                // Xoay toàn bộ khối hạt - CHẬM và NHẸ NHÀNG
                const maxGlobalRotationSpeed = 0.008; // Tốc độ xoay
                const minGlobalRotationSpeed = 0.002; // Tốc độ xoay tối thiểu
                const globalRotationSpeed = minGlobalRotationSpeed + (maxGlobalRotationSpeed - minGlobalRotationSpeed) * speedFactor;
                
                // Giảm dần rotation về giá trị ban đầu của trái tim khi kết thúc
                const rotationFactor = 1 - chaosProgress; // Giảm dần từ 1 xuống 0
                
                particles.rotation.y += globalRotationSpeed * rotationFactor;
                particles.rotation.x += globalRotationSpeed * 0.2 * rotationFactor;
                
                // Lerp rotation về giá trị ban đầu của trái tim khi kết thúc
                particles.rotation.x = particles.rotation.x * (1 - chaosProgress * 0.2) + heartInitialRotationX * (chaosProgress * 0.2);
                particles.rotation.y = particles.rotation.y * (1 - chaosProgress * 0.2) + heartInitialRotationY * (chaosProgress * 0.2);
                particles.rotation.z = heartInitialRotationZ;
                
                // Sau khi xoay xong, chuyển sang tạo hình trái tim ngay
                if (chaosProgress >= 1) {
                    animationState = 'heart';
                    startTime = Date.now(); // Reset thời gian cho giai đoạn heart
                    // Reset rotation về đúng giá trị ban đầu của trái tim
                    particles.rotation.x = heartInitialRotationX;
                    particles.rotation.y = heartInitialRotationY;
                    particles.rotation.z = heartInitialRotationZ;
                    
                    // Áp dụng góc xoay ban đầu cho chữ (thêm 180 độ vào Y để hiển thị mặt trước)
                    const messageElement = document.getElementById('message');
                    if (messageElement) {
                        const rotationX = heartInitialRotationX * (180 / Math.PI);
                        const rotationY = heartInitialRotationY * (180 / Math.PI) + 180; // Thêm 180 độ để lật mặt trước
                        const rotationZ = heartInitialRotationZ * (180 / Math.PI);
                        messageElement.style.transform = `translate(-50%, -50%) rotateX(${rotationX}deg) rotateY(${rotationY}deg) rotateZ(${rotationZ}deg)`;
                    }
                    
                    console.log('Bắt đầu tạo hình trái tim');
                }
            } else if (animationState === 'heart') {
                // Tính toán tiến độ của hiệu ứng (từ 0 đến 1)
                let progress = Math.min((time - startTime) / duration, 1);
                // Áp dụng hàm easing để chuyển động đẹp hơn
                let easedProgress = easeInOutCubic(progress);

                // Di chuyển các hạt từ vị trí hiện tại (sau khi xoay) đến vị trí trái tim
                for (let i = 0; i < positionsArray.length; i += 3) {
                    // Lấy vị trí hiện tại (sau giai đoạn chaos)
                    const currentX = positionsArray[i];
                    const currentY = positionsArray[i + 1];
                    const currentZ = positionsArray[i + 2];
                    
                    // Nội suy tuyến tính (Lerp) từ vị trí hiện tại đến vị trí trái tim
                    positionsArray[i] = currentX * (1 - easedProgress) + targetPositionsArray[i] * easedProgress;
                    positionsArray[i + 1] = currentY * (1 - easedProgress) + targetPositionsArray[i + 1] * easedProgress;
                    positionsArray[i + 2] = currentZ * (1 - easedProgress) + targetPositionsArray[i + 2] * easedProgress;
                }
                
                particles.geometry.attributes.position.needsUpdate = true;
                // Xoay nhẹ toàn bộ khối hạt — KHÔNG xoay trong 3s delay (trái tim đứng yên, mặt hướng ra)
                const isInDelay = heartRotationCount >= 1 && heartDelayEndTime > 0 && Date.now() < heartDelayEndTime;
                // Không có quả cầu: quay 1 vòng xong dừng, không xoay nữa
                const isNoSphereStopped = sphereOriginalImages.length === 0 && heartRotationCount >= 1;
                if (!isInDelay && !isNoSphereStopped) {
                    particles.rotation.y += 0.002;
                }
                
                // Hiện hai ảnh + tên sớm (chỉ mode 'days')
                const heartProgress = Math.min((time - startTime) / duration, 1);
                const leftWrap = document.getElementById('heart-side-wrap-left');
                const rightWrap = document.getElementById('heart-side-wrap-right');
                if (heartProgress > 0.25 && HEART_MESSAGE_CONFIG.mode === 'days' && leftWrap && rightWrap) {
                    leftWrap.classList.add('visible');
                    rightWrap.classList.add('visible');
                }

                // Xoay chữ cùng hướng với trái tim (thêm 180 độ vào Y để hiển thị mặt trước)
                const messageElement = document.getElementById('message');
                if (messageElement) {
                    // Chuyển đổi từ radian sang độ và áp dụng rotation
                    // Thêm 180 độ vào Y để lật chữ lại mặt trước
                    const rotationY = particles.rotation.y * (180 / Math.PI) + 180;
                    const rotationX = particles.rotation.x * (180 / Math.PI);
                    const rotationZ = particles.rotation.z * (180 / Math.PI);
                    messageElement.style.transform = `translate(-50%, -50%) rotateX(${rotationX}deg) rotateY(${rotationY}deg) rotateZ(${rotationZ}deg)`;
                }
                
                // Đếm số vòng xoay (2*PI = 1 vòng)
                if (particles.rotation.y >= Math.PI * 1) {
                    heartRotationCount++;
                    particles.rotation.y = particles.rotation.y % (Math.PI * 2);
                    
                    // Xoay đủ 1 vòng → delay 3s rồi mới tan ra
                    if (heartRotationCount >= 1) {
                        if (heartDelayEndTime === 0) {
                            heartDelayEndTime = Date.now() + HEART_DELAY_BEFORE_FLYOUT_MS;
                        }
                        if (Date.now() < heartDelayEndTime) {
                            // Đang chờ 3s, chưa tan ra
                        } else if (sphereOriginalImages.length === 0) {
                            // Mảng ảnh quả cầu rỗng: dừng ở trái tim; nếu có thư thì hiện nút thư góc phải
                            if (cfg3d.enableLetter === true && !heartLetterButtonShown) {
                                heartLetterButtonShown = true;
                                const btnFlying = document.getElementById('btn-flying-corner');
                                if (btnFlying) {
                                    btnFlying.classList.add('visible');
                                    btnFlying.onclick = function() {
                                        btnFlying.classList.remove('visible');
                                        sphereShowLetter();
                                    };
                                }
                            }
                        } else {
                        // Sau 3s delay: ẩn trái tim, cho hạt bay ra
                        console.log('Trái tim vỡ — tất cả hạt bay ra không gian');
                        animationState = 'flyout';
                        particles.visible = false; // Ẩn trái tim để chỉ còn hạt bay ra (flyOutParticles)
                        document.getElementById('message').style.opacity = 0;
                        const leftWrap = document.getElementById('heart-side-wrap-left');
                        const rightWrap = document.getElementById('heart-side-wrap-right');
                        if (leftWrap) leftWrap.classList.remove('visible');
                        if (rightWrap) rightWrap.classList.remove('visible');
                        
                        // Dữ liệu từ chính trái tim đang xoay (particles) — không clone từ nguồn khác
                        const heartColors = particles.geometry.attributes.color.array;
                        const heartTargetPositions = particles.geometry.attributes.targetPosition.array; // vị trí hình trái tim
                        const totalParticles = particles.geometry.attributes.position.count;
                        // Trong 5s phân tán chỉ còn 50% số hạt bay ra
                        const flyOutCount = Math.max(1, Math.floor(totalParticles * 0.17));
                        const flyOutIndices = []; // Chọn ngẫu nhiên 50% hạt
                        for (let i = 0; i < totalParticles; i++) flyOutIndices.push(i);
                        for (let i = totalParticles - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1));
                            [flyOutIndices[i], flyOutIndices[j]] = [flyOutIndices[j], flyOutIndices[i]];
                        }
                        flyOutPositions = new Float32Array(flyOutCount * 3);
                        flyOutStartPositions = new Float32Array(flyOutCount * 3);
                        flyOutTargetPositions = new Float32Array(flyOutCount * 3);
                        flyOutStartTime = Date.now();
                        const flyOutColors = new Float32Array(flyOutCount * 3);
                        flyOutVelocities = [];
                        flyOutFloatPhase = [];
                        flyOutFloatAmplitude = [];
                        const flyOutDriftSpeed = 0.008;
                        const flyOutRandomSpread = 0.004;
                        const heartYOffset = (window.innerWidth < 768 && HEART_MESSAGE_CONFIG.mode === 'days') ? particles.position.y : 0;
                        for (let idx = 0; idx < flyOutCount; idx++) {
                            const particleIndex = flyOutIndices[idx];
                            const i3 = particleIndex * 3;
                            const idx3 = idx * 3;
                            const sx = heartTargetPositions[i3];
                            const sy = heartTargetPositions[i3 + 1] + heartYOffset;
                            const sz = heartTargetPositions[i3 + 2];
                            flyOutStartPositions[idx3] = sx;
                            flyOutStartPositions[idx3 + 1] = sy;
                            flyOutStartPositions[idx3 + 2] = sz;
                            flyOutPositions[idx3] = sx;
                            flyOutPositions[idx3 + 1] = sy;
                            flyOutPositions[idx3 + 2] = sz;
                            const tx = (Math.random() - 0.5) * 2 * FLYOUT_BOUND;
                            const ty = (Math.random() - 0.5) * 2 * FLYOUT_BOUND;
                            const tz = (Math.random() - 0.5) * 2 * FLYOUT_BOUND;
                            flyOutTargetPositions[idx3] = tx;
                            flyOutTargetPositions[idx3 + 1] = ty;
                            flyOutTargetPositions[idx3 + 2] = tz;
                            flyOutColors[idx3] = heartColors[i3];
                            flyOutColors[idx3 + 1] = heartColors[i3 + 1];
                            flyOutColors[idx3 + 2] = heartColors[i3 + 2];
                            const len = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
                            flyOutVelocities.push({
                                x: (tx / len) * flyOutDriftSpeed + (Math.random() - 0.5) * flyOutRandomSpread,
                                y: (ty / len) * flyOutDriftSpeed + (Math.random() - 0.5) * flyOutRandomSpread,
                                z: (tz / len) * flyOutDriftSpeed + (Math.random() - 0.5) * flyOutRandomSpread
                            });
                            flyOutFloatPhase.push(Math.random() * Math.PI * 2);
                            flyOutFloatAmplitude.push(0.015 + Math.random() * 0.025);
                        }
                        const flyOutGeometry = new THREE.BufferGeometry();
                        flyOutGeometry.setAttribute('position', new THREE.BufferAttribute(flyOutPositions, 3));
                        flyOutGeometry.setAttribute('color', new THREE.BufferAttribute(flyOutColors, 3));
                        const flyOutMaterial = new THREE.PointsMaterial({
                            size: 2.2 * (window.innerWidth < 768 ? HEART_PHASE_SCALE_MOBILE : HEART_PHASE_SCALE),
                            map: particles.material.map,
                            vertexColors: true,
                            blending: THREE.AdditiveBlending,
                            depthTest: false,
                            transparent: true,
                            opacity: 0.95,
                            sizeAttenuation: true
                        });
                        flyOutParticles = new THREE.Points(flyOutGeometry, flyOutMaterial);
                        flyOutParticles.renderOrder = 999;
                        scene.add(flyOutParticles);
                        console.log('✨ Trái tim vỡ — 50% hạt (' + flyOutCount + '/' + totalParticles + ') bay ra không gian');
                        // Sau khi phân tán 5s thì chuyển sang phase quả cầu (không có giai đoạn drift)
                        setTimeout(function() { startSpherePhase(); }, FLYOUT_SPREAD_DURATION_MS);
                        }
                    }
                }
            } else if (animationState === 'flyout') {
                // Hạt từ trái tim bay ra: phân tán 5s từ đầu (không ẩn/hiện)
                if (flyOutParticles && flyOutPositions && flyOutStartPositions && flyOutTargetPositions) {
                    const elapsed = Date.now() - flyOutStartTime;
                    const progress = Math.min(1, elapsed / FLYOUT_SPREAD_DURATION_MS);
                    const eased = 1 - Math.pow(1 - progress, 1.5);
                    const n = flyOutVelocities.length;
                    if (progress < 1) {
                        for (let j = 0; j < n; j++) {
                            flyOutPositions[j * 3] = flyOutStartPositions[j * 3] + (flyOutTargetPositions[j * 3] - flyOutStartPositions[j * 3]) * eased;
                            flyOutPositions[j * 3 + 1] = flyOutStartPositions[j * 3 + 1] + (flyOutTargetPositions[j * 3 + 1] - flyOutStartPositions[j * 3 + 1]) * eased;
                            flyOutPositions[j * 3 + 2] = flyOutStartPositions[j * 3 + 2] + (flyOutTargetPositions[j * 3 + 2] - flyOutStartPositions[j * 3 + 2]) * eased;
                        }
                        flyOutParticles.geometry.attributes.position.needsUpdate = true;
                    }
                }
            }

            // Hiện dòng chữ sớm khi trái tim đang hình thành (chỉ khi đang ở trạng thái heart)
            if (animationState === 'heart') {
                const progress = Math.min((time - startTime) / duration, 1);
                if (progress > 0.25) {
                    document.getElementById('message').style.opacity = 1;
                }
                // Cupid bay khi mở thư ở chế độ chỉ có trái tim
                if (cupidLetterState === 'flying') updateCupidFly();
            }

            // Render Three.js (chaos / heart / flyout)
            renderer.render(scene, camera);
        }

        // ========== PHASE QUẢ CẦU: khởi tạo (sau khi canvas ảnh biến mất 2s) ==========
        function randomPointOnSphere(r) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            return new THREE.Vector3(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
        }

        function createSpherePatch(r, thetaStart, thetaEnd, phiStart, phiEnd, widthSeg, heightSeg) {
            const geometry = new THREE.BufferGeometry();
            const vertices = [];
            const uvs = [];
            const indices = [];
            for (let y = 0; y <= heightSeg; y++) {
                const v = y / heightSeg;
                const phi = phiStart + v * (phiEnd - phiStart);
                for (let x = 0; x <= widthSeg; x++) {
                    const u = x / widthSeg;
                    const theta = thetaStart + u * (thetaEnd - thetaStart);
                    const px = r * Math.sin(phi) * Math.cos(theta);
                    const py = r * Math.cos(phi);
                    const pz = r * Math.sin(phi) * Math.sin(theta);
                    vertices.push(px, py, pz);
                    uvs.push(u, 1 - v);
                }
            }
            for (let y = 0; y < heightSeg; y++) {
                for (let x = 0; x < widthSeg; x++) {
                    const a = y * (widthSeg + 1) + x;
                    const b = a + 1;
                    const c = a + (widthSeg + 1);
                    const d = c + 1;
                    indices.push(a, c, b);
                    indices.push(b, c, d);
                }
            }
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            return geometry;
        }

        function sphereCreateSphere() {
            let imageIndex = 0;
            spherePhiStart = Math.PI * spherePolarMargin;
            spherePhiEnd = Math.PI * (1 - spherePolarMargin);
            spherePhiRange = spherePhiEnd - spherePhiStart;
            for (let row = 0; row < sphereRows; row++) {
                const phi1 = spherePhiStart + (row / sphereRows) * spherePhiRange;
                const phi2 = spherePhiStart + ((row + 1) / sphereRows) * spherePhiRange;
                const phiMid = (phi1 + phi2) / 2;
                const circumference = 2 * Math.PI * sphereRadius * Math.sin(phiMid);
                const imageHeight = spherePhiRange * sphereRadius / sphereRows;
                const imagesInRow = Math.max(3, Math.round(circumference / imageHeight));
                const thetaStep = (2 * Math.PI) / imagesInRow;
                for (let col = 0; col < imagesInRow; col++) {
                    const theta = col * thetaStep;
                    const texture = sphereTexturesForSphere[imageIndex % sphereTexturesForSphere.length];
                    imageIndex++;
                    const geometry = createSpherePatch(sphereRadius, theta, theta + thetaStep, phi1, phi2, 12, 12);
                    const material = new THREE.MeshBasicMaterial({
                        map: texture,
                        side: THREE.DoubleSide,
                        transparent: true,
                        opacity: 1
                    });
                    const mesh = new THREE.Mesh(geometry, material);
                    const introStartPos = randomPointOnSphere(SPHERE_INTRO_RADIUS); // Phân bố toàn không gian (như imageheart)
                    mesh.userData.introStartPos = introStartPos;
                    mesh.userData.introDelay = Math.random() * SPHERE_INTRO_STAGGER_MS;
                    mesh.position.copy(introStartPos);
                    sphereGroup.add(mesh);
                    sphereMeshes.push(mesh);
                }
            }
            sphereIntroStartTime = Date.now();
        }

        function sphereCreateFloatingImages() {
            const floatingGroup = new THREE.Group();
            scene.add(floatingGroup);
            const totalFloatingImages = 60;
            const gridSize = 16;
            const usedPositions = [];
            function isPositionValid(x, y, z, minDistance) {
                for (const pos of usedPositions) {
                    const dist = Math.sqrt(Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2) + Math.pow(z - pos.z, 2));
                    if (dist < minDistance) return false;
                }
                return true;
            }
            function findValidPosition(size) {
                const minDist = size * 1.5 + 1;
                let attempts = 0;
                while (attempts < 100) {
                    const x = (Math.random() - 0.5) * gridSize;
                    const y = (Math.random() - 0.5) * gridSize;
                    const z = (Math.random() - 0.5) * gridSize;
                    if (isPositionValid(x, y, z, minDist)) {
                        usedPositions.push({ x, y, z });
                        return { x, y, z };
                    }
                    attempts++;
                }
                const angle = Math.random() * Math.PI * 2;
                const dist = gridSize / 2 + Math.random() * 2;
                return { x: Math.cos(angle) * dist, y: (Math.random() - 0.5) * gridSize, z: Math.sin(angle) * dist };
            }
            function createGlowTexture(size) {
                const canvas = document.createElement('canvas');
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext('2d');
                const center = size / 2;
                const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
                gradient.addColorStop(0, 'rgba(255, 105, 180, 1)');
                gradient.addColorStop(0.2, 'rgba(255, 182, 193, 0.85)');
                gradient.addColorStop(0.45, 'rgba(255, 105, 180, 0.5)');
                gradient.addColorStop(0.7, 'rgba(255, 105, 180, 0.2)');
                gradient.addColorStop(1, 'rgba(255, 105, 180, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, size, size);
                return new THREE.CanvasTexture(canvas);
            }
            const glowTexture = createGlowTexture(128);
            function createRoundedRectGeometry(width, height, radius) {
                const shape = new THREE.Shape();
                const x = -width / 2, y = -height / 2;
                shape.moveTo(x + radius, y);
                shape.lineTo(x + width - radius, y);
                shape.quadraticCurveTo(x + width, y, x + width, y + radius);
                shape.lineTo(x + width, y + height - radius);
                shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
                shape.lineTo(x + radius, y + height);
                shape.quadraticCurveTo(x, y + height, x, y + height - radius);
                shape.lineTo(x, y + radius);
                shape.quadraticCurveTo(x, y, x + radius, y);
                const geometry = new THREE.ShapeGeometry(shape);
                const pos = geometry.attributes.position;
                const uvs = [];
                for (let i = 0; i < pos.count; i++)
                    uvs.push((pos.getX(i) + width / 2) / width, (pos.getY(i) + height / 2) / height);
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
                return geometry;
            }
            for (let i = 0; i < totalFloatingImages; i++) {
                const texture = sphereLoadedTextures[i % sphereLoadedTextures.length];
                const sizeVariation = 0.5 + Math.random() * 2;
                const width = 1.5 * sizeVariation;
                const height = 1 * sizeVariation;
                const cornerRadius = 0.15 * sizeVariation;
                const imageGroup = new THREE.Group();
                const glowOuterSize = 2.2;
                const glowOuterGeom = createRoundedRectGeometry(width * glowOuterSize, height * glowOuterSize, cornerRadius * glowOuterSize);
                const glowOuterMat = new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
                const glowOuterMesh = new THREE.Mesh(glowOuterGeom, glowOuterMat);
                glowOuterMesh.position.z = -0.02;
                imageGroup.add(glowOuterMesh);
                const glowSize = 1.5;
                const glowGeometry = createRoundedRectGeometry(width * glowSize, height * glowSize, cornerRadius * glowSize);
                const glowMat = new THREE.MeshBasicMaterial({ map: glowTexture, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
                const glowMesh = new THREE.Mesh(glowGeometry, glowMat);
                glowMesh.position.z = -0.01;
                imageGroup.add(glowMesh);
                const geometry = createRoundedRectGeometry(width, height, cornerRadius);
                const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, opacity: 0 });
                const imageMesh = new THREE.Mesh(geometry, material);
                imageGroup.add(imageMesh);
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                imageGroup.position.set(
                    sphereRadius * 0.5 * Math.sin(phi) * Math.cos(theta),
                    sphereRadius * 0.5 * Math.cos(phi),
                    sphereRadius * 0.5 * Math.sin(phi) * Math.sin(theta)
                );
                const targetPos = findValidPosition(Math.max(width, height));
                imageGroup.userData = {
                    startPos: imageGroup.position.clone(),
                    targetPos: new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z),
                    floatSpeedY: 0.3 + Math.random() * 0.5,
                    floatAmplitudeY: 0.1 + Math.random() * 0.2,
                    floatPhaseY: Math.random() * Math.PI * 2,
                    delay: Math.random() * 0.5,
                    size: sizeVariation,
                    basePos: new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z),
                    imageMaterial: material,
                    glowMaterial: glowMat,
                    glowOuterMaterial: glowOuterMat,
                    driftSpeed: 0.002 + Math.random() * 0.003,
                    baseZ: targetPos.z
                };
                floatingGroup.add(imageGroup);
                sphereFloatingImages.push(imageGroup);
            }
            sphereFloatingGroup = floatingGroup;
        }

        function sphereTriggerExplosion() {
            if (sphereIsExploded) return;
            sphereIsExploded = true;
            sphereExplosionProgress = 0;
            sphereMeshes.forEach(m => { if (m.material) m.material.transparent = true; });
            sphereFadeProgress = 0;
            sphereExplosionStartTime = Date.now();
            controls.autoRotate = false;
            controls.enableRotate = true;
            controls.maxDistance = 14;
            const enableFlying = cfg3d.enableSphereFlyingImages !== false;
            sphereCreateFloatingImages();
            if (cfg3d.enableLetter === true) {
                const btnFlying = document.getElementById('btn-flying-corner');
                if (btnFlying) btnFlying.classList.add('visible');
            }
            const flash = document.createElement('div');
            flash.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:radial-gradient(circle,rgba(255,105,180,0.8) 0%,transparent 70%);pointer-events:none;z-index:1000;animation:flashFade 1s ease-out forwards;';
            (window.SCENE3D_CONTAINER || document.body).appendChild(flash);
            if (!document.querySelector('#flashStyle')) {
                const style = document.createElement('style');
                style.id = 'flashStyle';
                style.textContent = '@keyframes flashFade { 0% { opacity: 1; } 100% { opacity: 0; } }';
                document.head.appendChild(style);
            }
            setTimeout(() => flash.remove(), 1000);
        }

        function sphereCreateTextCrawl3D() {
            if (sphereTextCrawlMesh) return;
            document.fonts.ready.then(() => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const canvasWidth = 1536, canvasHeight = 2500, textMaxWidth = 1400;
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                ctx.fillStyle = '#ffc0cb';
                ctx.font = 'italic 52px "Cormorant Garamond", Georgia, serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                ctx.shadowColor = 'rgba(255, 105, 180, 0.8)';
                ctx.shadowBlur = 30;
                function wrapLine(line) {
                    const words = line.split(' ');
                    const result = [];
                    let current = '';
                    for (const w of words) {
                        const test = current ? current + ' ' + w : w;
                        if (ctx.measureText(test).width <= textMaxWidth) current = test;
                        else { if (current) result.push(current); current = w; }
                    }
                    if (current) result.push(current);
                    return result;
                }
                const lineHeight = 75, startY = 80;
                let drawY = startY;
                sphereValentineText.split('\n').forEach((line) => {
                    (line ? wrapLine(line) : ['']).forEach((ln) => {
                        ctx.fillText(ln, canvasWidth / 2, drawY);
                        drawY += lineHeight;
                    });
                });
                const texture = new THREE.CanvasTexture(canvas);
                texture.needsUpdate = true;
                const planeWidth = 14;
                const planeHeight = planeWidth * (canvasHeight / canvasWidth);
                const textHeightCanvas = drawY - startY;
                const textCenterCanvas = startY + textHeightCanvas / 2;
                const canvasCenter = canvasHeight / 2;
                const offsetFromCanvasCenter = textCenterCanvas - canvasCenter;
                sphereTextStopY = offsetFromCanvasCenter * planeHeight / canvasHeight;
                const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });
                sphereTextCrawlMesh = new THREE.Mesh(geometry, material);
                sphereTextCrawlMesh.position.set(0, -15, 0);
                sphereTextCrawlMesh.rotation.x = -Math.PI * 0.06;
                scene.add(sphereTextCrawlMesh);
                sphereTextCrawlStarted = true;
            });
        }

        function sphereStartTypingEffect() {
            if (sphereTypingStarted) return;
            sphereTypingStarted = true;
            const typingContainer = document.getElementById('typing-container');
            const typingTextEl = document.getElementById('typing-text');
            typingContainer.classList.add('visible');
            let currentIndex = 0;
            function typeNextChar() {
                if (currentIndex < sphereValentineText.length) {
                    const char = sphereValentineText[currentIndex];
                    const cursor = typingTextEl.querySelector('.cursor');
                    const textNode = document.createTextNode(char);
                    typingTextEl.insertBefore(textNode, cursor);
                    currentIndex++;
                    setTimeout(typeNextChar, char === '\n' ? SPHERE_TYPING_SPEED_MS * 5 : SPHERE_TYPING_SPEED_MS);
                } else {
                    setTimeout(() => {
                        const cursor = typingTextEl.querySelector('.cursor');
                        if (cursor) cursor.style.display = 'none';
                    }, 2000);
                }
            }
            setTimeout(typeNextChar, 500);
        }

        function sphereShowLetter() {
            if (sphereLetterShown) return;
            sphereLetterShown = true;
            const el = document.getElementById('sphere-particles');
            if (el) { el.style.opacity = '0'; el.style.transition = 'opacity 1s'; }
            
            // Chọn logic theo loại thư đã config (TYPING và CUPID đều dùng flow cupid bay + phong bì + click)
            if (sphereLetterType === LETTER_TYPES.TYPING || sphereLetterType === LETTER_TYPES.CUPID) {
                startCupidLetterSequence();
            } else {
                sphereCreateTextCrawl3D();
            }
        }
        
        // ========== KIỂU THƯ CUPID: Cupid bay lên giữa -> ẩn -> hiện phong bì (letterimage) -> click phong bì -> khung thư Valentine ==========
        function startCupidLetterSequence() {
            const overlay = document.getElementById('cupid-letter-overlay');
            const cupidImg = document.getElementById('cupid-flying-img');
            const letterFrame = document.getElementById('cupid-letter-frame');
            if (!overlay || !cupidImg || !letterFrame) return;
            
            cupidLetterState = 'flying';
            cupidFlyStartTime = Date.now();
            
            overlay.classList.add('visible');
            cupidImg.style.display = '';
            
            // Bắt đầu ở góc dưới trái (khoảng 15% từ trái, 85% từ trên = gần đáy)
            const startLeft = window.innerWidth * 0.15;
            const startTop = window.innerHeight * 0.85;
            cupidImg.style.left = startLeft + 'px';
            cupidImg.style.top = startTop + 'px';
            cupidImg.style.opacity = '1';
            cupidImg.style.transition = 'none';
            
            letterFrame.classList.remove('visible');
            document.getElementById('letter-envelope-img')?.classList.remove('visible');
            document.getElementById('letter-typing-space')?.classList.remove('visible');
            document.getElementById('cupid-in-space-boy')?.classList.remove('visible');
            document.getElementById('cupid-in-space-girl')?.classList.remove('visible');
        }
        
        function updateCupidFly() {
            if (cupidLetterState !== 'flying') return;
            const elapsed = Date.now() - cupidFlyStartTime;
            const progress = Math.min(1, elapsed / CUPID_FLY_DURATION_MS);
            const eased = 1 - Math.pow(1 - progress, 1.2); // easeOutExpo
            
            const cupidImg = document.getElementById('cupid-flying-img');
            if (!cupidImg) return;
            
            const startLeft = window.innerWidth * 0.15;
            const startTop = window.innerHeight * 0.85;
            const endLeft = window.innerWidth * 0.5;
            const endTop = window.innerHeight * 0.5;
            
            const left = startLeft + (endLeft - startLeft) * eased;
            const top = startTop + (endTop - startTop) * eased;
            
            cupidImg.style.left = left + 'px';
            cupidImg.style.top = top + 'px';
            cupidImg.style.transition = 'none';
            
            if (progress >= 1) {
                cupidLetterState = 'letterImage';
                cupidImg.style.transition = 'opacity 0.5s ease-out';
                cupidImg.style.opacity = '0';
                setTimeout(() => {
                    cupidImg.style.display = 'none';
                    const envelopeImg = document.getElementById('letter-envelope-img');
                    if (envelopeImg) {
                        envelopeImg.classList.add('visible');
                    }
                }, 500);
            }
        }
        
        function handleLetterEnvelopeClick() {
            if (cupidLetterState !== 'letterImage') return;
            cupidLetterState = 'showingLetter';
            particleFadeOutStartTime = Date.now(); // Bắt đầu fade hạt từ từ (giảm lag)
            
            const envelopeImg = document.getElementById('letter-envelope-img');
            if (envelopeImg) envelopeImg.classList.remove('visible');
            
            if (sphereLetterType === LETTER_TYPES.TYPING) {
                const letterTypingSpace = document.getElementById('letter-typing-space');
                const letterTypingText = letterTypingSpace ? letterTypingSpace.querySelector('.letter-typing-text') : null;
                document.getElementById('cupid-in-space-boy')?.classList.add('visible');
                document.getElementById('cupid-in-space-girl')?.classList.add('visible');
                if (letterTypingSpace && letterTypingText) {
                    letterTypingText.textContent = '';
                    const cursor = document.createElement('span');
                    cursor.className = 'letter-cursor';
                    letterTypingText.appendChild(cursor);
                    letterTypingSpace.classList.add('visible');
                    startLetterTypingEffect(letterTypingText, cursor, true);
                }
            } else if (sphereLetterType === LETTER_TYPES.CUPID) {
                const letterFrame = document.getElementById('cupid-letter-frame');
                const letterContent = letterFrame ? letterFrame.querySelector('.letter-content') : null;
                if (letterFrame && letterContent) {
                    letterContent.textContent = '';
                    const cursor = document.createElement('span');
                    cursor.className = 'letter-cursor';
                    letterContent.appendChild(cursor);
                    if (LETTER_SIGNATURE_TEXT && LETTER_SIGNATURE_TEXT.trim()) {
                        const sig = document.createElement('div');
                        sig.className = 'letter-signature';
                        sig.textContent = LETTER_SIGNATURE_TEXT;
                        letterContent.appendChild(sig);
                    }
                    letterFrame.classList.add('layout-cupid', 'visible');
                    startLetterTypingEffect(letterContent, cursor, false);
                }
            }
        }
        
        function startLetterTypingEffect(letterContent, cursor, isInSpace) {
            const text = CUPID_VALENTINE_TEXT;
            const TYPING_SPEED_MS = 50;
            const NEWLINE_DELAY = 5 * TYPING_SPEED_MS;
            let currentIndex = 0;
            
            function typeNextChar() {
                if (currentIndex < text.length) {
                    const char = text[currentIndex];
                    const textNode = document.createTextNode(char);
                    letterContent.insertBefore(textNode, cursor);
                    currentIndex++;
                    if (!isInSpace) {
                        cursor.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                        const extraSpace = Math.min(100, letterContent.clientHeight * 0.2);
                        letterContent.scrollTop = Math.min(
                            letterContent.scrollTop + extraSpace,
                            Math.max(0, letterContent.scrollHeight - letterContent.clientHeight)
                        );
                    } else {
                        cursor.scrollIntoView({ block: 'nearest', behavior: 'auto' });
                    }
                    setTimeout(typeNextChar, char === '\n' ? NEWLINE_DELAY : TYPING_SPEED_MS);
                } else {
                    setTimeout(() => {
                        if (cursor) cursor.style.display = 'none';
                        if (letterContent) letterContent.classList.add('typing-complete');
                    }, 2000);
                }
            }
            setTimeout(typeNextChar, 300);
        }

        function getEventCoords(event) {
            if (event.touches && event.touches[0]) return { x: event.touches[0].clientX, y: event.touches[0].clientY };
            if (event.changedTouches && event.changedTouches[0]) return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
            return { x: event.clientX, y: event.clientY };
        }

        function startSpherePhase() {
            const isMobile = window.innerWidth < 768;
            document.getElementById('threejs-canvas').classList.remove('fade-out');
            var hintEl = document.getElementById('sphere-click-hint');
            if (hintEl) { hintEl.classList.remove('visible'); hintEl.setAttribute('aria-hidden', 'true'); }

            scene.remove(particles);
            if (particles.geometry) particles.geometry.dispose();
            if (particles.material) particles.material.dispose();
            // Hạt 3D bay lơ lửng: cứ để nguyên, không xóa (vẫn lơ lửng trong phase quả cầu)
            scene.fog = null;

            camera.near = 0.1;
            camera.far = 1000;
            camera.updateProjectionMatrix();
            // Camera đã dùng cùng z từ đầu (UNIFIED_CAMERA_Z) → không đổi, không scale fly-out

            controls = new THREE.OrbitControls(camera, renderer.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.enableZoom = true;
            controls.enableRotate = false;
            controls.enablePan = false;
            controls.minDistance = isMobile ? 5 : 6;
            controls.maxDistance = isMobile ? 20 : 18;
            controls.autoRotate = false;
            controls.minPolarAngle = Math.PI * 0.25;
            controls.maxPolarAngle = Math.PI * 0.75;
            controls.minAzimuthAngle = -Math.PI * 0.45;
            controls.maxAzimuthAngle = Math.PI * 0.45;
            controls.target.set(0, 0, 0);

            sphereGroup = new THREE.Group();
            scene.add(sphereGroup);

            sphereClickSphere = new THREE.Mesh(
                new THREE.SphereGeometry(sphereRadius * 1.1, 32, 32),
                new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
            );
            sphereClickSphere.renderOrder = -1;
            scene.add(sphereClickSphere);

            sphereRaycaster = new THREE.Raycaster();
            sphereMouse = new THREE.Vector2();

            sphereTextureLoader = new THREE.TextureLoader();
            Promise.all(sphereOriginalImages.map((url, index) => {
                return new Promise((resolve, reject) => {
                    sphereTextureLoader.load(url, (texture) => {
                        sphereLoadedTextures[index] = texture;
                        sphereLoadedCount++;
                        resolve(texture);
                    }, undefined, reject);
                });
            })).then(() => {
                // Ảnh hệ thống (assets/images/imagedefalut/) chỉ dùng cho ảnh bay, không dùng cho quả cầu
                sphereTexturesForSphere = sphereLoadedTextures.filter(function(_, i) {
                    var url = sphereOriginalImages[i];
                    return !(typeof url === 'string' && url.includes('assets/images/imagedefalut/'));
                });
                if (sphereTexturesForSphere.length === 0) sphereTexturesForSphere = sphereLoadedTextures; // Fallback: toàn ảnh hệ thống thì vẫn hiện quả cầu
                sphereCreateSphere();
                // Hạt quanh quả cầu: giống imageheart — r = radius*1.2 + random*3, theta/phi uniform
                if (!flyOutParticles) {
                    const particleCount = 600;
                    const positions = new Float32Array(particleCount * 3);
                    const colors = new Float32Array(particleCount * 3);
                    for (let i = 0; i < particleCount; i++) {
                        const theta = Math.random() * Math.PI * 2;
                        const phi = Math.acos(2 * Math.random() - 1);
                        const r = sphereRadius * 1.2 + Math.random() * 3;
                        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
                        positions[i * 3 + 1] = r * Math.cos(phi);
                        positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
                        colors[i * 3] = 1;
                        colors[i * 3 + 1] = 0.4 + Math.random() * 0.3;
                        colors[i * 3 + 2] = 0.7 + Math.random() * 0.3;
                    }
                    const particlesGeometry = new THREE.BufferGeometry();
                    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                    particlesGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    sphereParticlesMesh = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({
                        size: 0.04, vertexColors: true, transparent: true, opacity: 0.8
                    }));
                    scene.add(sphereParticlesMesh);
                }
                // Hạt mưa bay lên từ dưới: random x,z ở dưới, bay lên (kiểu mưa ngược)
                const rainPositions = new Float32Array(SPHERE_RAIN_UP_COUNT * 3);
                const rainColors = new Float32Array(SPHERE_RAIN_UP_COUNT * 3);
                for (let i = 0; i < SPHERE_RAIN_UP_COUNT; i++) {
                    rainPositions[i * 3] = (Math.random() - 0.5) * 2 * FLYOUT_BOUND;
                    rainPositions[i * 3 + 1] = -FLYOUT_BOUND + Math.random() * 2 * FLYOUT_BOUND; // từ dưới rải lên
                    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 2 * FLYOUT_BOUND;
                    rainColors[i * 3] = 1;
                    rainColors[i * 3 + 1] = 0.4 + Math.random() * 0.3;
                    rainColors[i * 3 + 2] = 0.7 + Math.random() * 0.3;
                }
                sphereRainUpPositions = rainPositions;
                const rainGeometry = new THREE.BufferGeometry();
                rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
                rainGeometry.setAttribute('color', new THREE.BufferAttribute(rainColors, 3));
                sphereRainUpParticles = new THREE.Points(rainGeometry, new THREE.PointsMaterial({
                    size: 0.035, vertexColors: true, transparent: true, opacity: 0.75
                }));
                sphereRainUpParticles.renderOrder = 998;
                scene.add(sphereRainUpParticles);
                const container = document.getElementById('sphere-particles');
                for (let i = 0; i < 30; i++) {
                    const dot = document.createElement('div');
                    dot.className = 'particle';
                    dot.style.left = Math.random() * 100 + '%';
                    dot.style.animationDelay = Math.random() * 15 + 's';
                    dot.style.animationDuration = (10 + Math.random() * 10) + 's';
                    container.appendChild(dot);
                }
            }).catch((err) => {
                console.error('Lỗi load ảnh quả cầu:', err);
                sphereCreateSphere();
            });

            const canvasEl = renderer.domElement;
            function onSpherePointerDown(e) {
                const coords = getEventCoords(e);
                sphereMouseDownX = coords.x;
                sphereMouseDownY = coords.y;
                sphereIsPointerDown = true;
                sphereWasDrag = false;
            }
            function onSpherePointerMove(e) {
                const coords = getEventCoords(e);
                if (sphereIsPointerDown) {
                    const moved = Math.sqrt(Math.pow(coords.x - sphereMouseDownX, 2) + Math.pow(coords.y - sphereMouseDownY, 2));
                    if (moved > SPHERE_CLICK_DRAG_THRESHOLD) sphereWasDrag = true;
                }
            }
            function onSpherePointerUp() {
                sphereIsPointerDown = false;
            }
            function handleSphereTap(clientX, clientY) {
                sphereMouse.x = (clientX / window.innerWidth) * 2 - 1;
                sphereMouse.y = -(clientY / window.innerHeight) * 2 + 1;
                sphereRaycaster.setFromCamera(sphereMouse, camera);
                if (sphereIsExploded || !sphereIntroComplete) return;
                if (sphereWasDrag) { sphereWasDrag = false; return; }
                sphereWasDrag = false;
                const intersects = sphereRaycaster.intersectObject(sphereClickSphere);
                if (intersects.length > 0) {
                    var hintEl = document.getElementById('sphere-click-hint');
                    if (hintEl) { hintEl.classList.remove('visible'); hintEl.setAttribute('aria-hidden', 'true'); }
                    if (!sphereHasZoomedIn) {
                        sphereHasZoomedIn = true;
                        sphereZoomInTime = Date.now();
                        sphereNeedZoomIn = true;
                        const target = controls.target;
                        const dir = camera.position.clone().sub(target).normalize();
                        sphereZoomInTargetPosition.copy(target).add(dir.multiplyScalar(controls.minDistance));
                    } else {
                        // Click lần thứ 2: nếu có ảnh bay thì trigger explosion,
                        // nếu không có ảnh bay nhưng có thư thì ẩn quả cầu và mở thư trực tiếp
                        const hasFlyingImages = cfg3d.enableSphereFlyingImages !== false;
                        const hasLetter = cfg3d.enableLetter === true;

                        if (hasFlyingImages) {
                            sphereTriggerExplosion();
                        } else if (hasLetter) {
                            // Ẩn quả cầu và các hạt liên quan trước khi hiện thư
                            sphereIsExploded = true;
                            if (sphereGroup) sphereGroup.visible = false;
                            if (sphereClickSphere) sphereClickSphere.visible = false;
                            if (sphereParticlesMesh) sphereParticlesMesh.visible = false;
                            if (sphereRainUpParticles) sphereRainUpParticles.visible = false;
                            sphereShowLetter();
                        }
                    }
                }
            }
            canvasEl.addEventListener('mousedown', onSpherePointerDown);
            canvasEl.addEventListener('mouseup', onSpherePointerUp);
            canvasEl.addEventListener('mouseleave', onSpherePointerUp);
            canvasEl.addEventListener('mousemove', onSpherePointerMove);
            canvasEl.addEventListener('click', (e) => handleSphereTap(e.clientX, e.clientY));
            canvasEl.addEventListener('touchstart', onSpherePointerDown, { passive: true });
            canvasEl.addEventListener('touchmove', onSpherePointerMove, { passive: true });
            canvasEl.addEventListener('touchend', (e) => {
                onSpherePointerUp();
                if (e.cancelable) e.preventDefault();
                const coords = getEventCoords(e);
                handleSphereTap(coords.x, coords.y);
            }, { passive: false });

            document.getElementById('btn-flying-corner').addEventListener('click', () => {
                if (!sphereIsExploded || sphereIsFinalFlyUp) return;
                sphereIsFinalFlyUp = true;
                var hintEl = document.getElementById('sphere-click-hint');
                if (hintEl) { hintEl.classList.remove('visible'); hintEl.setAttribute('aria-hidden', 'true'); }
                sphereFinalFlyUpStartTime = Date.now();
                document.getElementById('btn-flying-corner').classList.remove('visible');
                // Không nền hạt trong phần ảnh bay lên trời (sau quả cầu)
                const particlesEl = document.getElementById('sphere-particles');
                if (particlesEl) { particlesEl.style.opacity = '0'; particlesEl.style.transition = 'opacity 1s'; }
                const resetDelay = isMobile ? 2000 : 1550;
                setTimeout(() => {
                    sphereSmoothCameraPosition = new THREE.Vector3(0, 0, isMobile ? UNIFIED_CAMERA_Z_MOBILE : UNIFIED_CAMERA_Z);
                    sphereNeedSmoothCameraReset = true;
                }, resetDelay);
            });

            animationState = 'sphere';
            console.log('✅ Đã bắt đầu phase quả cầu');
        }

        function showSphereClickHint() {
            const el = document.getElementById('sphere-click-hint');
            if (!el) return;
            el.classList.add('visible');
            el.setAttribute('aria-hidden', 'false');
            setTimeout(function() {
                el.classList.remove('visible');
                el.setAttribute('aria-hidden', 'true');
            }, SPHERE_HINT_DURATION_MS);
        }

        function updateSpherePhase(time) {
            sphereTime += 0.01;

            // Gợi ý lần 1: 5s sau khi ghép xong quả cầu → "Click vào nhé" (để zoom vào cầu)
            if (sphereIntroComplete && !sphereHintClickShown && sphereIntroCompleteTime > 0 && (Date.now() - sphereIntroCompleteTime) >= SPHERE_HINT_DELAY_MS) {
                sphereHintClickShown = true;
                showSphereClickHint();
            }
            // Gợi ý lần 2: chỉ khi có ảnh bay hoặc thư (click lần 2 mới có tác dụng). Nếu chỉ có quả cầu thì chỉ show 1 lần thôi.
            var hasSecondAction = cfg3d.enableSphereFlyingImages !== false || cfg3d.enableLetter === true;
            if (hasSecondAction && sphereHasZoomedIn && !sphereIsExploded && !sphereHintFlyShown && sphereZoomInTime > 0 && (Date.now() - sphereZoomInTime) >= SPHERE_HINT_DELAY_MS) {
                sphereHintFlyShown = true;
                showSphereClickHint();
            }
            
            // Kiểu thư Cupid: cập nhật animation bay từ góc trái lên giữa
            if (cupidLetterState === 'flying') updateCupidFly();

            // Hạt trong không gian (flyOut): phân tán 5s từ đầu (không ẩn/hiện)
            if (flyOutParticles && flyOutPositions && flyOutStartPositions && flyOutTargetPositions && flyOutVelocities.length > 0) {
                const elapsed = Date.now() - flyOutStartTime;
                const progress = Math.min(1, elapsed / FLYOUT_SPREAD_DURATION_MS);
                const eased = 1 - Math.pow(1 - progress, 1.5);
                const n = flyOutVelocities.length;
                if (progress < 1) {
                    for (let j = 0; j < n; j++) {
                        flyOutPositions[j * 3] = flyOutStartPositions[j * 3] + (flyOutTargetPositions[j * 3] - flyOutStartPositions[j * 3]) * eased;
                        flyOutPositions[j * 3 + 1] = flyOutStartPositions[j * 3 + 1] + (flyOutTargetPositions[j * 3 + 1] - flyOutStartPositions[j * 3 + 1]) * eased;
                        flyOutPositions[j * 3 + 2] = flyOutStartPositions[j * 3 + 2] + (flyOutTargetPositions[j * 3 + 2] - flyOutStartPositions[j * 3 + 2]) * eased;
                    }
                    flyOutParticles.geometry.attributes.position.needsUpdate = true;
                }
            }
            // Chỉ fade hạt bay lên (sphereRainUpParticles), giữ hạt nền
            if (particleFadeOutStartTime > 0) {
                const fadeElapsed = Date.now() - particleFadeOutStartTime;
                const fadeProgress = Math.min(1, fadeElapsed / PARTICLE_FADEOUT_DURATION_MS);
                const fadeOpacity = 1 - fadeProgress;
                if (sphereRainUpParticles && sphereRainUpParticles.material) {
                    sphereRainUpParticles.material.opacity = Math.max(0, fadeOpacity * 0.75);
                    if (fadeProgress >= 1) sphereRainUpParticles.visible = false;
                }
            }
            // Hạt mưa bay lên từ dưới (chỉ update khi chưa fade xong)
            if (sphereRainUpParticles && sphereRainUpPositions && (!particleFadeOutStartTime || Date.now() - particleFadeOutStartTime < PARTICLE_FADEOUT_DURATION_MS)) {
                const n = sphereRainUpPositions.length / 3;
                for (let j = 0; j < n; j++) {
                    sphereRainUpPositions[j * 3 + 1] += SPHERE_RAIN_UP_SPEED;
                    if (sphereRainUpPositions[j * 3 + 1] > SPHERE_RAIN_TOP_MAX) {
                        sphereRainUpPositions[j * 3 + 1] = -FLYOUT_BOUND;
                        sphereRainUpPositions[j * 3] = (Math.random() - 0.5) * 2 * FLYOUT_BOUND;
                        sphereRainUpPositions[j * 3 + 2] = (Math.random() - 0.5) * 2 * FLYOUT_BOUND;
                    }
                }
                sphereRainUpParticles.geometry.attributes.position.needsUpdate = true;
            }
            if (sphereIsExploded) {
                sphereExplosionProgress = Math.min(1, sphereExplosionProgress + 0.018);
                sphereFadeProgress = Math.min(1, sphereFadeProgress + 0.04);
                sphereGroup.children.forEach(child => {
                    if (child.material) {
                        child.material.opacity = Math.max(0, 1 - sphereFadeProgress);
                        if (child.material.opacity <= 0) child.visible = false;
                    }
                });
                if (sphereClickSphere) sphereClickSphere.visible = false;
                if (sphereFloatingGroup) {
                    sphereDriftTiltAngle += sphereDriftTiltDirection * SPHERE_DRIFT_TILT_SPEED;
                    if (sphereDriftTiltAngle >= SPHERE_DRIFT_TILT_MAX) {
                        sphereDriftTiltAngle = SPHERE_DRIFT_TILT_MAX;
                        sphereDriftTiltDirection = -1;
                    } else if (sphereDriftTiltAngle <= -SPHERE_DRIFT_TILT_MAX) {
                        sphereDriftTiltAngle = -SPHERE_DRIFT_TILT_MAX;
                        sphereDriftTiltDirection = 1;
                    }
                    sphereFloatingGroup.rotation.y = sphereDriftTiltAngle;
                }
                const maxY = 10, minY = -10, finalMaxY = 25;
                let allImagesGone = true;
                sphereFloatingImages.forEach((img, index) => {
                    const data = img.userData;
                    const delayedProgress = Math.max(0, (sphereExplosionProgress - data.delay) / (1 - data.delay));
                    if (delayedProgress > 0) {
                        const t = Math.min(1, delayedProgress);
                        const eased = 1 - Math.pow(1 - t, 2);
                        const floatTime = sphereTime * 2;
                        const floatY = sphereIsFinalFlyUp ? 0 : Math.sin(floatTime * data.floatSpeedY + data.floatPhaseY) * data.floatAmplitudeY;
                        const elapsedSec = (Date.now() - sphereExplosionStartTime) / 1000;
                        const FAST_DRIFT_SEC = window.innerWidth < 768 ? 4 : 2.5;
                        const TAPER_END_SEC = window.innerWidth < 768 ? 7 : 5;
                        const FAST_SPEED = window.innerWidth < 768 ? 25 : 18;
                        let driftMultiplier = sphereIsFinalFlyUp ? 80 : (elapsedSec < FAST_DRIFT_SEC ? FAST_SPEED : (elapsedSec < TAPER_END_SEC ? FAST_SPEED - (FAST_SPEED - 1) * (elapsedSec - FAST_DRIFT_SEC) / (TAPER_END_SEC - FAST_DRIFT_SEC) : 1));
                        data.basePos.y += data.driftSpeed * driftMultiplier;
                        if (eased < 1) {
                            img.position.x = data.startPos.x + (data.targetPos.x - data.startPos.x) * eased;
                            img.position.z = data.startPos.z + (data.targetPos.z - data.startPos.z) * eased;
                            const lerpedY = data.startPos.y + (data.targetPos.y - data.startPos.y) * eased;
                            img.position.y = lerpedY + (data.basePos.y - data.targetPos.y) + floatY;
                        } else {
                            img.position.x = data.basePos.x;
                            img.position.y = data.basePos.y + floatY;
                            img.position.z = data.baseZ;
                        }
                        if (sphereIsFinalFlyUp) {
                            if (data.basePos.y < finalMaxY) allImagesGone = false;
                            else img.visible = false;
                        } else {
                            allImagesGone = false;
                            if (data.basePos.y > maxY) {
                                data.basePos.y = minY;
                                data.basePos.x = (Math.random() - 0.5) * 16;
                                data.baseZ = (Math.random() - 0.5) * 16;
                                img.position.x = data.basePos.x;
                                img.position.z = data.baseZ;
                            }
                        }
                        const imageOpacity = Math.min(1, delayedProgress * 2);
                        data.imageMaterial.opacity = imageOpacity;
                        const glowPulse = 0.65 + Math.sin(sphereTime * 3 + index * 0.5) * 0.25;
                        data.glowMaterial.opacity = Math.min(1, imageOpacity * glowPulse);
                        data.glowOuterMaterial.opacity = Math.min(1, imageOpacity * glowPulse * 0.75);
                    } else if (sphereIsFinalFlyUp) allImagesGone = false;
                });
                const canShowLetter = sphereIsFinalFlyUp && !sphereLetterShown && (allImagesGone || sphereFloatingImages.length === 0);
                if (canShowLetter) {
                    if (cfg3d.enableLetter === true)
                        sphereShowLetter();
                    else
                        sphereLetterShown = true;
                }
                if (sphereTextCrawlMesh && sphereTextCrawlStarted) {
                    if (sphereTextCrawlMesh.position.y < sphereTextStopY) sphereTextCrawlMesh.position.y += SPHERE_TEXT_CRAWL_SPEED;
                    if (sphereTextCrawlMesh.material.opacity < 1) sphereTextCrawlMesh.material.opacity = Math.min(1, sphereTextCrawlMesh.material.opacity + 0.015);
                }
                if (sphereNeedSmoothCameraReset && sphereSmoothCameraPosition) {
                    controls.target.lerp(sphereSmoothCameraTarget, 0.012);
                    camera.position.lerp(sphereSmoothCameraPosition, 0.012);
                    if (camera.position.distanceTo(sphereSmoothCameraPosition) < 0.1) {
                        camera.position.copy(sphereSmoothCameraPosition);
                        controls.target.copy(sphereSmoothCameraTarget);
                        sphereNeedSmoothCameraReset = false;
                    }
                }
            } else if (sphereIntroComplete) {
                if (sphereNeedZoomIn) {
                    camera.position.lerp(sphereZoomInTargetPosition, 0.08);
                    if (camera.position.distanceTo(controls.target) <= controls.minDistance + 0.05) sphereNeedZoomIn = false;
                }
                sphereGroup.rotation.y += 0.001;
                // Hạt không gian: xoay giống imageheart (0.0005 y, 0.00025 x) — không copy quả cầu
                if (sphereParticlesMesh) {
                    sphereParticlesMesh.rotation.y += 0.0005;
                    sphereParticlesMesh.rotation.x += 0.00025;
                }
                if (flyOutParticles) {
                    flyOutParticles.rotation.y += 0.0005;
                    flyOutParticles.rotation.x += 0.00025;
                }
            }
            // Intro (như imageheart): các mảnh phân bố toàn không gian → bay vào ghép thành quả cầu; sau đó hạt bay lên + xoay
            if (!sphereIntroComplete && sphereIntroStartTime > 0 && sphereMeshes.length > 0) {
                const elapsed = Date.now() - sphereIntroStartTime;
                const origin = new THREE.Vector3(0, 0, 0);
                const durationSec = SPHERE_INTRO_DURATION_MS / 1000;
                sphereMeshes.forEach(mesh => {
                    const delay = (mesh.userData.introDelay || 0) / 1000;
                    const t = Math.min(1, Math.max(0, (elapsed / 1000 - delay) / durationSec));
                    const eased = 1 - Math.pow(1 - t, 1.4);
                    mesh.position.lerpVectors(mesh.userData.introStartPos, origin, eased);
                    if (mesh.material) mesh.material.opacity = 1;
                });
                if (elapsed > SPHERE_INTRO_DURATION_MS + SPHERE_INTRO_STAGGER_MS) {
                    sphereIntroComplete = true;
                    if (!sphereIntroCompleteTime) sphereIntroCompleteTime = Date.now();
                    sphereMeshes.forEach(m => {
                        m.position.set(0, 0, 0);
                        if (m.material) m.material.opacity = 1;
                        m.visible = true;
                    });
                }
            }
            controls.update();
        }

        // Cập nhật kích thước Canvas 2D khi resize
        function onWindowResize() {
            windowHalfX = window.innerWidth / 2;
            windowHalfY = window.innerHeight / 2;
            w = window.innerWidth;
            h = window.innerHeight;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        window.initBackup2Scene = function() {
            init();
            animate();
        };
})();
