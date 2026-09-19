/* =========================================================
   설정값 (README에 명시)
   ========================================================= */
const CONFIG = {
  githubUser: 'eajnoeyeel',
  navScrollThreshold: 60, // 네비게이션 배경 변경 기준(px)
  scrollTopThreshold: 300, // 스크롤 탑 버튼 표시 기준(px)
  revealThreshold: 0.2, // Intersection Observer threshold
  typingSpeed: 90, // 한 글자 입력 간격(ms)
  deletingSpeed: 45, // 한 글자 삭제 간격(ms)
  typingPause: 1600, // 문장 완성 후 대기(ms)
  fetchTimeout: 8000, // GitHub API 응답 대기 한도(ms). 넘으면 요청을 취소하고 에러 상태로 전환
  // Formspree 폼 ID (https://formspree.io/f/{ID}). 비워두면 데모 모드로 동작
  formspreeId: 'xdekanev',
};

const THEME_KEY = 'theme';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* =========================================================
   상태(state) — 화면은 항상 이 값을 기준으로 다시 그린다

   규칙: 상태를 바꿨으면 반드시 짝이 되는 render 함수를 호출한다.
   projects처럼 여러 필드가 한꺼번에 바뀌는 상태는 setProjectsState가
   spread로 새 객체를 만들어 교체하므로, 렌더 도중 값이 섞이지 않는다.
   ========================================================= */
const state = {
  theme: document.documentElement.getAttribute('data-theme') || 'light',
  themeSource: 'system', // 'user'면 사용자가 직접 고른 값
  menuOpen: false,
  projects: {
    status: 'idle', // idle | loading | success | empty | error
    items: [],
    errorMessage: '',
  },
  filter: 'All',
  form: {
    values: { name: '', email: '', message: '' },
    errors: { name: '', email: '', message: '' },
    touched: { name: false, email: false, message: false },
    status: 'idle', // idle | sending | success | error
  },
};

/* =========================================================
   DOM 선택
   ========================================================= */
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => parent.querySelectorAll(selector);

const els = {
  root: document.documentElement,
  header: $('.site-header'),
  themeToggle: $('.theme-toggle'),
  navToggle: $('.nav__toggle'),
  navMenu: $('.nav__menu'),
  navLinks: $$('.nav__menu a, .nav__logo, .hero__cta a'),
  scrollTop: $('.scroll-top'),
  reveals: $$('.reveal'),
  typing: $('.typing__text'),
  filters: $('.filters'),
  projects: $('.projects'),
  form: $('#contact-form'),
  formStatus: $('.form-status'),
  formSubmit: $('.form-submit'),
  year: $('.footer__year'),
};

/* =========================================================
   유틸
   ========================================================= */
// API 응답을 innerHTML에 넣기 전에 이스케이프해 XSS를 막는다
const escapeHTML = (value = '') =>
  String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char]);

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });

// 로컬스토리지가 막힌 환경(시크릿 모드, 쿠키 차단 등)에서도 페이지가 죽지 않도록 감싼다.
// 읽기 실패는 '저장된 값 없음'으로 보고 시스템 설정을 따르고,
// 쓰기 실패는 무시한다 — 현재 세션의 테마 전환은 그대로 동작하고, 새로고침하면 시스템 설정으로 돌아간다.
const safeStorage = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  set: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // 의도적으로 무시 (위 주석 참고)
    }
  },
};

/* =========================================================
   흐름 1. 다크 모드: 클릭 → state.theme 변경 → data-theme 반영
   ========================================================= */
const renderTheme = () => {
  const isDark = state.theme === 'dark';
  els.root.setAttribute('data-theme', state.theme);
  els.themeToggle.setAttribute('aria-pressed', String(isDark));
  els.themeToggle.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
};

const setTheme = (theme, source) => {
  state.theme = theme;
  state.themeSource = source;
  if (source === 'user') safeStorage.set(THEME_KEY, theme);
  renderTheme();
};

const initTheme = () => {
  const saved = safeStorage.get(THEME_KEY);
  if (saved === 'dark' || saved === 'light') state.themeSource = 'user';
  renderTheme();

  els.themeToggle.addEventListener('click', () => {
    setTheme(state.theme === 'dark' ? 'light' : 'dark', 'user');
  });

  // 보너스: 사용자가 직접 고른 적이 없으면 시스템 설정 변경을 실시간으로 따라간다
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', (event) => {
    if (state.themeSource === 'user') return;
    setTheme(event.matches ? 'dark' : 'light', 'system');
  });
};

/* =========================================================
   햄버거 메뉴: 클릭 → state.menuOpen 변경 → classList.toggle
   ========================================================= */
const renderMenu = () => {
  els.navMenu.classList.toggle('active', state.menuOpen);
  els.navToggle.classList.toggle('active', state.menuOpen);
  els.navToggle.setAttribute('aria-expanded', String(state.menuOpen));
  els.navToggle.setAttribute('aria-label', state.menuOpen ? '메뉴 닫기' : '메뉴 열기');
};

const initMenu = () => {
  els.navToggle.addEventListener('click', () => {
    state.menuOpen = !state.menuOpen;
    renderMenu();
  });

  // ESC로 닫기
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !state.menuOpen) return;
    state.menuOpen = false;
    renderMenu();
    els.navToggle.focus();
  });
};

/* =========================================================
   부드러운 스크롤
   ========================================================= */
const initSmoothScroll = () => {
  els.navLinks.forEach((link) => {
    link.addEventListener('click', (event) => {
      const { hash } = link;
      const target = hash ? $(hash) : null;
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', hash);
      if (state.menuOpen) {
        state.menuOpen = false;
        renderMenu();
      }
    });
  });
};

/* =========================================================
   스크롤: 네비게이션 배경(60px), 스크롤 탑 버튼(300px)
   ========================================================= */
const renderScroll = () => {
  const { scrollY } = window;
  els.header.classList.toggle('scrolled', scrollY >= CONFIG.navScrollThreshold);
  els.scrollTop.classList.toggle('show', scrollY >= CONFIG.scrollTopThreshold);
};

const initScroll = () => {
  let ticking = false;
  window.addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        renderScroll();
        ticking = false;
      });
    },
    { passive: true },
  );
  renderScroll();

  els.scrollTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
};

/* =========================================================
   스크롤 애니메이션 (Intersection Observer)
   ========================================================= */
const initReveal = () => {
  if (!('IntersectionObserver' in window)) {
    els.reveals.forEach((el) => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return;
        target.classList.add('visible');
        observer.unobserve(target);
      });
    },
    { threshold: CONFIG.revealThreshold },
  );
  els.reveals.forEach((el) => observer.observe(el));
};

/* =========================================================
   보너스: 타이핑 효과
   ========================================================= */
const initTyping = () => {
  const phrases = els.typing.dataset.typing.split('|');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return; // 움직임 줄이기 설정이면 첫 문장만 고정 표시

  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;

  const tick = () => {
    const current = phrases[phraseIndex];
    charIndex += deleting ? -1 : 1;
    els.typing.textContent = current.slice(0, charIndex);

    let delay = deleting ? CONFIG.deletingSpeed : CONFIG.typingSpeed;
    if (!deleting && charIndex === current.length) {
      deleting = true;
      delay = CONFIG.typingPause;
    } else if (deleting && charIndex === 0) {
      deleting = false;
      phraseIndex = (phraseIndex + 1) % phrases.length;
      delay = CONFIG.typingSpeed * 4;
    }
    setTimeout(tick, delay);
  };

  els.typing.textContent = '';
  setTimeout(tick, 400);
};

/* =========================================================
   흐름 2. GitHub API: 요청 → 로딩/성공/빈/에러 상태 → Projects 렌더링
   흐름 4. 필터 클릭 → state.filter 변경 → 목록 다시 렌더링 (보너스)
   ========================================================= */
const toProject = ({ name, description, html_url, homepage, language, stargazers_count, forks_count, updated_at }) => ({
  name,
  description,
  url: html_url,
  homepage,
  language: language || 'Etc',
  stars: stargazers_count,
  forks: forks_count,
  updatedAt: updated_at,
});

const projectCard = ({ name, description, url, homepage, language, stars, forks, updatedAt }) => `
  <article class="project-card">
    <h3 class="project-card__title">
      <a href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(name)}</a>
    </h3>
    <p class="project-card__desc">${escapeHTML(description || '설명이 없는 저장소입니다.')}</p>
    <div class="project-card__meta">
      <span class="project-card__lang">${escapeHTML(language)}</span>
      <span aria-label="스타 ${stars}개">★ ${stars}</span>
      <span aria-label="포크 ${forks}개">⑂ ${forks}</span>
      <span>${formatDate(updatedAt)}</span>
    </div>
    ${homepage ? `<a class="project-card__demo" href="${escapeHTML(homepage)}" target="_blank" rel="noopener noreferrer">Live Demo →</a>` : ''}
  </article>
`;

const renderFilters = () => {
  const { status, items } = state.projects;
  if (status !== 'success') {
    els.filters.innerHTML = '';
    return;
  }
  // 언어별 개수 집계 (reduce) 후 많은 순으로 정렬
  const counts = items.reduce((acc, { language }) => {
    acc[language] = (acc[language] || 0) + 1;
    return acc;
  }, {});
  const languages = ['All', ...Object.keys(counts).sort((a, b) => counts[b] - counts[a])];

  els.filters.innerHTML = languages
    .map((lang) => {
      const count = lang === 'All' ? items.length : counts[lang];
      const active = lang === state.filter;
      return `<button class="filter-btn${active ? ' active' : ''}" type="button" data-lang="${escapeHTML(lang)}" aria-pressed="${active}">${escapeHTML(lang)}<span class="filter-btn__count">${count}</span></button>`;
    })
    .join('');
};

const renderProjects = () => {
  const { status, items, errorMessage } = state.projects;
  els.projects.setAttribute('aria-busy', String(status === 'loading'));

  if (status === 'loading') {
    els.projects.innerHTML = `
      <div class="state state--loading">
        <div class="spinner" aria-hidden="true"></div>
        <p>로딩 중...</p>
      </div>`;
    return;
  }

  if (status === 'error') {
    els.projects.innerHTML = `
      <div class="state state--error">
        <p>프로젝트를 불러올 수 없습니다.</p>
        <p class="state__detail">${escapeHTML(errorMessage)}</p>
        <button class="btn btn--primary retry-btn" type="button">다시 시도</button>
      </div>`;
    return;
  }

  // 필터 적용 (filter)
  const visible = state.filter === 'All' ? items : items.filter(({ language }) => language === state.filter);

  if (status === 'empty' || visible.length === 0) {
    els.projects.innerHTML = `
      <div class="state state--empty">
        <p>표시할 프로젝트가 없습니다.</p>
      </div>`;
    return;
  }

  // 데이터 → 카드 HTML (map)
  els.projects.innerHTML = visible.map(projectCard).join('');
};

const renderProjectsSection = () => {
  renderFilters();
  renderProjects();
};

const setProjectsState = (patch) => {
  state.projects = { ...state.projects, ...patch };
  renderProjectsSection();
};

const fetchProjects = async () => {
  setProjectsState({ status: 'loading', errorMessage: '' });

  // 응답이 없는 채로 로딩 스피너가 계속 도는 것을 막는다
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CONFIG.fetchTimeout);

  try {
    const response = await fetch(
      `https://api.github.com/users/${CONFIG.githubUser}/repos?per_page=100&sort=updated`,
      { headers: { Accept: 'application/vnd.github+json' }, signal: controller.signal },
    );

    if (!response.ok) {
      const remaining = response.headers.get('x-ratelimit-remaining');
      if (response.status === 403 || response.status === 429 || remaining === '0') {
        throw new Error('GitHub API 요청 한도를 넘었습니다. 잠시 후 다시 시도해 주세요.');
      }
      if (response.status === 404) {
        throw new Error(`GitHub 사용자(${CONFIG.githubUser})를 찾을 수 없습니다.`);
      }
      throw new Error(`요청에 실패했습니다. (HTTP ${response.status})`);
    }

    const data = await response.json();
    // 포크와 보관된 저장소는 제외
    const items = data.filter(({ fork, archived }) => !fork && !archived).map(toProject);

    state.filter = 'All';
    setProjectsState({ status: items.length ? 'success' : 'empty', items });
  } catch (error) {
    let message = error.message;
    if (error.name === 'AbortError') message = '요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.';
    else if (error instanceof TypeError) message = '네트워크 연결을 확인해 주세요.';
    setProjectsState({ status: 'error', errorMessage: message });
  } finally {
    clearTimeout(timeoutId);
  }
};

const initProjects = () => {
  // 이벤트 위임: 다시 그려지는 버튼에도 리스너가 유지된다
  els.projects.addEventListener('click', (event) => {
    if (event.target.closest('.retry-btn')) fetchProjects();
  });

  els.filters.addEventListener('click', (event) => {
    const button = event.target.closest('.filter-btn');
    if (!button) return;
    state.filter = button.dataset.lang;
    renderProjectsSection();
  });

  fetchProjects();
};

/* =========================================================
   흐름 3. 폼: 입력 → 유효성 상태 변경 → 에러 메시지 표시/숨김
   ========================================================= */
const validators = {
  name: (value) => (value.trim() ? '' : '이름을 입력해 주세요.'),
  email: (value) => {
    if (!value.trim()) return '이메일을 입력해 주세요.';
    return EMAIL_PATTERN.test(value.trim()) ? '' : '올바른 이메일 형식이 아닙니다. (예: name@example.com)';
  },
  message: (value) => {
    if (!value.trim()) return '메시지를 입력해 주세요.';
    return value.trim().length < 10 ? '메시지는 10자 이상 입력해 주세요.' : '';
  },
};

const validateField = (field) => {
  state.form.errors[field] = validators[field](state.form.values[field]);
};

const renderFormErrors = () => {
  Object.entries(state.form.errors).forEach(([field, message]) => {
    const input = $(`#${field}`);
    const wrapper = input.closest('.form-field');
    const visibleMessage = state.form.touched[field] ? message : '';
    $(`#${field}-error`).textContent = visibleMessage;
    wrapper.classList.toggle('invalid', Boolean(visibleMessage));
    input.setAttribute('aria-invalid', String(Boolean(visibleMessage)));
  });
};

const STATUS_TEXT = {
  idle: '',
  sending: '전송 중...',
  success: '',
  error: '전송에 실패했습니다. 잠시 후 다시 시도해 주세요.',
};

const renderFormStatus = (successText = '') => {
  const { status } = state.form;
  els.formStatus.textContent = status === 'success' ? successText : STATUS_TEXT[status];
  els.formStatus.classList.remove('success', 'error');
  if (status === 'success' || status === 'error') els.formStatus.classList.add(status);
  els.formSubmit.disabled = status === 'sending';
  els.formSubmit.textContent = status === 'sending' ? 'Sending...' : 'Send';
};

// 보너스: Formspree로 실제 전송
const sendForm = async (values) => {
  if (!CONFIG.formspreeId) {
    // 데모 모드: 실제 전송 없이 성공 처리
    await new Promise((resolve) => setTimeout(resolve, 600));
    return { demo: true };
  }
  const response = await fetch(`https://formspree.io/f/${CONFIG.formspreeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(values),
  });
  if (!response.ok) throw new Error(`Formspree ${response.status}`);
  return { demo: false };
};

const initForm = () => {
  const fields = Object.keys(state.form.values);

  els.form.addEventListener('input', (event) => {
    const { name, value } = event.target;
    if (!fields.includes(name)) return;
    state.form.values[name] = value;
    validateField(name);
    if (state.form.status !== 'sending') state.form.status = 'idle';
    renderFormErrors();
    renderFormStatus();
  });

  // 포커스를 벗어나면 그 필드는 '만진 것'으로 보고 에러를 보여준다
  els.form.addEventListener('focusout', (event) => {
    const { name } = event.target;
    if (!fields.includes(name)) return;
    state.form.touched[name] = true;
    validateField(name);
    renderFormErrors();
  });

  els.form.addEventListener('submit', async (event) => {
    event.preventDefault();

    fields.forEach((field) => {
      state.form.touched[field] = true;
      validateField(field);
    });
    renderFormErrors();

    const firstInvalid = fields.find((field) => state.form.errors[field]);
    if (firstInvalid) {
      $(`#${firstInvalid}`).focus();
      return;
    }

    state.form.status = 'sending';
    renderFormStatus();

    try {
      const { demo } = await sendForm(state.form.values);
      const { name } = state.form.values;
      state.form.status = 'success';
      renderFormStatus(
        demo
          ? `${name.trim()}님, 메시지가 접수되었습니다! (데모 모드: 실제 메일은 전송되지 않았습니다)`
          : `${name.trim()}님, 메시지가 전송되었습니다! 곧 답장 드릴게요.`,
      );
      els.form.reset();
      fields.forEach((field) => {
        state.form.values[field] = '';
        state.form.touched[field] = false;
        state.form.errors[field] = '';
      });
      renderFormErrors();
    } catch (error) {
      state.form.status = 'error';
      renderFormStatus();
    }
  });
};

/* =========================================================
   시작
   ========================================================= */
const init = () => {
  els.year.textContent = new Date().getFullYear();
  initTheme();
  initMenu();
  initSmoothScroll();
  initScroll();
  initReveal();
  initTyping();
  initProjects();
  initForm();
};

init();
