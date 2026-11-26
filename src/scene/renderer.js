import * as THREE from "three";
import { RATIOS } from "../core/defaults.js";
export function fitFrame(width, height, ratio) {
  if (!ratio) return { width, height };
  if (width / height > ratio) return { width: height * ratio, height };
  return { width, height: width / ratio };
}
export class Viewport {
  constructor(container, state) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "low-power",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Composición tridimensional. Un dedo gira; dos dedos desplazan y acercan.",
    );
    this.renderer.domElement.tabIndex = 0;
    container.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.state = state;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(document.getElementById("viewport"));
    this.onResize = () => {};
    this.onRender = () => {};
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      this.onContextLost?.();
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () =>
      this.onContextRestored?.(),
    );
  }
  resize() {
    const bounds = document.getElementById("viewport").getBoundingClientRect();
    const frame = fitFrame(
      bounds.width,
      bounds.height,
      this.freeFrame ? null : RATIOS[this.state.frame.ratio],
    );
    this.width = Math.max(1, Math.round(frame.width));
    this.height = Math.max(1, Math.round(frame.height));
    this.container.style.width = `${this.width}px`;
    this.container.style.height = `${this.height}px`;
    const guides = document.getElementById("frame-guides");
    guides.style.width = `${this.width}px`;
    guides.style.height = `${this.height}px`;
    guides.classList.toggle("thirds", !this.freeFrame && this.state.frame.thirds);
    guides.classList.toggle("framed", !this.freeFrame && this.state.frame.ratio !== "free");
    this.renderer.setSize(this.width, this.height);
    this.onResize(this.width / this.height);
    this.requestRender();
  }
  applyAppearance() {
    this.scene.background = new THREE.Color(this.state.appearance.background);
    this.renderer.toneMappingExposure = this.state.appearance.exposure;
    this.renderer.setPixelRatio(
      Math.min(
        devicePixelRatio || 1,
        this.state.appearance.quality === "high" ? 2 : 1.5,
      ),
    );
    this.resize();
  }
  requestRender() {
    if (this.pending) return;
    this.pending = requestAnimationFrame(() => {
      this.pending = null;
      this.onRender();
    });
  }
  render(camera) {
    this.renderer.render(this.scene, camera);
  }
}
