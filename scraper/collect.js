/**
 * 상생누리(winwinnuri.or.kr) 신청중 공고 수집 스크립트
 * - applyStepNm = "신청중" 이고 사업명(bizNm 또는 prgNm)에 키워드가 포함된 공고만 수집
 * - 최신순(desc) 정렬로 훑고, 신청중이 없는 페이지가 연속되면 조기 종료
 * - 마감일이 지난 공고는 제외
 * - 외부 키/토큰 불필요, Node 내장 fetch만 사용
 */

const fs = require('fs');
const path = require('path');

const KEYWORDS = ['ESG', '스마트공장', '혁신파트너십'];
const TARGET_STATUS = '신청중';          // applyStepNm 기준
const BASE_URL = 'https://www.winwinnuri.or.kr/pg/selectPgProgramAjax.do';
const LIST_PAGE = 'https://www.winwinnuri.or.kr/pg/selectPgSearchList.do';
const PAGE_SIZE = 100;
const MAX_PAGES = 120;                    // 안전장치 (12,000건)
const STALE_PAGE_LIMIT = 8;               // 신청중이 하나도 없는 페이지가 연속 N번이면 중단
const EXCLUDE_CLOSED = true;              // 마감일 지난 공고 제외
const OUT_PATH = path.join(__dirname, '..', 'public', 'notices.json');

const HEADERS = {
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Accept-Language': 'ko-KR,ko;q=0.9',
  'Content-Type': 'application/json',
  'Referer': LIST_PAGE,
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest'
};

function buildParams(pageNumber) {
  return {
    pageSize: String(PAGE_SIZE),
    pageNumber: String(pageNumber),
    sortOrder: 'desc',        // 최신순
    bizNm: '',
    corpNm: '',
    bizStYmd: '',
    bizEdYmd: '',
    supoTrgt: '0',
    bizAreaSecd: '0',
    applyStep: '',
    progStep: '0',
    bizArea: '0',
    pageType: 'gth',
    mainSchType: '',
    orderType: '3',
    clsBizOpenYn: '',
    _: String(Date.now())
  };
}

function normalize(s) {
  return (s || '').replace(/\s+/g, '');
}

// bizNm과 prgNm 둘 다 검사 (회차 공고명과 프로그램명이 다른 경우가 있음)
function matchedKeyword(row) {
  const haystack = normalize(row.bizNm) + '\u0000' + normalize(row.prgNm);
  return KEYWORDS.find(kw => haystack.includes(normalize(kw)));
}

async function fetchPage(pageNumber) {
  const url = new URL(BASE_URL);
  for (const [k, v] of Object.entries(buildParams(pageNumber))) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const matched = new Map();
  const today = new Date().toISOString().slice(0, 10);
  let scanned = 0;
  let applyingSeen = 0;
  let closedSkipped = 0;
  let staleStreak = 0;
  let stoppedEarly = false;

  for (let pageNumber = 1; pageNumber <= MAX_PAGES; pageNumber++) {
    let data;
    try {
      data = await fetchPage(pageNumber);
    } catch (e) {
      console.error(`page ${pageNumber} 실패: ${e.message}`);
      break;
    }

    const rows = data.rows || [];
    if (pageNumber === 1) {
      console.log(`전체 ${data.total}건 / ${data.totalPages}페이지 (페이지당 ${PAGE_SIZE}건, 최신순)`);
      console.log(`오늘: ${today} / 마감 지난 공고 제외: ${EXCLUDE_CLOSED ? '예' : '아니오'}\n`);
    }
    if (rows.length === 0) {
      console.log(`page ${pageNumber}: 0건 — 종료`);
      stoppedEarly = true;
      break;
    }

    scanned += rows.length;
    let applyingThisPage = 0;

    for (const row of rows) {
      if ((row.applyStepNm || '') !== TARGET_STATUS) continue;
      applyingThisPage++;
      applyingSeen++;

      const kw = matchedKeyword(row);
      if (!kw) continue;

      // 마감일이 지난 공고 제외 (상태가 '신청중'으로 남아있는 경우 대비)
      if (EXCLUDE_CLOSED && row.notiEdYmd && row.notiEdYmd < today) {
        closedSkipped++;
        continue;
      }

      matched.set(String(row.bizId), {
        bizId: String(row.bizId),
        prgId: String(row.prgId ?? ''),
        bizNm: row.bizNm || '',
        prgNm: row.prgNm || '',
        applyStepNm: row.applyStepNm,
        progStepCodNm: row.progStepCodNm || '',
        notiStYmd: row.notiStYmd || '',
        notiEdYmd: row.notiEdYmd || '',
        bizArea: row.bizArea || '',
        bizAreaSecdNm: row.bizAreaSecdNm || '',
        membrCorpNm: row.membrCorpNm || '',
        matchedKeyword: kw
      });
    }

    console.log(`page ${pageNumber}: ${rows.length}건 중 신청중 ${applyingThisPage}건 (누적 매칭 ${matched.size}건)`);

    // 신청중이 전혀 없는 페이지가 연속되면 과거 구간으로 넘어간 것으로 보고 중단
    staleStreak = applyingThisPage === 0 ? staleStreak + 1 : 0;
    if (staleStreak >= STALE_PAGE_LIMIT) {
      console.log(`\n신청중 없는 페이지 ${STALE_PAGE_LIMIT}회 연속 — 과거 구간으로 판단해 종료`);
      stoppedEarly = true;
      break;
    }

    if (data.totalPages && pageNumber >= data.totalPages) {
      stoppedEarly = true;
      break;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  if (!stoppedEarly) {
    console.log(`\n※ MAX_PAGES(${MAX_PAGES})까지 돌고 끝났습니다. 뒤쪽에 공고가 더 있을 수 있으니 값을 늘려보세요.`);
  }

  const notices = [...matched.values()].sort((a, b) =>
    (a.notiEdYmd || '9999-99-99').localeCompare(b.notiEdYmd || '9999-99-99')
  );

  console.log(`\n${scanned}건 확인 / 신청중 ${applyingSeen}건 / 마감제외 ${closedSkipped}건 → 최종 ${notices.length}건`);
  for (const kw of KEYWORDS) {
    const hits = notices.filter(n => n.matchedKeyword === kw);
    console.log(`\n  ${kw}: ${hits.length}건`);
    hits.forEach(h => console.log(`      · ${h.bizNm} (~${h.notiEdYmd})`));
  }

  if (notices.length === 0 && fs.existsSync(OUT_PATH)) {
    const prev = JSON.parse(fs.readFileSync(OUT_PATH, 'utf-8'));
    if (Array.isArray(prev.notices) && prev.notices.length > 0) {
      console.error('\n이번 결과가 0건이라 기존 파일을 유지합니다.');
      process.exit(1);
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify({
    updatedAt: new Date().toISOString(),
    keywords: KEYWORDS,
    count: notices.length,
    notices
  }, null, 2) + '\n', 'utf-8');

  console.log(`\n저장 완료: ${OUT_PATH}`);
}

main().catch(err => {
  console.error('수집 스크립트 실패:', err);
  process.exit(1);
});