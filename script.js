let cameraRecorder;
let screenRecorder;
let cameraStream;
let screenStream;
let cameraTimer;
let screenTimer;
let cameraTimeElapsed = 0;
let screenTimeElapsed = 0;

// 新增设备选择相关变量
let availableCameras = [];
let availableMics = [];
let availableAudioOutputs = [];
let selectedFormat = 'webm';

// 获取DOM元素
const cameraPreview = document.getElementById('cameraPreview');
const screenPreview = document.getElementById('screenPreview');
const startCameraBtn = document.getElementById('startCamera');
const stopCameraBtn = document.getElementById('stopCamera');
const startScreenBtn = document.getElementById('startScreen');
const stopScreenBtn = document.getElementById('stopScreen');
const recordingsList = document.getElementById('recordingsList');

// 在 recording-section 中添加时间显示
const cameraSection = document.querySelector('.recording-section:first-of-type');
const screenSection = document.querySelector('.recording-section:last-of-type');

const cameraTimeDisplay = document.createElement('div');
cameraTimeDisplay.className = 'time-display';
cameraTimeDisplay.textContent = '00:00';
cameraSection.insertBefore(cameraTimeDisplay, cameraSection.querySelector('.buttons'));

const screenTimeDisplay = document.createElement('div');
screenTimeDisplay.className = 'time-display';
screenTimeDisplay.textContent = '00:00';
screenSection.insertBefore(screenTimeDisplay, screenSection.querySelector('.buttons'));

// 添加标签切换功能
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.dataset.tab;
        
        // 更新按钮状态
        tabButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        // 更新内容显示
        tabContents.forEach(content => {
            content.classList.remove('active');
            if (content.id === `${tabName}-tab`) {
                content.classList.add('active');
            }
        });
    });
});

// 获取设备选择元素
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const audioSelect = document.getElementById('audioSelect');
const cameraQualitySelect = document.getElementById('cameraQualitySelect');
const screenQualitySelect = document.getElementById('screenQualitySelect');
const mirrorToggle = document.getElementById('mirrorToggle');

// 质量设置
const qualitySettings = {
    '4K': { width: 3840, height: 2160 },
    '1080p': { width: 1920, height: 1080 },
    '720p': { width: 1280, height: 720 },
    '480p': { width: 854, height: 480 }
};

// 获取格式选择元素
const formatSelect = document.getElementById('formatSelect');

// 监听格式选择变化
formatSelect.addEventListener('change', (e) => {
    selectedFormat = e.target.value;
});

// 文件格式转换函数
async function convertFormat(blob, targetFormat) {
    if (targetFormat === 'webm') return blob;
    
    // 如果浏览器不支持 ffmpeg.js，直接返回原始 blob
    if (typeof FFmpeg === 'undefined') {
        console.warn('FFmpeg.js 未加载，无法进行格式转换');
        return blob;
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const videoData = new Uint8Array(e.target.result);
            
            if (targetFormat === 'mp4') {
                const worker = new Worker('ffmpeg-worker-mp4.js');
                worker.onmessage = function(e) {
                    const msg = e.data;
                    if (msg.type === "ready") {
                        worker.postMessage({
                            type: 'run',
                            arguments: ['-i', 'input.webm', '-c:v', 'libx264', 'output.mp4']
                        });
                    } else if (msg.type === "done") {
                        const mp4Blob = new Blob([msg.data], { type: 'video/mp4' });
                        resolve(mp4Blob);
                    }
                };
                worker.postMessage({
                    type: 'write',
                    path: 'input.webm',
                    data: videoData
                });
            } else if (targetFormat === 'gif') {
                const worker = new Worker('ffmpeg-worker-mp4.js');
                worker.onmessage = function(e) {
                    const msg = e.data;
                    if (msg.type === "ready") {
                        worker.postMessage({
                            type: 'run',
                            arguments: [
                                '-i', 'input.webm',
                                '-vf', 'fps=10,scale=320:-1:flags=lanczos',
                                'output.gif'
                            ]
                        });
                    } else if (msg.type === "done") {
                        const gifBlob = new Blob([msg.data], { type: 'image/gif' });
                        resolve(gifBlob);
                    }
                };
                worker.postMessage({
                    type: 'write',
                    path: 'input.webm',
                    data: videoData
                });
            }
        };
        reader.readAsArrayBuffer(blob);
    });
}

// 保存文件函数
async function saveFile(blob, type, timestamp) {
    try {
        // 转换格式
        const convertedBlob = await convertFormat(blob, selectedFormat);
        
        // 创建下载链接
        const url = URL.createObjectURL(convertedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_${timestamp}.${selectedFormat}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        return url;
    } catch (err) {
        console.error('保存文件失败:', err);
        // 如果发生错误，返回原始URL
        return URL.createObjectURL(blob);
    }
}

// 初始化设备列表
async function initializeDevices() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        
        availableCameras = devices.filter(device => device.kind === 'videoinput');
        availableMics = devices.filter(device => device.kind === 'audioinput');
        availableAudioOutputs = devices.filter(device => device.kind === 'audiooutput');
        
        // 填充摄像头选择
        cameraSelect.innerHTML = availableCameras
            .map(camera => `<option value="${camera.deviceId}">${camera.label || `摄像头 ${availableCameras.indexOf(camera) + 1}`}</option>`)
            .join('');
            
        // 填充麦克风选择
        micSelect.innerHTML = availableMics
            .map(mic => `<option value="${mic.deviceId}">${mic.label || `麦克风 ${availableMics.indexOf(mic) + 1}`}</option>`)
            .join('');
            
        // 填充音频输出选择
        audioSelect.innerHTML = availableAudioOutputs
            .map(audio => `<option value="${audio.deviceId}">${audio.label || `音频输出 ${availableAudioOutputs.indexOf(audio) + 1}`}</option>`)
            .join('');
    } catch (err) {
        console.error('获取设备列表失败:', err);
    }
}

// 监听设备变化
navigator.mediaDevices.addEventListener('devicechange', initializeDevices);

// 镜像切换
mirrorToggle.addEventListener('change', () => {
    cameraPreview.classList.toggle('mirror', mirrorToggle.checked);
});

// 更新摄像头预览
async function updateCameraStream() {
    try {
        // 如果已有流，先停止所有轨道
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
        }
        
        const quality = qualitySettings[cameraQualitySelect.value];
        
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined,
                width: { ideal: quality.width },
                height: { ideal: quality.height }
            },
            audio: {
                deviceId: micSelect.value ? { exact: micSelect.value } : undefined,
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        cameraPreview.srcObject = cameraStream;
        
        // 确保视频元素正确播放
        await cameraPreview.play().catch(err => {
            console.warn('自动播放失败，可能需要用户交互:', err);
        });
    } catch (err) {
        console.error('更新摄像头流失败:', err);
        alert('更新摄像头设置失败，请确保已授予权限并连接了摄像头设备。');
    }
}

// 监听设备和质量选择变化
cameraSelect.addEventListener('change', updateCameraStream);
micSelect.addEventListener('change', updateCameraStream);
cameraQualitySelect.addEventListener('change', updateCameraStream);

// 注册Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful');
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// 摄像头录制
startCameraBtn.addEventListener('click', async () => {
    try {
        // 如果没有摄像头流或流已停止，重新获取
        if (!cameraStream || cameraStream.getVideoTracks()[0].readyState === 'ended') {
            await updateCameraStream();
        }
        
        cameraRecorder = new MediaRecorder(cameraStream, {
            mimeType: 'video/webm;codecs=vp9'
        });
        const chunks = [];

        cameraRecorder.ondataavailable = (e) => chunks.push(e.data);
        cameraRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            addRecordingToList('摄像头录制', url);
            clearInterval(cameraTimer);
            cameraTimeElapsed = 0;
            cameraTimeDisplay.textContent = '00:00';
        };

        cameraRecorder.start(1000); // 每秒触发一次 ondataavailable
        startCameraBtn.disabled = true;
        stopCameraBtn.disabled = false;
        
        // 开始计时
        cameraTimeElapsed = 0;
        cameraTimer = setInterval(() => {
            cameraTimeElapsed++;
            const minutes = Math.floor(cameraTimeElapsed / 60);
            const seconds = cameraTimeElapsed % 60;
            cameraTimeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    } catch (err) {
        console.error('无法访问摄像头:', err);
        alert('无法访问摄像头，请确保已授予权限。');
    }
});

stopCameraBtn.addEventListener('click', () => {
    cameraRecorder.stop();
    // 停止录制但保持预览
    updateCameraStream();
    startCameraBtn.disabled = false;
    stopCameraBtn.disabled = true;
});

// 屏幕录制
startScreenBtn.addEventListener('click', async () => {
    try {
        const quality = qualitySettings[screenQualitySelect.value];
        screenStream = await navigator.mediaDevices.getDisplayMedia({ 
            video: { 
                cursor: "always",
                width: { ideal: quality.width },
                height: { ideal: quality.height }
            }, 
            audio: {
                deviceId: audioSelect.value ? { exact: audioSelect.value } : undefined,
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });
        screenPreview.srcObject = screenStream;
        
        screenRecorder = new MediaRecorder(screenStream, {
            mimeType: 'video/webm;codecs=vp9'
        });
        const chunks = [];

        screenRecorder.ondataavailable = (e) => chunks.push(e.data);
        screenRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            addRecordingToList('屏幕录制', url);
            clearInterval(screenTimer);
            screenTimeElapsed = 0;
            screenTimeDisplay.textContent = '00:00';
        };

        screenRecorder.start(1000);
        startScreenBtn.disabled = true;
        stopScreenBtn.disabled = false;

        // 开始计时
        screenTimeElapsed = 0;
        screenTimer = setInterval(() => {
            screenTimeElapsed++;
            const minutes = Math.floor(screenTimeElapsed / 60);
            const seconds = screenTimeElapsed % 60;
            screenTimeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    } catch (err) {
        console.error('无法访问屏幕:', err);
        alert('无法访问屏幕，请确保已授予权限。');
    }
});

stopScreenBtn.addEventListener('click', () => {
    screenRecorder.stop();
    screenStream.getTracks().forEach(track => track.stop());
    screenPreview.srcObject = null;
    startScreenBtn.disabled = false;
    stopScreenBtn.disabled = true;
});

// 修改录制文件添加到列表的函数
function addRecordingToList(type, url) {
    // 创建预览功能
    function createPreview() {
        // 创建预览容器
        const overlay = document.createElement('div');
        overlay.className = 'video-preview-overlay';

        const container = document.createElement('div');
        container.className = 'video-preview-container';

        const video = document.createElement('video');
        video.className = 'video-preview';
        video.src = url;
        video.controls = true;

        const closeButton = document.createElement('button');
        closeButton.className = 'close-preview';
        closeButton.innerHTML = '×';

        // 添加关闭功能
        function closePreview() {
            document.body.removeChild(overlay);
            video.pause();
            video.src = '';
        }

        closeButton.addEventListener('click', closePreview);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closePreview();
        });

        // 组装预览元素
        container.appendChild(video);
        container.appendChild(closeButton);
        overlay.appendChild(container);

        return {
            show: () => {
                document.body.appendChild(overlay);
                video.play().catch(err => console.warn('自动播放失败:', err));
            }
        };
    }

    const now = new Date();
    const timestamp = now.toLocaleString('zh-CN');
    const extension = selectedFormat || 'webm';
    
    const div = document.createElement('div');
    div.className = 'recording-item';
    div.innerHTML = `
        <a href="${url}" download="${type}_${timestamp}.${extension}">
            <svg class="icon" viewBox="0 0 24 24" style="width: 1em; height: 1em; margin-right: 0.5em;">
                <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/>
            </svg>
            ${type} - ${timestamp}
        </a>
        <div class="recording-buttons">
            <button class="preview-button">
                <svg class="icon" viewBox="0 0 24 24" style="width: 1em; height: 1em; margin-right: 0.5em;">
                    <path fill="currentColor" d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                预览
            </button>
            <button class="save-button">
                <svg class="icon" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M19 12v7H5v-7H3v7c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-7h-2zm-6 .67l2.59-2.58L17 11.5l-5 5-5-5 1.41-1.41L11 12.67V3h2v9.67z"/>
                </svg>
                保存
            </button>
        </div>
    `;

    // 创建预览实例
    const preview = createPreview();
    
    // 添加预览按钮事件监听
    div.querySelector('.preview-button').addEventListener('click', () => preview.show());

    // 添加保存按钮事件监听
    div.querySelector('.save-button').addEventListener('click', async () => {
        const response = await fetch(url);
        const blob = await response.blob();
        await saveFile(blob, type, timestamp);
    });

    recordingsList.appendChild(div);
}

// 页面加载完成后初始化
window.addEventListener('load', async () => {
    // 请求设备权限以获取设备名称
    try {
        const initialStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        // 设置初始预览
        cameraPreview.srcObject = initialStream;
        cameraStream = initialStream;

        initialStream.getTracks().forEach(track => track.stop());
        await initializeDevices();
        
        // 初始化完成后重新启动预览
        updateCameraStream();
    } catch (err) {
        console.error('初始化设备失败:', err);
    }
});

// 画中画相关变量
let pipRecorder;
let pipScreenStream;
let pipCameraStream;
let pipCanvas;
let pipContext;
let pipTimer;
let pipTimeElapsed = 0;

// 获取画中画元素
const pipScreenPreview = document.getElementById('pipScreenPreview');
const pipCameraPreview = document.getElementById('pipCameraPreview');
const startPipBtn = document.getElementById('startPip');
const stopPipBtn = document.getElementById('stopPip');
const pipSizeSelect = document.getElementById('pipSizeSelect');

// 监听摄像头大小变化
pipSizeSelect.addEventListener('change', () => {
    pipCameraPreview.className = `pip-camera ${pipSizeSelect.value}`;
});

// 合并视频流
function setupPipRecording(screenStream, cameraStream) {
    // 创建画布
    pipCanvas = document.createElement('canvas');
    const screenVideo = pipScreenPreview;
    
    // 设置画布大小为屏幕流的大小
    pipCanvas.width = screenVideo.videoWidth;
    pipCanvas.height = screenVideo.videoHeight;
    pipContext = pipCanvas.getContext('2d');
    
    // 创建合并后的媒体流
    const canvasStream = pipCanvas.captureStream();
    
    // 添加音轨
    const audioTracks = [
        ...screenStream.getAudioTracks(),
        ...cameraStream.getAudioTracks()
    ];
    audioTracks.forEach(track => canvasStream.addTrack(track));
    
    return canvasStream;
}

// 绘制画中画效果
function drawPip() {
    if (!pipCanvas || !pipContext) return;
    
    const screenVideo = pipScreenPreview;
    const cameraVideo = pipCameraPreview;
    
    // 绘制屏幕内容
    pipContext.drawImage(screenVideo, 0, 0, pipCanvas.width, pipCanvas.height);
    
    // 计算摄像头视频的大小和位置
    const sizes = {
        small: { width: pipCanvas.width * 0.15, height: pipCanvas.height * 0.15 },
        medium: { width: pipCanvas.width * 0.25, height: pipCanvas.height * 0.25 },
        large: { width: pipCanvas.width * 0.35, height: pipCanvas.height * 0.35 }
    };
    
    const size = sizes[pipSizeSelect.value];
    const padding = 20;
    const x = pipCanvas.width - size.width - padding;
    const y = pipCanvas.height - size.height - padding;
    
    // 绘制摄像头内容
    pipContext.save();
    pipContext.beginPath();
    pipContext.roundRect(x, y, size.width, size.height, 8);
    pipContext.clip();
    pipContext.drawImage(cameraVideo, x, y, size.width, size.height);
    
    // 绘制边框
    pipContext.strokeStyle = 'white';
    pipContext.lineWidth = 2;
    pipContext.stroke();
    pipContext.restore();
    
    requestAnimationFrame(drawPip);
}

// 开始画中画录制
startPipBtn.addEventListener('click', async () => {
    try {
        // 获取屏幕流
        const quality = qualitySettings[pipQualitySelect.value];
        pipScreenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
                cursor: "always",
                width: { ideal: quality.width },
                height: { ideal: quality.height }
            },
            audio: {
                deviceId: pipAudioSelect.value ? { exact: pipAudioSelect.value } : undefined,
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        pipScreenPreview.srcObject = pipScreenStream;
        
        // 获取摄像头流
        pipCameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                deviceId: pipCameraSelect.value ? { exact: pipCameraSelect.value } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: {
                deviceId: pipMicSelect.value ? { exact: pipMicSelect.value } : undefined,
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        pipCameraPreview.srcObject = pipCameraStream;
        
        // 等待视频元数据加载完成
        await Promise.all([
            new Promise(resolve => pipScreenPreview.onloadedmetadata = resolve),
            new Promise(resolve => pipCameraPreview.onloadedmetadata = resolve)
        ]);
        
        // 设置画中画录制
        const combinedStream = setupPipRecording(pipScreenStream, pipCameraStream);
        drawPip();
        
        // 开始录制
        pipRecorder = new MediaRecorder(combinedStream, {
            mimeType: 'video/webm;codecs=vp9'
        });
        
        const chunks = [];
        pipRecorder.ondataavailable = e => chunks.push(e.data);
        pipRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            addRecordingToList('画中画录制', url);
            clearInterval(pipTimer);
            pipTimeElapsed = 0;
            document.querySelector('#pip-tab .time-display').textContent = '00:00';
        };
        
        pipRecorder.start(1000);
        startPipBtn.disabled = true;
        stopPipBtn.disabled = false;
        
        // 开始计时
        pipTimeElapsed = 0;
        pipTimer = setInterval(() => {
            pipTimeElapsed++;
            const minutes = Math.floor(pipTimeElapsed / 60);
            const seconds = pipTimeElapsed % 60;
            document.querySelector('#pip-tab .time-display').textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
        
    } catch (err) {
        console.error('画中画录制失败:', err);
        alert('启动画中画录制失败，请检查设备权限。');
    }
});

// 停止画中画录制
stopPipBtn.addEventListener('click', () => {
    pipRecorder.stop();
    pipScreenStream.getTracks().forEach(track => track.stop());
    pipCameraStream.getTracks().forEach(track => track.stop());
    pipScreenPreview.srcObject = null;
    pipCameraPreview.srcObject = null;
    startPipBtn.disabled = false;
    stopPipBtn.disabled = true;
    pipCanvas = null;
    pipContext = null;
}); 