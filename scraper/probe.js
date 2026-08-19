/** GitHub Actions 환경에서 어떤 헤더 조합이 통하는지 확인 */
const BASE = 'https://www.winwinnuri.or.kr/pg/selectPgProgramAjax.do';

const PARAMS = {
  pageSize: '10', pageNumber: '1', sortOrder: 'desc',
  bizNm: '', corpNm: '', bizStYmd: '', bizEdYmd: '',
  supoTrgt: '0', bizAreaSecd: '0', applyStep: '', progStep: '0',
  bizArea: '0', pageType: 'gth', mainSchType: '', orderType: '3',
  clsBizOpenYn: ''
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36';
const REF = 'https://www.winwinnuri.or.kr/pg/selectPgSearchList.do';

const CASES = {
  '1-현재설정': {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Content-Type': 'application/json',
    'Referer': REF,
    'User-Agent': UA,
    'X-Requested-With': 'XMLHttpRequest'
  },
  '2-ContentType제거': {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9',
    'Referer': REF,
    'User-Agent': UA,
    'X-Requested-With': 'XMLHttpRequest'
  },
  '3-최소헤더': {
    'User-Agent': UA,
    'X-Requested-With': 'XMLHttpRequest'
  },
  '4-UA만': {
    'User-Agent': UA
  },
  '5-헤더없음': {},
  '6-브라우저전체': {
    'Accept': 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Referer': REF,
    'User-Agent': UA,
    'X-Requested-With': 'XMLHttpRequest',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
  }
};

(async () => {
  // 세션 쿠키를 먼저 받아두는 경우도 테스트
  let cookie = '';
  try {
    const r = await fetch(REF, { headers: { 'User-Agent': UA } });
    const sc = r.headers.getSetCookie ? r.headers.getSetCookie() : [];
    cookie = sc.map(c => c.split(';')[0]).join('; ');
    console.log('목록페이지 접속: HTTP ' + r.status);
    console.log('받은 쿠키: ' + (cookie || '(없음)') + '\n');
  } catch (e) {
    console.log('목록페이지 접속 실패: ' + e.message + '\n');
  }

  const url = new URL(BASE);
  for (const [k, v] of Object.entries(PARAMS)) url.searchParams.set(k, v);
  url.searchParams.set('_', String(Date.now()));

  for (const [name, headers] of Object.entries(CASES)) {
    for (const withCookie of [false, true]) {
      if (withCookie && !cookie) continue;
      const h = withCookie ? { ...headers, Cookie: cookie } : headers;
      const label = name + (withCookie ? ' +쿠키' : '');
      try {
        const res = await fetch(url.toString(), { headers: h });
        const text = await res.text();
        let rows = -1;
        try { rows = (JSON.parse(text).rows || []).length; } catch {}
        const mark = rows > 0 ? ' ★★★ 성공' : '';
        console.log(`[${label}] HTTP ${res.status} / rows ${rows}${mark}`);
        if (res.status !== 200) console.log('   응답 앞 200자: ' + text.slice(0, 200));
      } catch (e) {
        console.log(`[${label}] 예외: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
})();