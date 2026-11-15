// 사진을 줄여서 보내기 (업로드·AI 분석 시간을 줄이려고 긴 변 1280px, JPEG 0.82)
const MAX_SIDE = 1280

export async function toJpeg(source, w, h) {
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.82))
  if (!blob) throw new Error('이미지 변환 실패')
  return new File([blob], 'label.jpg', { type: 'image/jpeg' })
}

export async function shrinkFile(file) {
  try {
    const url = URL.createObjectURL(file)
    const img = await new Promise((res, rej) => {
      const i = new Image()
      i.onload = () => res(i)
      i.onerror = rej
      i.src = url
    })
    const out = await toJpeg(img, img.naturalWidth, img.naturalHeight)
    URL.revokeObjectURL(url)
    return out
  } catch {
    return file // 변환이 안 되면 원본 그대로
  }
}

/** 재생 중인 <video>에서 지금 화면 한 장 */
export async function grabFrame(video) {
  if (!video?.videoWidth) throw new Error('카메라 화면이 아직 준비되지 않았어요')
  return toJpeg(video, video.videoWidth, video.videoHeight)
}
