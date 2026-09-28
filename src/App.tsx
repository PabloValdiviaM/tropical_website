import React, { useState, useRef, useEffect } from 'react';
import { Compass, Gauge, Zap, Activity, ShieldCheck, ChevronDown, ArrowUpRight, Flame, Trees, Sparkles, Navigation } from 'lucide-react';

// Lista completa de los 75 cuadros en alta resolución cargados en /public/frames
// frame_001.png a frame_051.png (secuencial 1 a 51) y frame_053.png a frame_099.png (53 a 99)
const FRAMES_LIST: string[] = [
  ...Array.from({ length: 51 }, (_, i) => `/frames/frame_${String(i + 1).padStart(3, '0')}.png`),
  ...Array.from({ length: 24 }, (_, i) => `/frames/frame_${String(53 + i * 2).padStart(3, '0')}.png`),
];
const TOTAL_FRAMES = FRAMES_LIST.length;

export default function App() {
  const [email, setEmail] = useState('');
  const [videoError, setVideoError] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  // Scrollytelling state
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(1);
  const [framesLoadedCount, setFramesLoadedCount] = useState(0);

  const currentFrameRef = useRef(1);
  const videoRef = useRef<HTMLVideoElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const scrollyContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);

  // Escuchar preferencia de movimiento reducido
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Función para dibujar el frame con object-fit: cover exacto y fallback inteligente si un frame aún no ha descargado
  const drawFrame = (frameNum: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imgIndex = Math.max(0, Math.min(TOTAL_FRAMES - 1, frameNum - 1));
    let img = imagesRef.current[imgIndex];

    // Si el frame solicitado no ha completado su carga, buscar el cuadro cargado más próximo para evitar parpadeos negros
    if (!img || !img.complete || !img.naturalWidth) {
      let nearestDist = Infinity;
      let nearestImg: HTMLImageElement | null = null;
      for (let i = 0; i < imagesRef.current.length; i++) {
        const candidate = imagesRef.current[i];
        if (candidate && candidate.complete && candidate.naturalWidth > 0) {
          const dist = Math.abs(i - imgIndex);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestImg = candidate;
          }
        }
      }
      if (nearestImg) {
        img = nearestImg;
      }
    }

    if (!img || !img.complete || !img.naturalWidth) return;

    const cw = canvas.width;
    const ch = canvas.height;
    if (cw === 0 || ch === 0) return;

    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;

    // Calcular scale cover exacto sin deformación
    const scale = Math.max(cw / iw, ch / ih);
    const nw = iw * scale;
    const nh = ih * scale;
    const ox = (cw - nw) / 2;
    const oy = (ch - nh) / 2;

    ctx.drawImage(img, ox, oy, nw, nh);
  };

  // Precargar las imágenes de la secuencia en alta resolución (.png)
  useEffect(() => {
    const imgs: HTMLImageElement[] = [];
    let loaded = 0;

    FRAMES_LIST.forEach((src, idx) => {
      const img = new Image();
      img.src = src;
      img.onload = () => {
        loaded++;
        setFramesLoadedCount(loaded);
        // Si se acaba de cargar el primer frame o el frame actualmente visible, dibujarlo
        if (idx === 0 || idx === currentFrameRef.current - 1) {
          drawFrame(currentFrameRef.current);
        }
      };
      img.onerror = () => {
        console.warn(`Frame no disponible en ${src}`);
      };
      imgs.push(img);
    });
    imagesRef.current = imgs;
  }, []);

  // Ajustar resolución del canvas a viewport únicamente en resize real (no en cada cuadro de scroll)
  useEffect(() => {
    const resizeCanvas = () => {
      if (!canvasRef.current) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);

      if (canvasRef.current.width !== w || canvasRef.current.height !== h) {
        canvasRef.current.width = w;
        canvasRef.current.height = h;
      }
      drawFrame(currentFrameRef.current);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  // Listener de Scroll para el Scrollytelling sincronizado mediante requestAnimationFrame
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          if (!scrollyContainerRef.current) return;
          const rect = scrollyContainerRef.current.getBoundingClientRect();
          const containerHeight = rect.height - window.innerHeight;
          if (containerHeight <= 0) return;

          const progress = Math.max(0, Math.min(1, -rect.top / containerHeight));
          setScrollProgress(progress);

          const frameNumber = Math.max(
            1,
            Math.min(TOTAL_FRAMES, Math.floor(progress * (TOTAL_FRAMES - 1)) + 1)
          );

          if (currentFrameRef.current !== frameNumber) {
            currentFrameRef.current = frameNumber;
            setCurrentFrameIndex(frameNumber);
            drawFrame(frameNumber);
          }
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Pausar video del Hero fuera de pantalla
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (prefersReducedMotion) {
      video.pause();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            video.pause();
          } else if (!prefersReducedMotion && document.visibilityState === 'visible') {
            video.play().catch(() => {});
          }
        });
      },
      { threshold: 0.15 }
    );

    if (heroRef.current) {
      observer.observe(heroRef.current);
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        video.pause();
      } else if (!prefersReducedMotion) {
        video.play().catch(() => {});
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [prefersReducedMotion]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const scrollToStory = () => {
    if (scrollyContainerRef.current) {
      scrollyContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Cálculo de opacidad y desplazamiento para cada acto del scrollytelling
  const getActOpacity = (start: number, end: number, fadeDist = 0.05, isLast = false) => {
    if (isLast) {
      if (scrollProgress < start - fadeDist) return 0;
      if (scrollProgress < start) {
        return (scrollProgress - (start - fadeDist)) / fadeDist;
      }
      return 1; // Permanece visible hasta el final del recorrido sin fundido en negro prematuro
    }
    if (scrollProgress < start - fadeDist || scrollProgress > end + fadeDist) return 0;
    if (scrollProgress >= start && scrollProgress <= end) return 1;
    if (scrollProgress < start) {
      return (scrollProgress - (start - fadeDist)) / fadeDist;
    }
    return (end + fadeDist - scrollProgress) / fadeDist;
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-white selection:bg-white/20 selection:text-white font-sans-ui overflow-x-clip">
      {/* ===================== HERO SECTION ===================== */}
      <section
        id="inicio"
        ref={heroRef}
        className="relative min-h-screen w-full flex flex-col justify-between"
        aria-label="Hero Diario Asombro"
      >
        {/* ================= VIDEO DE FONDO Y DEGRADADOS ================= */}
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
          {!videoError ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              poster="/media/orange-car-jungle-poster.jpg"
              onError={() => setVideoError(true)}
              className="w-full h-full object-cover object-center"
              style={{
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            >
              <source src="/media/orange-car-jungle.mp4" type="video/mp4" />
              <source
                src="https://res.cloudinary.com/e0ixhoqu/video/upload/v1790293464/Orange_car_driving_through_jungle_20260924184002.mp4"
                type="video/mp4"
              />
            </video>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-black/80 text-white/50 text-sm">
              Archivo pendiente: /media/orange-car-jungle.mp4
            </div>
          )}

          {/* Degradados negro en los extremos */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/30 to-black/85 pointer-events-none" />
          <div className="absolute top-0 inset-x-0 h-36 bg-gradient-to-b from-black via-black/50 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 h-44 bg-gradient-to-t from-black via-black/60 to-transparent pointer-events-none" />
        </div>

        {/* ================= NAVEGACIÓN ================= */}
        <header className="relative z-20 w-full px-6 md:px-10 py-6 md:py-8">
          <div className="max-w-[1440px] mx-auto flex items-center justify-between">
            {/* Logo / Marca */}
            <a
              href="#"
              className="text-lg md:text-xl font-medium tracking-tight text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded px-1 transition-opacity hover:opacity-90 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            >
              Asombro
            </a>

            {/* Enlaces de navegación */}
            <nav
              className="hidden md:flex items-center gap-8 text-sm font-normal text-white/80"
              aria-label="Navegación principal"
            >
              <a
                href="#inicio"
                className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded py-1 px-1.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
              >
                Inicio
              </a>
              <a
                href="#fusion-selva"
                onClick={(e) => {
                  e.preventDefault();
                  const el = document.getElementById('fusion-selva');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded py-1 px-1.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
              >
                Audi & Selva
              </a>
              <a
                href="#expedicion"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToStory();
                }}
                className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded py-1 px-1.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
              >
                Expedición Scrolly
              </a>
              <a
                href="#rendimiento"
                onClick={(e) => {
                  e.preventDefault();
                  scrollToStory();
                }}
                className="hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded py-1 px-1.5 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
              >
                Rendimiento
              </a>
            </nav>

            {/* Botón blanco «Empieza tu viaje» */}
            <button
              type="button"
              onClick={scrollToStory}
              className="h-10 px-5 rounded-full bg-white text-black font-medium text-sm hover:bg-neutral-100 active:scale-[0.98] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black shadow-lg flex items-center gap-2"
            >
              <span>Empieza tu viaje</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* ================= CONTENIDO HERO ================= */}
        <div className="relative z-10 w-full max-w-[1440px] mx-auto px-6 md:px-10 flex-1 flex flex-col items-center justify-start text-center pt-8 md:pt-14 lg:pt-20 pb-8">
          <div className="max-w-[840px] w-full flex flex-col items-center">
            {/* 1. Cápsula centrada */}
            <div
              className="animate-entrance inline-flex items-center px-4 py-1.5 rounded-full border border-white/15 bg-white/10 backdrop-blur-md text-xs md:text-sm font-normal text-white/90 mb-5 md:mb-7 shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
              style={{ animationDelay: '0ms' }}
            >
              Más de 7.000 personas ya suscritas
            </div>

            {/* 2. H1 en una sola línea */}
            <h1
              className="hero-title animate-entrance text-white text-center mb-7 md:mb-9 max-w-full drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]"
              style={{ animationDelay: '100ms' }}
            >
              <span className="font-sans-ui font-medium whitespace-nowrap">Inspírate </span>
              <span className="font-serif-italic font-normal whitespace-nowrap">con nosotros</span>
            </h1>

            {/* 3. Formulario en cápsula de vidrio */}
            <form
              onSubmit={handleSubmit}
              className="animate-entrance w-full max-w-[512px] p-1.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)] flex items-center mb-5 md:mb-6"
              style={{ animationDelay: '200ms' }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Tu email"
                aria-label="Tu email"
                required
                className="flex-1 min-w-0 bg-transparent px-4 md:px-5 py-2.5 text-sm md:text-base text-white placeholder-white/50 focus:outline-none"
              />
              <button
                type="submit"
                className="h-10 md:h-11 px-6 rounded-full bg-white text-black font-medium text-sm hover:bg-neutral-100 active:scale-[0.98] transition-all duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black shadow-md"
              >
                Suscribirse
              </button>
            </form>

            {/* 4. Frase inferior */}
            <p
              className="animate-entrance text-xs md:text-sm text-white/60 font-normal drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]"
              style={{ animationDelay: '300ms' }}
            >
              La búsqueda ha <span className="font-serif-italic font-normal text-white/90">cambiado</span>. ¿Y tú?
            </p>
          </div>
        </div>

        {/* Indicador sutil de scroll hacia la sección intermedia */}
        <div className="relative z-10 w-full flex flex-col items-center pb-6 md:pb-8">
          <button
            onClick={() => {
              const el = document.getElementById('fusion-selva');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="group inline-flex flex-col items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
            aria-label="Descubre el Audi deportivo en la selva"
          >
            <span className="uppercase tracking-widest text-[10px] font-medium group-hover:text-orange-400 transition-colors">
              Descubrir expedición
            </span>
            <ChevronDown className="w-4 h-4 animate-bounce text-white/70" />
          </button>
        </div>
      </section>

      {/* ===================== SECCIÓN INTERMEDIA: EL AUDI DEPORTIVO Y EL PAISAJE SELVÁTICO ===================== */}
      {/* 
        Esta sección se fusiona cromática y espacialmente con la sección principal superior 
        a través del overlay degradado a negro puro en la parte superior, 
        y se funde de manera gradual con la sección Scrollytelling inferior 
        mediante un overlay degradado en la base hacia el lienzo interactivo.
      */}
      <section
        id="fusion-selva"
        className="relative min-h-[90vh] md:min-h-screen w-full flex items-center justify-center overflow-hidden bg-black text-white px-6 md:px-12 py-24 md:py-32"
        aria-label="Audi Deportivo en el Paisaje Selvático Tropical"
      >
        {/* Fondo fotográfico de alta fidelidad con el Audi naranja en la espesura */}
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none overflow-hidden">
          <img
            src="/media/audi_naranja_selva.jpg"
            alt="Audi deportivo naranja avanzando por la frondosa vegetación tropical"
            className="w-full h-full object-cover object-center scale-105 transition-transform duration-1000 ease-out"
          />

          {/* ============ OVERLAY SUPERIOR: Fusión orgánica con la sección principal (Hero) ============ */}
          {/* El hero termina en negro; este overlay inicia suavemente en negro y se desvanece de inmediato */}
          <div className="absolute top-0 inset-x-0 h-28 md:h-36 bg-gradient-to-b from-black via-black/50 to-transparent pointer-events-none" />

          {/* ============ OVERLAY INFERIOR: Fusión sutil y fina hacia la sección Scrollytelling ============ */}
          {/* Degradado fino y delicado para no invadir la imagen ni opacar el vehículo */}
          <div className="absolute bottom-0 inset-x-0 h-28 md:h-36 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />

          {/* Capa de contraste ambiental ligera y viñeta sutil */}
          <div className="absolute inset-0 bg-black/25 pointer-events-none" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-black/50 pointer-events-none" />
        </div>

        {/* Contenido Editorial y Narrativo */}
        <div className="relative z-10 max-w-[1200px] mx-auto w-full flex flex-col items-center text-center">
          {/* Pill distintiva con estética de aventura y alto rendimiento */}
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-orange-500/20 border border-orange-500/40 backdrop-blur-xl text-orange-400 text-xs md:text-sm font-semibold uppercase tracking-widest mb-6 md:mb-8 shadow-[0_0_24px_rgba(249,115,22,0.25)] animate-entrance">
            <Trees className="w-4 h-4 text-emerald-400" />
            <span className="text-white/90">Ecosistema Tropical</span>
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
            <span className="text-orange-300">Ingeniería Quattro</span>
          </div>

          {/* Título de gran impacto tipográfico */}
          <h2 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-medium tracking-tight text-white mb-6 md:mb-8 max-w-[1050px] leading-[1.05] drop-shadow-[0_4px_32px_rgba(0,0,0,0.9)]">
            Potencia salvaje en <br className="hidden sm:inline" />
            <span className="font-serif-italic font-normal text-transparent bg-clip-text bg-gradient-to-r from-orange-300 via-amber-200 to-orange-400">
              el corazón de la jungla
            </span>
          </h2>

          {/* Subtítulo evocador del contraste entre tecnología y naturaleza */}
          <p className="text-lg sm:text-xl md:text-2xl text-orange-200/90 font-light tracking-wide max-w-[850px] mb-6 md:mb-8 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
            Donde el asfalto claudica y la humedad del trópico desafía cada límite aerodinámico del deportivo.
          </p>

          {/* Descripción inmersiva alusiva al Audi deportivo y la vegetación selvática */}
          <p className="text-sm sm:text-base md:text-lg text-white/75 font-normal leading-relaxed max-w-[760px] mb-10 md:mb-12 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
            El deportivo se abre paso entre helechos gigantescos, niebla matutina y senderos milenarios. Su carrocería en tono naranja magma refracta los rayos de luz filtrados por el dosel selvático, mientras la tracción integral inteligente modula instantáneamente el torque en terrenos fangosos y escarpados. Es la simbiosis definitiva entre precisión mecánica alemana y la indómita belleza de la naturaleza virgen.
          </p>

          {/* Tarjetas flotantes translúcidas con atributos técnicos clave */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 w-full max-w-[920px] mb-10">
            <div className="p-5 md:p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col items-center text-center transition-transform hover:-translate-y-1">
              <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-3">
                <Flame className="w-5 h-5" />
              </div>
              <span className="text-xs uppercase tracking-wider text-white/50 font-mono mb-1">Color exclusivo</span>
              <span className="text-base md:text-lg font-semibold text-white">Magma Orange</span>
              <p className="text-xs text-white/60 mt-1">Acabado multicapa de alto contraste para visibilidad en niebla tropical</p>
            </div>

            <div className="p-5 md:p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col items-center text-center transition-transform hover:-translate-y-1">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
                <Navigation className="w-5 h-5" />
              </div>
              <span className="text-xs uppercase tracking-wider text-white/50 font-mono mb-1">Adaptabilidad</span>
              <span className="text-base md:text-lg font-semibold text-white">Suspensión Adaptativa</span>
              <p className="text-xs text-white/60 mt-1">Ajuste milimétrico de despeje al suelo para vadear rocas y raíces húmedas</p>
            </div>

            <div className="p-5 md:p-6 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.6)] flex flex-col items-center text-center transition-transform hover:-translate-y-1">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs uppercase tracking-wider text-white/50 font-mono mb-1">Tracción</span>
              <span className="text-base md:text-lg font-semibold text-white">Quattro Selvático</span>
              <p className="text-xs text-white/60 mt-1">Distribución de potencia 40:60 con bloqueo vectorial dinámico</p>
            </div>
          </div>

          {/* Botón de enlace hacia el Scrollytelling */}
          <button
            onClick={scrollToStory}
            className="group inline-flex items-center gap-3 px-8 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-black font-semibold text-sm hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_8px_30px_rgba(249,115,22,0.35)]"
          >
            <span>Iniciar el Scrollytelling en vivo</span>
            <ChevronDown className="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
          </button>
        </div>
      </section>

      {/* ===================== SECCIÓN SCROLLYTELLING (SECUENCIA DE IMÁGENES) ===================== */}
      {/* Contenedor optimizado a 380vh para un ritmo fluido, sin paradas vacías ni desplazamientos excesivos */}
      <section
        id="expedicion"
        ref={scrollyContainerRef}
        className="relative h-[380vh] w-full bg-black"
        aria-label="Experiencia de Scrollytelling interactivo del vehículo en la selva"
      >
        {/* Sticky Canvas Viewport fijado a pantalla completa */}
        <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center">
          {/* Canvas que renderiza a 60fps la secuencia de imágenes según el scroll */}
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover object-center pointer-events-none"
          />

          {/* ============ OVERLAYS DE TRANSICIÓN Y CONTRASTE CINEMÁTICO ============ */}
          {/* 
            Overlay superior equilibrado: Oscurecimiento negro en el borde superior ampliado con 
            gradiente gradual y continuo que se aclara suavemente hacia abajo.
          */}
          <div className="absolute top-0 inset-x-0 h-44 md:h-56 bg-gradient-to-b from-black via-black/60 to-transparent pointer-events-none z-10" />

          {/* Sombreado inferior sutil y delimitador de borde */}
          <div className="absolute bottom-0 inset-x-0 h-24 md:h-32 bg-gradient-to-t from-black/75 to-transparent pointer-events-none z-10" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.45)_100%)] pointer-events-none z-10" />

          {/* ================= ACTO 1: 4% - 22% (Aparición por la izquierda) ================= */}
          {/* En las primeras tomas el auto aparece al fondo sobre el camino empedrado */}
          <div
            className="absolute inset-0 max-w-[1440px] mx-auto px-6 md:px-16 pointer-events-none flex flex-col justify-center items-start transition-all duration-300 z-20"
            style={{
              opacity: getActOpacity(0.04, 0.22),
              transform: `translateY(${(1 - getActOpacity(0.04, 0.22)) * 16}px)`,
              visibility: getActOpacity(0.04, 0.22) > 0.01 ? 'visible' : 'hidden',
            }}
          >
            <div className="max-w-[480px] p-6 md:p-8 rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.8)]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-4">
                <Compass className="w-3.5 h-3.5" />
                <span>Acto I · Camino Virgen</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white mb-3 leading-[1.05]">
                La selva se abre <br />
                <span className="font-serif-italic font-normal text-orange-300">al rugido</span>
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                Entre la vegetación más densa y rocas milenarias, la silueta naranja irrumpe en un entorno inexplorado sin perder aplomo.
              </p>

              {/* Indicador de telemetría */}
              <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between text-xs font-mono text-white/60">
                <span>COORD: 04°12'S 72°31'W</span>
                <span className="text-orange-400 font-bold">TERRENO: SELVA</span>
              </div>
            </div>
          </div>

          {/* ================= ACTO 2: 28% - 50% (Aceleración y Dinámica) ================= */}
          {/* El auto avanza hacia el plano medio, texto colocado a la derecha con contraste óptimo */}
          <div
            className="absolute inset-0 max-w-[1440px] mx-auto px-6 md:px-16 pointer-events-none flex flex-col justify-center items-end transition-all duration-300 z-20"
            style={{
              opacity: getActOpacity(0.28, 0.50),
              transform: `translateY(${(1 - getActOpacity(0.28, 0.50)) * 16}px)`,
              visibility: getActOpacity(0.28, 0.50) > 0.01 ? 'visible' : 'hidden',
            }}
          >
            <div className="max-w-[500px] p-6 md:p-8 rounded-2xl bg-black/45 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.85)] text-left md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white/90 text-xs font-semibold uppercase tracking-wider mb-4">
                <Zap className="w-3.5 h-3.5 text-orange-400" />
                <span>Acto II · Dinámica quattro</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white mb-3 leading-[1.05]">
                Tracción continua, <br />
                <span className="font-serif-italic font-normal text-white/90">control absoluto</span>
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-4">
                Cada rueda recibe el torque exacto en milisegundos. El barro y la piedra mojada se convierten en pura adherencia.
              </p>

              {/* Métricas interactivas animadas */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-[11px] uppercase tracking-wider text-white/50">Reparto Torque</div>
                  <div className="text-base font-semibold text-white flex items-center justify-between">
                    <span>40:60</span>
                    <Activity className="w-3.5 h-3.5 text-orange-400" />
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-[11px] uppercase tracking-wider text-white/50">Suspensión RS</div>
                  <div className="text-base font-semibold text-white flex items-center justify-between">
                    <span>Adaptativa</span>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ================= ACTO 3: 56% - 76% (Primer plano y detalles del auto) ================= */}
          {/* El auto ocupa el primer plano con su color naranja vibrante y detalles aerodinámicos */}
          <div
            className="absolute inset-0 max-w-[1440px] mx-auto px-6 md:px-16 pointer-events-none flex flex-col justify-start md:justify-center items-start pt-24 md:pt-0 transition-all duration-300 z-20"
            style={{
              opacity: getActOpacity(0.56, 0.76),
              transform: `translateY(${(1 - getActOpacity(0.56, 0.76)) * 16}px)`,
              visibility: getActOpacity(0.56, 0.76) > 0.01 ? 'visible' : 'hidden',
            }}
          >
            <div className="max-w-[480px] p-6 md:p-8 rounded-2xl bg-black/45 backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.85)]">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-semibold uppercase tracking-wider mb-4">
                <Gauge className="w-3.5 h-3.5" />
                <span>Acto III · Foco Deportivo</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white mb-3 leading-[1.05]">
                Esculpido para la <br />
                <span className="font-serif-italic font-normal text-orange-400">velocidad pura</span>
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed">
                Difusores optimizados, tomas de aire agresivas y una carrocería ensanchada diseñada tanto para circuito como para los senderos más hostiles.
              </p>

              {/* Badge de potencia */}
              <div className="mt-4 flex items-center gap-4 text-xs font-medium text-white/80">
                <span className="px-2.5 py-1 rounded bg-white/10">0-100 km/h: 3.6s</span>
                <span className="px-2.5 py-1 rounded bg-white/10">600 CV</span>
                <span className="px-2.5 py-1 rounded bg-white/10">Biturbo</span>
              </div>
            </div>
          </div>

          {/* ================= ACTO 4: 82% - 100% (Cierre cinemático y llamado a la acción) ================= */}
          <div
            className="absolute inset-0 max-w-[1440px] mx-auto px-6 md:px-16 pointer-events-none flex flex-col justify-center items-center text-center transition-all duration-300 z-20"
            style={{
              opacity: getActOpacity(0.82, 1.0, 0.05, true),
              transform: `translateY(${(1 - getActOpacity(0.82, 1.0, 0.05, true)) * 16}px)`,
              visibility: getActOpacity(0.82, 1.0, 0.05, true) > 0.01 ? 'visible' : 'hidden',
            }}
          >
            <div className="max-w-[620px] p-8 md:p-10 rounded-3xl bg-black/55 backdrop-blur-2xl border border-white/15 shadow-[0_12px_48px_rgba(0,0,0,0.95)] pointer-events-auto">
              <span className="text-xs uppercase tracking-widest text-orange-400 font-semibold mb-3 block">
                Fin del recorrido
              </span>
              <h2 className="text-3xl md:text-6xl font-medium tracking-tight text-white mb-4 leading-[1.02]">
                El destino lo decides <br />
                <span className="font-serif-italic font-normal text-white">en cada curva</span>
              </h2>
              <p className="text-sm md:text-base text-white/70 leading-relaxed mb-7 max-w-[480px] mx-auto">
                La expedición no termina en el asfalto. Reserva una prueba de conducción exclusiva o configura tu vehículo a medida.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="h-11 px-7 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-100 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xl"
                >
                  <span>Volver al inicio</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => alert('Próximamente disponible el configurador 3D.')}
                  className="h-11 px-7 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-sm active:scale-[0.98] transition-all backdrop-blur-md"
                >
                  Configurar vehículo
                </button>
              </div>
            </div>
          </div>

          {/* Barra de progreso de scroll y velocímetro lateral */}
          <div className="absolute bottom-6 inset-x-6 md:inset-x-12 max-w-[1440px] mx-auto flex items-center justify-between text-xs font-mono text-white/50 pointer-events-none z-20">
            <div className="flex items-center gap-3">
              <span className="text-white/80 font-bold">
                FRAME {String(currentFrameIndex).padStart(2, '0')}/{String(TOTAL_FRAMES).padStart(2, '0')} (HD)
              </span>
              <div className="w-24 md:w-44 h-1 bg-white/15 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-300 transition-all duration-75"
                  style={{ width: `${scrollProgress * 100}%` }}
                />
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-white/70">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>SCROLL INTERACTIVO ({Math.round(scrollProgress * 100)}%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ELEGANTE CON MARCA ================= */}
      <footer className="relative z-20 w-full bg-black border-t border-white/10 px-6 md:px-12 py-10">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight text-white">Asombro</span>
            <span className="text-xs text-white/40">· Edición Expedición RS</span>
          </div>

          <p className="text-xs text-white/40 text-center md:text-right">
            © {new Date().getFullYear()} Asombro. Experiencia cinematográfica interactiva con renderizado por cuadros.
          </p>
        </div>
      </footer>
    </div>
  );
}
