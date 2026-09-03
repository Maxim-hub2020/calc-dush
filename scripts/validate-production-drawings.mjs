import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  server: { middlewareMode: true, hmr: false },
})

const distanceToVerticalEdge = (panel, operation) => Math.min(
  operation.xMm,
  panel.widthMm - operation.xMm,
)

try {
  const { defaultCatalog } = await server.ssrLoadModule('/src/pricing.ts')
  const { createInitialForm } = await server.ssrLoadModule('/src/calculator.ts')
  const { createProductionPackage } = await server.ssrLoadModule('/src/productionPlanning.ts')

  const packages = defaultCatalog.constructions.map((construction) => {
    const form = createInitialForm(defaultCatalog)
    form.constructionId = construction.id
    form.dimensions = Object.fromEntries(
      construction.fields.map((field) => [field.key, field.defaultValue]),
    )
    return createProductionPackage(defaultCatalog, form, '0001', 0)
  })

  packages.forEach((draft) => assert.deepEqual(
    draft.blockingIssues,
    [],
    `${draft.constructionTitle}: default 8 mm package must be production-ready`,
  ))

  const operations = packages.flatMap((draft) => draft.panels.flatMap((panel) => (
    panel.operations.map((operation) => ({ panel, operation }))
  )))
  const bySku = (sku) => operations.filter(({ operation }) => operation.sourceSku.startsWith(sku))

  operations.forEach(({ operation }) => assert.match(
    operation.sourceUrl ?? '',
    /^https:\/\/av24\.su\//,
    `${operation.sourceSku}: every machining operation must reference AV24`,
  ))

  bySku('FDP-122').forEach(({ panel, operation }) => {
    assert.equal(operation.diameterMm, 16)
    assert.equal(distanceToVerticalEdge(panel, operation), 34)
  })
  bySku('FDP-115').forEach(({ panel, operation }) => {
    assert.equal(operation.diameterMm, 14)
    assert.equal(distanceToVerticalEdge(panel, operation), 32)
  })
  for (const sku of ['FDK-22', 'FDK-27', 'FDK-28']) {
    bySku(sku).forEach(({ operation }) => {
      assert.equal(operation.widthMm, 32)
      assert.equal(operation.heightMm, 20)
      assert.equal(operation.radiusMm, 10)
      assert.equal(operation.straightDepthMm, 22)
    })
  }
  bySku('FDR-30').forEach(({ panel, operation }) => {
    assert.equal(operation.diameterMm, 10)
    assert.equal(distanceToVerticalEdge(panel, operation), 50)
  })

  const fdp185 = bySku('FDP-185')
  assert.ok(fdp185.some(({ operation }) => operation.radiusMm === 15 && operation.widthMm === 40))
  assert.ok(fdp185.some(({ operation }) => operation.radiusMm === 9 && operation.widthMm === 16))

  const fds1 = bySku('FDS-1')
  for (const diameter of [10, 14, 16, 48]) {
    assert.ok(fds1.some(({ operation }) => operation.diameterMm === diameter))
  }

  const sixMillimeterBlocked = defaultCatalog.constructions.filter((construction) => {
    const form = createInitialForm(defaultCatalog)
    const glass = defaultCatalog.glass.find((option) => option.thickness === 6)
    form.constructionId = construction.id
    form.dimensions = Object.fromEntries(
      construction.fields.map((field) => [field.key, field.defaultValue]),
    )
    if (glass) form.glassId = glass.id
    return createProductionPackage(defaultCatalog, form, '0001', 0).blockingIssues.length > 0
  }).length

  console.log(JSON.stringify({
    packages: packages.length,
    verifiedOperations: operations.length,
    sixMillimeterBlocked,
  }))
} finally {
  await server.close()
}
