/**
 * 요기보 컬러명 → HEX. deliveryOFF/창고재고.html의 COLOR_MAP 원본.
 * spec이 "아쿠아 블루 / Aqua Blue" 형태라 앞부분(한글명)으로 매칭한다.
 */
export const COLOR_MAP = {
  '체리 레드': '#D80C1E',
  '와인 버건디': '#A22327',
  '스위트 오렌지': '#EE780C',
  로즈핑크: '#E61A67',
  '올리브 그린': '#79A02F',
  '아쿠아 블루': '#0081CC',
  '네이비 블루': '#10376C',
  '브라이트 퍼플': '#754095',
  '딥 퍼플': '#87234B',
  '초코 브라운': '#745334',
  '라이트 그레이': '#E5DED3',
  '다크 그레이': '#615F5F',
  '리빙 코랄': '#FF6633',
  '블라썸 핑크': '#FFD3C5',
  '브라이트 옐로우': '#FFE100',
  '라벤더 퍼플': '#E6C8CE',
  '프레시 민트': '#CCEFC2',
  '파스텔 블루': '#D6E0EC',
  '아보카도 그린': '#C6D59B',
  '로즈 핑크': '#E61A67',
  스카이: 'skyblue',
  시트러스: 'orange',
  오닉스: '#3A5657',
  그라스: '#BED12B',
  스톤: '#98ABB6',
  '딥 블랙': '#000',
  스노우: '#fff',
  블랙펄: '#333',
  '리빙 코럴': 'orange',
  오션: 'blue',
  '슈가 브라운': '#6b3636',
};

/** spec 문자열에서 색상 HEX 추출 (없으면 null) */
export function colorOf(spec) {
  const ko = String(spec || '').split('/')[0].trim();
  return COLOR_MAP[ko] || null;
}

/** 그룹명 "Squeezibo(스퀴지보)" → "스퀴지보" */
export function displayGroup(group) {
  const m = String(group || '').match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : group || '기타';
}
