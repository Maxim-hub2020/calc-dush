import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
})

try {
  const calculator = await server.ssrLoadModule('/src/calculator.ts')
  const mirrorCalculator = await server.ssrLoadModule('/src/mirrorCalculator.ts')
  const adminCalculation = await server.ssrLoadModule('/src/adminCalculation.ts')
  const { defaultCatalog } = await server.ssrLoadModule('/src/pricing.ts')
  const { defaultMirrorCatalog } = await server.ssrLoadModule('/src/mirrorPricing.ts')

  const clone = (value) => structuredClone(value)

  const mirrorCatalogWithoutMarkup = clone(defaultMirrorCatalog)
  mirrorCatalogWithoutMarkup.settings.materialMarkupPercent = 0
  mirrorCatalogWithoutMarkup.settings.serviceMarkupPercent = 0
  const mirrorCatalogWithMarkup = clone(mirrorCatalogWithoutMarkup)
  mirrorCatalogWithMarkup.settings.serviceMarkupPercent = 10
  const mirrorForm = mirrorCalculator.createInitialMirrorForm(mirrorCatalogWithoutMarkup)
  mirrorForm.options = [{ id: 'glue', serviceId: 'installation-glue', quantity: 1 }]

  const mirrorWithoutMarkup = mirrorCalculator.calculateMirrorQuote(mirrorCatalogWithoutMarkup, mirrorForm)
  const mirrorWithMarkup = mirrorCalculator.calculateMirrorQuote(mirrorCatalogWithMarkup, mirrorForm)
  const mirrorRawOption = mirrorCalculator.getMirrorCalculatedOptions(mirrorCatalogWithMarkup, mirrorForm)[0]
  const mirrorPricing = mirrorCalculator.getMirrorPricingComponents(mirrorCatalogWithMarkup, mirrorForm)
  assert.equal(mirrorRawOption.total, 2_112, 'Mirror workshop price must be geometry × base work price')
  assert.equal(
    mirrorCalculator.getMirrorCalculatedOptionSellingTotal(mirrorCatalogWithMarkup, mirrorRawOption),
    mirrorRawOption.total * 1.1,
    'Mirror client work price must include the configured work markup',
  )
  assert.ok(
    mirrorWithMarkup.installation > mirrorWithoutMarkup.installation,
    'Increasing mirror work markup must increase the client work amount',
  )
  assert.equal(
    adminCalculation.getMirrorCostPrice(mirrorCatalogWithMarkup, mirrorForm, mirrorWithMarkup),
    adminCalculation.getMirrorCostPrice(mirrorCatalogWithoutMarkup, mirrorForm, mirrorWithoutMarkup),
    'Mirror work markup must not inflate workshop cost',
  )
  const mirrorBreakdown = adminCalculation.buildMirrorCalculationBreakdown(
    mirrorCatalogWithMarkup,
    mirrorForm,
    1,
    mirrorWithMarkup,
  )
  assert.equal(mirrorBreakdown.finance.position.revenue, mirrorWithMarkup.total)
  assert.equal(mirrorPricing.total, mirrorWithMarkup.total)

  const discountedMirrorForm = { ...mirrorForm, discountEnabled: true, discountPercent: 10 }
  const discountedMirror = mirrorCalculator.calculateMirrorQuote(mirrorCatalogWithMarkup, discountedMirrorForm)
  assert.ok(discountedMirror.total < mirrorWithMarkup.total, 'Mirror discount must reduce revenue')
  assert.equal(
    adminCalculation.getMirrorCostPrice(mirrorCatalogWithMarkup, discountedMirrorForm, discountedMirror),
    adminCalculation.getMirrorCostPrice(mirrorCatalogWithMarkup, mirrorForm, mirrorWithMarkup),
    'Mirror discount must not reduce workshop cost',
  )

  let mirrorServiceChecks = 0
  for (const service of defaultMirrorCatalog.services.filter((item) => item.category === 'work')) {
    const form = mirrorCalculator.createInitialMirrorForm(defaultMirrorCatalog)
    form.options = [{ id: `check-${service.id}`, serviceId: service.id, quantity: 1 }]
    const option = mirrorCalculator.getMirrorCalculatedOptions(defaultMirrorCatalog, form)[0]
    const sellingTotal = mirrorCalculator.getMirrorCalculatedOptionSellingTotal(defaultMirrorCatalog, option)
    const expectedFactor = 1 + defaultMirrorCatalog.settings.serviceMarkupPercent / 100
    assert.equal(sellingTotal, option.total * expectedFactor, `${service.label}: work markup is inconsistent`)
    assert.equal(
      mirrorCalculator.getMirrorPricingComponents(defaultMirrorCatalog, form).rawWork,
      option.total,
      `${service.label}: raw workshop total is inconsistent`,
    )
    mirrorServiceChecks += 1
  }

  let mirrorGroupChecks = 0
  for (const group of defaultMirrorCatalog.groups) {
    const form = mirrorCalculator.createInitialMirrorForm(defaultMirrorCatalog)
    const selectionId = `check-${group.id}`
    form.groups = [{ id: selectionId, groupId: group.id }]
    const expected = mirrorCalculator.getMirrorCalculatedOptions(defaultMirrorCatalog, form)
      .filter((option) => option.groupSelectionId === selectionId)
      .reduce(
        (sum, option) => sum + mirrorCalculator.getMirrorCalculatedOptionSellingTotal(defaultMirrorCatalog, option),
        0,
      )
    assert.equal(
      mirrorCalculator.getMirrorCalculatedGroupSellingTotal(defaultMirrorCatalog, form, selectionId),
      expected,
      `${group.label}: group selling total is inconsistent`,
    )
    mirrorGroupChecks += 1
  }

  const showerCatalog = clone(defaultCatalog)
  showerCatalog.services.productMarkupPercent = 0
  showerCatalog.services.hardwareMarkupPercent = 0
  const showerForm = calculator.createInitialForm(showerCatalog)
  const showerWithoutMarkup = calculator.calculateQuote(showerCatalog, showerForm)

  const showerCatalogWithProductMarkup = clone(showerCatalog)
  showerCatalogWithProductMarkup.services.productMarkupPercent = 10
  const showerWithProductMarkup = calculator.calculateQuote(showerCatalogWithProductMarkup, showerForm)
  assert.ok(showerWithProductMarkup.total > showerWithoutMarkup.total, 'Shower product markup must increase revenue')
  assert.equal(
    adminCalculation.getShowerCostPrice(showerCatalogWithProductMarkup, showerForm, showerWithProductMarkup),
    adminCalculation.getShowerCostPrice(showerCatalog, showerForm, showerWithoutMarkup),
    'Shower product markup must not inflate cost',
  )

  const showerCatalogWithHardwareMarkup = clone(showerCatalog)
  showerCatalogWithHardwareMarkup.services.hardwareMarkupPercent = 10
  const showerWithHardwareMarkup = calculator.calculateQuote(showerCatalogWithHardwareMarkup, showerForm)
  assert.ok(showerWithHardwareMarkup.total > showerWithoutMarkup.total, 'Shower hardware markup must increase revenue')
  assert.equal(
    adminCalculation.getShowerCostPrice(showerCatalogWithHardwareMarkup, showerForm, showerWithHardwareMarkup),
    adminCalculation.getShowerCostPrice(showerCatalog, showerForm, showerWithoutMarkup),
    'Shower hardware markup must not inflate cost',
  )

  const installedForm = { ...showerForm, installation: true, complexInstallation: false }
  const installedResult = calculator.calculateQuote(showerCatalog, installedForm)
  const construction = calculator.getConstruction(showerCatalog, installedForm.constructionId)
  const standardInstallation = calculator.getInstallationAmounts(construction, installedForm)
  assert.equal(installedResult.installation, standardInstallation.price, 'Shower client installation price must be used')
  assert.ok(standardInstallation.cost < standardInstallation.price, 'Crew payout must be separate from client price')

  const complexForm = { ...installedForm, complexInstallation: true }
  const complexInstallation = calculator.getInstallationAmounts(construction, complexForm)
  assert.equal(complexInstallation.price, standardInstallation.price * 1.25)
  assert.equal(complexInstallation.cost, standardInstallation.cost * 1.25)

  const showerBreakdown = adminCalculation.buildShowerCalculationBreakdown(
    showerCatalog,
    complexForm,
    2,
    calculator.calculateQuote(showerCatalog, complexForm),
  )
  assert.equal(
    showerBreakdown.finance.position.revenue,
    calculator.calculateQuote(showerCatalog, complexForm).total * 2,
    'Shower admin revenue must match calculator total and quantity',
  )

  const discountedShowerForm = { ...installedForm, discountEnabled: true, discountPercent: 10 }
  const discountedShower = calculator.calculateQuote(showerCatalog, discountedShowerForm)
  assert.ok(discountedShower.total < installedResult.total, 'Shower discount must reduce revenue')
  assert.equal(
    adminCalculation.getShowerCostPrice(showerCatalog, discountedShowerForm, discountedShower),
    adminCalculation.getShowerCostPrice(showerCatalog, installedForm, installedResult),
    'Shower discount must not reduce material or crew cost',
  )

  const outsideDelivery = calculator.calculateQuoteDelivery(showerCatalog, {
    enabled: true,
    zone: 'outside',
    km: 10,
  })
  assert.equal(
    outsideDelivery,
    calculator.roundMoneyUp(showerCatalog.services.deliveryBase + showerCatalog.services.deliveryKmRate * 10),
    'Outside delivery must include the city base plus distance',
  )

  let showerCombinationChecks = 0
  for (const construction of defaultCatalog.constructions) {
    for (const glass of defaultCatalog.glass.filter((item) => item.thickness === 6 || item.thickness === 8)) {
      const form = calculator.createInitialForm(defaultCatalog)
      form.constructionId = construction.id
      form.dimensions = calculator.resetDimensionsForConstruction(construction)
      form.glassId = glass.id

      const result = calculator.calculateQuote(defaultCatalog, form)
      const cost = adminCalculation.getShowerCostPrice(defaultCatalog, form, result)
      assert.equal(Object.keys(result.errors).length, 0, `${construction.title}, ${glass.label}: unexpected errors`)
      assert.ok(Number.isFinite(result.total) && result.total >= 0, `${construction.title}, ${glass.label}: invalid total`)
      assert.ok(Number.isFinite(cost) && cost >= 0, `${construction.title}, ${glass.label}: invalid cost`)

      const productMarkupCatalog = clone(defaultCatalog)
      productMarkupCatalog.services.productMarkupPercent += 10
      const productMarkupResult = calculator.calculateQuote(productMarkupCatalog, form)
      assert.ok(
        productMarkupResult.total >= result.total,
        `${construction.title}, ${glass.label}: product markup reduced the total`,
      )

      const hardwareMarkupCatalog = clone(defaultCatalog)
      hardwareMarkupCatalog.services.hardwareMarkupPercent += 10
      const hardwareMarkupResult = calculator.calculateQuote(hardwareMarkupCatalog, form)
      assert.ok(
        hardwareMarkupResult.total >= result.total,
        `${construction.title}, ${glass.label}: hardware markup reduced the total`,
      )

      const installed = { ...form, installation: true, complexInstallation: false }
      const installation = calculator.getInstallationAmounts(construction, installed)
      const installedResult = calculator.calculateQuote(defaultCatalog, installed)
      assert.equal(
        installedResult.installation,
        installation.price,
        `${construction.title}, ${glass.label}: installation selling price is inconsistent`,
      )
      assert.ok(
        installation.cost <= installation.price,
        `${construction.title}, ${glass.label}: crew payout exceeds client installation price`,
      )
      showerCombinationChecks += 1
    }
  }

  console.log(
    `Pricing calculations validated: ${mirrorServiceChecks} mirror services, `
      + `${mirrorGroupChecks} mirror groups, ${showerCombinationChecks} shower combinations`,
  )
} finally {
  await server.close()
}
