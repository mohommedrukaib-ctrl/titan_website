/* ==========================================================================
   TITAN EVENTS — public site behaviour
   Splash screen · sticky nav · mobile drawer · scroll reveal
   animated counters · toasts · form niceties. No dependencies.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------- splash -- */
  function initSplash() {
    const splash = $('#splash');
    if (!splash) return;
    const isHome = location.pathname === '/' || location.pathname === '';
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem('titanSplash') === '1';
    } catch (e) {
      alreadyShown = false;
    }

    if (!isHome || alreadyShown || reduceMotion) {
      splash.hidden = true;
      return;
    }

    try {
      sessionStorage.setItem('titanSplash', '1');
    } catch (e) {
      /* ignore */
    }
    document.body.classList.add('no-scroll');
    const hold = 1500;
    window.setTimeout(() => {
      splash.classList.add('is-leaving');
      document.body.classList.remove('no-scroll');
      window.setTimeout(() => {
        splash.hidden = true;
      }, 750);
    }, hold);
  }

  /* ------------------------------------------------------ header + nav --- */
  function initHeader() {
    const header = $('.site-header');
    const drawer = $('#mobileNav');
    const overlay = $('#navOverlay');
    const toggle = $('#navToggle');
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 24);
      const top = $('#toTop');
      if (top) top.classList.toggle('is-visible', window.scrollY > 620);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    if (!drawer || !toggle) return;

    const close = () => {
      drawer.classList.remove('is-open');
      overlay && overlay.classList.remove('is-open');
      header.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('no-scroll');
    };
    const open = () => {
      drawer.classList.add('is-open');
      overlay && overlay.classList.add('is-open');
      header.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
      document.body.classList.add('no-scroll');
    };

    toggle.addEventListener('click', () => (drawer.classList.contains('is-open') ? close() : open()));
    overlay && overlay.addEventListener('click', close);
    $$('a', drawer).forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  /* ------------------------------------------------------------ reveal --- */
  function initReveal() {
    const items = $$('.reveal');
    if (!items.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    items.forEach((el) => io.observe(el));
  }

  /* ----------------------------------------------------------- counters -- */
  function formatCount(value, format) {
    if (format === 'compact') {
      if (value >= 1000000) return (value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1) + 'M';
      if (value >= 1000) return (value / 1000).toFixed(value % 1000 === 0 ? 0 : 1) + 'K';
    }
    return String(Math.round(value));
  }

  function animateCount(el) {
    const target = Number(el.dataset.count || 0);
    const format = el.dataset.format || 'plain';
    const duration = 1700;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = formatCount(target * eased, format);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = formatCount(target, format);
    };
    requestAnimationFrame(step);
  }

  function initCounters() {
    const counters = $$('[data-count]');
    if (!counters.length) return;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      counters.forEach((el) => {
        el.textContent = formatCount(Number(el.dataset.count || 0), el.dataset.format);
      });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateCount(entry.target);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------- toasts -- */
  window.titanToast = function (message, type = 'info', timeout = 5200) {
    let host = $('#toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.id = 'toasts';
      document.body.appendChild(host);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.innerHTML =
      '<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg>' +
      '<div></div>' +
      '<button class="toast__close" type="button" aria-label="Dismiss">&times;</button>';
    toast.querySelector('div').textContent = message;
    host.appendChild(toast);
    const dismiss = () => {
      toast.classList.add('is-leaving');
      window.setTimeout(() => toast.remove(), 420);
    };
    toast.querySelector('.toast__close').addEventListener('click', dismiss);
    window.setTimeout(dismiss, timeout);
    return toast;
  };

  function initToasts() {
    $$('#toasts .toast').forEach((toast, i) => {
      const type = toast.classList.contains('toast--error')
        ? 'error'
        : toast.classList.contains('toast--success')
          ? 'success'
          : 'info';
      const delay = (type === 'error' ? 7000 : 5000) + i * 400;
      const dismiss = () => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 420);
      };
      const btn = toast.querySelector('.toast__close');
      if (btn) btn.addEventListener('click', dismiss);
      window.setTimeout(dismiss, delay);
    });
  }

  /* --------------------------------------------------------- card glow --- */
  function initCardGlow() {
    $$('.card').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${((e.clientX - rect.left) / rect.width) * 100}%`);
        card.style.setProperty('--my', `${((e.clientY - rect.top) / rect.height) * 100}%`);
      });
    });
  }

  /* ------------------------------------------------------------- forms --- */
  function initForms() {
    $$('form[data-track]').forEach((form) => {
      const stamp = form.querySelector('[name="formOpenedAt"]');
      if (stamp) stamp.value = String(Date.now());
      const submit = form.querySelector('[data-submit]');
      form.addEventListener('submit', () => {
        if (submit) {
          submit.dataset.label = submit.innerHTML;
          submit.innerHTML = 'Sending…';
          submit.setAttribute('aria-busy', 'true');
          window.setTimeout(() => {
            if (submit.isConnected && submit.dataset.label) submit.innerHTML = submit.dataset.label;
          }, 8000);
        }
      });
    });

    /* instant client-side hints (server still validates everything) */
    const contact = $('#inquiryForm');
    if (contact) {
      const email = contact.querySelector('[name="email"]');
      email &&
        email.addEventListener('blur', () => {
          const field = email.closest('.field');
          const valid = !email.value || /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email.value);
          field && field.classList.toggle('has-error', !valid && email.value.length > 0);
          const err = field && field.querySelector('.field__error');
          if (err) err.textContent = valid ? '' : 'Please check that email address.';
        });
    }
  }

  /* -------------------------------------------------------------- misc --- */
  function initTopButton() {
    const btn = $('#toTop');
    if (!btn) return;
    btn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  }

  function initCountdowns() {
    $$('[data-countdown]').forEach((el) => {
      const target = new Date(el.dataset.countdown);
      if (Number.isNaN(target.getTime())) return;
      const tick = () => {
        const diff = target - new Date();
        if (diff <= 0) {
          el.textContent = 'Happening now';
          return;
        }
        const days = Math.floor(diff / 86400000);
        const hours = Math.floor((diff % 86400000) / 3600000);
        el.textContent = days > 0 ? `${days} day${days === 1 ? '' : 's'} to go` : `${hours} hour${hours === 1 ? '' : 's'} to go`;
      };
      tick();
      window.setInterval(tick, 60000);
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSplash();
    initHeader();
    initReveal();
    initCounters();
    initToasts();
    initCardGlow();
    initForms();
    initTopButton();
    initCountdowns();
  });
})();
