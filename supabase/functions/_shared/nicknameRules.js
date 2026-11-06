// 자동 생성: npm run server:shared (src/online/nicknameRules.ts). 직접 고치지 않는다
// @ts-self-types="./nicknameRules.d.ts"
// src/online/bannedWords.ts
/** 욕설·비속어 대표형과 흔한 변형 */
const PROFANITY = [
	"씨발",
	"시발",
	"씨빨",
	"씨팔",
	"시팔",
	"쓰발",
	"병신",
	"븅신",
	"개새",
	"새끼",
	"좆",
	"존나",
	"지랄",
	"닥쳐",
	"미친놈",
	"미친년",
	"fuck",
	"shit",
	"bitch"
];
/** 성적 표현 */
const SEXUAL = [
	"섹스",
	"보지",
	"자지",
	"야동",
	"강간",
	"sex",
	"porn",
	"pussy",
	"slut",
	"whore"
];
/** 혐오·비하 */
const HATE = [
	"한남충",
	"김치녀",
	"된장녀",
	"맘충",
	"틀딱",
	"급식충",
	"짱깨",
	"쪽바리",
	"깜둥",
	"니애미",
	"느금",
	"nigger",
	"nigga",
	"faggot",
	"retard",
	"hitler"
];
/** 운영자 사칭 */
const IMPERSONATION = [
	"운영자",
	"운영진",
	"관리자",
	"공식",
	"admin",
	"official"
];
const BANNED_WORDS = [
	...PROFANITY,
	...SEXUAL,
	...HATE,
	...IMPERSONATION
];
// src/online/nicknameRules.ts
/** 길이 하한·상한 (코드 포인트 기준. 한글 완성형 1자 = 1) */
const NICKNAME_MIN_LENGTH = 2;
const NICKNAME_MAX_LENGTH = 10;
/** 태그 범위. 화면에는 `#0427`처럼 4자리로 보인다 */
const TAG_MIN = 0;
const TAG_MAX = 9999;
/** 같은 닉네임 안에서 태그가 겹칠 때 다시 뽑는 최대 횟수. 넘으면 server 오류 */
const TAG_MAX_ATTEMPTS = 20;
/** 한글 완성형(가~힣), 영문, 숫자만. 공백·기호·이모지·자모 단독·보이지 않는 글자는 안 된다 */
const ALLOWED = /^[가-힣A-Za-z0-9]+$/;
/** 앞뒤 공백 제거 + NFC 정규화 (조합형으로 들어온 한글을 완성형으로 맞춘다) */
function normalizeNickname(input) {
	return input.normalize("NFC").trim();
}
/** 소문자로 바꾸고 숫자를 뺀 문자열에 금칙어가 들어 있으면 true (`시1발` 같은 끼워 넣기 차단) */
function containsBannedWord(nickname) {
	const folded = nickname.toLowerCase().replace(/[0-9]/g, "");
	return BANNED_WORDS.some((word) => folded.includes(word));
}
function checkNickname(input) {
	const nickname = normalizeNickname(input);
	const length = [...nickname].length;
	if (length < 2) return {
		ok: false,
		code: "too-short"
	};
	if (length > 10) return {
		ok: false,
		code: "too-long"
	};
	if (!ALLOWED.test(nickname)) return {
		ok: false,
		code: "bad-chars"
	};
	if (containsBannedWord(nickname)) return {
		ok: false,
		code: "banned"
	};
	return {
		ok: true,
		nickname
	};
}
function isValidTag(tag) {
	return typeof tag === "number" && Number.isInteger(tag) && tag >= 0 && tag <= 9999;
}
/** `#0427`처럼 4자리 */
function formatTag(tag) {
	return `#${String(tag).padStart(4, "0")}`;
}
export { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, TAG_MAX, TAG_MAX_ATTEMPTS, TAG_MIN, checkNickname, containsBannedWord, formatTag, isValidTag, normalizeNickname };
