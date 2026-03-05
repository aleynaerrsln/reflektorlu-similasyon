import { SceneManager } from './core/SceneManager.js';
import { HyperloopScene } from './3d/HyperloopScene.js';
import { Dashboard } from './ui/Dashboard.js';

// Initialize scene
const canvas = document.getElementById('three-canvas');
const sceneManager = new SceneManager(canvas);

// Initialize 3D hyperloop scene
const hyperloopScene = new HyperloopScene(sceneManager);

// Initialize dashboard UI overlay
const dashboardContainer = document.getElementById('dashboard-overlay');
const dashboard = new Dashboard(dashboardContainer);

// Start render loop
sceneManager.start();

// For real Omron PLC connection, uncomment:
// import { PlcConnector } from './data/PlcConnector.js';
// const plc = new PlcConnector({ host: '192.168.1.100', port: 9600 });
// plc.connect();
