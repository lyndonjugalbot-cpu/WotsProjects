/**
 * Sticky header: adds a shadow/opaque background once the page scrolls
 * past a threshold, and republishes scroll position as a CSS variable
 * (--scrollY) that the stylesheet uses to parallax the hero blobs.
 */
class ScrollController {
  constructor({ headerSelector = '#siteHeader', threshold = 10 } = {}) {
    this.header = document.querySelector(headerSelector);
    this.root = document.documentElement;
    this.threshold = threshold;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ticking = false;
    this.handleScroll = this.handleScroll.bind(this);
  }

  init() {
    if (!this.header) return;
    window.addEventListener('scroll', () => this.requestTick(), { passive: true });
    this.handleScroll();
  }

  requestTick() {
    if (this.ticking) return;
    requestAnimationFrame(this.handleScroll);
    this.ticking = true;
  }

  handleScroll() {
    const y = window.scrollY;
    this.header.classList.toggle('scrolled', y > this.threshold);
    if (!this.reduceMotion) {
      this.root.style.setProperty('--scrollY', `${y}px`);
    }
    this.ticking = false;
  }
}

/** Toggles the off-canvas mobile nav and closes it after a link is tapped. */
class MobileMenu {
  constructor({ toggleSelector = '#hamburgerBtn', menuSelector = '#mobileMenu' } = {}) {
    this.toggle = document.querySelector(toggleSelector);
    this.menu = document.querySelector(menuSelector);
  }

  init() {
    if (!this.toggle || !this.menu) return;
    this.toggle.addEventListener('click', () => this.menu.classList.toggle('open'));
    this.menu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => this.menu.classList.remove('open'));
    });
  }
}

/** Fades/slides `.reveal` elements into view the first time they enter the viewport. */
class ScrollReveal {
  constructor({ selector = '.reveal', threshold = 0.15, rootMargin = '0px 0px -60px 0px' } = {}) {
    this.elements = document.querySelectorAll(selector);
    this.observer = new IntersectionObserver((entries) => this.handleIntersect(entries), {
      threshold,
      rootMargin,
    });
  }

  init() {
    this.elements.forEach((el) => this.observer.observe(el));
  }

  handleIntersect(entries) {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      this.observer.unobserve(entry.target);
    });
  }
}

/** Copies a button's `data-copy` value to the clipboard and flashes "Copied!" feedback. */
class ClipboardCopy {
  constructor({ selector = '[data-copy]' } = {}) {
    this.buttons = document.querySelectorAll(selector);
  }

  init() {
    this.buttons.forEach((btn) => {
      btn.addEventListener('click', () => this.copy(btn));
    });
  }

  async copy(btn) {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      this.copyWithFallback(text);
    }
    this.flashCopied(btn);
  }

  copyWithFallback(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }

  flashCopied(btn) {
    const original = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => {
      btn.textContent = original;
      btn.classList.remove('copied');
    }, 1500);
  }
}

/** Keeps the footer copyright year current without a build step. */
class FooterYear {
  constructor({ selector = '#year' } = {}) {
    this.el = document.querySelector(selector);
  }

  init() {
    if (!this.el) return;
    this.el.textContent = new Date().getFullYear();
  }
}

/** Composes the page's independent behaviors and boots them together. */
class VirtualBridgeSite {
  constructor() {
    this.modules = [
      new ScrollController(),
      new MobileMenu(),
      new ScrollReveal(),
      new ClipboardCopy(),
      new FooterYear(),
    ];
  }

  init() {
    this.modules.forEach((module) => module.init());
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new VirtualBridgeSite().init();
});
