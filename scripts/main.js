import '../styles/style.scss'

import {gsap} from 'gsap'

import {OrbitControls} from "three/examples/jsm/controls/OrbitControls";
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

import {
  BlendFunction,
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,

} from "postprocessing";
import {
  CineonToneMapping,
  DirectionalLight,
  HalfFloatType,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  TextureLoader,
  WebGLRenderer,
  DefaultLoadingManager,
  PMREMGenerator,
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  MeshPhysicalMaterial, ConeGeometry, PlaneGeometry, CameraHelper, MeshPhongMaterial, Box3, DoubleSide, CanvasTexture
} from "three";
import {RGBELoader} from "three/addons/loaders/RGBELoader.js";
import { GUI } from 'dat.gui'

let renderer,
  scene,
  camera;

function load() {

  const assets = new Map();

  const gltfLoader = new GLTFLoader()
  const rgbeLoader = new RGBELoader()
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('../draco/')
  gltfLoader.setDRACOLoader(dracoLoader)

  const textureLoader = new TextureLoader()

  return new Promise((resolve, reject) => {

    gltfLoader.load('public/models/roman_door_free.glb', gltf => {
      assets.set('door', gltf.scene)
    })

    rgbeLoader
      .setPath(`img/`)
      .load('inner-hdr.hdr', t => {
        assets.set('inner-hdr', t)
      })

    DefaultLoadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      if (itemsLoaded === itemsTotal) {
        resolve(assets);
      }
    };
    DefaultLoadingManager.onError = reject;

  })
}

function initialize(assets) {

  const container3d = document.querySelector('.container3d')
  const width = container3d.clientWidth;
  const height = container3d.clientHeight;
  const aspect = width / height;

  renderer = new WebGLRenderer({
    powerPreference: "high-performance",
    antialias: false,
    stencil: false,
    depth: false,
  });
  renderer.setSize(width, height);
  renderer.setClearColor(0x0FC0FC);
  renderer.toneMapping = CineonToneMapping
  renderer.toneMappingExposure = 1
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFSoftShadowMap
  window.innerWidth <= 1920 ? renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio)) : ''

  container3d.appendChild(renderer.domElement);

  function setBackgroundGradient( color1, color2) {
    let canvas = document.createElement('canvas')
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 100, 100);
    gradient.addColorStop(0, color1);
    gradient.addColorStop(1, color2);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 100, 100);
    const bgTexture = new CanvasTexture(canvas);
    let canvasAspect = container3d.clientWidth / container3d.clientHeight;
    let imageAspect = bgTexture.image ? bgTexture.image.width / bgTexture.image.height : 1;
    let aspectBg = imageAspect / canvasAspect;

    bgTexture.offset.x = aspectBg > 1 ? (1 - 1 / aspectBg) / 2 : 0;
    bgTexture.repeat.x = aspectBg > 1 ? 1 / aspectBg : 1;

    bgTexture.offset.y = aspectBg > 1 ? 0 : (1 - aspectBg) / 2;
    bgTexture.repeat.y = aspectBg > 1 ? 1 : aspectBg;
    return bgTexture
  }

  scene = new Scene();
  scene.environment = new PMREMGenerator(renderer).fromCubemap(assets.get('inner-hdr')).texture
  scene.background = setBackgroundGradient('#ff0000','#0000ff')



  camera = new PerspectiveCamera(
    75,
    aspect,
    .1,
    1000
  )
  camera.lookAt(scene.position);
  camera.position.set(
    0,
    0,
    200
  )

  let controls = new OrbitControls(camera, renderer.domElement)
  controls.maxPolarAngle = Math.PI/1.7
  controls.update()

  // -------------------------------------------------------------------------------models------------------//

  const door = assets.get('door')
  door.rotation.y = Math.PI
  scene.add(door)
  door.traverse(node => {
    if(node.geometry) {
      node.geometry.center()
      node.updateWorldMatrix()
      node.receiveShadow = true
      node.castShadow = true
        node.material.envMapIntensity = .2
    }
  });

  //---------------------------------------------------------------------------------meshes-------------------------//

  const geometry = new SphereGeometry( 25, 64, 32 );
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    transmission: 1,
    opacity: 1,
    metalness: 0,
    roughness: 0,
    ior: 2.4,
    thickness: 5,
    envMapIntensity: 2
  });

  const sphere = new Mesh( geometry, material );
  sphere.receiveShadow = true

  const geometryCone = new ConeGeometry( 25, 100, 64 );
  const materialCone = new MeshStandardMaterial( {
    color: 0xffffff,
    metalness: .5,
    roughness: 1,
    envMapIntensity: .2
  } );
  const cone = new Mesh(geometryCone, materialCone );

  cone.add(sphere)
  scene.add( cone );
  cone.castShadow = true
  cone.receiveShadow = true

  const floor = new Mesh(new PlaneGeometry(1000, 1000), new MeshPhongMaterial({
    color: 0x777777
  }))
  floor.rotation.x = -Math.PI/2
  scene.add(floor)

  floor.receiveShadow = true


  //---------------------------------------------------------------------------------interactions-------------------//

  function setAllPositions() {
    const doorBox3 = new Box3().setFromObject(door)
    cone.position.set(
      doorBox3.max.x + 60,
      doorBox3.min.y + (cone.geometry.parameters.height / 2),
      -50
    )
    floor.position.set(0, doorBox3.min.y, 0)
  }

  setAllPositions()

  const gui = new GUI()

  const settings = {
    scaleX : 1,
    scaleY : 1
  }

  gui.add(settings, 'scaleX', 0.5, 2).onChange(val => {
    door.scale.x = val
  })
  gui.add(settings, 'scaleY', 0.5, 2).onChange(val => {
    door.scale.y = val
    setAllPositions()
  })

  //--------------------------------------------------------------------lights-------------------------//

  const sun = new DirectionalLight(0xffffff, 1)
  sun.position.set(
    -200, 150, 200
  )
  scene.add(sun)

  sun.castShadow = true
  sun.shadow.mapSize.width = 1024
  sun.shadow.mapSize.height = 1024
  sun.shadow.camera.near = .1
  sun.shadow.camera.far = 2000
  sun.shadow.camera.right = -500
  sun.shadow.camera.left = 500
  sun.shadow.camera.top = 500
  sun.shadow.camera.bottom = -500
  sun.shadow.bias = -0.001

  //++++++++++++++++++++++++postprocessing
  const composer = new EffectComposer(
    renderer, {
      frameBufferType: HalfFloatType
    }
  );

  const smaaEffect = new SMAAEffect();

  const renderPass = new RenderPass(scene, camera);
  const effectPass = new EffectPass(
    camera,
    smaaEffect,
  );
  const smaaPass = new EffectPass(camera, smaaEffect);
  effectPass.renderToScreen = true;

  composer.addPass(renderPass);
  composer.addPass(smaaPass);
  composer.addPass(effectPass);

  window.addEventListener("resize", (function() {

    let id = 0;

    function handleResize() {

      const width = container3d.clientWidth;
      const height = container3d.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      composer.setSize(width, height);

      id = 0;

    }

    return function onResize(event) {

      if(id === 0) {

        id = setTimeout(handleResize, 66, event);

      }

    };

  })());

  function render() {
    composer.render();
    requestAnimationFrame(render);
  }
  render()

}

load().then(initialize).catch(console.error);

