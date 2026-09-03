import type { ShowerHardwareItem } from './pricing'

const productImages: Record<string, string> = {
  '4607': 'https://av24.su/wa-data/public/shop/products/07/46/4607/images/12532/12532.750x0.jpg',
  '6230': 'https://av24.su/wa-data/public/shop/products/30/62/6230/images/41875/41875.750x0.jpg',
  '3966': 'https://av24.su/wa-data/public/shop/products/66/39/3966/images/43526/43526.750x0.jpg',
  '4039': 'https://av24.su/wa-data/public/shop/products/39/40/4039/images/43447/43447.750x0.jpg',
  '5260': 'https://av24.su/wa-data/public/shop/products/60/52/5260/images/26703/26703.750x0.jpg',
  '2917': 'https://av24.su/wa-data/public/shop/products/17/29/2917/images/34028/34028.750x0.PNG',
  '7679': 'https://av24.su/wa-data/public/shop/products/79/76/7679/images/33642/33642.750x0.jpg',
  '5567': 'https://av24.su/wa-data/public/shop/products/67/55/5567/images/18560/18560.750x0.jpg',
  '6291': 'https://av24.su/wa-data/public/shop/products/91/62/6291/images/22556/22556.750x0.jpg',
  '6683': 'https://av24.su/wa-data/public/shop/products/83/66/6683/images/25602/25602.750x0.jpg',
  '4697': 'https://av24.su/wa-data/public/shop/products/97/46/4697/images/30858/30858.750x0.jpg',
  '5559': 'https://av24.su/wa-data/public/shop/products/59/55/5559/images/18545/18545.750x0.jpg',
  '6930': 'https://av24.su/wa-data/public/shop/products/30/69/6930/images/33266/33266.750x0.jpg',
  '4609': 'https://av24.su/wa-data/public/shop/products/09/46/4609/images/13066/13066.750x0.jpg',
  '2910': 'https://av24.su/wa-data/public/shop/products/10/29/2910/images/9474/9474.750x0.jpg',
  '3997': 'https://av24.su/wa-data/public/shop/products/97/39/3997/images/8808/8808.750x0.jpg',
  '2963': 'https://av24.su/wa-data/public/shop/products/63/29/2963/images/43578/43578.750x0.jpg',
  '2955': 'https://av24.su/wa-data/public/shop/products/55/29/2955/images/43626/43626.750x0.jpg',
  '5564': 'https://av24.su/wa-data/public/shop/products/64/55/5564/images/18557/18557.750x0.jpg',
  '2952': 'https://av24.su/wa-data/public/shop/products/52/29/2952/images/50613/50613.750x0.JPG',
  '7245': 'https://av24.su/wa-data/public/shop/products/45/72/7245/images/30038/30038.750x0.jpg',
  '7247': 'https://av24.su/wa-data/public/shop/products/47/72/7247/images/30042/30042.750x0.jpg',
  '5811': 'https://av24.su/wa-data/public/shop/products/11/58/5811/images/47709/47709.750x0.jpeg',
  '5879': 'https://av24.su/wa-data/public/shop/products/79/58/5879/images/20699/20699.750x0.jpg',
}

const familyImages: Array<[string, string]> = [
  ['FDK-22', productImages['4607']],
  ['FDT-151', productImages['6230']],
  ['FDC-14', productImages['3966']],
  ['FDC-12', productImages['4039']],
  ['FDR-30', productImages['5260']],
  ['FDPP-10.1', productImages['2917']],
  ['FDPP-436.8', productImages['7679']],
  ['FDPP-402.8', productImages['5567']],
  ['FDPP-503.8', productImages['6291']],
  ['FDPA-58.25', productImages['6683']],
  ['FDP-115', productImages['4697']],
  ['FDPP-502.8', productImages['5559']],
  ['FDP-122', productImages['6930']],
  ['FDK-24', productImages['4609']],
  ['FDS-1', productImages['2910']],
  ['FDT-352', productImages['3997']],
  ['FDC-30', productImages['2963']],
  ['FDC-33', productImages['2955']],
  ['FDPP-407.8', productImages['5564']],
  ['FDC-35', productImages['2952']],
  ['FDK-27', productImages['7245']],
  ['FDK-28', productImages['7247']],
  ['FDPP-501.8', productImages['5811']],
  ['FDP-185', productImages['5879']],
]

export const getShowerHardwareImage = (item?: ShowerHardwareItem) => {
  if (!item) return undefined
  if (item.sourceProductId && productImages[item.sourceProductId]) return productImages[item.sourceProductId]
  const sku = item.sku?.trim().toLocaleUpperCase('ru') ?? ''
  return familyImages.find(([prefix]) => sku.startsWith(prefix))?.[1]
}
