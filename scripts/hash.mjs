/** 비밀번호 → DASH_USERS 에 넣을 sha256 값. 사용: npm run hash -- <비밀번호> */
import { createHash } from 'node:crypto';
const pw = process.argv[2];
if (!pw) {
  console.error('사용법: npm run hash -- <비밀번호>');
  process.exit(1);
}
console.log('sha256:' + createHash('sha256').update(pw, 'utf8').digest('hex'));
