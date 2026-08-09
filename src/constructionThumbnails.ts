import type { CSSProperties } from 'react'
import showerThumbnailSprite from './assets/shower-thumbnail-sprite.png'

const constructionThumbnailPositions: Record<string, string> = {
  '6663': '6.46% 21.88%',
  '6744': '35.96% 21.88%',
  '6747': '66.01% 21.88%',
  '6745': '95.79% 21.88%',
  '6746': '6.46% 58.68%',
  '6748': '35.96% 58.68%',
  '6749': '66.01% 58.68%',
  '6750': '95.79% 58.68%',
  '6751': '6.46% 95.49%',
  '6752': '35.96% 95.49%',
  '6753': '66.01% 95.49%',
  '6754': '95.79% 95.49%',
}

export const getConstructionThumbnailStyle = (constructionId: string): CSSProperties | null => {
  const backgroundPosition = constructionThumbnailPositions[constructionId]
  if (!backgroundPosition) return null
  return { backgroundImage: `url(${showerThumbnailSprite})`, backgroundPosition }
}
