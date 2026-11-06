// 자동 생성: npm run server:shared (src/online/nicknameRules.ts). 직접 고치지 않는다
// @ts-self-types="./nicknameRules.d.ts"
const groups = Object.values({
	profanity: {
		contains: [
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
		],
		exceptions: [
			"시발점",
			"시발역",
			"무지개새",
			"새끼고양이",
			"새끼강아지",
			"새끼손가락",
			"닥쳐오"
		],
		prefix: []
	},
	sexual: {
		contains: [
			"섹스",
			"강간",
			"보지",
			"자지",
			"야동",
			"sex",
			"porn",
			"pussy",
			"slut",
			"whore"
		],
		exceptions: [
			"해보지",
			"보지마",
			"남자지",
			"여자지",
			"야동생",
			"sussex",
			"essex",
			"pussycat"
		],
		prefix: []
	},
	hate: {
		contains: [
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
		],
		exceptions: [],
		prefix: []
	},
	impersonation: {
		contains: [],
		exceptions: [],
		prefix: [
			"운영자",
			"운영진",
			"관리자",
			"공식",
			"admin",
			"official"
		]
	}
});
const BANNED_CONTAINS = groups.flatMap((g) => g.contains);
const BANNED_EXCEPTIONS = groups.flatMap((g) => g.exceptions);
const BANNED_PREFIX = groups.flatMap((g) => g.prefix);
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
/** text 안에서 word가 나오는 모든 시작 위치 */
function occurrences(text, word) {
	const found = [];
	for (let i = text.indexOf(word); i !== -1; i = text.indexOf(word, i + 1)) found.push(i);
	return found;
}
/**
* 포함 금칙어가 하나라도 예외 말(exceptions) 바깥에 나오면 true.
* 예외 말을 문자열에서 지우지 않고 "그 자리가 예외 말 안에 덮여 있는지"로 본다.
* 지우는 방식은 `개새끼고양이`(새끼고양이를 지우면 `개`만 남는다) 같은 구멍이 생긴다
*/
function containsBannedWord(folded) {
	const excused = BANNED_EXCEPTIONS.flatMap((ex) => occurrences(folded, ex).map((start) => [start, start + ex.length]));
	return BANNED_CONTAINS.some((word) => occurrences(folded, word).some((start) => !excused.some(([s, e]) => s <= start && start + word.length <= e)));
}
/**
* 소문자로 바꾸고 숫자를 뺀 문자열(`시1발` → `시발`)을 bannedWords 목록과 맞춘다:
* 포함(contains, 예외 말 안은 제외) / 시작(prefix)
*/
function isBannedNickname(nickname) {
	const folded = nickname.toLowerCase().replace(/[0-9]/g, "");
	return containsBannedWord(folded) || BANNED_PREFIX.some((word) => folded.startsWith(word));
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
	if (isBannedNickname(nickname)) return {
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
export { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH, TAG_MAX, TAG_MAX_ATTEMPTS, TAG_MIN, checkNickname, formatTag, isBannedNickname, isValidTag, normalizeNickname };
