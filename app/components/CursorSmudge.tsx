"use client";

import { useEffect, useRef, useState } from "react";


interface Ripple {
  x: number;
  y: number;
  startTime: number;
  radius: number;
  intensity: number;
}

interface TrailPoint {
  x: number;
  y: number;
  time: number;
  intensity: number;
  vx: number;
  vy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  trajectory: 'straight' | 'orbital';
  centerX?: number;
  centerY?: number;
  angle?: number;
  radius?: number;
  angularVelocity?: number;
  type?: 'normal' | 'higgs';
}

export default function CursorSmudge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const mousePosRef = useRef({ x: 0, y: 0 });
  const svgContainersCacheRef = useRef<Element[]>([]);
  const svgContainersCacheAtRef = useRef(0);
  const trailsRef = useRef<TrailPoint[]>([]);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const [zoom, setZoom] = useState(1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const cursorSizeRef = useRef(150);
  const [blurRegions, setBlurRegions] = useState<Array<{ x: number; y: number; size: number; blur: number; vx: number; vy: number }>>([]);
  const bodyRef = useRef<HTMLBodyElement | null>(null);
  const ripplesRef = useRef<Ripple[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const isMobileRef = useRef(false);
  const randomMovementRef = useRef<{ x: number; y: number; targetX: number; targetY: number; lastMove: number } | null>(null);
  const blurRegionsRef = useRef<Array<{ x: number; y: number; size: number; blur: number; vx: number; vy: number }>>([]);
  const lastParticleSpawnRef = useRef(0);
  const lastHiggsSpawnRef = useRef(0);

  useEffect(() => {
    // Detect mobile device
    isMobileRef.current = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                          (typeof window !== 'undefined' && window.innerWidth <= 768);
    
    // Get body element to apply gravity lens transform
    bodyRef.current = document.body as HTMLBodyElement;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    
    // Initialize random movement for mobile
    if (isMobileRef.current) {
      randomMovementRef.current = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        targetX: window.innerWidth / 2,
        targetY: window.innerHeight / 2,
        lastMove: Date.now(),
      };
      mousePosRef.current = { x: randomMovementRef.current.x, y: randomMovementRef.current.y };
      setMousePos({ ...mousePosRef.current });
    }
    
    // Initialize blur regions - create multiple regions with different blur levels
    const numRegions = 4;
    const initialRegions = Array.from({ length: numRegions }, (_, i) => ({
      x: (window.innerWidth / numRegions) * i + Math.random() * (window.innerWidth / numRegions),
      y: Math.random() * window.innerHeight,
      size: 200 + Math.random() * 300,
      blur: 1 + Math.random() * 8, // Blur between 1-9px
      vx: (Math.random() - 0.5) * 0.5, // Horizontal velocity
      vy: (Math.random() - 0.5) * 0.5, // Vertical velocity
    }));
    blurRegionsRef.current = initialRegions;
    setBlurRegions(initialRegions);

    // Helper function to calculate cursor size based on orientation
    const updateCursorSize = () => {
      if (typeof window === 'undefined') return;
      const isPortrait = window.innerHeight > window.innerWidth;
      cursorSizeRef.current = isPortrait ? window.innerWidth / 3 : window.innerHeight / 3;
    };

    // Set canvas size
    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      updateCursorSize();
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Track mouse position with velocity
    let lastRippleTime = 0;
    const rippleInterval = 600; // Create new ripple every 600ms (less frequent)
    
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      const vx = e.clientX - lastMousePosRef.current.x;
      const vy = e.clientY - lastMousePosRef.current.y;
      
      mousePosRef.current = { x: e.clientX, y: e.clientY };
      trailsRef.current.push({
        x: e.clientX,
        y: e.clientY,
        time: now,
        intensity: 1.0,
        vx,
        vy,
      });
      
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      
      // Keep only recent trails (last 30 points for smoother effect)
      if (trailsRef.current.length > 30) {
        trailsRef.current.shift();
      }
      
      // Create continuous ripples on mouse movement
      if (now - lastRippleTime > rippleInterval) {
        ripplesRef.current.push({
          x: e.clientX,
          y: e.clientY,
          startTime: now,
          radius: 0,
          intensity: 1.0,
        });
        
        lastRippleTime = now;
        
        // Limit number of simultaneous ripples (allow more for continuous effect)
        if (ripplesRef.current.length > 15) {
          ripplesRef.current.shift();
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);

    // Handle click/touch to create water ripples
    const handleClick = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0]?.clientY : e.clientY;
      
      if (clientX !== undefined && clientY !== undefined) {
        const now = Date.now();
        ripplesRef.current.push({
          x: clientX,
          y: clientY,
          startTime: now,
          radius: 0,
          intensity: 1.0,
        });
        
        // Limit number of simultaneous ripples
        if (ripplesRef.current.length > 5) {
          ripplesRef.current.shift();
        }
      }
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("touchstart", handleClick, { passive: true });

    // Animation loop
    let lastUiSync = 0;
    const animate = (timestamp: number) => {
      timeRef.current = timestamp * 0.001;
      const now = Date.now();
      
      // Random movement for mobile (decorative only)
      if (isMobileRef.current && randomMovementRef.current) {
        const timeSinceLastMove = now - randomMovementRef.current.lastMove;
        const moveInterval = 2500 + Math.random() * 2500; // 2.5-5 seconds between moves
        const moveDuration = 1000 + Math.random() * 500; // 1-1.5 seconds to reach target
        
        // Check if it's time to set a new target
        if (timeSinceLastMove > moveInterval) {
          // Set new random target position
          const padding = 150;
          randomMovementRef.current.targetX = padding + Math.random() * (window.innerWidth - padding * 2);
          randomMovementRef.current.targetY = padding + Math.random() * (window.innerHeight - padding * 2);
          randomMovementRef.current.lastMove = now;
        }
        
        // Smoothly move towards target
        const timeSinceTargetSet = now - randomMovementRef.current.lastMove;
        if (timeSinceTargetSet < moveDuration) {
          const progress = Math.min(1, timeSinceTargetSet / moveDuration);
          // Smooth ease-in-out curve
          const easeProgress = progress < 0.5 
            ? 2 * progress * progress 
            : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          
          // Interpolate between current and target position
          const startX = randomMovementRef.current.x;
          const startY = randomMovementRef.current.y;
          randomMovementRef.current.x = startX + (randomMovementRef.current.targetX - startX) * easeProgress;
          randomMovementRef.current.y = startY + (randomMovementRef.current.targetY - startY) * easeProgress;
          
          mousePosRef.current = {
            x: randomMovementRef.current.x,
            y: randomMovementRef.current.y,
          };
        } else {
          randomMovementRef.current.x = randomMovementRef.current.targetX;
          randomMovementRef.current.y = randomMovementRef.current.targetY;
          mousePosRef.current = {
            x: randomMovementRef.current.x,
            y: randomMovementRef.current.y,
          };
        }
      }
      
      const pos = mousePosRef.current;
      const mouseX = pos.x;
      const mouseY = pos.y;

      // Create pulsing zoom effect (gravity lens zooms in and out)
      const currentZoom = 1.0 + Math.sin(timeRef.current * 1.5) * 0.3;
      
      // Animate blur regions - move them around and change blur levels
      const updatedRegions = blurRegionsRef.current.map((region, index) => {
        // Update position
        let newX = region.x + region.vx;
        let newY = region.y + region.vy;
        let newVx = region.vx;
        let newVy = region.vy;
        
        // Bounce off edges
        if (newX < 0 || newX > window.innerWidth) {
          newVx *= -1;
          newX = Math.max(0, Math.min(window.innerWidth, newX));
        }
        if (newY < 0 || newY > window.innerHeight) {
          newVy *= -1;
          newY = Math.max(0, Math.min(window.innerHeight, newY));
        }
        
        // Animate blur level (changes over time)
        let newBlur = 1 + Math.sin(timeRef.current * 0.8 + index * 0.5) * 4 + Math.cos(timeRef.current * 0.6 + index) * 3;
        newBlur = Math.max(0.5, Math.min(12, newBlur)); // Clamp between 0.5-12px
        
        let newSize = region.size;
        // Occasionally change size
        if (Math.random() < 0.01) {
          newSize = 150 + Math.random() * 400;
        }
        
        // Occasionally reverse direction (creates more chaotic movement)
        if (Math.random() < 0.005) {
          newVx = (Math.random() - 0.5) * 0.8;
          newVy = (Math.random() - 0.5) * 0.8;
        }
        
        return {
          x: newX,
          y: newY,
          size: newSize,
          blur: newBlur,
          vx: newVx,
          vy: newVy,
        };
      });
      
      blurRegionsRef.current = updatedRegions;
      
      // Update and apply water ripples to SVG elements
      const rippleDuration = 2000; // 2 seconds for longer visibility
      ripplesRef.current = ripplesRef.current.filter((ripple) => {
        const age = now - ripple.startTime;
        if (age > rippleDuration) return false;
        
        // Calculate ripple expansion
        const progress = age / rippleDuration; // 0 to 1
        ripple.radius = progress * 500; // Max radius 500px for larger circles
        ripple.intensity = Math.max(0, 1 - progress * 0.8); // Slower fade for better visibility
        
        return true;
      });

      // Apply gravity lens and water ripple effects to SVG elements
      if (mouseX > 0 && mouseY > 0) {
        const lensRadius = 250;
        const lensRadiusSquared = lensRadius * lensRadius;
        
        if (
          svgContainersCacheRef.current.length === 0 ||
          timestamp - svgContainersCacheAtRef.current > 3000
        ) {
          svgContainersCacheRef.current = Array.from(
            document.querySelectorAll(".hyperlinksImageContainer"),
          );
          svgContainersCacheAtRef.current = timestamp;
        }

        svgContainersCacheRef.current.forEach((container) => {
          const rect = container.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          let totalDistortionX = 0;
          let totalDistortionY = 0;
          let totalScale = 1;
          
          // Apply gravity lens effect
          const dx = mouseX - centerX;
          const dy = mouseY - centerY;
          const distanceSquared = dx * dx + dy * dy;
          
          if (distanceSquared < lensRadiusSquared) {
            const distance = Math.sqrt(distanceSquared);
            const normalizedDistance = distance / lensRadius;
            const falloff = 1 - normalizedDistance;
            const localZoom = 1 + (currentZoom - 1) * falloff * 0.8;
            totalScale = localZoom;
          }
          
          // Apply water ripple effects
          ripplesRef.current.forEach((ripple) => {
            const rippleDx = ripple.x - centerX;
            const rippleDy = ripple.y - centerY;
            const rippleDistance = Math.sqrt(rippleDx * rippleDx + rippleDy * rippleDy);
            
            // Check if this point is within the ripple's influence
            const rippleInfluenceRadius = ripple.radius + 150; // Extend influence for continuous effect
            if (rippleDistance < rippleInfluenceRadius && rippleDistance > Math.max(0, ripple.radius - 80)) {
              // Calculate ripple wave effect - multiple wave frequencies for concentric circles
              const wavePhase1 = (rippleDistance - ripple.radius) / 40; // Primary wave
              const wavePhase2 = (rippleDistance - ripple.radius) / 20; // Secondary wave
              const waveAmplitude1 = Math.sin(wavePhase1 * Math.PI * 2) * ripple.intensity;
              const waveAmplitude2 = Math.sin(wavePhase2 * Math.PI * 2) * ripple.intensity * 0.5;
              const waveAmplitude = waveAmplitude1 + waveAmplitude2;
              
              // Create distortion that pushes content outward (like water)
              const angle = Math.atan2(rippleDy, rippleDx);
              const distortionStrength = waveAmplitude * 40 * ripple.intensity; // Stronger distortion (doubled)
              
              totalDistortionX += Math.cos(angle) * distortionStrength;
              totalDistortionY += Math.sin(angle) * distortionStrength;
              
              // Add scale effect from ripple (creates depth)
              const scaleEffect = 1 + waveAmplitude * 0.15 * ripple.intensity; // Stronger scale effect
              totalScale *= scaleEffect;
            }
          });
          
          // Apply combined transform
          if (totalDistortionX !== 0 || totalDistortionY !== 0 || totalScale !== 1) {
            (container as HTMLElement).style.transform = 
              `translate(${totalDistortionX}px, ${totalDistortionY}px) scale(${totalScale})`;
            (container as HTMLElement).style.transformOrigin = 'center center';
            (container as HTMLElement).style.transition = 'transform 0.15s ease-out';
          } else {
            (container as HTMLElement).style.transform = 'translate(0, 0) scale(1)';
            (container as HTMLElement).style.transition = 'transform 0.3s ease-out';
          }
        });
      }
      
      // Clear with slow fade effect (creates smudge trail)
      ctx.fillStyle = "rgba(255, 255, 255, 0.02)";
      ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

      // Update and draw trails with wave effect
      trailsRef.current = trailsRef.current.filter((trail, index) => {
        const age = (now - trail.time) / 1000; // Age in seconds
        trail.intensity = Math.max(0, 1 - age * 1.5); // Fade over ~0.67 seconds
        
        if (trail.intensity <= 0) return false;

        // Add wave distortion based on time and position
        const waveX = Math.sin(timeRef.current * 2 + trail.x * 0.01) * 5 * trail.intensity;
        const waveY = Math.cos(timeRef.current * 1.5 + trail.y * 0.01) * 5 * trail.intensity;
        
        const x = trail.x + waveX;
        const y = trail.y + waveY;
        
        // Draw smudge effect with colors (not blue)
        // Trail radius is 80% of cursor size
        const radius = cursorSizeRef.current * 0.8 * trail.intensity;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        
        // Unisex color mixing - greens, oranges, yellows
        const baseHue = 60 + Math.sin(timeRef.current * 0.5 + index * 0.3) * 80; // 0-140 (yellows, greens, oranges)
        const hue1 = baseHue;
        const hue2 = baseHue + 30;
        const hue3 = baseHue + 60;
        
        gradient.addColorStop(0, `hsla(${hue1}, 70%, 60%, ${0.4 * trail.intensity})`);
        gradient.addColorStop(0.33, `hsla(${hue2}, 70%, 60%, ${0.3 * trail.intensity})`);
        gradient.addColorStop(0.66, `hsla(${hue3}, 70%, 60%, ${0.25 * trail.intensity})`);
        gradient.addColorStop(1, `hsla(${hue1}, 70%, 60%, ${0.05 * trail.intensity})`);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      // Spawn hyper-fast particles randomly (sometimes)
      const particleSpawnChance = 0.05; // 5% chance per frame - more frequent
      const bigParticleSpawnChance = 0.008; // 0.8% chance per frame for big particles
      const minTimeBetweenSpawns = 100; // Minimum 100ms between spawns
      const minTimeBetweenBigSpawns = 500; // Minimum 500ms between big particle spawns
      
      // Spawn small particles
      if (Math.random() < particleSpawnChance && now - lastParticleSpawnRef.current > minTimeBetweenSpawns) {
        const numParticles = 1 + Math.floor(Math.random() * 4); // 1-4 particles at a time
        
        for (let i = 0; i < numParticles; i++) {
          const trajectory = Math.random() < 0.5 ? 'straight' : 'orbital';
          
          if (trajectory === 'straight') {
            // Straight trajectory - spawn from random edge
            const edge = Math.floor(Math.random() * 4);
            let spawnX, spawnY, vx, vy;
            
            switch (edge) {
              case 0: // Top
              spawnX = Math.random() * canvas.width;
              spawnY = 0;
              vx = (Math.random() - 0.5) * 2;
              vy = 15 + Math.random() * 25; // Much faster downward
              break;
            case 1: // Right
              spawnX = canvas.width;
              spawnY = Math.random() * canvas.height;
              vx = -(15 + Math.random() * 25); // Much faster leftward
              vy = (Math.random() - 0.5) * 2;
              break;
            case 2: // Bottom
              spawnX = Math.random() * canvas.width;
              spawnY = canvas.height;
              vx = (Math.random() - 0.5) * 2;
              vy = -(15 + Math.random() * 25); // Much faster upward
              break;
            case 3: // Left
              spawnX = 0;
              spawnY = Math.random() * canvas.height;
              vx = 15 + Math.random() * 25; // Much faster rightward
              vy = (Math.random() - 0.5) * 2;
              break;
              default:
              spawnX = Math.random() * canvas.width;
              spawnY = Math.random() * canvas.height;
              const angle = Math.random() * Math.PI * 2;
              const speed = 15 + Math.random() * 25; // Much faster
              vx = Math.cos(angle) * speed;
              vy = Math.sin(angle) * speed;
            }
            
            particlesRef.current.push({
              x: spawnX,
              y: spawnY,
              vx,
              vy,
              life: 0,
              maxLife: 1000 + Math.random() * 2000, // 1-3 seconds
              size: 1, // Small particle
              trajectory: 'straight',
            });
          } else {
            // Orbital trajectory
            const centerX = Math.random() * canvas.width;
            const centerY = Math.random() * canvas.height;
            const radius = 50 + Math.random() * 200;
            const angle = Math.random() * Math.PI * 2;
            const angularVelocity = (0.05 + Math.random() * 0.15) * (Math.random() < 0.5 ? 1 : -1); // Fast rotation
            
            particlesRef.current.push({
              x: centerX + Math.cos(angle) * radius,
              y: centerY + Math.sin(angle) * radius,
              vx: 0,
              vy: 0,
              life: 0,
              maxLife: 2000 + Math.random() * 3000, // 2-5 seconds
              size: 1, // Small particle
              trajectory: 'orbital',
              centerX,
              centerY,
              angle,
              radius,
              angularVelocity,
            });
          }
        }
        
        lastParticleSpawnRef.current = now;
      }
      
      // Spawn big particles (less frequently)
      if (Math.random() < bigParticleSpawnChance && now - lastParticleSpawnRef.current > minTimeBetweenBigSpawns) {
        const numBigParticles = 1 + Math.floor(Math.random() * 2); // 1-2 big particles at a time
        
        for (let i = 0; i < numBigParticles; i++) {
          const trajectory = Math.random() < 0.6 ? 'straight' : 'orbital';
          const particleSize = 8 + Math.random() * 12; // 8-20px big particles
          
          if (trajectory === 'straight') {
            // Straight trajectory - spawn from random edge
            const edge = Math.floor(Math.random() * 4);
            let spawnX, spawnY, vx, vy;
            
            switch (edge) {
              case 0: // Top
                spawnX = Math.random() * canvas.width;
                spawnY = 0;
                vx = (Math.random() - 0.5) * 3;
                vy = 8 + Math.random() * 12; // Slower than small particles
                break;
              case 1: // Right
                spawnX = canvas.width;
                spawnY = Math.random() * canvas.height;
                vx = -(8 + Math.random() * 12);
                vy = (Math.random() - 0.5) * 3;
                break;
              case 2: // Bottom
                spawnX = Math.random() * canvas.width;
                spawnY = canvas.height;
                vx = (Math.random() - 0.5) * 3;
                vy = -(8 + Math.random() * 12);
                break;
              case 3: // Left
                spawnX = 0;
                spawnY = Math.random() * canvas.height;
                vx = 8 + Math.random() * 12;
                vy = (Math.random() - 0.5) * 3;
                break;
              default:
                spawnX = Math.random() * canvas.width;
                spawnY = Math.random() * canvas.height;
                const angle = Math.random() * Math.PI * 2;
                const speed = 8 + Math.random() * 12;
                vx = Math.cos(angle) * speed;
                vy = Math.sin(angle) * speed;
            }
            
            particlesRef.current.push({
              x: spawnX,
              y: spawnY,
              vx,
              vy,
              life: 0,
              maxLife: 3000 + Math.random() * 4000, // 3-7 seconds
              size: particleSize,
              trajectory: 'straight',
            });
          } else {
            // Orbital trajectory for big particles
            const centerX = Math.random() * canvas.width;
            const centerY = Math.random() * canvas.height;
            const radius = 100 + Math.random() * 300; // Larger orbits
            const angle = Math.random() * Math.PI * 2;
            const angularVelocity = (0.02 + Math.random() * 0.08) * (Math.random() < 0.5 ? 1 : -1); // Slower rotation
            
            particlesRef.current.push({
              x: centerX + Math.cos(angle) * radius,
              y: centerY + Math.sin(angle) * radius,
              vx: 0,
              vy: 0,
              life: 0,
              maxLife: 4000 + Math.random() * 5000, // 4-9 seconds
              size: particleSize,
              trajectory: 'orbital',
              centerX,
              centerY,
              angle,
              radius,
              angularVelocity,
            });
          }
        }
        
        lastParticleSpawnRef.current = now;
      }
      
      // Spawn Higgs boson more frequently (every 2-4 seconds)
      const higgsSpawnInterval = 2000 + Math.random() * 2000; // 2-4 seconds
      if (now - lastHiggsSpawnRef.current > higgsSpawnInterval) {
        // Spawn from anywhere on screen
        const startX = Math.random() * canvas.width;
        const startY = Math.random() * canvas.height;
        
        // Calculate viewport diagonal for path length reference
        const viewportDiagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
        
        // Path length: 150% to 300% of viewport diagonal (much longer trajectories)
        const pathLength = viewportDiagonal * (1.5 + Math.random() * 1.5); // 1.5 to 3.0
        
        // Random direction
        const angle = Math.random() * Math.PI * 2;
        
        // Calculate end position
        const endX = startX + Math.cos(angle) * pathLength;
        const endY = startY + Math.sin(angle) * pathLength;
        
        // Fast but noticeable speed - travel time based on path length
        // Longer paths take proportionally longer, but still fast
        const baseSpeed = viewportDiagonal / 300; // Base speed: cross viewport in ~300ms
        const travelTime = pathLength / baseSpeed; // Proportional to path length
        
        particlesRef.current.push({
          x: startX,
          y: startY,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
          life: 0,
          maxLife: travelTime,
          size: 2 + Math.random() * 2, // Small: 2-4 pixels
          trajectory: 'straight',
          type: 'higgs',
        });
        
        lastHiggsSpawnRef.current = now;
      }
      
      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((particle) => {
        // Update position based on trajectory
        if (particle.trajectory === 'straight') {
          particle.x += particle.vx;
          particle.y += particle.vy;
        } else if (particle.trajectory === 'orbital') {
          // Orbital movement
          particle.angle! += particle.angularVelocity!;
          particle.x = particle.centerX! + Math.cos(particle.angle!) * particle.radius!;
          particle.y = particle.centerY! + Math.sin(particle.angle!) * particle.radius!;
        }
        
        particle.life += 16; // Approximate frame time
        
        // Remove if expired
        // For Higgs boson, only remove when expired (not when off-screen) to allow long trajectories
        if (particle.life > particle.maxLife) {
          return false;
        }
        
        // For other particles, remove if off screen
        if (particle.type !== 'higgs' && 
            (particle.x < -100 || particle.x > canvas.width + 100 ||
             particle.y < -100 || particle.y > canvas.height + 100)) {
          return false;
        }
        
        // Draw particle - unisex colors
        const size = particle.size || 1; // Ensure size is always defined and valid
        
        // Validate particle position and size
        if (!isFinite(particle.x) || !isFinite(particle.y) || !isFinite(size) || size <= 0) {
          return false; // Skip invalid particles
        }
        
        if (particle.type === 'higgs') {
          // Higgs boson - pure black dot, like a cut
          ctx.fillStyle = 'rgba(0, 0, 0, 1)'; // Pure black
          ctx.fillRect(Math.floor(particle.x - size / 2), Math.floor(particle.y - size / 2), size, size);
        } else if (size === 1) {
          // Small 1px particle
          const particleHue = 30 + Math.random() * 120; // Orange/yellow/green range (30-150)
          const alpha = 1 - (particle.life / particle.maxLife) * 0.3; // Fade slightly
          
          ctx.fillStyle = `hsla(${particleHue}, 80%, 70%, ${alpha})`;
          ctx.fillRect(Math.floor(particle.x), Math.floor(particle.y), 1, 1);
          
          // Also draw a slightly larger point for visibility
          ctx.fillStyle = `hsla(${particleHue}, 80%, 70%, ${alpha * 0.5})`;
          ctx.fillRect(Math.floor(particle.x) - 1, Math.floor(particle.y) - 1, 3, 3);
        } else {
          // Big particle - draw as circle with gradient
          const particleHue = 30 + Math.random() * 120; // Orange/yellow/green range (30-150)
          const alpha = 1 - (particle.life / particle.maxLife) * 0.3; // Fade slightly
          
          const gradient = ctx.createRadialGradient(
            particle.x, particle.y, 0,
            particle.x, particle.y, size
          );
          gradient.addColorStop(0, `hsla(${particleHue}, 80%, 70%, ${alpha})`);
          gradient.addColorStop(0.5, `hsla(${particleHue + 20}, 80%, 65%, ${alpha * 0.7})`);
          gradient.addColorStop(1, `hsla(${particleHue + 40}, 80%, 60%, ${alpha * 0.3})`);
          
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, size, 0, Math.PI * 2);
          ctx.fill();
          
          // Add glow effect for big particles
          ctx.shadowBlur = size * 1.5;
          ctx.shadowColor = `hsla(${particleHue}, 80%, 70%, ${alpha * 0.5})`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
        
        return true;
      });

      // Draw water ripples on canvas - always show concentric circles
      ripplesRef.current.forEach((ripple, index) => {
        const age = now - ripple.startTime;
        const progress = age / rippleDuration;
        
        if (progress < 1) {
          // Draw multiple concentric circles for each ripple (stronger visual)
          const numRings = 6; // More rings for stronger effect
          const ringSpacing = 50; // Wider spacing between rings
          
          for (let ring = 0; ring < numRings; ring++) {
            const ringRadius = ripple.radius - ring * ringSpacing;
            
            // Only draw if ring is positive radius and visible
            if (ringRadius > 0) {
              // Calculate opacity based on distance from center and time (stronger)
              const ringProgress = ring / numRings;
              const ringOpacity = (1 - ringProgress) * ripple.intensity * 0.9; // Increased from 0.6 to 0.9
              
              // Alternate between green and orange for better visibility
              const hue = 60 + (ring % 2) * 60; // 60 (yellow) or 120 (green)
              
              ctx.strokeStyle = `hsla(${hue}, 80%, 65%, ${ringOpacity})`; // Higher saturation and lightness
              ctx.lineWidth = 3; // Thicker lines (increased from 2)
              ctx.beginPath();
              ctx.arc(ripple.x, ripple.y, ringRadius, 0, Math.PI * 2);
              ctx.stroke();
              
              // Add stronger glow effect
              ctx.shadowBlur = 15; // Increased from 10
              ctx.shadowColor = `hsla(${hue}, 80%, 65%, ${ringOpacity * 0.7})`; // Stronger shadow
              ctx.stroke();
              ctx.shadowBlur = 0;
            }
          }
        }
      });

      // Draw current cursor position with stronger wave effect
      if (mouseX > 0 && mouseY > 0) {
        const waveX = Math.sin(timeRef.current * 3) * 8;
        const waveY = Math.cos(timeRef.current * 2.5) * 8;
        
        const cursorRadius = cursorSizeRef.current;
        const cursorGradient = ctx.createRadialGradient(
          mouseX + waveX,
          mouseY + waveY,
          0,
          mouseX + waveX,
          mouseY + waveY,
          cursorRadius
        );
        
        // Unisex colors - greens, oranges, yellows
        const baseHue = 60 + Math.sin(timeRef.current * 0.4) * 80; // 0-140 (yellows, greens, oranges)
        cursorGradient.addColorStop(0, `hsla(${baseHue}, 80%, 65%, 0.5)`);
        cursorGradient.addColorStop(0.2, `hsla(${baseHue + 15}, 80%, 65%, 0.4)`);
        cursorGradient.addColorStop(0.4, `hsla(${baseHue + 30}, 80%, 65%, 0.35)`);
        cursorGradient.addColorStop(0.6, `hsla(${baseHue + 45}, 80%, 65%, 0.3)`);
        cursorGradient.addColorStop(0.8, `hsla(${baseHue + 60}, 80%, 65%, 0.2)`);
        cursorGradient.addColorStop(1, `hsla(${baseHue + 75}, 80%, 65%, 0.1)`);

        ctx.fillStyle = cursorGradient;
        ctx.beginPath();
        ctx.arc(mouseX + waveX, mouseY + waveY, cursorRadius, 0, Math.PI * 2);
        ctx.fill();
        
        // Add additional wave rings
        for (let i = 1; i <= 3; i++) {
          const ringRadius = cursorRadius + i * (cursorRadius * 0.2);
          const ringIntensity = 0.2 / i;
          const ringWave = Math.sin(timeRef.current * 2 + i) * 5;
          
          ctx.strokeStyle = `hsla(${baseHue + i * 15}, 70%, 60%, ${ringIntensity})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(
            mouseX + waveX,
            mouseY + waveY + ringWave,
            ringRadius,
            0,
            Math.PI * 2
          );
          ctx.stroke();
        }
      }

      if (timestamp - lastUiSync > 80) {
        lastUiSync = timestamp;
        setMousePos({ ...mousePosRef.current });
        setZoom(currentZoom);
        setCurrentTime(timeRef.current);
        setBlurRegions([...blurRegionsRef.current]);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate(0);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("touchstart", handleClick);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Clean up CSS custom properties
      if (bodyRef.current) {
        bodyRef.current.style.removeProperty('--lens-x');
        bodyRef.current.style.removeProperty('--lens-y');
        bodyRef.current.style.removeProperty('--lens-zoom');
        bodyRef.current.style.removeProperty('--lens-radius');
      }
    };
  }, []);

  return (
    <>
      {/* Canvas for color smudge effect */}
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9999,
          mixBlendMode: "multiply",
        }}
      />
      {/* Gravity lens effect - pulsing rings that zoom in and out */}
      {mousePos.x > 0 && mousePos.y > 0 && (
        <>
          {/* Gravity lens rings that pulse */}
          {[0, 1, 2, 3].map((i) => {
            const ringScale = zoom + i * 0.1;
            // Calculate cursor size based on orientation
            const isPortrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
            const baseCursorSize = isPortrait 
              ? (typeof window !== 'undefined' ? window.innerWidth / 3 : 150)
              : (typeof window !== 'undefined' ? window.innerHeight / 3 : 150);
            const ringRadius = baseCursorSize + i * (baseCursorSize * 0.2);
            const ringOpacity = (0.3 - i * 0.08) * (1 - Math.abs(zoom - 1.0) * 0.5);
            
            return (
              <div
                key={i}
                style={{
                  position: "fixed",
                  left: `${mousePos.x}px`,
                  top: `${mousePos.y}px`,
                  width: `${ringRadius * 2}px`,
                  height: `${ringRadius * 2}px`,
                  marginLeft: `-${ringRadius}px`,
                  marginTop: `-${ringRadius}px`,
                  borderRadius: "50%",
                  border: `2px solid hsla(${60 + Math.sin(currentTime * 0.3 + i) * 80 + i * 10}, 70%, 60%, ${ringOpacity})`,
                  pointerEvents: "none",
                  zIndex: 10001,
                  transform: `scale(${ringScale})`,
                  transition: "transform 0.1s ease-out, opacity 0.1s ease-out",
                  boxShadow: `0 0 ${ringRadius * 0.5}px hsla(${60 + Math.sin(currentTime * 0.3 + i) * 80 + i * 10}, 70%, 60%, ${ringOpacity * 0.5})`,
                }}
              />
            );
          })}
          
          {/* Gravity lens overlay - creates localized zoom effect on underlying content */}
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: "none",
              zIndex: 10000,
              clipPath: `circle(${(typeof window !== 'undefined' ? (window.innerHeight > window.innerWidth ? window.innerWidth / 3 : window.innerHeight / 3) : 200) * zoom}px at ${mousePos.x}px ${mousePos.y}px)`,
              transform: `scale(${zoom})`,
              transformOrigin: `${mousePos.x}px ${mousePos.y}px`,
              transition: "transform 0.1s ease-out, clip-path 0.1s ease-out",
            }}
          >
            {/* This creates the magnifying effect by scaling content within the clip-path */}
            <div
              style={{
                width: "100%",
                height: "100%",
                transform: `scale(${1 / zoom})`,
                transformOrigin: `${mousePos.x}px ${mousePos.y}px`,
                background: "transparent",
              }}
            />
          </div>
        </>
      )}
      {/* Animated blur regions - create inconsistent blur areas */}
      {blurRegions.map((region, index) => (
        <div
          key={index}
          style={{
            position: "fixed",
            left: `${region.x}px`,
            top: `${region.y}px`,
            width: `${region.size}px`,
            height: `${region.size}px`,
            marginLeft: `-${region.size / 2}px`,
            marginTop: `-${region.size / 2}px`,
            borderRadius: "50%",
            pointerEvents: "none",
            zIndex: 9998,
            backdropFilter: `blur(${region.blur}px)`,
            WebkitBackdropFilter: `blur(${region.blur}px)`,
            transition: "backdrop-filter 0.1s linear",
            mixBlendMode: "normal",
            opacity: 0.6,
          }}
        />
      ))}
      {/* Prism overlay that distorts the view */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
          zIndex: 9997,
          background: `radial-gradient(circle at ${mousePos.x}px ${mousePos.y}px, 
            rgba(255, 200, 50, 0.1) 0%,
            rgba(255, 180, 100, 0.08) 25%,
            rgba(200, 255, 150, 0.06) 50%,
            rgba(150, 255, 200, 0.04) 75%,
            transparent 100%)`,
          mixBlendMode: "overlay",
        }}
      />
    </>
  );
}

