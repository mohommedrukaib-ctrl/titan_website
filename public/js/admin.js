/* ==========================================================================
   TITAN EVENTS — admin panel behaviour
   Mobile sidebar drawer · password toggle · destructive confirms
   poster preview · toasts.
   ========================================================================== */
(function () {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ------------------------------------------------------------- sidebar -- */
  function initSidebar() {
    const side = $('#adminSide');
    const overlay = $('#sideOverlay');
    const toggle = $('#sideToggle');
    if (!side || !toggle) return;

    const close = () => {
      side.classList.remove('is-open');
      overlay && overlay.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    };
    const open = () => {
      side.classList.add('is-open');
      overlay && overlay.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    };
    toggle.addEventListener('click', () => (side.classList.contains('is-open') ? close() : open()));
    overlay && overlay.addEventListener('click', close);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }

  /* ---------------------------------------------------- password toggle --- */
  function initPasswordToggles() {
    $$('[data-pw-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = btn.parentElement.querySelector('input');
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        btn.innerHTML = show
          ? '<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 4l16 16"/><path d="M9.5 5.4A9.6 9.6 0 0112 5c6 0 9.5 6 9.5 6a17 17 0 01-2.6 3.2M6.4 7.6A17 17 0 002.5 11s3.5 6 9.5 6a9.4 9.4 0 003.5-.7"/></svg>'
          : '<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2.5 12S6 6 12 6s9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="3"/></svg>';
      });
    });
  }

  /* ---------------------------------------------------------- confirms --- */
  function initConfirms() {
    $$('form[data-confirm]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        const message = form.dataset.confirm || 'Are you sure?';
        if (!window.confirm(message)) {
          e.preventDefault();
          return;
        }
        const btn = form.querySelector('button[type="submit"]');
        if (btn) {
          btn.disabled = true;
          btn.textContent = 'Working…';
        }
      });
    });
  }

  /* ----------------------------------------------------- poster preview -- */
  function initPosterPreview() {
    $$('input[type="file"][data-preview]').forEach((input) => {
      const target = document.getElementById(input.dataset.preview);
      const note = document.getElementById(`${input.dataset.preview}-note`);
      input.addEventListener('change', () => {
        const file = input.files && input.files[0];
        if (!file) return;
        if (!/^image\//.test(file.type)) {
          window.titanToast && window.titanToast('Please choose an image file.', 'error');
          input.value = '';
          return;
        }
        if (target) {
          const url = URL.createObjectURL(file);
          target.src = url;
          target.hidden = false;
          const wrap = target.closest('.poster-preview');
          wrap && (wrap.hidden = false);
        }
        if (note) {
          note.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB — it will be automatically resized and compressed.`;
        }
      });
    });
  }

  /* ------------------------------------------------------------- toasts -- */
  window.titanToast = window.titanToast || function (message, type = 'info', timeout = 5000) {
    let host = $('#toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      host.id = 'toasts';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = '<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5M12 16.5v.5"/><circle cx="12" cy="12" r="9"/></svg><div></div><button class="toast__close" type="button" aria-label="Dismiss">&times;</button>';
    el.querySelector('div').textContent = message;
    host.appendChild(el);
    const dismiss = () => {
      el.classList.add('is-leaving');
      window.setTimeout(() => el.remove(), 400);
    };
    el.querySelector('.toast__close').addEventListener('click', dismiss);
    window.setTimeout(dismiss, timeout);
  };

  function initToasts() {
    $$('#toasts .toast').forEach((toast, i) => {
      const isError = toast.classList.contains('toast--error');
      const dismiss = () => {
        toast.classList.add('is-leaving');
        window.setTimeout(() => toast.remove(), 400);
      };
      const btn = toast.querySelector('.toast__close');
      if (btn) btn.addEventListener('click', dismiss);
      window.setTimeout(dismiss, (isError ? 8000 : 5200) + i * 400);
    });
  }

  /* --------------------------------------------------------- char count -- */
  function initCounters() {
    $$('[data-counter-for]').forEach((el) => {
      const field = document.getElementById(el.dataset.counterFor);
      if (!field) return;
      const max = Number(field.getAttribute('maxlength')) || 500;
      const update = () => {
        el.textContent = `${field.value.length} / ${max}`;
      };
      field.addEventListener('input', update);
      update();
    });
  }

  function initAutoGrow() {
    $$('textarea[data-autogrow]').forEach((ta) => {
      const resize = () => {
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight + 2, 420)}px`;
      };
      ta.addEventListener('input', resize);
      resize();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initSidebar();
    initPasswordToggles();
    initConfirms();
    initPosterPreview();
    initToasts();
    initCounters();
    initAutoGrow();
  });
})();
