export const roundMoneyUp = (value: unknown) => {
  const amount = Math.max(0, Number(value) || 0)
  return Math.ceil(amount / 100) * 100
}
