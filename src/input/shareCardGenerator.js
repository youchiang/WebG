/**
 * Polaroid Achievement Card Generator and Web Share API Trigger
 * Formats: 1080 x 1350 px (Threads / Instagram 4:5 vertical card)
 */

export async function generateDriftShareCard({ gameCanvas, state }) {
  const shareCanvas = document.createElement('canvas');
  shareCanvas.width = 1080;
  shareCanvas.height = 1350;
  const ctx = shareCanvas.getContext('2d');

  // 1. Clean Cream/Pastel Background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, 1080, 1350);

  // Soft decorative header pill
  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(80, 60, 920, 100, 30);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🚛 《垃圾清運行動》 清運戰報', 540, 126);

  // 2. Game Canvas Snapshot (Framed Polaroid style)
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 12;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(70, 190, 940, 680);
  ctx.restore();

  // Draw snapshot inside frame
  try {
    ctx.drawImage(gameCanvas, 85, 205, 910, 650);
  } catch (e) {
    ctx.fillStyle = '#CBD5E1';
    ctx.fillRect(85, 205, 910, 650);
  }

  // 3. Score & Title Badge
  ctx.fillStyle = '#2DD4BF';
  ctx.beginPath();
  ctx.roundRect(80, 900, 920, 160, 24);
  ctx.fill();

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🏁 總甩尾累計成績', 540, 950);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 68px sans-serif';
  ctx.fillText(`${state.totalScore.toLocaleString()} PTS`, 540, 1030);

  // 4. Yeeted Breakdown & Funny Title
  ctx.fillStyle = '#1E293B';
  ctx.font = 'bold 42px sans-serif';
  ctx.fillText(`榮譽頭銜：${state.evaluationTitle || '秋名山老司機'}`, 540, 1120);

  ctx.fillStyle = '#64748B';
  ctx.font = '32px sans-serif';
  const yeetSummary = `🧍 擊飛路人 ${state.yeetCounts.human} 人  ·  🐱 升空橘貓 ${state.yeetCounts.cat} 隻  ·  🐕 旋轉柴犬 ${state.yeetCounts.shiba} 隻`;
  ctx.fillText(yeetSummary, 540, 1180);

  // Footer
  ctx.fillStyle = '#94A3B8';
  ctx.font = '28px sans-serif';
  ctx.fillText('單手單指極限甩尾 ➔ 在 Threads 上挑戰我的分數！', 540, 1280);

  return new Promise((resolve) => {
    shareCanvas.toBlob(resolve, 'image/png');
  });
}

export async function shareDriftScore({ imageBlob, state }) {
  const bagsInfo = state.trashBagsRemaining !== undefined ? `\n📦 護送 ${state.trashBagsRemaining} 袋垃圾成功抵達（甩飛 ${state.trashBagsLost || 0} 袋）` : '';
  const shareText = `我在《垃圾清運行動》拿到了 ${state.totalScore.toLocaleString()} 分！\n解鎖頭銜：${state.evaluationTitle} 🚛💨${bagsInfo}\n累計撞飛 ${state.totalYeeted} 個路旁觀賽群！誰能超越我？😂\n#垃圾清運行動 #Threads小遊戲 #3D賽車`;

  if (navigator.canShare && navigator.canShare({ files: [new File([imageBlob], 'drift-result.png', { type: 'image/png' })] })) {
    try {
      await navigator.share({
        title: '《垃圾清運行動》成績戰報',
        text: shareText,
        files: [new File([imageBlob], 'drift-result.png', { type: 'image/png' })],
      });
      return { success: true, method: 'native' };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, aborted: true };
    }
  }

  // Fallback: Copy share text and trigger image download
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareText);
    }
    const link = document.createElement('a');
    link.download = `drift-score-${Date.now()}.png`;
    link.href = URL.createObjectURL(imageBlob);
    link.click();
    return { success: true, method: 'download-and-copy' };
  } catch (err) {
    return { success: false, error: err };
  }
}
