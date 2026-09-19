// 첫 화면이 그려지기 전에 테마를 적용해 깜빡임(FOUC)을 막는다.
// 우선순위: 로컬스토리지에 저장된 값 > 시스템 설정(prefers-color-scheme)
(() => {
  let saved = null;
  try {
    saved = localStorage.getItem('theme');
  } catch (error) {
    saved = null;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved === 'dark' || saved === 'light' ? saved : prefersDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
})();
