"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { SVGResult } from "three/examples/jsm/loaders/SVGLoader.js";

interface MeltingSVGProps {
  svgContent: string;
  width?: number;
  height?: number;
}

// Custom shader for melting effect
const meltingVertexShader = `
  uniform float uTime;
  uniform float uMeltIntensity;
  uniform float uNoiseScale;
  
  varying vec2 vUv;
  varying float vMeltFactor;
  varying vec3 vPosition;
  
  // Improved noise function
  float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }
  
  float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }
  
  void main() {
    vUv = uv;
    vPosition = position;
    
    // Calculate melt factor based on Y position (top melts more)
    float meltFactor = 1.0 - uv.y;
    meltFactor = pow(meltFactor, 1.5); // More intense at top
    
    // Add multi-octave noise for organic melting
    vec2 noiseCoord = position.xy * uNoiseScale + vec2(uTime * 0.3, uTime * 0.2);
    float n1 = noise(noiseCoord);
    float n2 = noise(noiseCoord * 2.0) * 0.5;
    float n3 = noise(noiseCoord * 4.0) * 0.25;
    float n = (n1 + n2 + n3) / 1.75;
    
    // Calculate melt displacement with wave-like motion
    float wave = sin(position.x * 0.01 + uTime * 0.5) * 0.3 + 0.7;
    float meltDisplacement = meltFactor * uMeltIntensity * wave * (0.7 + n * 0.6);
    
    // Apply gravity-like downward pull
    vec3 pos = position;
    pos.y -= meltDisplacement;
    
    // Add horizontal spread as it melts (dripping effect)
    float horizontalSpread = n * meltDisplacement * 0.3;
    pos.x += horizontalSpread;
    
    // Add slight Z variation for depth
    pos.z += n * meltFactor * 2.0;
    
    vMeltFactor = meltFactor;
    
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const meltingFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor;
  
  varying vec2 vUv;
  varying float vMeltFactor;
  varying vec3 vPosition;
  
  void main() {
    // Base color with slight variation based on melt
    vec3 color = uColor;
    
    // Add slight transparency at melted edges for depth
    float alpha = 1.0 - vMeltFactor * 0.2;
    
    // Add subtle shading based on position
    float shade = 0.9 + vMeltFactor * 0.1;
    color *= shade;
    
    gl_FragColor = vec4(color, alpha);
  }
`;

export default function MeltingSVG({
  svgContent,
  width = 400,
  height = 400,
}: MeltingSVGProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const [useFallback, setUseFallback] = useState(true); // Start with fallback, try WebGL after mount

  useEffect(() => {
    // If dimensions are too small, use fallback
    if (width < 10 || height < 10) {
      setUseFallback(true);
      return;
    }

    if (!containerRef.current || useFallback) {
      return;
    }

    // Check if WebGL is available
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        console.warn('WebGL not available, using fallback');
        setUseFallback(true);
        return;
      }
    } catch (e) {
      console.warn('WebGL check failed, using fallback:', e);
      setUseFallback(true);
      return;
    }

    // Parse SVG using SVGLoader
    let loader: SVGLoader;
    let svgData: SVGResult;
    
    try {
      loader = new SVGLoader();
      svgData = loader.parse(svgContent);
      
      // Check if we have any paths
      if (!svgData.paths || svgData.paths.length === 0) {
        console.warn("No paths found in SVG, using fallback");
        setUseFallback(true);
        return;
      }
    } catch (error) {
      console.error("Error parsing SVG with SVGLoader:", error);
      setUseFallback(true);
      return;
    }

    // Get SVG viewBox for proper scaling
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgElement = doc.querySelector("svg");
    const viewBox = svgElement?.getAttribute("viewBox");
    let svgWidth = width;
    let svgHeight = height;
    let centerX = 0;
    let centerY = 0;

    if (viewBox) {
      const [x, y, w, h] = viewBox.split(" ").map(parseFloat);
      svgWidth = w;
      svgHeight = h;
      centerX = x + w / 2;
      centerY = y + h / 2;
    }

    // Setup Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060908);
    sceneRef.current = scene;

    const camera = new THREE.OrthographicCamera(
      -svgWidth / 2,
      svgWidth / 2,
      svgHeight / 2,
      -svgHeight / 2,
      0.1,
      1000
    );
    camera.position.z = 100;

    // Process all paths from SVG
    const extrudeSettings = {
      depth: 2,
      bevelEnabled: false,
    };

    // Create material with melting shader
    const uniforms = {
      uTime: { value: 0 },
      uMeltIntensity: { value: 20.0 },
      uNoiseScale: { value: 0.01 },
      uColor: { value: new THREE.Color(0x00d65a) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: meltingVertexShader,
      fragmentShader: meltingFragmentShader,
      uniforms,
      side: THREE.DoubleSide,
    });

    // Process each path in the SVG
    let hasGeometry = false;
    svgData.paths.forEach((path) => {
      try {
        const shapes = SVGLoader.createShapes(path);
        
        shapes.forEach((shape) => {
          try {
            const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
            
            // Center and scale geometry
            geometry.translate(-centerX, centerY, 0);
            geometry.scale(1, -1, 1); // Flip Y axis
            
            const mesh = new THREE.Mesh(geometry, material);
            scene.add(mesh);
            hasGeometry = true;
          } catch (geoError) {
            console.warn("Error creating geometry from shape:", geoError);
          }
        });
      } catch (shapeError) {
        console.warn("Error creating shapes from path:", shapeError);
      }
    });

    if (!hasGeometry) {
      console.warn("No geometry created, using fallback");
      setUseFallback(true);
      return;
    }

    // Setup renderer
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setSize(width, height);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      if (!containerRef.current) {
        setUseFallback(true);
        return;
      }
      containerRef.current.appendChild(renderer.domElement);
      rendererRef.current = renderer;
    } catch (renderError) {
      console.error("Error creating WebGL renderer:", renderError);
      setUseFallback(true);
      return;
    }

    // Store geometries and meshes for cleanup
    const geometries: THREE.BufferGeometry[] = [];
    const meshes: THREE.Mesh[] = [];
    scene.children.forEach((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child);
        if (child.geometry) {
          geometries.push(child.geometry);
        }
      }
    });

    // Animation loop
    const startTime = Date.now();
    const animate = () => {
      if (!rendererRef.current) return;
      
      const elapsed = (Date.now() - startTime) * 0.001;
      uniforms.uTime.value = elapsed;

      // Vary melt intensity over time with smooth oscillation
      uniforms.uMeltIntensity.value = 20.0 + Math.sin(elapsed * 0.3) * 8.0 + Math.cos(elapsed * 0.7) * 4.0;

      renderer.render(scene, camera);
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      geometries.forEach((geo) => geo.dispose());
      material.dispose();
      if (rendererRef.current) {
        rendererRef.current.dispose();
        if (containerRef.current && rendererRef.current.domElement.parentNode) {
          containerRef.current.removeChild(rendererRef.current.domElement);
        }
      }
    };
  }, [svgContent, width, height]);

  // Try to initialize WebGL after component mounts (optional enhancement)
  useEffect(() => {
    if (useFallback && width > 10 && height > 10) {
      // Small delay to ensure DOM is ready, then try WebGL
      const timer = setTimeout(() => {
        // Only try WebGL if it's likely to work
        if (typeof window !== 'undefined' && window.WebGLRenderingContext) {
          setUseFallback(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [useFallback, width, height]);

  // Always show SVG - fallback is the default
  if (useFallback || width < 10 || height < 10) {
    return (
      <div
        ref={fallbackRef}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    );
  }

  // WebGL container (only used if WebGL works)
  return (
    <>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      />
      {/* Fallback SVG hidden but ready */}
      <div
        ref={fallbackRef}
        style={{ display: "none" }}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
    </>
  );
}

