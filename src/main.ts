import Phaser from 'phaser';
import { GAME } from './config';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';
import { ResultScene } from './scenes/ResultScene';
import { RankingScene } from './scenes/RankingScene';
import { StageMapScene } from './scenes/StageMapScene';
import { renderAppIconPage } from './dev/appIcon';
import { onlineStatus, setNickname, startRun, submitScore } from './online';
import { toPromptResult } from './scenes/nicknameGate';
import { setRankingClient } from './scenes/rankingClient';
import { setRunClient } from './scenes/runClient';

// DEV ?icon: 게임 대신 앱 아이콘 원본을 받는 페이지 (assets/app-icon/README.md)
if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('icon')) {
  renderAppIconPage();
} else {
  // 경쟁 run: 키가 있고 온라인이며 계정이 준비됐거나 로그인 중일 때만 서버 run을 받는다 (startRun이 로그인까지 기다린다)
  setRunClient({
    startRun,
    submitScore,
    canRank: () => {
      const status = onlineStatus();
      return (
        (status === 'ready' || status === 'signing-in') &&
        (typeof navigator === 'undefined' || navigator.onLine)
      );
    },
  });
  // DEV ?fakerun=<ok|rejected|outdated|failed|null|slow>: 서버 없는 랭킹 등록 흐름 확인
  const fakeRun = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('fakerun')
    : null;
  if (fakeRun !== null) void import('./dev/fakeRun').then((m) => m.installFakeRun(fakeRun));
  // 주간 랭킹: fetchRanking은 claude-1의 src/online/ranking.ts가 오면 여기서 꽂는다 (그 전에는 "연결 불가")
  setRankingClient({
    fetchRanking: () => Promise.resolve({ kind: 'offline' }),
    setNickname: (name) => setNickname(name).then(toPromptResult),
  });
  // DEV ?fakeranking=<list|empty|error|slow|offline|nonick|norecord>: 서버 없는 랭킹 화면 확인
  const fakeRanking = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('fakeranking')
    : null;
  if (fakeRanking !== null) {
    void import('./dev/fakeRanking').then((m) => m.installFakeRanking(fakeRanking));
  }
  const game = startGame();
  // DEV ?nickname=<ok|오류 code>: 닉네임 입력 창 미리보기. 배포 빌드에서는 분기째 빠진다
  const nickname = import.meta.env.DEV
    ? new URLSearchParams(window.location.search).get('nickname')
    : null;
  if (nickname !== null) {
    game.events.once(Phaser.Core.Events.READY, () => {
      void import('./dev/nicknamePreview').then((m) =>
        m.openNicknamePreview(game.canvas, nickname),
      );
    });
  }
}

function startGame(): Phaser.Game {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME.width,
    height: GAME.height,
    transparent: true, // 하늘은 index.html의 html 그라데이션 하나만 쓴다
    scale: {
      // 폭 720 기준으로 화면 비율에 맞춰 높이를 늘린다 (배치는 screenLayout)
      mode: Phaser.Scale.EXPAND,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Pause는 Game 위에 그려지도록 Game보다 뒤에 둔다
    scene: [BootScene, MenuScene, StageMapScene, RankingScene, GameScene, ResultScene, PauseScene],
  });
}
