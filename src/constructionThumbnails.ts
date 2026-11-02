import type { CSSProperties } from 'react'
import showerThumbnailSprite from './assets/shower-concept-sprite.png'

const constructionThumbnailPositions: Record<string, string> = {
  '6663': '0% 0%',
  '6744': '33.333333% 0%',
  '6747': '66.666667% 0%',
  '6745': '100% 0%',
  '6746': '0% 50%',
  '6748': '33.333333% 50%',
  '6749': '66.666667% 50%',
  '6750': '100% 50%',
  '6751': '0% 100%',
  '6752': '33.333333% 100%',
  '6753': '66.666667% 100%',
  '6754': '100% 100%',
}

export const getConstructionThumbnailStyle = (constructionId: string): CSSProperties | null => {
  const backgroundPosition = constructionThumbnailPositions[constructionId]
  if (!backgroundPosition) return null
  return { backgroundImage: `url(${showerThumbnailSprite})`, backgroundPosition }
}
