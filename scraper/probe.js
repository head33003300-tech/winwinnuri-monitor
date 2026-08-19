/** GitHub Actions에서 올바른 파라미터로 접속되는지 확인 */
const BASE = 'https://www.winwinnuri.or.kr/pg/selectPgProgramAjax.do';
const LIST = 'https://www.winwinnuri.or.kr/pg/selectPgSearchList.do';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';

const HEADERS = {
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Content-Type': 'application/json',
  'Referer': LIST,
  'User-Agent': UA,
  'X-Requested-With': 'XMLHttpRequest'
};

function buildUrl(pageNumber, pageSize) {
  const params = {
    pageSize: String(pageSize), pageNumber: String(pageNumber), sortOrder: 'desc',
    bizNm: '', corpNm: '', bizStYmd: '', bizEdYmd: '',
    supoTrgt: '0', bizAreaSecd: '0', applyStep: '', progStep: '0',
    bizArea: '0', pageType: 'gth', mainSchType: '', orderType: '3',
    clsBizOpenYn: '', _: String(Date.now())
  };
  const url = new URL(BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

(async () => {
  // 1) 목록 페이지
  try {
    const r = await fetch(LIST, { headers: { 'User-Agent': UA } });
    console.log(`목록페이지: HTTP ${r.status}`);
  } catch (e) {
    console.log(`목록페이지 예외: ${e.message}`);
  }

  // 2) 올바른 파라미터로 AJAX
  for (const size of [10, 50, 100]) {
    try {
      const r = await fetch(buildUrl(1, size), { headers: HEADERS });
      let rows = -1;
      let total = '-';
      if (r.ok) {
        const d = await r.json();
        rows = (d.rows || []).length;
        total = d.total;
      }
      console.log(`pageSize=${size} → HTTP ${r.status} / total ${total} / rows ${rows}${rows > 0 ? '  ★★★' : ''}`);
    } catch (e) {
      console.log(`pageSize=${size} → 예외 ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  // 3) 연속 요청 견디는지 (3페이지 연속)
  console.log('\n--- 연속 요청 테스트 (2초 간격) ---');
  for (let p = 1; p <= 3; p++) {
    try {
      const r = await fetch(buildUrl(p, 100), { headers: HEADERS });
      const rows = r.ok ? ((await r.json()).rows || []).length : -1;
      console.log(`page ${p} → HTTP ${r.status} / rows ${rows}`);
    } catch (e) {
      console.log(`page ${p} → 예외 ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000));
  }
})();