/**
 * Krevia — Digital Operations for Real Estate
 * Premium Interactive Website
 * Inspired by good-fella.com design patterns
 */

// Global state
let isTransitioning = false;

document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    initMagneticButtons();
    initPageTransitions();
    initNavigation();
    initMobileMenu();
    initHeroAnimation();
    initHeroInteractivity();
    initScrollReveal();
    initCaseStudyScroll();
    initAboutPageAnimations();
});

/**
 * Page Loader
 */
function initLoader() {
    const loader = document.getElementById('loader');

    if (!loader) return;

    const body = document.body;
    body.classList.add('loading');

    setTimeout(() => {
        loader.classList.add('hidden');
        body.classList.remove('loading');

        // Trigger hero entrance
        const hero = document.querySelector('.hero');
        if (hero) {
            hero.classList.add('loaded');
        }
    }, 1500);
}

/**
 * Magnetic Button Effects - Disabled to keep buttons fixed in place
 */
function initMagneticButtons() {
    // Magnetic effect disabled - buttons stay fixed in place
    return;
}

/**
 * Page Transitions (Grid Reveal)
 */
function initPageTransitions() {
    const transition = document.getElementById('page-transition');
    const blocks = document.querySelectorAll('.transition-block');
    const logo = document.querySelector('.transition-logo');

    if (!transition || !blocks.length) return;

    // Handle internal page links
    const pageLinks = document.querySelectorAll('a[href$=".html"]:not([target="_blank"])');

    pageLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');

            // Skip if same page
            if (href === window.location.pathname.split('/').pop()) return;

            e.preventDefault();

            if (isTransitioning) return;
            isTransitioning = true;

            // Lock scroll
            document.body.style.overflow = 'hidden';

            // Animate transition in
            transition.style.pointerEvents = 'all';

            // Grid blocks animation (staggered from bottom)
            blocks.forEach((block, i) => {
                const delay = i * 0.05;
                block.style.transition = `transform 0.6s cubic-bezier(0.65, 0, 0.35, 1) ${delay}s`;
                block.style.transformOrigin = 'bottom';
                block.style.transform = 'scaleY(1)';
            });

            // Logo fade in
            setTimeout(() => {
                if (logo) {
                    logo.style.transition = 'opacity 0.3s ease';
                    logo.style.opacity = '1';
                }
            }, 400);

            // Navigate after animation
            setTimeout(() => {
                window.location.href = href;
            }, 900);
        });
    });

    // Page enter animation (reverse)
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            // Back/forward navigation
            resetTransition();
        }
    });

    // Initial page load - animate out
    requestAnimationFrame(() => {
        blocks.forEach((block, i) => {
            block.style.transform = 'scaleY(1)';
            block.style.transformOrigin = 'top';

            const delay = 0.1 + i * 0.04;
            setTimeout(() => {
                block.style.transition = 'transform 0.6s cubic-bezier(0.65, 0, 0.35, 1)';
                block.style.transform = 'scaleY(0)';
            }, delay * 1000);
        });

        if (logo) {
            logo.style.opacity = '0';
        }
    });

    function resetTransition() {
        blocks.forEach(block => {
            block.style.transform = 'scaleY(0)';
            block.style.transformOrigin = 'top';
        });
        if (logo) logo.style.opacity = '0';
        transition.style.pointerEvents = 'none';
        document.body.style.overflow = '';
        isTransitioning = false;
    }
}

/**
 * Navigation Scroll Effect
 */
function initNavigation() {
    const nav = document.getElementById('nav');
    if (!nav) return;

    let lastScroll = 0;
    let ticking = false;

    function updateNav() {
        const currentScroll = window.pageYOffset;

        // Add scrolled class
        if (currentScroll > 80) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        // Hide/show on scroll direction
        if (currentScroll > lastScroll && currentScroll > 200) {
            nav.classList.add('nav-hidden');
        } else {
            nav.classList.remove('nav-hidden');
        }

        lastScroll = currentScroll;
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateNav);
            ticking = true;
        }
    }, { passive: true });

    updateNav();
}

/**
 * Mobile Menu
 */
function initMobileMenu() {
    const toggle = document.getElementById('nav-toggle');
    const menu = document.getElementById('mobile-menu');
    const body = document.body;

    if (!toggle || !menu) return;

    const links = menu.querySelectorAll('.mobile-link');
    let isOpen = false;

    function openMenu() {
        isOpen = true;
        toggle.classList.add('active');
        menu.classList.add('active');
        body.classList.add('menu-open');

        links.forEach((link, index) => {
            link.style.transitionDelay = `${index * 0.05 + 0.1}s`;
        });
    }

    function closeMenu() {
        isOpen = false;
        toggle.classList.remove('active');
        menu.classList.remove('active');
        body.classList.remove('menu-open');

        links.forEach(link => {
            link.style.transitionDelay = '0s';
        });
    }

    toggle.addEventListener('click', () => {
        if (isOpen) closeMenu();
        else openMenu();
    });

    links.forEach(link => link.addEventListener('click', closeMenu));

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) closeMenu();
    });
}

/**
 * Hero Title Letter Animation
 */
function initHeroAnimation() {
    const letters = document.querySelectorAll('.hero-title .letter');
    if (!letters.length) return;

    let letterIndex = 0;
    document.querySelectorAll('.title-line').forEach((line, lineIndex) => {
        const lineLetters = line.querySelectorAll('.letter');
        lineLetters.forEach((letter, i) => {
            const delay = 0.5 + (letterIndex + i) * 0.03 + lineIndex * 0.1;
            letter.style.transitionDelay = `${delay}s`;
        });
        letterIndex += lineLetters.length;
    });
}

/**
 * Hero Section Interactivity
 * Mouse-reactive elements and parallax
 */
function initHeroInteractivity() {
    const hero = document.querySelector('.hero');
    const orbs = document.querySelectorAll('.hero-orb');
    const grid = document.querySelector('.hero-grid');
    const lines = document.querySelector('.hero-lines');

    if (!hero) return;

    // Skip on mobile/reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        window.innerWidth < 768) {
        return;
    }

    let mouseX = 0, mouseY = 0;
    let currentX = 0, currentY = 0;
    let scrollY = 0;
    let ticking = false;

    // Mouse tracking for hero
    hero.addEventListener('mousemove', (e) => {
        const rect = hero.getBoundingClientRect();
        mouseX = (e.clientX - rect.left - rect.width / 2) / rect.width;
        mouseY = (e.clientY - rect.top - rect.height / 2) / rect.height;
    });

    // Animate orbs based on mouse
    function animateHero() {
        currentX += (mouseX - currentX) * 0.05;
        currentY += (mouseY - currentY) * 0.05;

        orbs.forEach((orb, i) => {
            const intensity = (i + 1) * 30;
            orb.style.transform = `translate(${currentX * intensity}px, ${currentY * intensity}px)`;
        });

        if (grid) {
            grid.style.transform = `translate(${currentX * -10}px, ${currentY * -10}px) rotate(${currentX * 2}deg)`;
        }

        if (lines) {
            const lineSpans = lines.querySelectorAll('span');
            lineSpans.forEach((span, i) => {
                const offset = (i - 2) * 5;
                span.style.transform = `translateX(${currentX * offset * 10}px)`;
            });
        }

        requestAnimationFrame(animateHero);
    }

    if (window.innerWidth >= 1024) {
        animateHero();
    }

    // Scroll parallax
    function updateParallax() {
        const heroHeight = hero.offsetHeight;
        if (scrollY > heroHeight) {
            ticking = false;
            return;
        }

        const heroContent = hero.querySelector('.hero-content');
        if (heroContent) {
            const opacity = Math.max(0, 1 - (scrollY / (heroHeight * 0.6)));
            const yOffset = scrollY * 0.4;
            heroContent.style.opacity = opacity;
            heroContent.style.transform = `translate3d(0, ${yOffset}px, 0)`;
        }

        orbs.forEach((orb, i) => {
            const speed = (i + 1) * 0.15;
            orb.style.marginTop = `${scrollY * speed}px`;
        });

        ticking = false;
    }

    window.addEventListener('scroll', () => {
        scrollY = window.pageYOffset;
        if (!ticking) {
            requestAnimationFrame(updateParallax);
            ticking = true;
        }
    }, { passive: true });
}

/**
 * Scroll Reveal Animations
 */
function initScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal-up, .reveal-card');
    if (!revealElements.length) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        revealElements.forEach(el => el.classList.add('visible'));
        return;
    }

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -80px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    revealElements.forEach(el => observer.observe(el));
}

/**
 * Case Study Scroll-Jacking with GSAP ScrollTrigger
 */
function initCaseStudyScroll() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
        console.warn('GSAP or ScrollTrigger not loaded');
        return;
    }

    const caseStudiesSection = document.querySelector('.case-studies');
    const caseStudiesWrapper = document.querySelector('.case-studies-wrapper');
    const caseStudies = document.querySelectorAll('.case-study');
    const progressIndicator = document.querySelector('.case-progress');
    const progressFill = document.querySelector('.case-progress-fill');
    const progressCurrent = document.querySelector('.case-progress-current');

    if (!caseStudiesSection || !caseStudiesWrapper || !caseStudies.length) return;

    // Skip on mobile or reduced motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
        window.innerWidth < 768) {
        caseStudies.forEach(cs => {
            cs.classList.add('active');
            cs.style.position = 'relative';
            cs.style.height = 'auto';
            cs.style.minHeight = 'auto';
            cs.style.marginBottom = '40px';
        });
        caseStudiesWrapper.style.height = 'auto';

        // Use IntersectionObserver for mobile metrics animation
        const metricsObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateMetrics(entry.target);
                    metricsObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.2 });

        caseStudies.forEach(cs => metricsObserver.observe(cs));
        return;
    }

    gsap.registerPlugin(ScrollTrigger);

    const numCases = caseStudies.length;
    let currentIndex = 0;

    const setActiveCase = (index) => {
        caseStudies.forEach((cs, csIndex) => {
            cs.classList.toggle('active', csIndex === index);
        });
        if (progressCurrent) progressCurrent.textContent = String(index + 1).padStart(2, '0');
        currentIndex = index;
    };

    const enterCaseMode = () => {
        caseStudiesSection.classList.add('case-studies-active');
        if (progressIndicator) progressIndicator.classList.add('visible');
        document.querySelector('.nav')?.classList.add('case-studies-active');
    };

    const exitCaseMode = () => {
        caseStudiesSection.classList.remove('case-studies-active');
        if (progressIndicator) progressIndicator.classList.remove('visible');
        document.querySelector('.nav')?.classList.remove('case-studies-active');
    };

    caseStudies.forEach(cs => cs.classList.remove('active'));

    const caseTimeline = gsap.timeline({
        scrollTrigger: {
            trigger: caseStudiesWrapper,
            start: 'top top',
            end: `+=${numCases * 100}%`,
            pin: caseStudiesWrapper,
            scrub: 0.5,
            anticipatePin: 1,
            onEnter: () => {
                enterCaseMode();
                setActiveCase(0);
                animateMetrics(caseStudies[0]);
            },
            onLeave: exitCaseMode,
            onEnterBack: () => {
                enterCaseMode();
                setActiveCase(currentIndex);
                animateMetrics(caseStudies[currentIndex]);
            },
            onLeaveBack: () => {
                exitCaseMode();
                if (progressFill) progressFill.style.height = '0%';
                currentIndex = 0;
                if (progressCurrent) progressCurrent.textContent = '01';
                caseStudies.forEach(cs => cs.classList.remove('active'));
            },
            onUpdate: (self) => {
                if (progressFill) progressFill.style.height = `${self.progress * 100}%`;
                const newIndex = Math.min(Math.floor(self.progress * numCases), numCases - 1);
                if (newIndex !== currentIndex) {
                    setActiveCase(newIndex);
                    animateMetrics(caseStudies[newIndex]);
                }
            }
        }
    });

    // Individual case study animations
    caseStudies.forEach((cs, i) => {
        if (i > 0) {
            caseTimeline.fromTo(cs,
                { opacity: 0, y: 50 },
                { opacity: 1, y: 0, duration: 0.5 },
                i / numCases
            );
        }
    });
}

/**
 * Animate Metrics Counting
 */
function animateMetrics(caseStudy) {
    if (!caseStudy) return;

    const metrics = caseStudy.querySelectorAll('.metric-value[data-count]');

    metrics.forEach(metric => {
        if (metric.dataset.animated) return;
        metric.dataset.animated = 'true';

        const target = parseFloat(metric.dataset.count);
        const prefix = metric.dataset.prefix || '';
        const suffix = metric.dataset.suffix || '';
        const isDecimal = target % 1 !== 0;
        const duration = 1500;
        const start = performance.now();

        function updateCount(timestamp) {
            const elapsed = timestamp - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 4);
            const current = eased * target;

            if (isDecimal) {
                metric.textContent = prefix + current.toFixed(1) + suffix;
            } else {
                metric.textContent = prefix + Math.floor(current).toLocaleString() + suffix;
            }

            if (progress < 1) requestAnimationFrame(updateCount);
        }

        requestAnimationFrame(updateCount);
    });
}

/**
 * About Page Animations
 */
function initAboutPageAnimations() {
    const aboutHero = document.querySelector('.about-hero');
    if (!aboutHero) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Philosophy lines
    const philLines = document.querySelectorAll('.phil-line');
    if (philLines.length) {
        const philObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.3 });

        philLines.forEach((line, i) => {
            line.style.opacity = '0';
            line.style.transform = 'translateY(30px)';
            line.style.transition = `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.15}s`;
            philObserver.observe(line);
        });
    }

    // Statement section
    const statementSection = document.querySelector('.about-statement');
    if (statementSection) {
        const statementMassive = statementSection.querySelectorAll('.statement-massive');
        const dividers = statementSection.querySelectorAll('.statement-divider');

        const statementObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    dividers.forEach(div => {
                        div.style.opacity = '1';
                        div.style.transform = 'scaleX(1)';
                    });

                    statementMassive.forEach((text, i) => {
                        setTimeout(() => {
                            text.style.opacity = '1';
                            text.style.transform = 'translateY(0)';
                        }, 300 + i * 200);
                    });
                }
            });
        }, { threshold: 0.4 });

        dividers.forEach(div => {
            div.style.opacity = '0';
            div.style.transform = 'scaleX(0)';
            div.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        });

        statementMassive.forEach(text => {
            text.style.opacity = '0';
            text.style.transform = 'translateY(40px)';
            text.style.transition = 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
        });

        statementObserver.observe(statementSection);
    }

    // Serve cards
    const serveCards = document.querySelectorAll('.serve-card');
    if (serveCards.length) {
        const serveObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, { threshold: 0.2 });

        serveCards.forEach((card, i) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(40px)';
            card.style.transition = `all 0.8s cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.15}s`;
            serveObserver.observe(card);
        });
    }

    // About hero parallax
    let aboutScrollY = 0;
    let aboutTicking = false;
    const aboutHeroContent = aboutHero.querySelector('.about-hero-content');
    const scrollIndicator = aboutHero.querySelector('.scroll-indicator');

    function updateAboutParallax() {
        const heroHeight = aboutHero.offsetHeight;

        if (aboutScrollY > heroHeight) {
            aboutTicking = false;
            return;
        }

        if (aboutHeroContent) {
            const opacity = Math.max(0, 1 - (aboutScrollY / (heroHeight * 0.5)));
            aboutHeroContent.style.opacity = opacity;
        }

        if (scrollIndicator) {
            scrollIndicator.style.opacity = Math.max(0, 1 - (aboutScrollY / 150));
        }

        aboutTicking = false;
    }

    window.addEventListener('scroll', () => {
        aboutScrollY = window.pageYOffset;
        if (!aboutTicking) {
            requestAnimationFrame(updateAboutParallax);
            aboutTicking = true;
        }
    }, { passive: true });
}

/**
 * Form Handling
 */
document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', (e) => {
        e.preventDefault();

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.innerHTML = '<span>Sending...</span>';
        submitBtn.disabled = true;

        setTimeout(() => {
            submitBtn.innerHTML = '<span>Message Sent!</span>';
            form.reset();

            setTimeout(() => {
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
            }, 2000);
        }, 1500);
    });
});
